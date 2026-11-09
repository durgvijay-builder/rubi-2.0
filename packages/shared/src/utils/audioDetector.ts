/**
 * Audio format detection utility by inspecting magic bytes of binary buffers.
 * Guarantees that audio format is verified by content rather than header/filename.
 */

export type SupportedAudioFormat = 'wav' | 'webm' | 'ogg' | 'mp3' | 'flac' | 'unknown';

export interface AudioFormatInfo {
  format: SupportedAudioFormat;
  mimeType: string;
  extension: string;
  isValid: boolean;
  sampleRate?: number | undefined;
  channels?: number | undefined;
  bitDepth?: number | undefined;
}

/**
 * Detects the real audio format of a buffer from its initial bytes.
 */
export function detectAudioFormat(buffer: Buffer | Uint8Array): AudioFormatInfo {
  if (!buffer || buffer.length < 4) {
    return {
      format: 'unknown',
      mimeType: 'application/octet-stream',
      extension: 'bin',
      isValid: false,
    };
  }

  const b0 = buffer[0] ?? 0;
  const b1 = buffer[1] ?? 0;
  const b2 = buffer[2] ?? 0;
  const b3 = buffer[3] ?? 0;

  // 1. WAV check: Starts with 'RIFF' or 'RIFX', and bytes 8..11 are 'WAVE'
  if (
    buffer.length >= 12 &&
    ((b0 === 0x52 && b1 === 0x49 && b2 === 0x46 && b3 === 0x46) || // RIFF
     (b0 === 0x52 && b1 === 0x49 && b2 === 0x46 && b3 === 0x58)) && // RIFX
    buffer[8] === 0x57 && buffer[9] === 0x41 && buffer[10] === 0x56 && buffer[11] === 0x45 // WAVE
  ) {
    let sampleRate: number | undefined;
    let channels: number | undefined;
    let bitDepth: number | undefined;

    // Parse 'fmt ' subchunk if present
    if (buffer.length >= 36) {
      for (let i = 12; i < Math.min(buffer.length - 24, 256); i++) {
        if (buffer[i] === 0x66 && buffer[i + 1] === 0x6d && buffer[i + 2] === 0x74 && buffer[i + 3] === 0x20) {
          const c0 = buffer[i + 10] ?? 0;
          const c1 = buffer[i + 11] ?? 0;
          channels = c0 | (c1 << 8);

          const s0 = buffer[i + 12] ?? 0;
          const s1 = buffer[i + 13] ?? 0;
          const s2 = buffer[i + 14] ?? 0;
          const s3 = buffer[i + 15] ?? 0;
          sampleRate = s0 | (s1 << 8) | (s2 << 16) | (s3 << 24);

          const bd0 = buffer[i + 22] ?? 0;
          const bd1 = buffer[i + 23] ?? 0;
          bitDepth = bd0 | (bd1 << 8);
          break;
        }
      }
    }

    return {
      format: 'wav',
      mimeType: 'audio/wav',
      extension: 'wav',
      isValid: true,
      sampleRate,
      channels,
      bitDepth,
    };
  }

  // 2. WebM / Matroska check: EBML identifier [0x1A, 0x45, 0xDF, 0xA3]
  if (b0 === 0x1a && b1 === 0x45 && b2 === 0xdf && b3 === 0xa3) {
    return {
      format: 'webm',
      mimeType: 'audio/webm',
      extension: 'webm',
      isValid: true,
    };
  }

  // 3. OGG check: 'OggS' [0x4F, 0x67, 0x67, 0x53]
  if (b0 === 0x4f && b1 === 0x67 && b2 === 0x67 && b3 === 0x53) {
    return {
      format: 'ogg',
      mimeType: 'audio/ogg',
      extension: 'ogg',
      isValid: true,
    };
  }

  // 4. MP3 check: ID3v2 header 'ID3' [0x49, 0x44, 0x33] or MPEG frame sync (0xFF 0xFB/F3/F2/E0..FE)
  if (
    (b0 === 0x49 && b1 === 0x44 && b2 === 0x33) ||
    (b0 === 0xff && (b1 & 0xe0) === 0xe0)
  ) {
    return {
      format: 'mp3',
      mimeType: 'audio/mpeg',
      extension: 'mp3',
      isValid: true,
    };
  }

  // 5. FLAC check: 'fLaC' [0x66, 0x4C, 0x61, 0x43]
  if (b0 === 0x66 && b1 === 0x4c && b2 === 0x61 && b3 === 0x43) {
    return {
      format: 'flac',
      mimeType: 'audio/flac',
      extension: 'flac',
      isValid: true,
    };
  }

  return {
    format: 'unknown',
    mimeType: 'application/octet-stream',
    extension: 'bin',
    isValid: false,
  };
}
