import type { ITTSAdapter, TTSOptions, TTSResult } from '@rubi/shared';
import { generatePlayableWavBuffer } from './wavGenerator.js';

export interface MockTimbreTTSConfig {
  sampleRate?: number;
  baseFrequency?: number;
}

/**
 * Deterministic offline mock implementation of Gnani Timbre Neural TTS.
 *
 * Implements ITTSAdapter. Synthesizes a valid, fully playable 16-bit 44.1kHz
 * RIFF PCM WAV buffer so browser HTML5 <audio> elements, unit tests, and media
 * pipelines genuinely play audio confirmation chimes.
 */
export class MockTimbreTTSAdapter implements ITTSAdapter {
  private readonly sampleRate: number;
  private readonly baseFrequency: number;

  constructor(config?: MockTimbreTTSConfig) {
    const sr = config?.sampleRate;
    this.sampleRate = typeof sr === 'number' && !Number.isNaN(sr) && sr > 0 ? sr : 44100;
    const freq = config?.baseFrequency;
    this.baseFrequency = typeof freq === 'number' && !Number.isNaN(freq) && freq > 0 ? freq : 523.25;
  }

  async synthesize(text: string, options?: TTSOptions): Promise<TTSResult> {
    const trimmedText = text?.trim() ?? '';

    // Validate options.speed if provided
    if (options?.speed !== undefined) {
      if (typeof options.speed !== 'number' || Number.isNaN(options.speed)) {
        throw new RangeError(
          `Invalid speed multiplier: expected a valid number, received ${options.speed}`
        );
      }
    }

    const speed = Math.max(0.5, Math.min(2.0, options?.speed ?? 1.0));

    // Calculate natural spoken duration (~65ms per character, clamped between 1000ms and 15000ms)
    const rawDurationMs = Math.max(1200, Math.min(15000, trimmedText.length * 65));
    const effectiveDurationMs = Math.round(rawDurationMs / speed);

    // Synthesize valid playable RIFF PCM WAV buffer
    const wavResult = generatePlayableWavBuffer({
      durationMs: effectiveDurationMs,
      sampleRate: this.sampleRate,
      frequency: this.baseFrequency,
      chimeHarmonics: true,
    });

    return {
      audioBuffer: wavResult.buffer,
      mimeType: 'audio/wav',
      durationMs: wavResult.durationMs,
      isMock: true,
    };
  }
}

