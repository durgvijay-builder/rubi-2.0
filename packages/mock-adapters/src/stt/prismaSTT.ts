import type { ISTTAdapter, STTOptions, STTResult } from '@rubi/shared';
import { MockPrismaSTTAdapter } from './mockPrismaSTT.js';
import { LivePrismaSTTAdapter, type LivePrismaSTTOptions } from './livePrismaSTT.js';

export interface PrismaSTTAdapterOptions extends LivePrismaSTTOptions {
  mode?: 'offline' | 'live' | 'auto';
  mockAdapter?: ISTTAdapter;
  liveAdapter?: ISTTAdapter;
  fallbackToMockOnError?: boolean;
}

/**
 * Intelligent Factory Adapter for Gnani Prisma STT.
 *
 * Dynamically switches between LivePrismaSTTAdapter and MockPrismaSTTAdapter
 * based on environment configuration (RUBI_MODE, GNANI_API_KEY, MOCK_SERVICES).
 * Provides seamless offline development and testing fallback.
 */
export class PrismaSTTAdapter implements ISTTAdapter {
  private readonly mockAdapter: ISTTAdapter;
  private readonly liveAdapter: ISTTAdapter | null;
  private readonly isLiveMode: boolean;
  private readonly fallbackToMockOnError: boolean;

  constructor(options?: PrismaSTTAdapterOptions) {
    const rubiMode = (options?.mode ?? process.env.RUBI_MODE ?? 'auto').toLowerCase();
    const mockServices = process.env.MOCK_SERVICES === 'true';
    const apiKey =
      options?.apiKey ??
      process.env.GNANI_STT_API_KEY ??
      process.env.GNANI_API_KEY ??
      '';

    this.mockAdapter = options?.mockAdapter ?? new MockPrismaSTTAdapter();
    this.fallbackToMockOnError = options?.fallbackToMockOnError ?? (rubiMode !== 'live');

    // Determine if we should attempt live mode
    if (rubiMode === 'offline' || mockServices || !apiKey) {
      this.isLiveMode = false;
      this.liveAdapter = null;
    } else {
      this.isLiveMode = true;
      this.liveAdapter = options?.liveAdapter ?? new LivePrismaSTTAdapter({ ...options, apiKey });
    }
  }

  /**
   * Returns true if currently operating in live mode
   */
  get isLive(): boolean {
    return this.isLiveMode && this.liveAdapter !== null;
  }

  async transcribe(audioBuffer: Buffer, options?: STTOptions): Promise<STTResult> {
    if (this.isLive && this.liveAdapter) {
      try {
        return await this.liveAdapter.transcribe(audioBuffer, options);
      } catch (error) {
        if (this.fallbackToMockOnError) {
          console.warn(
            `[PrismaSTTAdapter] Live transcription failed (${(error as Error).message}). Falling back to MockPrismaSTTAdapter.`
          );
          return await this.mockAdapter.transcribe(audioBuffer, options);
        }
        throw error;
      }
    }

    return await this.mockAdapter.transcribe(audioBuffer, options);
  }
}

