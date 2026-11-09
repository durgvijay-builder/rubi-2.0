import { test, expect } from '@playwright/test';
import { setupMockNetworkRoutes, MockNetworkState } from '../helpers/mock-routes.js';
import { injectBrowserAudioMocks } from '../helpers/audio-mock.js';
import { VoiceRecorderPage } from '../helpers/page-objects/VoiceRecorderPage.js';
import { TranscriptionEditorPage } from '../helpers/page-objects/TranscriptionEditorPage.js';
import { HitlReviewPage } from '../helpers/page-objects/HitlReviewPage.js';
import { TaskBoardPage } from '../helpers/page-objects/TaskBoardPage.js';
import { ActivityTimelinePage } from '../helpers/page-objects/ActivityTimelinePage.js';
import { SYNTHETIC_SPEECH_MOCK_WAV } from '../fixtures/audio-tones.js';
import { TRANSCRIPT_FIXTURES } from '../fixtures/transcripts.js';

test.describe('Tier 3: Cross-Feature Combinations — Full Voice-to-Action Execution Pipeline', () => {
  let state: MockNetworkState;

  test.beforeEach(async ({ page }) => {
    state = new MockNetworkState();
    await setupMockNetworkRoutes(page, state);
    await injectBrowserAudioMocks(page);
  });

  test('TC-CROSS-01: Full user journey: voice recording -> STT -> transcript edit -> Gemini extraction -> DAG cycle validation -> HITL review -> DB persistence -> Timbre TTS confirmation -> Activity history logging -> Dependency unblocking', async ({
    page,
  }) => {
    const recorder = new VoiceRecorderPage(page);
    const editor = new TranscriptionEditorPage(page);
    const hitl = new HitlReviewPage(page);
    const board = new TaskBoardPage(page);
    const timeline = new ActivityTimelinePage(page);

    // ==========================================
    // STAGE 1: Audio Capture & Voice Recording
    // ==========================================
    await recorder.goto();

    // Set mock transcript to the English dependency fixture
    const meetingFixture = TRANSCRIPT_FIXTURES.EN_WITH_DEPENDENCY!;
    await page.setExtraHTTPHeaders({
      'x-mock-transcript': encodeURIComponent(meetingFixture.transcript),
    });

    await recorder.startRecording();
    await recorder.assertTimerActive();
    await recorder.stopRecording();

    // ==========================================
    // STAGE 2: STT Transcription & Review Edit
    // ==========================================
    await editor.assertTranscriptContains('PostgreSQL database');

    // Perform minor human correction before AI extraction
    await editor.appendTranscript('Ensure SSL encryption is enabled.');

    // ==========================================
    // STAGE 3: Semantic Extraction & DAG Cycle Check
    // ==========================================
    await editor.triggerExtraction();

    // 2 tasks extracted with a dependency relationship:
    // Task 1: "Set up PostgreSQL database"
    // Task 2: "Implement API integration endpoints" (depends on Task 1)
    await hitl.assertCandidateCount(2);

    // Verify token usage telemetry
    await hitl.assertTokenTelemetryVisible();

    // ==========================================
    // STAGE 4: Human-in-the-Loop Review & Edit
    // ==========================================
    // Edit the assignee of the first task
    await hitl.editCandidateAssignee(0, 'Lead Backend Engineer');

    // Approve all valid tasks
    await hitl.batchApproveAll();

    // ==========================================
    // STAGE 5: Database Persistence & Dependency Blocking
    // ==========================================
    // Verify tasks are persisted in PostgreSQL state via API query
    const tasksRes = await page.request.get('/api/tasks');
    const tasksData = await tasksRes.json();
    const createdTasks = tasksData.tasks.filter(
      (t: any) => t.title === 'Set up PostgreSQL database' || t.title === 'Implement API integration endpoints'
    );
    expect(createdTasks.length).toBe(2);

    const dbTask = createdTasks.find((t: any) => t.title === 'Set up PostgreSQL database')!;
    const apiTask = createdTasks.find((t: any) => t.title === 'Implement API integration endpoints')!;

    // dbTask has no dependencies -> should be TO_DO
    expect(dbTask.status).toBe('TO_DO');

    // apiTask depends on dbTask -> should be automatically BLOCKED!
    expect(apiTask.status).toBe('BLOCKED');
    expect(apiTask.dependencies).toContain(dbTask.id);

    // ==========================================
    // STAGE 6: Spoken Confirmation (Timbre TTS)
    // ==========================================
    const ttsRes = await page.request.post('/api/speech/synthesize', {
      data: {
        text: 'Tasks approved and saved to backlog. API integration is blocked by PostgreSQL setup.',
        voice: 'Shivani',
      },
    });
    const ttsData = await ttsRes.json();
    expect(ttsData.spokenText).toContain('Tasks approved');

    // ==========================================
    // STAGE 7: Immutable Activity Event Logging
    // ==========================================
    const actRes = await page.request.get('/api/activities');
    const actData = await actRes.json();
    const approvalEvents = actData.activities.filter((a: any) => a.eventType === 'TASK_APPROVED');
    expect(approvalEvents.length).toBeGreaterThanOrEqual(2);

    const depEvents = actData.activities.filter((a: any) => a.eventType === 'DEPENDENCY_ADDED');
    expect(depEvents.length).toBeGreaterThanOrEqual(1);

    // ==========================================
    // STAGE 8: Automated Dependency Unblocking Cascade
    // ==========================================
    // When dbTask is marked COMPLETED, apiTask should transition from BLOCKED -> TO_DO
    await page.request.patch(`/api/tasks/${dbTask.id}`, {
      data: { status: 'COMPLETED' },
    });

    const verifyRes = await page.request.get('/api/tasks');
    const verifyData = await verifyRes.json();
    const updatedApiTask = verifyData.tasks.find((t: any) => t.id === apiTask.id);
    expect(updatedApiTask?.status).toBe('TO_DO');

    // Verify unblocking activity was recorded
    const unblockActRes = await page.request.get('/api/activities');
    const unblockActData = await unblockActRes.json();
    const unblockActivity = unblockActData.activities.find(
      (a: any) => a.eventType === 'TASK_STATUS_CHANGED' && a.taskId === apiTask.id && a.newState?.status === 'TO_DO'
    );
    expect(unblockActivity).toBeDefined();
  });
});
