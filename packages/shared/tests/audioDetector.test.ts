import { describe, it, expect } from 'vitest';
import { detectAudioFormat } from '../src/utils/audioDetector.js';

describe('Audio Detector Utility', () => {
  it('detects genuine RIFF/WAVE header', () => {
    // 44-byte standard PCM WAV header
    const wavBuffer = Buffer.alloc(44);
    wavBuffer.write('RIFF', 0);
    wavBuffer.writeUInt32LE(36, 4);
    wavBuffer.write('WAVE', 8);
    wavBuffer.write('fmt ', 12);
    wavBuffer.writeUInt32LE(16, 16);
    wavBuffer.writeUInt16LE(1, 20); // PCM
    wavBuffer.writeUInt16LE(1, 22); // mono
    wavBuffer.writeUInt32LE(16000, 24); // 16kHz
    wavBuffer.writeUInt32LE(32000, 28);
    wavBuffer.writeUInt16LE(2, 32);
    wavBuffer.writeUInt16LE(16, 34); // 16-bit
    wavBuffer.write('data', 36);
    wavBuffer.writeUInt32LE(0, 40);

    const info = detectAudioFormat(wavBuffer);
    expect(info.isValid).toBe(true);
    expect(info.format).toBe('wav');
    expect(info.mimeType).toBe('audio/wav');
    expect(info.extension).toBe('wav');
    expect(info.sampleRate).toBe(16000);
    expect(info.channels).toBe(1);
    expect(info.bitDepth).toBe(16);
  });

  it('detects WebM / Matroska EBML header [0x1A, 0x45, 0xDF, 0xA3]', () => {
    const webmBuffer = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81]);
    const info = detectAudioFormat(webmBuffer);
    expect(info.isValid).toBe(true);
    expect(info.format).toBe('webm');
    expect(info.mimeType).toBe('audio/webm');
    expect(info.extension).toBe('webm');
  });

  it('detects OGG container header [OggS]', () => {
    const oggBuffer = Buffer.from([0x4f, 0x67, 0x67, 0x53, 0x00, 0x02, 0x00, 0x00]);
    const info = detectAudioFormat(oggBuffer);
    expect(info.isValid).toBe(true);
    expect(info.format).toBe('ogg');
    expect(info.mimeType).toBe('audio/ogg');
    expect(info.extension).toBe('ogg');
  });

  it('detects MP3 header with ID3 tag', () => {
    const id3Buffer = Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00]);
    const info = detectAudioFormat(id3Buffer);
    expect(info.isValid).toBe(true);
    expect(info.format).toBe('mp3');
    expect(info.mimeType).toBe('audio/mpeg');
    expect(info.extension).toBe('mp3');
  });

  it('detects MP3 with MPEG frame sync (0xFF 0xFB)', () => {
    const mpegSyncBuffer = Buffer.from([0xff, 0xfb, 0x90, 0x44, 0x00, 0x00]);
    const info = detectAudioFormat(mpegSyncBuffer);
    expect(info.isValid).toBe(true);
    expect(info.format).toBe('mp3');
    expect(info.mimeType).toBe('audio/mpeg');
  });

  it('rejects corrupted or arbitrary non-audio binary data', () => {
    const randomBuffer = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
    const info = detectAudioFormat(randomBuffer);
    expect(info.isValid).toBe(false);
    expect(info.format).toBe('unknown');
    expect(info.mimeType).toBe('application/octet-stream');
  });

  it('handles empty or undersized buffers gracefully', () => {
    expect(detectAudioFormat(Buffer.alloc(0)).isValid).toBe(false);
    expect(detectAudioFormat(Buffer.from([0x52, 0x49])).isValid).toBe(false);
  });
});

