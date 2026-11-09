import type { ITTSAdapter, TTSOptions, TTSResult } from '@rubi/shared';
import { MockTimbreTTSAdapter } from './mockTimbreTTS.js';
import { LiveTimbreTTSAdapter, type LiveTimbreTTSOptions } from './liveTimbreTTS.js';
import { LiveElevenLabsTTSAdapter } from './liveElevenLabsTTS.js';

export interface TimbreTTSAdapterOptions extends LiveTimbreTTSOptions {
  mode?: 'offline' | 'live' | 'auto';
  provider?: 'gnani' | 'elevenlabs';
  mockAdapter?: ITTSAdapter;
  liveAdapter?: ITTSAdapter;
  fallbackToMockOnError?: boolean;
}

/**
 * Intelligent Factory Adapter for Neural TTS (Gnani Timbre or ElevenLabs).
 *
 * Dynamically selects between Live (Gnani or ElevenLabs) and Mock adapters
 * based on environment configuration (RUBI_MODE, RUBI_TTS_PROVIDER, API keys).
 * In live mode, strictly avoids silent mock fallbacks.
 */
export class TimbreTTSAdapter implements ITTSAdapter {
  private readonly mockAdapter: ITTSAdapter;
  private readonly liveAdapter: ITTSAdapter | null;
  private readonly isLiveMode: boolean;
  private readonly fallbackToMockOnError: boolean;
  private readonly providerName: string;

  constructor(options?: TimbreTTSAdapterOptions) {
    const rubiMode = (options?.mode ?? process.env.RUBI_MODE ?? 'auto').toLowerCase();
    const mockServices = process.env.MOCK_SERVICES === 'true';
    const provider = (options?.provider ?? process.env.RUBI_TTS_PROVIDER ?? 'gnani').toLowerCase();
    this.providerName = provider === 'elevenlabs' ? 'elevenlabs' : 'gnani';

    const gnaniApiKey =
      options?.apiKey ??
      process.env.GNANI_TTS_API_KEY ??
      process.env.GNANI_API_KEY ??
      '';
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY ?? '';

    const effectiveApiKey = this.providerName === 'elevenlabs' ? elevenLabsApiKey : gnaniApiKey;

    this.mockAdapter = options?.mockAdapter ?? new MockTimbreTTSAdapter();
    this.fallbackToMockOnError = options?.fallbackToMockOnError ?? (rubiMode !== 'live');

    if (rubiMode === 'offline' || mockServices || !effectiveApiKey) {
      this.isLiveMode = false;
      this.liveAdapter = null;
    } else {
      this.isLiveMode = true;
      if (options?.liveAdapter) {
        this.liveAdapter = options.liveAdapter;
      } else if (this.providerName === 'elevenlabs') {
        this.liveAdapter = new LiveElevenLabsTTSAdapter({ apiKey: elevenLabsApiKey });
      } else {
        this.liveAdapter = new LiveTimbreTTSAdapter({ ...options, apiKey: gnaniApiKey });
      }
    }
  }

  /**
   * Returns true if currently operating in live mode
   */
  get isLive(): boolean {
    return this.isLiveMode && this.liveAdapter !== null;
  }

  get provider(): string {
    return this.providerName;
  }

  async synthesize(text: string, options?: TTSOptions): Promise<TTSResult> {
    if (this.isLive && this.liveAdapter) {
      try {
        return await this.liveAdapter.synthesize(text, options);
      } catch (error) {
        if (this.fallbackToMockOnError) {
          console.warn(
            `[TTSAdapter] Live synthesis failed with ${this.providerName} (${(error as Error).message}). Falling back to MockTimbreTTSAdapter.`
          );
          return await this.mockAdapter.synthesize(text, options);
        }
        throw error;
      }
    }

    return await this.mockAdapter.synthesize(text, options);
  }
}

