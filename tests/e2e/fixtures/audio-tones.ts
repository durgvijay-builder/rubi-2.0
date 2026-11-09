/**
 * Synthetic WAV Audio Tone & Header Fixtures for R.U.B.I. 2.0 E2E Testing
 *
 * Provides mathematically valid, deterministic 16-bit PCM WAV buffers
 * for offline browser MediaStream & file-upload tests without requiring
 * external audio hardware or proprietary audio files.
 */

/**
 * Creates a valid PCM 16-bit mono WAV buffer with a generated sine tone or silence.
 *
 * @param durationSeconds Length of audio in seconds
 * @param sampleRate Samples per second (default: 16000 Hz, speech standard)
 * @param frequencyHz Frequency of sine wave (0 for digital silence)
 * @returns Node.js Buffer containing complete RIFF WAVE binary data
 */
export function createSyntheticWavBuffer(
  durationSeconds: number = 1.0,
  sampleRate: number = 16000,
  frequencyHz: number = 440
): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const dataSize = numSamples * blockAlign;
  const chunkSize = 36 + dataSize;

  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF Chunk Descriptor
  buffer.write('RIFF', 0); // ChunkID
  buffer.writeUInt32LE(chunkSize, 4); // ChunkSize
  buffer.write('WAVE', 8); // Format

  // "fmt " Sub-chunk
  buffer.write('fmt ', 12); // Subchunk1ID
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // AudioFormat (1 = Linear PCM)
  buffer.writeUInt16LE(numChannels, 22); // NumChannels
  buffer.writeUInt32LE(sampleRate, 24); // SampleRate
  buffer.writeUInt32LE(byteRate, 28); // ByteRate
  buffer.writeUInt16LE(blockAlign, 32); // BlockAlign
  buffer.writeUInt16LE(bitsPerSample, 34); // BitsPerSample

  // "data" Sub-chunk
  buffer.write('data', 36); // Subchunk2ID
  buffer.writeUInt32LE(dataSize, 40); // Subchunk2Size

  // Write PCM audio samples (16-bit signed integer)
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    let sample = 0;
    if (frequencyHz > 0) {
      // Sine wave between -32767 and 32767
      const t = i / sampleRate;
      sample = Math.floor(Math.sin(2 * Math.PI * frequencyHz * t) * 32767 * 0.7);
    }
    buffer.writeInt16LE(sample, offset);
    offset += 2;
  }

  return buffer;
}

/** Pre-generated standard speech mock audio tone (16kHz, 2.0s, 440Hz tone) */
export const SYNTHETIC_SPEECH_MOCK_WAV = createSyntheticWavBuffer(2.0, 16000, 440);

/** Pre-generated digital silence audio tone (16kHz, 1.0s, 0Hz silence) */
export const SYNTHETIC_SILENCE_WAV = createSyntheticWavBuffer(1.0, 16000, 0);

/** Pre-generated confirmation chime audio tone (44.1kHz, 1.5s, 880Hz chime) */
export const SYNTHETIC_CHIME_WAV = createSyntheticWavBuffer(1.5, 44100, 880);

/** Corrupted audio header buffer (invalid RIFF magic bytes) */
export const CORRUPTED_AUDIO_BUFFER = Buffer.from('NOT_A_VALID_RIFF_HEADER_STREAM_DATA_1234567890');

/** Oversized audio buffer (>25MB threshold) for HTTP 413 boundary testing */
export function createOversizedAudioBuffer(sizeInMB: number = 26): Buffer {
  return Buffer.alloc(sizeInMB * 1024 * 1024, 0xaa);
}

