import { describe, it, expect, vi } from 'vitest';
import { LivePrismaSTTAdapter } from '../src/stt/livePrismaSTT.js';
import { generatePlayableWavBuffer } from '../src/tts/wavGenerator.js';

describe('LivePrismaSTTAdapter Audio Inspection & Format Handling', () => {
  const validWav = generatePlayableWavBuffer({ durationMs: 500 }).buffer;
  const validWebM = Buffer.from([
    0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81, 0x01,
  ]);

  it('labels genuine WAV buffer as audio.wav and audio/wav', async () => {
    let capturedFormData: FormData | null = null;

    const mockFetch = vi.fn().mockImplementation(async (_url, init) => {
      capturedFormData = init.body as FormData;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          transcript: 'Completed physics assignment',
          confidence: 0.98,
          detected_language_code: 'en-IN',
          duration_ms: 500,
        }),
      };
    });

    const adapter = new LivePrismaSTTAdapter({
      apiKey: 'gnani_test_key',
      fetchFn: mockFetch as any,
    });

    const result = await adapter.transcribe(validWav);
    expect(result.text).toBe('Completed physics assignment');
    expect(capturedFormData).not.toBeNull();

    const audioFile = capturedFormData!.get('audio_file') as File;
    expect(audioFile).toBeDefined();
    expect(audioFile.name).toBe('audio.wav');
    expect(audioFile.type).toBe('audio/wav');
  });

  it('labels WebM buffer as audio.webm and audio/webm to prevent ffmpeg RIFF header demux errors', async () => {
    let capturedFormData: FormData | null = null;

    const mockFetch = vi.fn().mockImplementation(async (_url, init) => {
      capturedFormData = init.body as FormData;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          transcript: 'WebM speech test',
          confidence: 0.95,
          detected_language_code: 'hi-en',
          duration_ms: 1000,
        }),
      };
    });

    const adapter = new LivePrismaSTTAdapter({
      apiKey: 'gnani_test_key',
      fetchFn: mockFetch as any,
    });

    const result = await adapter.transcribe(validWebM);
    expect(result.text).toBe('WebM speech test');
    expect(capturedFormData).not.toBeNull();

    const audioFile = capturedFormData!.get('audio_file') as File;
    expect(audioFile).toBeDefined();
    // Must NOT be mislabeled as audio.wav!
    expect(audioFile.name).toBe('audio.webm');
    expect(audioFile.type).toBe('audio/webm');
  });
});
