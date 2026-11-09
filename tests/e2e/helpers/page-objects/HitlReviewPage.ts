import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage.js';

/**
 * Page Object for Human-in-the-Loop (HITL) Review Deck & Granular Controls.
 * Enforces "Silence Never Implies Consent" with zero auto-commit.
 */
export class HitlReviewPage extends BasePage {
  readonly reviewDeckContainer: Locator;
  readonly candidateCards: Locator;
  readonly batchApproveBtn: Locator;
  readonly discardAllBtn: Locator;
  readonly cycleErrorBanner: Locator;
  readonly ambiguityWarning: Locator;
  readonly tokenTelemetryBadge: Locator;

  constructor(page: Page) {
    super(page);
    this.reviewDeckContainer = page.locator(
      '[data-testid="hitl-review-deck"], [data-testid="approval-queue"], section[aria-label="Action items review"]'
    );
    this.candidateCards = page.locator('[data-testid^="candidate-card-"], [data-testid="candidate-task-card"]');
    this.batchApproveBtn = page.locator(
      '[data-testid="batch-approve-btn"], button:has-text("Approve All"), button:has-text("Commit All")'
    );
    this.discardAllBtn = page.locator(
      '[data-testid="discard-all-btn"], button:has-text("Discard All"), button:has-text("Reject All")'
    );
    this.cycleErrorBanner = page.locator(
      '[data-testid="cycle-error-banner"], [data-testid="dag-cycle-alert"], [role="alert"]:has-text("Circular")'
    );
    this.ambiguityWarning = page.locator(
      '[data-testid="ambiguity-warning"], [data-testid="ambiguity-banner"], [role="alert"]:has-text("Ambiguity")'
    );
    this.tokenTelemetryBadge = page.locator(
      '[data-testid="tokens-telemetry-badge"], [data-testid="token-cost-tracker"]'
    );
  }

  /**
   * Asserts the review deck is visible with exact number of candidate cards.
   */
  async assertCandidateCount(expectedCount: number) {
    await expect(this.reviewDeckContainer.first()).toBeVisible({ timeout: 6000 });
    await expect(this.candidateCards).toHaveCount(expectedCount);
  }

  /**
   * Returns locator for a specific candidate card by index or tempId.
   */
  getCandidateCard(indexOrTempId: number | string): Locator {
    if (typeof indexOrTempId === 'number') {
      return this.candidateCards.nth(indexOrTempId);
    }
    return this.page.locator(`[data-testid="candidate-card-${indexOrTempId}"]`);
  }

  /**
   * Inline edits the title of a candidate card.
   */
  async editCandidateTitle(index: number, newTitle: string) {
    const card = this.getCandidateCard(index);
    const titleInput = card.locator('[data-testid="card-title-input"], input[name="title"]');
    await titleInput.fill(newTitle);
  }

  /**
   * Asserts candidate card title matches value pattern.
   */
  async assertCandidateTitle(index: number, pattern: string | RegExp) {
    const card = this.getCandidateCard(index);
    const titleInput = card.locator('[data-testid="card-title-input"], input[name="title"]');
    const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
    await expect(titleInput).toHaveValue(regex, { timeout: 5000 });
  }

  /**
   * Inline edits the assignee / owner of a candidate card.
   */
  async editCandidateAssignee(index: number, newAssignee: string) {
    const card = this.getCandidateCard(index);
    const assigneeInput = card.locator('[data-testid="card-assignee-input"], input[name="assignee"], input[name="owner"]');
    await assigneeInput.fill(newAssignee);
  }

  /**
   * Asserts candidate card assignee matches value pattern.
   */
  async assertCandidateAssignee(index: number, pattern: string | RegExp) {
    const card = this.getCandidateCard(index);
    const assigneeInput = card.locator('[data-testid="card-assignee-input"], input[name="assignee"], input[name="owner"]');
    const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
    await expect(assigneeInput).toHaveValue(regex, { timeout: 5000 });
  }

  /**
   * Inline changes the priority of a candidate card.
   */
  async changeCandidatePriority(index: number, priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') {
    const card = this.getCandidateCard(index);
    const prioritySelect = card.locator('[data-testid="card-priority-select"], select[name="priority"]');
    await prioritySelect.selectOption(priority);
  }

  /**
   * Granularly approves a single candidate card by clicking its approve button.
   */
  async approveSingleCard(index: number) {
    const card = this.getCandidateCard(index);
    const approveBtn = card.locator('[data-testid="card-approve-btn"], button:has-text("Approve")');
    await approveBtn.click();
  }

  /**
   * Granularly rejects / discards a single candidate card.
   */
  async rejectSingleCard(index: number) {
    const card = this.getCandidateCard(index);
    const rejectBtn = card.locator('[data-testid="card-reject-btn"], button:has-text("Reject"), button:has-text("Discard")');
    await rejectBtn.click();
  }

  /**
   * Approves all valid candidate tasks atomically.
   */
  async batchApproveAll() {
    await this.batchApproveBtn.first().click();
  }

  /**
   * Asserts token telemetry display contains token count and USD cost.
   */
  async assertTokenTelemetryVisible() {
    await expect(this.tokenTelemetryBadge.first()).toBeVisible({ timeout: 5000 });
    const text = await this.tokenTelemetryBadge.first().innerText();
    expect(text).toMatch(/tokens/i);
    expect(text).toMatch(/\$|USD/i);
  }

  /**
   * Asserts that circular dependency alert is present and approval is disabled.
   */
  async assertCycleErrorPresent() {
    await expect(this.cycleErrorBanner.first()).toBeVisible({ timeout: 5000 });
    await expect(this.cycleErrorBanner.first()).toContainText(/circular/i);

    // Verify batch approval is disabled when cycle error is present
    if (await this.batchApproveBtn.count() > 0) {
      await expect(this.batchApproveBtn.first()).toBeDisabled();
    }
  }

  /**
   * Asserts ambiguity banner is displayed.
   */
  async assertAmbiguityWarningPresent() {
    await expect(this.ambiguityWarning.first()).toBeVisible({ timeout: 5000 });
  }
}
