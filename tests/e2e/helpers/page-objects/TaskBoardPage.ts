import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage.js';

/**
 * Page Object for Task Board, 7-State Lifecycle, and Dependency Visualization.
 */
export class TaskBoardPage extends BasePage {
  readonly boardContainer: Locator;
  readonly taskCards: Locator;
  readonly archivedFilterCheckbox: Locator;
  readonly searchFilterInput: Locator;

  constructor(page: Page) {
    super(page);
    this.boardContainer = page.locator('[data-testid="task-board"], [data-testid="kanban-board"], main');
    this.taskCards = page.locator('[data-testid^="task-card-"], [data-testid="task-card"]');
    this.archivedFilterCheckbox = page.locator(
      '[data-testid="filter-archived-checkbox"], input#show-archived, button:has-text("Archived")'
    );
    this.searchFilterInput = page.locator('[data-testid="task-search-input"], input[placeholder*="Search"]');
  }

  /**
   * Returns locator for a column corresponding to a specific TaskStatus.
   */
  getColumn(status: 'PENDING_APPROVAL' | 'TO_DO' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED'): Locator {
    return this.page.locator(`[data-testid="column-${status}"], [data-status="${status}"]`);
  }

  /**
   * Returns locator for a specific task card by title snippet or ID.
   */
  getTaskCard(titleSnippetOrId: string): Locator {
    return this.page.locator(`[data-testid="task-card-${titleSnippetOrId}"], [data-testid^="task-card-"]:has-text("${titleSnippetOrId}")`);
  }

  /**
   * Asserts a task with the given title exists on the board.
   */
  async assertTaskExists(titleSnippet: string, expectedStatus?: string) {
    const card = this.getTaskCard(titleSnippet);
    await expect(card.first()).toBeVisible({ timeout: 6000 });
    if (expectedStatus) {
      await expect(card.first()).toContainText(expectedStatus);
    }
  }

  /**
   * Asserts a task is not visible on the active board (e.g. after soft-archival).
   */
  async assertTaskNotVisible(titleSnippet: string) {
    const card = this.getTaskCard(titleSnippet);
    await expect(card.first()).not.toBeVisible();
  }

  /**
   * Transitions a task's status via dropdown or status selector.
   */
  async transitionTaskStatus(
    titleSnippet: string,
    newStatus: 'TO_DO' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED'
  ) {
    const card = this.getTaskCard(titleSnippet);
    const statusSelect = card.locator('[data-testid="task-status-select"], select[name="status"]');

    if (await statusSelect.count() > 0 && await statusSelect.first().isVisible()) {
      await statusSelect.first().selectOption(newStatus);
    } else {
      // Fallback: look for action menu or status change button
      const actionBtn = card.locator(`button:has-text("${newStatus}"), [data-testid="btn-status-${newStatus}"]`);
      if (await actionBtn.count() > 0) {
        await actionBtn.first().click();
      }
    }
  }

  /**
   * Soft-archives a task using its card archive button.
   */
  async archiveTask(titleSnippet: string) {
    const card = this.getTaskCard(titleSnippet);
    const archiveBtn = card.locator('[data-testid="archive-task-btn"], button:has-text("Archive")');
    await archiveBtn.first().click();
  }

  /**
   * Toggles the "Show Archived Tasks" view filter.
   */
  async toggleArchivedFilter() {
    await this.archivedFilterCheckbox.first().click();
  }

  /**
   * Asserts a task displays a dependency tag indicating prerequisite or blocked status.
   */
  async assertDependencyTag(titleSnippet: string, expectedTagSnippet?: string) {
    const card = this.getTaskCard(titleSnippet);
    const depTag = card.locator('[data-testid="dependency-tag"], [data-testid="blocked-by-tag"]');
    await expect(depTag.first()).toBeVisible({ timeout: 4000 });
    if (expectedTagSnippet) {
      await expect(depTag.first()).toContainText(expectedTagSnippet);
    }
  }
}

