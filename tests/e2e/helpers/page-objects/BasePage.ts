import { Page, expect } from '@playwright/test';

/**
 * Base Page Object providing navigation, workspace headers, and layout assertions.
 */
export class BasePage {
  constructor(public readonly page: Page) {}

  /**
   * Navigates to app root or relative path.
   */
  async goto(path: string = '/') {
    await this.page.goto(path);
  }

  /**
   * Sets custom workspace ID header for multi-tenant isolation testing.
   */
  async setWorkspaceHeader(workspaceId: string) {
    await this.page.setExtraHTTPHeaders({
      'x-workspace-id': workspaceId,
    });
  }

  /**
   * Verifies that the viewport does not exhibit horizontal scrolling/overflow.
   * Required for mobile viewports (320px, 375px, 430px) as specified in spec_inventory.md.
   */
  async assertNoHorizontalOverflow() {
    const isOverflowing = await this.page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(isOverflowing).toBe(false);
  }

  /**
   * Waits for any active global loading spinner or processing state to disappear.
   */
  async waitForLoaderToDissolve() {
    const loader = this.page.locator('[data-testid="global-spinner"], .animate-spin');
    if (await loader.count() > 0 && await loader.first().isVisible()) {
      await loader.first().waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});
    }
  }

  /**
   * Verifies current state communicator badge.
   */
  async assertProcessingState(stateName: string) {
    const stateBadge = this.page.locator(`[data-testid="processing-state-${stateName}"], [data-state="${stateName}"]`);
    await expect(stateBadge.first()).toBeVisible({ timeout: 5000 });
  }
}

