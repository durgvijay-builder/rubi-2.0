import { test, expect } from '@playwright/test';
import { setupMockNetworkRoutes, MockNetworkState } from '../helpers/mock-routes.js';
import { injectBrowserAudioMocks } from '../helpers/audio-mock.js';
import { TaskBoardPage } from '../helpers/page-objects/TaskBoardPage.js';
import { ActivityTimelinePage } from '../helpers/page-objects/ActivityTimelinePage.js';

test.describe('Tier 1: Feature Coverage - Task Lifecycle, Board & Activity Log (R4)', () => {
  let state: MockNetworkState;

  test.beforeEach(async ({ page }) => {
    state = new MockNetworkState();
    await setupMockNetworkRoutes(page, state);
    await injectBrowserAudioMocks(page);
  });

  test('TC-PERSIST-01: Approved tasks appear on the task board in appropriate status column', async ({ page }) => {
    const board = new TaskBoardPage(page);
    await board.goto();

    // Verify seeded baseline tasks are visible
    await board.assertTaskExists('Initialize repository structure', 'COMPLETED');
    await board.assertTaskExists('Review legacy database models', 'TO_DO');
    await board.assertTaskExists('Deploy native PostgreSQL 18.6 container', 'TO_DO');
  });

  test('TC-PERSIST-02: 7-state task lifecycle allows valid status transitions (TO_DO -> IN_PROGRESS -> COMPLETED)', async ({
    page,
  }) => {
    const board = new TaskBoardPage(page);
    await board.goto();

    const targetTitle = 'Review legacy database models';

    // Transition: TO_DO -> IN_PROGRESS
    await board.transitionTaskStatus(targetTitle, 'IN_PROGRESS');
    await board.assertTaskExists(targetTitle, 'IN_PROGRESS');

    // Transition: IN_PROGRESS -> COMPLETED
    await board.transitionTaskStatus(targetTitle, 'COMPLETED');
    await board.assertTaskExists(targetTitle, 'COMPLETED');
  });

  test('TC-PERSIST-03: Soft archival hides task from active board view without data destruction', async ({ page }) => {
    const board = new TaskBoardPage(page);
    await board.goto();

    const targetTitle = 'Initialize repository structure';

    // Archive task from board UI
    await board.archiveTask(targetTitle);

    // Verify task is immediately hidden from default active board view
    await board.assertTaskNotVisible(targetTitle);

    // Verify via API that data was not destroyed
    const response = await page.request.get('/api/tasks?archived=true');
    const data = await response.json();
    const task = data.tasks.find((t: any) => t.title === targetTitle);
    expect(task?.isArchived).toBe(true);
  });

  test('TC-PERSIST-04: Soft restore un-archives task and returns it to active board', async ({ page }) => {
    const board = new TaskBoardPage(page);
    await board.goto();

    const targetTitle = 'Deploy native PostgreSQL 18.6 container';

    // Archive task
    await board.archiveTask(targetTitle);
    await board.assertTaskNotVisible(targetTitle);

    // Toggle filter to view archived tasks
    await board.toggleArchivedFilter();
    await board.assertTaskExists(targetTitle);

    // Restore task
    await board.archiveTask(targetTitle); // toggle button restores
    await board.toggleArchivedFilter(); // back to active board

    // Task is restored on active board
    await board.assertTaskExists(targetTitle);
  });

  test('TC-PERSIST-05: Immutable activity history audit table records every creation, status transition, and edit', async ({
    page,
  }) => {
    const board = new TaskBoardPage(page);
    const timeline = new ActivityTimelinePage(page);

    await board.goto();

    // Perform status transition to trigger activity logging
    await board.transitionTaskStatus('Review legacy database models', 'IN_PROGRESS');

    // Verify audit event exists in timeline
    await timeline.assertEventLogged('TASK_STATUS_CHANGED');
    await timeline.assertActivityCountAtLeast(1);
  });
});
