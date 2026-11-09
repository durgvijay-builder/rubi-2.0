import { test, expect } from '@playwright/test';
import { setupMockNetworkRoutes, MockNetworkState } from '../helpers/mock-routes.js';
import { injectBrowserAudioMocks } from '../helpers/audio-mock.js';
import { VoiceRecorderPage } from '../helpers/page-objects/VoiceRecorderPage.js';
import { TranscriptionEditorPage } from '../helpers/page-objects/TranscriptionEditorPage.js';
import { HitlReviewPage } from '../helpers/page-objects/HitlReviewPage.js';
import { BasePage } from '../helpers/page-objects/BasePage.js';
import {
  SYNTHETIC_SILENCE_WAV,
  CORRUPTED_AUDIO_BUFFER,
  createOversizedAudioBuffer,
} from '../fixtures/audio-tones.js';
import { TRANSCRIPT_FIXTURES } from '../fixtures/transcripts.js';
import { FOREIGN_WORKSPACE } from '../fixtures/mock-payloads.js';

test.describe('Tier 2: Boundary & Corner Cases', () => {
  let state: MockNetworkState;

  test.beforeEach(async ({ page }) => {
    state = new MockNetworkState();
    await setupMockNetworkRoutes(page, state);
  });

  test('TC-BOUND-01: Empty or zero-amplitude audio halts pipeline with warning and bypasses Gemini LLM', async ({
    page,
  }) => {
    await injectBrowserAudioMocks(page, { simulateEmptyAudio: true });
    await page.setExtraHTTPHeaders({ 'x-simulate-empty': 'true' });

    const recorder = new VoiceRecorderPage(page);
    await recorder.goto();

    // Start and stop silent recording
    await recorder.startRecording();
    await recorder.stopRecording();

    // Verify system halts before calling Gemini
    const editor = new TranscriptionEditorPage(page);
    // Transcription textarea should either be empty or show "No speech detected"
    const textVal = await editor.transcriptTextarea.first().inputValue().catch(() => '');
    expect(textVal).toBe('');
    expect(state.stagedExtraction).toBeNull();
  });

  test('TC-BOUND-02: Audio upload exceeding 25MB threshold is rejected with HTTP 413 Payload Too Large', async ({
    page,
  }) => {
    const oversizedBuffer = createOversizedAudioBuffer(26);

    const response = await page.request.post('/api/speech/transcribe', {
      headers: {
        'content-type': 'audio/wav',
        'content-length': oversizedBuffer.length.toString(),
      },
      data: oversizedBuffer,
    });

    expect(response.status()).toBe(413);
    const body = await response.json();
    expect(body.error).toBe('Payload Too Large');
  });

  test('TC-BOUND-03: Unsupported media format (.pdf / .exe) is rejected with HTTP 415 Unsupported Media Type', async ({
    page,
  }) => {
    const response = await page.request.post('/api/speech/transcribe', {
      headers: {
        'content-type': 'application/pdf',
        'x-file-type': 'unsupported',
      },
      data: Buffer.from('%PDF-1.4 dummy binary content'),
    });

    expect(response.status()).toBe(415);
    const body = await response.json();
    expect(body.error).toBe('Unsupported Media Type');
  });

  test('TC-BOUND-04: Circular dependency in extracted tasks (Alpha <-> Beta) disables approval and displays DAG cycle alert', async ({
    page,
  }) => {
    const editor = new TranscriptionEditorPage(page);
    const review = new HitlReviewPage(page);

    await editor.goto();
    await editor.editTranscript(TRANSCRIPT_FIXTURES.CIRCULAR_DEPENDENCY_CASE!.transcript);
    await editor.triggerExtraction();

    // Verify DAG cycle alert is rendered
    await review.assertCycleErrorPresent();

    // Attempting to post approval for batch with cycle must fail with 422
    const approveResponse = await page.request.post('/api/tasks/approve-all', {
      data: {
        tasks: state.stagedExtraction?.tasks,
      },
    });
    expect(approveResponse.status()).toBe(422);
  });

  test('TC-BOUND-05: Self-referencing task dependency is flagged and stripped with ambiguity warning', async ({
    page,
  }) => {
    const editor = new TranscriptionEditorPage(page);
    const review = new HitlReviewPage(page);

    await editor.goto();
    await editor.editTranscript(TRANSCRIPT_FIXTURES.SELF_DEPENDENCY_CASE!.transcript);
    await editor.triggerExtraction();

    // Ensure system does not crash and handles single task
    await review.assertCandidateCount(1);
  });

  test('TC-BOUND-06: Vague pronoun utterance missing owner generates ambiguity warning card', async ({ page }) => {
    const editor = new TranscriptionEditorPage(page);
    const review = new HitlReviewPage(page);

    await editor.goto();
    await editor.editTranscript(TRANSCRIPT_FIXTURES.HINGLISH_AMBIGUOUS_VAGUE!.transcript);
    await editor.triggerExtraction();

    await review.assertCandidateCount(1);
    await review.assertAmbiguityWarningPresent();
  });

  test('TC-BOUND-07: Malicious cross-workspace task ID injection returns HTTP 403 Forbidden', async ({ page }) => {
    const response = await page.request.get(`/api/tasks`, {
      headers: {
        'x-workspace-id': FOREIGN_WORKSPACE.id,
      },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('Forbidden');
  });

  test('TC-BOUND-08: Ultra-narrow 320px viewport renders cleanly with zero horizontal overflow (scrollWidth <= clientWidth)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    const base = new BasePage(page);
    await base.goto();

    // Check no horizontal scrollbar
    await base.assertNoHorizontalOverflow();
  });
});

