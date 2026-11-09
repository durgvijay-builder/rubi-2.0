import { PrismaSTTAdapter, TimbreTTSAdapter } from '@rubi/mock-adapters';
import type {
  ISTTAdapter,
  ITTSAdapter,
  STTOptions,
  STTResult,
  TTSOptions,
  TTSResult,
} from '@rubi/shared';

export interface SpeechServiceOptions {
  sttAdapter?: ISTTAdapter;
  ttsAdapter?: ITTSAdapter;
}

/**
 * Speech Service coordinating Gnani Prisma STT and Timbre TTS adapters.
 */
export class SpeechService {
  private readonly sttAdapter: ISTTAdapter;
  private readonly ttsAdapter: ITTSAdapter;

  constructor(options?: SpeechServiceOptions) {
    this.sttAdapter = options?.sttAdapter ?? new PrismaSTTAdapter();
    this.ttsAdapter = options?.ttsAdapter ?? new TimbreTTSAdapter();
  }

  /**
   * Transcribe an incoming audio buffer to text.
   */
  async transcribeAudio(audioBuffer: Buffer, options?: STTOptions): Promise<STTResult> {
    return this.sttAdapter.transcribe(audioBuffer, options);
  }

  /**
   * Synthesize text into spoken WAV audio buffer.
   */
  async synthesizeSpeech(text: string, options?: TTSOptions): Promise<TTSResult> {
    return this.ttsAdapter.synthesize(text, options);
  }
}

// Global default singleton service instance
export const speechService = new SpeechService();

