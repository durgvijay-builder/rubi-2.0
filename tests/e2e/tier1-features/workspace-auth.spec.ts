import { test, expect } from '@playwright/test';
import { setupMockNetworkRoutes, MockNetworkState } from '../helpers/mock-routes.js';
import { BasePage } from '../helpers/page-objects/BasePage.js';
import { DEFAULT_WORKSPACE, FOREIGN_WORKSPACE } from '../fixtures/mock-payloads.js';

test.describe('Tier 1: Feature Coverage - Workspace Authorization & Security Hygiene (R5)', () => {
  let state: MockNetworkState;

  test.beforeEach(async ({ page }) => {
    state = new MockNetworkState();
    await setupMockNetworkRoutes(page, state);
  });

  test('TC-AUTH-01: Valid workspace context displays authorized workspace tasks and data', async ({ page }) => {
    const base = new BasePage(page);
    await base.setWorkspaceHeader(DEFAULT_WORKSPACE.id);
    await base.goto();

    const response = await page.request.get('/api/tasks', {
      headers: { 'x-workspace-id': DEFAULT_WORKSPACE.id },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.tasks.length).toBeGreaterThan(0);
    for (const task of data.tasks) {
      expect(task.workspaceId).toBe(DEFAULT_WORKSPACE.id);
    }
  });

  test('TC-AUTH-02: Cross-workspace access attempt is rejected with HTTP 403 Forbidden', async ({ page }) => {
    const base = new BasePage(page);
    await base.setWorkspaceHeader(FOREIGN_WORKSPACE.id);

    const response = await page.request.get('/api/tasks', {
      headers: { 'x-workspace-id': FOREIGN_WORKSPACE.id },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('Forbidden');
    expect(body.message).toContain('Unauthorized workspace access');
  });

  test('TC-AUTH-03: Multi-tenant workspace header scopes task queries strictly to active tenant', async ({
    page,
  }) => {
    // Add a foreign workspace task to state
    state.addTask({
      id: 'task-foreign-101',
      workspaceId: 'workspace-secondary-team-222',
      title: 'Secret Foreign Task',
      status: 'TO_DO',
      priority: 'HIGH',
      assignee: 'Foreign Member',
      deadline: null,
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Query under default workspace
    const response = await page.request.get('/api/tasks', {
      headers: { 'x-workspace-id': DEFAULT_WORKSPACE.id },
    });
    const data = await response.json();

    // Verify foreign task is not present in primary workspace query
    const foreignTask = data.tasks.find((t: any) => t.id === 'task-foreign-101');
    expect(foreignTask).toBeUndefined();
  });

  test('TC-AUTH-04: Unauthorized path manipulation is rejected by workspace middleware', async ({ page }) => {
    const response = await page.request.get('/api/forbidden-workspace/tasks');
    expect(response.status()).toBe(403);
  });

  test('TC-AUTH-05: Client security audit asserts backend secrets (GNANI_API_KEY, GEMINI_API_KEY) are never exposed to browser', async ({
    page,
  }) => {
    const base = new BasePage(page);
    await base.goto();

    // Evaluate window object and global variables
    const windowEnv = await page.evaluate(() => {
      const win = window as any;
      return {
        gnaniKey: win.GNANI_API_KEY || win.process?.env?.GNANI_API_KEY,
        geminiKey: win.GEMINI_API_KEY || win.process?.env?.GEMINI_API_KEY,
        dbUrl: win.DATABASE_URL || win.process?.env?.DATABASE_URL,
      };
    });

    // Hard security assertion: client must never have access to private backend credentials
    expect(windowEnv.gnaniKey).toBeUndefined();
    expect(windowEnv.geminiKey).toBeUndefined();
    expect(windowEnv.dbUrl).toBeUndefined();
  });
});

