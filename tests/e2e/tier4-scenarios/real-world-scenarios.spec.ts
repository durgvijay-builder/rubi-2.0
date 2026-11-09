import { test, expect } from '@playwright/test';
import { setupMockNetworkRoutes, MockNetworkState } from '../helpers/mock-routes.js';
import { injectBrowserAudioMocks } from '../helpers/audio-mock.js';
import { VoiceRecorderPage } from '../helpers/page-objects/VoiceRecorderPage.js';
import { TranscriptionEditorPage } from '../helpers/page-objects/TranscriptionEditorPage.js';
import { HitlReviewPage } from '../helpers/page-objects/HitlReviewPage.js';
import { TaskBoardPage } from '../helpers/page-objects/TaskBoardPage.js';
import { BasePage } from '../helpers/page-objects/BasePage.js';
import { SYNTHETIC_SPEECH_MOCK_WAV } from '../fixtures/audio-tones.js';
import { TRANSCRIPT_FIXTURES } from '../fixtures/transcripts.js';

test.describe('Tier 4: Real-World Application Scenarios', () => {
  let state: MockNetworkState;

  test.beforeEach(async ({ page }) => {
    state = new MockNetworkState();
    await setupMockNetworkRoutes(page, state);
    await injectBrowserAudioMocks(page);
  });

  test('SCENARIO-A: Multi-task sprint planning meeting in code-switched Hinglish with 3 distinct tasks and cross-dependencies', async ({
    page,
  }) => {
    const recorder = new VoiceRecorderPage(page);
    const editor = new TranscriptionEditorPage(page);
    const review = new HitlReviewPage(page);
    const board = new TaskBoardPage(page);

    await recorder.goto();

    // Upload Hinglish sprint planning audio
    const fixture = TRANSCRIPT_FIXTURES.HINGLISH_MULTI_TASK_MEETING!;
    await page.setExtraHTTPHeaders({
      'x-mock-transcript': encodeURIComponent(fixture.transcript),
    });

    await recorder.uploadAudioBuffer(SYNTHETIC_SPEECH_MOCK_WAV, 'hinglish-sprint-meeting.wav', 'audio/wav');

    // Confirm transcript is extracted
    await editor.assertTranscriptContains('Kal subah 10 baje sprint planning meeting');
    await editor.triggerExtraction();

    // Verify 3 distinct candidate tasks in review deck
    await review.assertCandidateCount(3);

    // Verify task details extracted from Hinglish conversation
    await review.assertCandidateTitle(0, /architecture document/i);
    await review.assertCandidateAssignee(0, /Durgvijay/i);
    await review.assertCandidateTitle(1, /sprint planning/i);
    await review.assertCandidateTitle(2, /frontend dashboard/i);

    // User approves all 3 tasks
    await review.batchApproveAll();

    // Assert tasks appear on task board
    await board.assertTaskExists('Complete system architecture document');
    await board.assertTaskExists('Conduct sprint planning meeting');
    await board.assertTaskExists('Implement frontend dashboard integration');
  });

  test('SCENARIO-B: Mid-sprint scope change — dynamic task re-prioritization and postponement with TTS spoken confirmation', async ({
    page,
  }) => {
    const board = new TaskBoardPage(page);
    await board.goto();

    const targetTitle = 'Deploy native PostgreSQL 18.6 container';

    // Find task ID from API
    const tasksRes = await page.request.get('/api/tasks');
    const tasksData = await tasksRes.json();
    const task = tasksData.tasks.find((t: any) => t.title === targetTitle)!;

    // Reprioritize to CRITICAL and postpone deadline
    const newDeadline = '2026-11-16T18:00:00.000Z';
    const patchRes = await page.request.patch(`/api/tasks/${task.id}`, {
      data: {
        priority: 'CRITICAL',
        deadline: newDeadline,
      },
    });

    expect(patchRes.ok()).toBe(true);
    const patchData = await patchRes.json();
    expect(patchData.task.priority).toBe('CRITICAL');
    expect(patchData.task.deadline).toBe(newDeadline);

    // Generate spoken TTS confirmation
    const ttsRes = await page.request.post('/api/speech/synthesize', {
      data: {
        text: 'Task prioritized to Critical and postponed to November 16th.',
        voice: 'Avinash',
      },
    });
    const ttsData = await ttsRes.json();
    expect(ttsData.spokenText).toContain('Task prioritized to Critical');

    // Verify activity event was recorded for postponement/edit
    const actRes = await page.request.get('/api/activities');
    const actData = await actRes.json();
    const editActivity = actData.activities.find((a: any) => a.taskId === task.id);
    expect(editActivity).toBeDefined();
  });

  test('SCENARIO-C: Multi-member workflow — dependency unblocking cascade across backend, frontend, and QA', async ({
    page,
  }) => {
    // Commit 3 chained tasks via API:
    // Task 1: Backend API
    // Task 2: Frontend Client (depends on Task 1)
    // Task 3: QA Automation (depends on Task 2)
    const createRes = await page.request.post('/api/tasks', {
      data: {
        tasks: [
          {
            tempId: 'temp-chain-1',
            title: 'Develop REST API Endpoints',
            priority: 'HIGH',
            dependencies: [],
            owner: 'Backend Dev',
            status: 'TO_DO',
          },
          {
            tempId: 'temp-chain-2',
            title: 'Integrate Client Dashboard Views',
            priority: 'HIGH',
            dependencies: ['temp-chain-1'],
            owner: 'Frontend Dev',
            status: 'BLOCKED',
          },
          {
            tempId: 'temp-chain-3',
            title: 'Execute End-to-End QA Automation',
            priority: 'HIGH',
            dependencies: ['temp-chain-2'],
            owner: 'QA Tester',
            status: 'BLOCKED',
          },
        ],
      },
    });

    expect(createRes.ok()).toBe(true);
    const createdData = await createRes.json();
    const task1 = createdData.tasks.find((t: any) => t.title === 'Develop REST API Endpoints')!;
    const task2 = createdData.tasks.find((t: any) => t.title === 'Integrate Client Dashboard Views')!;
    const task3 = createdData.tasks.find((t: any) => t.title === 'Execute End-to-End QA Automation')!;

    expect(task1.status).toBe('TO_DO');
    expect(task2.status).toBe('BLOCKED');
    expect(task3.status).toBe('BLOCKED');

    // Step 1: Backend dev marks Task 1 COMPLETED -> Task 2 should unblock to TO_DO, Task 3 remains BLOCKED
    await page.request.patch(`/api/tasks/${task1.id}`, {
      data: { status: 'COMPLETED' },
    });

    const verifyRes1 = await page.request.get('/api/tasks');
    const verifyData1 = await verifyRes1.json();
    const updatedTask2 = verifyData1.tasks.find((t: any) => t.id === task2.id);
    const updatedTask3 = verifyData1.tasks.find((t: any) => t.id === task3.id);

    expect(updatedTask2.status).toBe('TO_DO');
    expect(updatedTask3.status).toBe('BLOCKED');

    // Step 2: Frontend dev marks Task 2 COMPLETED -> Task 3 unblocks to TO_DO
    await page.request.patch(`/api/tasks/${task2.id}`, {
      data: { status: 'COMPLETED' },
    });

    const verifyRes2 = await page.request.get('/api/tasks');
    const verifyData2 = await verifyRes2.json();
    const finalTask3 = verifyData2.tasks.find((t: any) => t.id === task3.id);

    expect(finalTask3.status).toBe('TO_DO');
  });

  test('SCENARIO-D: Viewport responsiveness matrix across Mobile (320px, 375px, 430px) and Desktop (1280px)', async ({
    page,
  }) => {
    const base = new BasePage(page);

    const testViewports = [
      { name: 'Minimal Mobile (iPhone SE 1st gen)', width: 320, height: 568 },
      { name: 'Standard Mobile (iPhone 12/13/14 mini)', width: 375, height: 667 },
      { name: 'Large Mobile (iPhone 14/15/16 Pro Max)', width: 430, height: 932 },
      { name: 'Desktop HD', width: 1280, height: 800 },
    ];

    for (const vp of testViewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await base.goto();

      // Zero horizontal scrollbar requirement across all devices
      await base.assertNoHorizontalOverflow();
    }
  });
});
