import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage.js';

/**
 * Page Object for Immutable Activity History Timeline.
 */
export class ActivityTimelinePage extends BasePage {
  readonly timelineContainer: Locator;
  readonly activityItems: Locator;

  constructor(page: Page) {
    super(page);
    this.timelineContainer = page.locator(
      '[data-testid="activity-timeline"], [data-testid="activity-feed"], section[aria-label="Activity history"]'
    );
    this.activityItems = page.locator('[data-testid^="activity-item-"], [data-testid="activity-item"]');
  }

  /**
   * Asserts an activity event with the given eventType exists in the timeline.
   */
  async assertEventLogged(eventType: string, taskTitleOrSnippet?: string) {
    await expect(this.timelineContainer.first()).toBeVisible({ timeout: 6000 });
    const targetItem = this.page.locator(
      `[data-testid="activity-item"]:has-text("${eventType}")`
    );
    await expect(targetItem.first()).toBeVisible({ timeout: 5000 });

    if (taskTitleOrSnippet) {
      await expect(targetItem.first()).toContainText(taskTitleOrSnippet);
    }
  }

  /**
   * Asserts total count of activity items.
   */
  async assertActivityCountAtLeast(minCount: number) {
    await expect(this.timelineContainer.first()).toBeVisible({ timeout: 6000 });
    const count = await this.activityItems.count();
    expect(count).toBeGreaterThanOrEqual(minCount);
  }
}

