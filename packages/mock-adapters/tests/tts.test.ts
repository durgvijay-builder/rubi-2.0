import { describe, it, expect, vi } from 'vitest';
import {
  generatePlayableWavBuffer,
  MockTimbreTTSAdapter,
  LiveTimbreTTSAdapter,
  TimbreTTSAdapter,
} from '../src/index.js';

describe('Gnani Timbre TTS Adapters', () => {
  describe('generatePlayableWavBuffer', () => {
    it('generates a structurally authentic and valid RIFF PCM WAV buffer', () => {
      const result = generatePlayableWavBuffer({ durationMs: 1000, sampleRate: 44100 });
      const buf = result.buffer;

      // RIFF header
      expect(buf.toString('ascii', 0, 4)).toBe('RIFF');
      const fileSize = buf.readUInt32LE(4);
      expect(fileSize).toBe(buf.length - 8);
      expect(buf.toString('ascii', 8, 12)).toBe('WAVE');

      // fmt sub-chunk
      expect(buf.toString('ascii', 12, 16)).toBe('fmt ');
      expect(buf.readUInt32LE(16)).toBe(16); // PCM chunk size
      expect(buf.readUInt16LE(20)).toBe(1); // AudioFormat = 1 (PCM)
      expect(buf.readUInt16LE(22)).toBe(1); // NumChannels = 1 (Mono)
      expect(buf.readUInt32LE(24)).toBe(44100); // Sample rate
      expect(buf.readUInt32LE(28)).toBe(44100 * 2); // Byte rate
      expect(buf.readUInt16LE(32)).toBe(2); // Block align
      expect(buf.readUInt16LE(34)).toBe(16); // Bits per sample

      // data sub-chunk
      expect(buf.toString('ascii', 36, 40)).toBe('data');
      const dataSize = buf.readUInt32LE(40);
      expect(dataSize).toBe(44100 * 2); // 1 second * 44100 samples/sec * 2 bytes/sample
      expect(buf.length).toBe(44 + dataSize);

      // Verify samples are non-zero (real audible waveform, not silent empty buffer)
      let nonZeroCount = 0;
      for (let offset = 44; offset < buf.length; offset += 2) {
        const sample = buf.readInt16LE(offset);
        if (sample !== 0) nonZeroCount++;
      }
      expect(nonZeroCount).toBeGreaterThan(1000);
    });
  });

  describe('MockTimbreTTSAdapter', () => {
    const adapter = new MockTimbreTTSAdapter();

    it('synthesizes playable WAV buffer and returns valid TTSResult', async () => {
      const text = 'Task approved and added to your backlog.';
      const result = await adapter.synthesize(text);

      expect(result.isMock).toBe(true);
      expect(result.mimeType).toBe('audio/wav');
      expect(result.durationMs).toBeGreaterThan(1000);
      expect(result.audioBuffer).toBeInstanceOf(Buffer);
      expect(result.audioBuffer.length).toBeGreaterThan(44);
      expect(result.audioBuffer.toString('ascii', 0, 4)).toBe('RIFF');
    });

    it('adjusts duration based on speech speed option', async () => {
      const text = 'Quick confirmation message';
      const normalResult = await adapter.synthesize(text, { speed: 1.0 });
      const fastResult = await adapter.synthesize(text, { speed: 2.0 });

      expect(fastResult.durationMs).toBeLessThan(normalResult.durationMs);
    });
  });

  describe('LiveTimbreTTSAdapter', () => {
    it('throws error when GNANI_API_KEY is not provided', async () => {
      const adapter = new LiveTimbreTTSAdapter({ apiKey: '' });
      await expect(adapter.synthesize('hello')).rejects.toThrow('GNANI_API_KEY is required');
    });

    it('throws error on empty text input', async () => {
      const adapter = new LiveTimbreTTSAdapter({ apiKey: 'some_key' });
      await expect(adapter.synthesize('')).rejects.toThrow('requires non-empty text input');
    });

    it('handles JSON response with base64 audio from Gnani endpoint', async () => {
      const fakeWav = Buffer.from('RIFF1234WAVEfmt fake wav');
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          audioBase64: fakeWav.toString('base64'),
          duration_ms: 2200,
        }),
      });

      const adapter = new LiveTimbreTTSAdapter({
        apiKey: 'test_key',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const result = await adapter.synthesize('Sprint planning meeting scheduled');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.isMock).toBe(false);
      expect(result.mimeType).toBe('audio/wav');
      expect(result.durationMs).toBe(2200);
      expect(result.audioBuffer.toString('ascii', 0, 4)).toBe('RIFF');
    });

    it('handles binary audio/wav stream from Gnani endpoint', async () => {
      const fakeWav = Buffer.from('RIFF5678WAVEfmt binary wav stream');
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'audio/wav' }),
        arrayBuffer: async () => fakeWav.buffer.slice(fakeWav.byteOffset, fakeWav.byteOffset + fakeWav.byteLength),
      });

      const adapter = new LiveTimbreTTSAdapter({
        apiKey: 'test_key',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const result = await adapter.synthesize('Direct audio stream confirmation');
      expect(result.isMock).toBe(false);
      expect(result.mimeType).toBe('audio/wav');
      expect(result.audioBuffer.toString('ascii', 0, 4)).toBe('RIFF');
    });

    it('throws error on HTTP error response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Speech synthesis model unavailable',
      });

      const adapter = new LiveTimbreTTSAdapter({
        apiKey: 'test_key',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      await expect(adapter.synthesize('Test speech')).rejects.toThrow(
        'Gnani Timbre TTS API failed with HTTP 500'
      );
    });
  });

  describe('TimbreTTSAdapter Factory', () => {
    it('defaults to MockTimbreTTSAdapter when in offline mode or missing API key', async () => {
      const factory = new TimbreTTSAdapter({ mode: 'offline' });
      expect(factory.isLive).toBe(false);

      const result = await factory.synthesize('Task completed successfully');
      expect(result.isMock).toBe(true);
      expect(result.audioBuffer.length).toBeGreaterThan(44);
    });

    it('delegates to live adapter when mode is live and apiKey is present', async () => {
      const mockLive = {
        synthesize: vi.fn().mockResolvedValue({
          audioBuffer: Buffer.from('RIFF_LIVE_AUDIO'),
          mimeType: 'audio/wav',
          durationMs: 1800,
          isMock: false,
        }),
      };

      const factory = new TimbreTTSAdapter({
        mode: 'live',
        apiKey: 'valid_api_key',
        liveAdapter: mockLive,
      });

      expect(factory.isLive).toBe(true);
      const result = await factory.synthesize('Spoken confirmation');
      expect(mockLive.synthesize).toHaveBeenCalled();
      expect(result.isMock).toBe(false);
    });

    it('falls back to mock adapter if live synthesis throws an error', async () => {
      const failingLive = {
        synthesize: vi.fn().mockRejectedValue(new Error('Connection timed out')),
      };

      const factory = new TimbreTTSAdapter({
        mode: 'live',
        apiKey: 'valid_api_key',
        liveAdapter: failingLive,
        fallbackToMockOnError: true,
      });

      const result = await factory.synthesize('Spoken confirmation with fallback');
      expect(failingLive.synthesize).toHaveBeenCalled();
      expect(result.isMock).toBe(true);
      expect(result.audioBuffer).toBeInstanceOf(Buffer);
    });
  });
});

