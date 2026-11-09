import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage.js';

/**
 * Page Object for Transcription Review & In-Place Editing.
 */
export class TranscriptionEditorPage extends BasePage {
  readonly transcriptTextarea: Locator;
  readonly wordCountLabel: Locator;
  readonly extractActionsBtn: Locator;
  readonly confidenceBadge: Locator;
  readonly editPromptHint: Locator;

  constructor(page: Page) {
    super(page);
    this.transcriptTextarea = page.locator(
      '[data-testid="transcription-editor"], [data-testid="transcript-input"], textarea[name="transcript"]'
    );
    this.wordCountLabel = page.locator('[data-testid="transcript-word-count"], [data-testid="word-count"]');
    this.extractActionsBtn = page.locator(
      '[data-testid="extract-actions-btn"], button:has-text("Extract Actions"), button:has-text("Understand")'
    );
    this.confidenceBadge = page.locator('[data-testid="stt-confidence-badge"], [data-testid="confidence-score"]');
    this.editPromptHint = page.locator('[data-testid="edit-hint-text"]');
  }

  /**
   * Asserts the transcribed text is displayed and contains the expected snippet.
   * Auto-retries until asynchronous STT response populates the value.
   */
  async assertTranscriptContains(textSnippet: string) {
    await expect(this.transcriptTextarea.first()).toBeVisible({ timeout: 6000 });
    const escapedSnippet = textSnippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await expect(this.transcriptTextarea.first()).toHaveValue(new RegExp(escapedSnippet, 'i'), { timeout: 8000 });
  }

  /**
   * Performs an in-place human edit on the transcript before triggering extraction.
   */
  async editTranscript(newText: string) {
    await this.transcriptTextarea.first().fill(newText);
  }

  /**
   * Appends text to the transcription box.
   */
  async appendTranscript(additionalText: string) {
    const currentVal = await this.transcriptTextarea.first().inputValue();
    await this.transcriptTextarea.first().fill(`${currentVal} ${additionalText}`);
  }

  /**
   * Clicks the extract button to trigger Gemini structured understanding.
   */
  async triggerExtraction() {
    await this.extractActionsBtn.first().click();
  }
}
