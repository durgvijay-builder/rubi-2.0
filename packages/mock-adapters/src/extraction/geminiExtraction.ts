import {
  type IExtractionAdapter,
  type ExtractedActionBatch,
} from '@rubi/shared';
import { MockGeminiExtractionAdapter } from './mockGeminiExtraction.js';
import {
  LiveGeminiExtractionAdapter,
  type LiveGeminiExtractionOptions,
} from './liveGeminiExtraction.js';

export interface GeminiExtractionAdapterOptions extends LiveGeminiExtractionOptions {
  mode?: 'offline' | 'live' | 'auto';
  mockAdapter?: IExtractionAdapter;
  liveAdapter?: IExtractionAdapter;
  fallbackToMockOnError?: boolean;
}

/**
 * Intelligent Factory Adapter for Gemini Structured Action Extraction.
 *
 * Dynamically switches between LiveGeminiExtractionAdapter and MockGeminiExtractionAdapter
 * based on environment configuration (RUBI_MODE, GEMINI_API_KEY, MOCK_SERVICES).
 * Transparently falls back to MockGeminiExtractionAdapter when offline or upon live failure.
 */
export class GeminiExtractionAdapter implements IExtractionAdapter {
  private readonly mockAdapter: IExtractionAdapter;
  private readonly liveAdapter: IExtractionAdapter | null;
  private readonly isLiveMode: boolean;
  private readonly fallbackToMockOnError: boolean;

  constructor(options?: GeminiExtractionAdapterOptions) {
    const rubiMode = (options?.mode ?? process.env.RUBI_MODE ?? 'auto').toLowerCase();
    const mockServices = process.env.MOCK_SERVICES === 'true';
    const apiKey = options?.apiKey ?? process.env.GEMINI_API_KEY ?? '';

    this.mockAdapter = options?.mockAdapter ?? new MockGeminiExtractionAdapter();
    this.fallbackToMockOnError = options?.fallbackToMockOnError ?? (rubiMode !== 'live');

    // Determine if we should attempt live mode
    if (rubiMode === 'offline' || mockServices || !apiKey) {
      this.isLiveMode = false;
      this.liveAdapter = null;
    } else {
      this.isLiveMode = true;
      this.liveAdapter =
        options?.liveAdapter ?? new LiveGeminiExtractionAdapter({ ...options, apiKey });
    }
  }

  get isLive(): boolean {
    return this.isLiveMode && this.liveAdapter !== null;
  }

  async extractActions(
    transcript: string,
    context?: Record<string, unknown>
  ): Promise<ExtractedActionBatch> {
    if (this.isLive && this.liveAdapter) {
      try {
        return await this.liveAdapter.extractActions(transcript, context);
      } catch (error) {
        if (this.fallbackToMockOnError) {
          console.warn(
            `[GeminiExtractionAdapter] Live extraction failed (${(error as Error).message}). Falling back to MockGeminiExtractionAdapter.`
          );
          return await this.mockAdapter.extractActions(transcript, context);
        }
        throw error;
      }
    }

    return await this.mockAdapter.extractActions(transcript, context);
  }
}
