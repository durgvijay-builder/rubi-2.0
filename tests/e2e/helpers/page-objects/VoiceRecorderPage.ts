import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage.js';
import { uploadSyntheticAudioFile } from '../audio-mock.js';

/**
 * Page Object for Audio Recording, Waveform visualizer, and File Upload.
 */
export class VoiceRecorderPage extends BasePage {
  readonly recordToggleBtn: Locator;
  readonly stopRecordBtn: Locator;
  readonly timerDisplay: Locator;
  readonly waveformIndicator: Locator;
  readonly fileUploadInput: Locator;
  readonly uploadDropzone: Locator;
  readonly audioPlayer: Locator;
  readonly ttsBanner: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.recordToggleBtn = page.locator('[data-testid="record-toggle-btn"], button[aria-label="Start recording"], button:has-text("Record")');
    this.stopRecordBtn = page.locator('[data-testid="stop-record-btn"], button[aria-label="Stop recording"], button:has-text("Stop")');
    this.timerDisplay = page.locator('[data-testid="record-timer"], [data-testid="recording-duration"]');
    this.waveformIndicator = page.locator('[data-testid="audio-waveform"], canvas.waveform, [data-testid="visualizer"]');
    this.fileUploadInput = page.locator('[data-testid="audio-file-input"], input[type="file"]');
    this.uploadDropzone = page.locator('[data-testid="upload-dropzone"], [data-testid="file-drop-area"]');
    this.audioPlayer = page.locator('[data-testid="tts-audio-player"], audio');
    this.ttsBanner = page.locator('[data-testid="spoken-confirmation-banner"], [data-testid="tts-spoken-text"]');
    this.errorMessage = page.locator('[data-testid="audio-error-banner"], [role="alert"]');
  }

  /**
   * Starts browser voice recording.
   */
  async startRecording() {
    await this.recordToggleBtn.first().click();
  }

  /**
   * Stops browser voice recording and triggers transcription submission.
   */
  async stopRecording() {
    // If separate stop button exists, click it; else toggle record button again
    if (await this.stopRecordBtn.count() > 0 && await this.stopRecordBtn.first().isVisible()) {
      await this.stopRecordBtn.first().click();
    } else {
      await this.recordToggleBtn.first().click();
    }
  }

  /**
   * Uploads synthetic WAV audio tone buffer via file input.
   */
  async uploadAudioBuffer(buffer: Buffer, fileName: string = 'test-recording.wav', mimeType: string = 'audio/wav') {
    await uploadSyntheticAudioFile(this.page, '[data-testid="audio-file-input"], input[type="file"]', buffer, fileName, mimeType);
  }

  /**
   * Asserts timer displays active progression (e.g. "00:01" or greater).
   */
  async assertTimerActive() {
    await expect(this.timerDisplay.first()).toBeVisible({ timeout: 4000 });
    const timerText = await this.timerDisplay.first().innerText();
    expect(timerText).toMatch(/\d{2}:\d{2}/);
  }

  /**
   * Asserts spoken confirmation banner is displayed with matching text.
   */
  async assertSpokenConfirmation(expectedTextSnippet?: string) {
    await expect(this.ttsBanner.first()).toBeVisible({ timeout: 5000 });
    if (expectedTextSnippet) {
      await expect(this.ttsBanner.first()).toContainText(expectedTextSnippet);
    }
  }
}

