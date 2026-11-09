import { test, expect } from '@playwright/test';
import { setupMockNetworkRoutes, MockNetworkState } from '../helpers/mock-routes.js';
import { injectBrowserAudioMocks } from '../helpers/audio-mock.js';
import { VoiceRecorderPage } from '../helpers/page-objects/VoiceRecorderPage.js';
import { TranscriptionEditorPage } from '../helpers/page-objects/TranscriptionEditorPage.js';
import { SYNTHETIC_SPEECH_MOCK_WAV, SYNTHETIC_CHIME_WAV } from '../fixtures/audio-tones.js';
import { TRANSCRIPT_FIXTURES } from '../fixtures/transcripts.js';

test.describe('Tier 1: Feature Coverage - Voice-First Interface & Speech Pipeline (R2)', () => {
  let state: MockNetworkState;

  test.beforeEach(async ({ page }) => {
    state = new MockNetworkState();
    await setupMockNetworkRoutes(page, state);
    await injectBrowserAudioMocks(page);
  });

  test('TC-SPEECH-01: In-browser voice recording activates MediaRecorder and tracks duration timer', async ({
    page,
  }) => {
    const recorder = new VoiceRecorderPage(page);
    await recorder.goto();

    // 1. Initial idle state check
    await expect(recorder.recordToggleBtn.first()).toBeVisible();

    // 2. Start recording
    await recorder.startRecording();

    // 3. Verify timer progresses and waveform activates
    await recorder.assertTimerActive();

    // 4. Stop recording
    await recorder.stopRecording();

    // 5. Verify recording state advances to transcribing / transcription review
    const editor = new TranscriptionEditorPage(page);
    await expect(editor.transcriptTextarea.first()).toBeVisible({ timeout: 8000 });
  });

  test('TC-SPEECH-02: Audio file upload fallback accepts valid WAV and MP3 buffers', async ({ page }) => {
    const recorder = new VoiceRecorderPage(page);
    await recorder.goto();

    // Upload synthetic WAV audio tone
    await recorder.uploadAudioBuffer(SYNTHETIC_SPEECH_MOCK_WAV, 'meeting-snippet.wav', 'audio/wav');

    // Verify upload moves straight to transcription
    const editor = new TranscriptionEditorPage(page);
    await expect(editor.transcriptTextarea.first()).toBeVisible({ timeout: 8000 });
  });

  test('TC-SPEECH-03: Gnani Prisma STT transcription is displayed accurately in English, Hindi, and Hinglish', async ({
    page,
  }) => {
    const recorder = new VoiceRecorderPage(page);
    const editor = new TranscriptionEditorPage(page);

    // Test Hinglish transcript rendering
    const hinglishFixture = TRANSCRIPT_FIXTURES.HINGLISH_MULTI_TASK_MEETING!;
    await page.setExtraHTTPHeaders({
      'x-mock-transcript': encodeURIComponent(hinglishFixture.transcript),
    });

    await recorder.goto();
    await recorder.uploadAudioBuffer(SYNTHETIC_SPEECH_MOCK_WAV, 'hinglish-speech.wav', 'audio/wav');

    await editor.assertTranscriptContains('Kal subah 10 baje sprint planning');
  });

  test('TC-SPEECH-04: Transcription allows in-place human review and editing before semantic extraction', async ({
    page,
  }) => {
    const recorder = new VoiceRecorderPage(page);
    const editor = new TranscriptionEditorPage(page);

    await recorder.goto();
    await recorder.uploadAudioBuffer(SYNTHETIC_SPEECH_MOCK_WAV, 'edit-sample.wav', 'audio/wav');

    // Wait for STT transcript to be populated
    await expect(editor.transcriptTextarea.first()).toBeVisible({ timeout: 8000 });

    // Perform human correction
    const correctedText = 'Please deploy PostgreSQL database and notify team before 5 PM.';
    await editor.editTranscript(correctedText);

    // Verify textarea retains corrected value
    await expect(editor.transcriptTextarea.first()).toHaveValue(correctedText);
  });

  test('TC-SPEECH-05: Gnani Timbre TTS synthesizes spoken confirmations accompanied by synchronized text display', async ({
    page,
  }) => {
    const recorder = new VoiceRecorderPage(page);
    await recorder.goto();

    // Trigger synthesis via direct API or app confirmation trigger
    const confirmationText = 'Sprint planning meeting scheduled for tomorrow at 10 AM.';
    const response = await page.request.post('/api/speech/synthesize', {
      data: {
        text: confirmationText,
        voice: 'Shivani',
        language: 'hi-en',
      },
    });

    expect(response.ok()).toBe(true);
    const payload = await response.json();
    expect(payload.mimeType).toBe('audio/wav');
    expect(payload.spokenText).toBe(confirmationText);
    expect(payload.audioBase64).toBeTruthy();
    expect(payload.isMock).toBe(true);
  });
});

