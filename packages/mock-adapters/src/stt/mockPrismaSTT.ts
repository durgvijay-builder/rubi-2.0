import type { ISTTAdapter, STTOptions, STTResult } from '@rubi/shared';
import {
  RECOVERED_HINGLISH_TRANSCRIPTS,
  ENGLISH_STT_FIXTURES,
  HINDI_STT_FIXTURES,
  type TranscriptFixture,
} from './fixtures.js';

/**
 * Deterministic offline mock implementation of Gnani Prisma STT.
 *
 * Implements ISTTAdapter. Provides genuine multi-lingual transcriptions
 * for English, Hindi, and Hinglish utilizing the 17 authentic recovered
 * Hinglish dictations from legacy user testing.
 */
export class MockPrismaSTTAdapter implements ISTTAdapter {
  /**
   * Deterministically transcribe audio buffer to text.
   *
   * @param audioBuffer - Binary audio payload
   * @param options - Language selection, sample rate, etc.
   */
  async transcribe(audioBuffer: Buffer, options?: STTOptions): Promise<STTResult> {
    const targetLanguage = options?.language ?? 'hi-en';

    // 1. Edge Case: Empty or completely silent buffer
    if (!audioBuffer || audioBuffer.length === 0) {
      return {
        text: '',
        language: targetLanguage,
        confidence: 0.0,
        durationMs: 0,
        isMock: true,
      };
    }

    // Check if buffer contains only silence (all zero bytes)
    const isSilence = this.checkIfSilent(audioBuffer);
    if (isSilence) {
      return {
        text: '',
        language: targetLanguage,
        confidence: 0.0,
        durationMs: Math.round((audioBuffer.length / 32000) * 1000),
        isMock: true,
      };
    }

    // 2. Select appropriate fixture catalog based on target language
    let fixtureList: readonly TranscriptFixture[];
    if (targetLanguage === 'en') {
      fixtureList = ENGLISH_STT_FIXTURES;
    } else if (targetLanguage === 'hi') {
      fixtureList = HINDI_STT_FIXTURES;
    } else {
      fixtureList = RECOVERED_HINGLISH_TRANSCRIPTS;
    }

    // 3. Deterministic selection using audio buffer content hash
    const selectedFixture = this.selectDeterministicFixture(audioBuffer, fixtureList);

    return {
      text: selectedFixture.transcript,
      language: selectedFixture.language,
      confidence: selectedFixture.confidence,
      durationMs: selectedFixture.durationMs,
      isMock: true,
    };
  }

  /**
   * Check if a buffer is purely zeroed PCM silence.
   *
   * Accurately verifies RIFF/WAVE header presence before skipping header bytes,
   * preventing false positives on small silent buffers and false negatives on raw PCM audio.
   */
  private checkIfSilent(buffer: Buffer): boolean {
    let startOffset = 0;
    const isWav =
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WAVE';

    if (isWav) {
      const dataIndex = buffer.indexOf('data', 12);
      if (dataIndex !== -1 && dataIndex + 8 <= buffer.length) {
        startOffset = dataIndex + 8; // skip 'data' (4b) + subchunk2Size (4b)
      } else if (buffer.length >= 44) {
        startOffset = 44; // standard 44-byte PCM header fallback
      } else {
        startOffset = 0; // truncated header
      }
    }

    for (let i = startOffset; i < buffer.length; i++) {
      if (buffer[i] !== 0) {
        return false;
      }
    }
    return true;
  }

  /**
   * Computes a deterministic index from audio buffer content
   */
  private selectDeterministicFixture(
    buffer: Buffer,
    fixtures: readonly TranscriptFixture[]
  ): TranscriptFixture {
    if (fixtures.length === 0) {
      throw new Error('Fixture catalog cannot be empty');
    }

    // If buffer length matches common test tone or default request,
    // default to the primary fixture (e.g. Sprint Planning for Hinglish, DB setup for English)
    if (fixtures === RECOVERED_HINGLISH_TRANSCRIPTS && buffer.length <= 1024) {
      // Default to sprint planning meeting fixture (#17)
      return RECOVERED_HINGLISH_TRANSCRIPTS[16]!;
    }

    let hash = 0;
    const stride = Math.max(1, Math.floor(buffer.length / 128));
    for (let i = 0; i < buffer.length; i += stride) {
      hash = (hash * 31 + (buffer[i] ?? 0)) >>> 0;
    }

    const index = hash % fixtures.length;
    return fixtures[index]!;
  }
}

