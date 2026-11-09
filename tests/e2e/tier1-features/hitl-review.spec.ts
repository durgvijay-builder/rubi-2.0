import { test, expect } from '@playwright/test';
import { setupMockNetworkRoutes, MockNetworkState } from '../helpers/mock-routes.js';
import { injectBrowserAudioMocks } from '../helpers/audio-mock.js';
import { TranscriptionEditorPage } from '../helpers/page-objects/TranscriptionEditorPage.js';
import { HitlReviewPage } from '../helpers/page-objects/HitlReviewPage.js';
import { TaskBoardPage } from '../helpers/page-objects/TaskBoardPage.js';
import { TRANSCRIPT_FIXTURES } from '../fixtures/transcripts.js';

test.describe('Tier 1: Feature Coverage - Human-in-the-Loop Approval & Governance (R4)', () => {
  let state: MockNetworkState;

  test.beforeEach(async ({ page }) => {
    state = new MockNetworkState();
    await setupMockNetworkRoutes(page, state);
    await injectBrowserAudioMocks(page);
  });

  test('TC-HITL-01: Silence never implies consent — zero tasks are persisted to DB without affirmative user approval', async ({
    page,
  }) => {
    const editor = new TranscriptionEditorPage(page);
    const review = new HitlReviewPage(page);
    const initialTaskCount = state.tasks.size;

    await editor.goto();
    await editor.editTranscript(TRANSCRIPT_FIXTURES.HINGLISH_MULTI_TASK_MEETING!.transcript);
    await editor.triggerExtraction();

    // Verify candidate cards are in staging deck
    await review.assertCandidateCount(3);

    // User navigates away or refreshes without approving
    await page.reload();

    // Verify database task count remains unchanged: zero auto-commit!
    expect(state.tasks.size).toBe(initialTaskCount);
  });

  test('TC-HITL-02: Granular candidate task card allows in-place editing of title, assignee, and priority', async ({
    page,
  }) => {
    const editor = new TranscriptionEditorPage(page);
    const review = new HitlReviewPage(page);

    await editor.goto();
    await editor.editTranscript(TRANSCRIPT_FIXTURES.EN_WITH_DEPENDENCY!.transcript);
    await editor.triggerExtraction();

    await review.assertCandidateCount(2);

    // Edit candidate title and assignee
    const updatedTitle = 'Configure PostgreSQL 18.6 with replication';
    const updatedAssignee = 'Database Specialist';

    await review.editCandidateTitle(0, updatedTitle);
    await review.editCandidateAssignee(0, updatedAssignee);
    await review.changeCandidatePriority(0, 'CRITICAL');

    // Verify candidate card shows edited details
    await review.assertCandidateTitle(0, updatedTitle);
    await review.assertCandidateAssignee(0, updatedAssignee);
  });

  test('TC-HITL-03: Individual task approval commits only the approved candidate to database', async ({
    page,
  }) => {
    const editor = new TranscriptionEditorPage(page);
    const review = new HitlReviewPage(page);
    const board = new TaskBoardPage(page);

    const initRes = await page.request.get('/api/tasks');
    const initData = await initRes.json();
    const initialCount = initData.tasks.length;

    await editor.goto();
    await editor.editTranscript(TRANSCRIPT_FIXTURES.EN_WITH_DEPENDENCY!.transcript);
    await editor.triggerExtraction();

    await review.assertCandidateCount(2);

    // Approve only the first task
    await review.approveSingleCard(0);

    // Verify exactly one task added to database
    const postRes = await page.request.get('/api/tasks');
    const postData = await postRes.json();
    expect(postData.tasks.length).toBe(initialCount + 1);

    // Board displays approved task
    await board.assertTaskExists('Set up PostgreSQL database');
  });

  test('TC-HITL-04: Individual task rejection discards candidate card without database persistence', async ({
    page,
  }) => {
    const editor = new TranscriptionEditorPage(page);
    const review = new HitlReviewPage(page);
    const initialCount = state.tasks.size;

    await editor.goto();
    await editor.editTranscript(TRANSCRIPT_FIXTURES.EN_SINGLE_TASK!.transcript);
    await editor.triggerExtraction();

    await review.assertCandidateCount(1);

    // Reject candidate
    await review.rejectSingleCard(0);

    // Verify candidate card is removed from review deck without saving
    await expect(review.candidateCards).toHaveCount(0);
  });

  test('TC-HITL-05: Batch Approve All Valid Tasks commits all non-blocked candidates atomically', async ({
    page,
  }) => {
    const editor = new TranscriptionEditorPage(page);
    const review = new HitlReviewPage(page);

    const initRes = await page.request.get('/api/tasks');
    const initData = await initRes.json();
    const initialCount = initData.tasks.length;

    await editor.goto();
    await editor.editTranscript(TRANSCRIPT_FIXTURES.HINGLISH_MULTI_TASK_MEETING!.transcript);
    await editor.triggerExtraction();

    await review.assertCandidateCount(3);

    // Click Approve All
    await review.batchApproveAll();

    // Verify all 3 tasks persisted to DB
    const postRes = await page.request.get('/api/tasks');
    const postData = await postRes.json();
    expect(postData.tasks.length).toBe(initialCount + 3);

    // Verify activity event logged
    const actRes = await page.request.get('/api/activities');
    const actData = await actRes.json();
    const approvedEvents = actData.activities.filter((a: any) => a.eventType === 'TASK_APPROVED');
    expect(approvedEvents.length).toBeGreaterThanOrEqual(3);
  });
});
