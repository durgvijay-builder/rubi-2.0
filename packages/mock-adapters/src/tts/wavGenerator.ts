/**
 * Genuine Playable RIFF PCM WAV Audio Generator
 *
 * Synthesizes structurally authentic, playable 16-bit mono PCM WAV buffers
 * containing harmonic chime tones with smooth attack/decay envelopes.
 * Playable by any standard HTML5 <audio> element, VLC, QuickTime, or web audio context.
 */

export interface WavGeneratorOptions {
  durationMs?: number;
  sampleRate?: number;
  frequency?: number;
  amplitude?: number; // 0.0 to 1.0
  chimeHarmonics?: boolean;
}

/**
 * Generates a valid RIFF PCM WAV audio buffer
 */
export function generatePlayableWavBuffer(options?: WavGeneratorOptions): {
  buffer: Buffer;
  durationMs: number;
  sampleRate: number;
} {
  // 1. Validate durationMs (must be a non-negative finite number)
  let durationMs = options?.durationMs ?? 1500;
  if (typeof durationMs !== 'number' || Number.isNaN(durationMs) || durationMs < 0) {
    throw new RangeError(
      `Invalid durationMs: expected non-negative number, received ${durationMs}`
    );
  }
  durationMs = Math.round(durationMs);

  // 2. Validate sampleRate (must be a positive finite number)
  let sampleRate = options?.sampleRate ?? 44100;
  if (typeof sampleRate !== 'number' || Number.isNaN(sampleRate) || sampleRate <= 0) {
    throw new RangeError(
      `Invalid sampleRate: expected positive number, received ${sampleRate}`
    );
  }
  sampleRate = Math.round(sampleRate);

  // 3. Sanitize frequency (positive number fallback to 440 Hz)
  const rawFreq = options?.frequency;
  const fundamentalFreq =
    typeof rawFreq === 'number' && !Number.isNaN(rawFreq) && rawFreq > 0
      ? rawFreq
      : 440;

  // 4. Sanitize amplitude (number fallback to 0.35, clamped [0.01, 1.0])
  const rawAmp = options?.amplitude;
  const safeAmp =
    typeof rawAmp === 'number' && !Number.isNaN(rawAmp)
      ? rawAmp
      : 0.35;
  const amplitude = Math.max(0.01, Math.min(1.0, safeAmp));

  const chimeHarmonics = options?.chimeHarmonics ?? true;

  const numChannels = 1; // Mono
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;

  const totalSamples = Math.floor((durationMs / 1000) * sampleRate);
  const dataSize = totalSamples * blockAlign;
  const fileSize = 36 + dataSize;

  const buffer = Buffer.alloc(44 + dataSize);

  // 1. RIFF Chunk Descriptor
  buffer.write('RIFF', 0, 4, 'ascii');
  buffer.writeUInt32LE(fileSize, 4);
  buffer.write('WAVE', 8, 4, 'ascii');

  // 2. "fmt " Sub-chunk
  buffer.write('fmt ', 12, 4, 'ascii');
  buffer.writeUInt32LE(16, 16); // Subchunk1Size for PCM
  buffer.writeUInt16LE(1, 20); // AudioFormat: 1 = PCM (linear quantization)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // 3. "data" Sub-chunk
  buffer.write('data', 36, 4, 'ascii');
  buffer.writeUInt32LE(dataSize, 40);

  // 4. Synthesize Audio Samples
  // Generate a multi-harmonic musical chime (fundamental + major third 554.37 Hz) with soft envelope
  const maxSampleValue = 32767 * amplitude;
  const attackSamples = Math.floor(sampleRate * 0.05); // 50ms attack
  const decayRate = 3.5 / (totalSamples / sampleRate); // Smooth exponential decay

  let byteOffset = 44;
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;

    // Amplitude envelope: quick attack to prevent clicks, smooth decay
    let envelope = 1.0;
    if (i < attackSamples) {
      envelope = i / attackSamples;
    } else {
      envelope = Math.exp(-decayRate * (t - 0.05));
    }

    // Tone synthesis: fundamental frequency + harmonic overtone
    let sampleVal: number;
    if (chimeHarmonics) {
      // Primary chime: 440 Hz (A4) + 554.37 Hz (C#5) + subtle 880 Hz (A5)
      const primary = Math.sin(2 * Math.PI * fundamentalFreq * t);
      const overtone1 = 0.5 * Math.sin(2 * Math.PI * (fundamentalFreq * 1.25) * t);
      const overtone2 = 0.25 * Math.sin(2 * Math.PI * (fundamentalFreq * 2.0) * t);
      sampleVal = (primary + overtone1 + overtone2) / 1.75;
    } else {
      sampleVal = Math.sin(2 * Math.PI * fundamentalFreq * t);
    }

    const int16Sample = Math.round(
      Math.max(-32768, Math.min(32767, sampleVal * maxSampleValue * envelope))
    );
    buffer.writeInt16LE(int16Sample, byteOffset);
    byteOffset += 2;
  }

  return {
    buffer,
    durationMs,
    sampleRate,
  };
}

