import { test, expect } from '@playwright/test';
import { setupMockNetworkRoutes, MockNetworkState } from '../helpers/mock-routes.js';
import { injectBrowserAudioMocks } from '../helpers/audio-mock.js';
import { TranscriptionEditorPage } from '../helpers/page-objects/TranscriptionEditorPage.js';
import { HitlReviewPage } from '../helpers/page-objects/HitlReviewPage.js';
import { TRANSCRIPT_FIXTURES } from '../fixtures/transcripts.js';

test.describe('Tier 1: Feature Coverage - Semantic Understanding & Intent Routing (R3)', () => {
  let state: MockNetworkState;

  test.beforeEach(async ({ page }) => {
    state = new MockNetworkState();
    await setupMockNetworkRoutes(page, state);
    await injectBrowserAudioMocks(page);
  });

  test('TC-EXTRACT-01: Gemini structured extraction converts conversation into Zod-compliant candidate tasks', async ({
    page,
  }) => {
    const editor = new TranscriptionEditorPage(page);
    const review = new HitlReviewPage(page);

    await editor.goto();

    // Populate transcript with multi-task fixture
    const fixture = TRANSCRIPT_FIXTURES.HINGLISH_MULTI_TASK_MEETING!;
    await editor.editTranscript(fixture.transcript);

    // Trigger extraction
    await editor.triggerExtraction();

    // Verify candidate cards are extracted and rendered in review deck
    await review.assertCandidateCount(3);
    await review.assertCandidateTitle(0, /architecture document/i);
  });

  test('TC-EXTRACT-02: Deterministic Intent Router executes direct status completion command bypassing LLM (zero token cost)', async ({
    page,
  }) => {
    const editor = new TranscriptionEditorPage(page);
    await editor.goto();

    // Submit direct status command
    const directCmd = 'Mark task #3 as completed.';
    await editor.editTranscript(directCmd);
    await editor.triggerExtraction();

    // Verify that task was directly updated on server and LLM was bypassed
    const tasksRes = await page.request.get('/api/tasks');
    const tasksData = await tasksRes.json();
    const targetTask = tasksData.tasks.find((t: any) => t.id === 'task-seed-3');
    expect(targetTask?.status).toBe('COMPLETED');

    // Verify activity event was logged with bypassLLM flag
    const actRes = await page.request.get('/api/activities');
    const actData = await actRes.json();
    const statusActivity = actData.activities.find((a: any) => a.eventType === 'TASK_STATUS_CHANGED' && a.taskId === 'task-seed-3');
    expect(statusActivity).toBeDefined();
    expect(statusActivity?.metadata?.bypassLLM).toBe(true);
  });

  test('TC-EXTRACT-03: Intent Router deterministically handles backlog queries without calling Gemini', async ({
    page,
  }) => {
    const editor = new TranscriptionEditorPage(page);
    await editor.goto();

    const queryCmd = 'Show all pending tasks in the backlog.';
    await editor.editTranscript(queryCmd);
    await editor.triggerExtraction();

    // Assert API response returned 0 tokens used
    const response = await page.request.post('/api/extract', {
      data: { transcript: queryCmd },
    });
    const payload = await response.json();
    expect(payload.bypassLLM).toBe(true);
    expect(payload.intent).toBe('LIST_TASKS');
    expect(payload.tokensUsed.totalTokens).toBe(0);
  });

  test('TC-EXTRACT-04: Ambiguity detection highlights tasks with unspecified owner or missing deadline', async ({
    page,
  }) => {
    const editor = new TranscriptionEditorPage(page);
    const review = new HitlReviewPage(page);

    await editor.goto();

    // Transcript with missing owner
    const ambigFixture = TRANSCRIPT_FIXTURES.EN_AMBIGUOUS_NO_OWNER!;
    await editor.editTranscript(ambigFixture.transcript);
    await editor.triggerExtraction();

    // Review card should display ambiguity warning
    await review.assertCandidateCount(1);
    await review.assertAmbiguityWarningPresent();
  });

  test('TC-EXTRACT-05: Token usage and estimated USD cost telemetry is accounted and displayed', async ({
    page,
  }) => {
    const editor = new TranscriptionEditorPage(page);
    const review = new HitlReviewPage(page);

    await editor.goto();
    await editor.editTranscript(TRANSCRIPT_FIXTURES.HINGLISH_MULTI_TASK_MEETING!.transcript);
    await editor.triggerExtraction();

    // Verify token and cost telemetry display
    await review.assertTokenTelemetryVisible();
  });
});
