import { describe, it, expect, vi } from 'vitest';
import {
  MockPrismaSTTAdapter,
  LivePrismaSTTAdapter,
  PrismaSTTAdapter,
  RECOVERED_HINGLISH_TRANSCRIPTS,
  ENGLISH_STT_FIXTURES,
  HINDI_STT_FIXTURES,
} from '../src/index.js';

describe('Gnani Prisma STT Adapters', () => {
  describe('MockPrismaSTTAdapter', () => {
    const adapter = new MockPrismaSTTAdapter();
    const testAudioBuffer = Buffer.from('RIFF....WAVEfmt ....data....fake audio pcm samples 1234567890');

    it('recovers all 17 authentic Hinglish transcripts from legacy rubi_local.db', () => {
      expect(RECOVERED_HINGLISH_TRANSCRIPTS).toHaveLength(17);
      expect(RECOVERED_HINGLISH_TRANSCRIPTS[0]?.title).toBe('Create Agriculture Website Landing Page');
      expect(RECOVERED_HINGLISH_TRANSCRIPTS[0]?.transcript).toContain('mera ek aur task add kar do mujhe ek website banani hai');
      expect(RECOVERED_HINGLISH_TRANSCRIPTS[7]?.transcript).toContain('backlog wale dance');
      expect(RECOVERED_HINGLISH_TRANSCRIPTS[16]?.transcript).toContain('Kal subah 10 baje sprint planning meeting');
    });

    it('transcribes into Hinglish by default and returns valid STTResult', async () => {
      const result = await adapter.transcribe(testAudioBuffer);
      expect(result.isMock).toBe(true);
      expect(result.language).toBe('hi-en');
      expect(result.text).toBeTruthy();
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      expect(result.durationMs).toBeGreaterThan(0);
    });

    it('transcribes into English when language option is set to "en"', async () => {
      const result = await adapter.transcribe(testAudioBuffer, { language: 'en' });
      expect(result.isMock).toBe(true);
      expect(result.language).toBe('en');
      const allEnglishTexts = ENGLISH_STT_FIXTURES.map((f) => f.transcript);
      expect(allEnglishTexts).toContain(result.text);
    });

    it('transcribes into Hindi when language option is set to "hi"', async () => {
      const result = await adapter.transcribe(testAudioBuffer, { language: 'hi' });
      expect(result.isMock).toBe(true);
      expect(result.language).toBe('hi');
      const allHindiTexts = HINDI_STT_FIXTURES.map((f) => f.transcript);
      expect(allHindiTexts).toContain(result.text);
    });

    it('returns empty text and zero confidence on empty audio buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);
      const result = await adapter.transcribe(emptyBuffer);
      expect(result.text).toBe('');
      expect(result.confidence).toBe(0.0);
      expect(result.durationMs).toBe(0);
      expect(result.isMock).toBe(true);
    });

    it('detects pure PCM silence (all zeros) and returns empty transcription', async () => {
      const silentBuffer = Buffer.alloc(1024, 0);
      const result = await adapter.transcribe(silentBuffer);
      expect(result.text).toBe('');
      expect(result.confidence).toBe(0.0);
      expect(result.isMock).toBe(true);
    });
  });

  describe('LivePrismaSTTAdapter', () => {
    it('throws when GNANI_API_KEY is not provided', async () => {
      const liveAdapter = new LivePrismaSTTAdapter({ apiKey: '' });
      await expect(
        liveAdapter.transcribe(Buffer.from('sample audio'))
      ).rejects.toThrow('GNANI_API_KEY is required');
    });

    it('successfully calls live endpoint with mocked fetch response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          transcript: 'Live transcription from Vachana gateway',
          confidence: 0.97,
          language_detected: 'hi-en',
          duration_sec: 3.5,
        }),
      });

      const liveAdapter = new LivePrismaSTTAdapter({
        apiKey: 'test_gnani_key',
        endpointUrl: 'https://api.vachana.ai/api/v1/stt/transcribe',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const result = await liveAdapter.transcribe(Buffer.from('fake-audio-bytes'), { language: 'hi-en' });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.isMock).toBe(false);
      expect(result.text).toBe('Live transcription from Vachana gateway');
      expect(result.confidence).toBe(0.97);
      expect(result.durationMs).toBe(3500);
      expect(result.language).toBe('hi-en');
    });

    it('throws descriptive error on API HTTP failure', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid API Key',
      });

      const liveAdapter = new LivePrismaSTTAdapter({
        apiKey: 'invalid_key',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      await expect(liveAdapter.transcribe(Buffer.from('audio'))).rejects.toThrow(
        'Gnani Prisma STT API failed with HTTP 401'
      );
    });
  });

  describe('PrismaSTTAdapter Factory', () => {
    it('defaults to MockPrismaSTTAdapter in offline mode or without API key', async () => {
      const factory = new PrismaSTTAdapter({ mode: 'offline' });
      expect(factory.isLive).toBe(false);

      const result = await factory.transcribe(Buffer.from('audio buffer'));
      expect(result.isMock).toBe(true);
    });

    it('activates live mode when apiKey is provided and mode is live', async () => {
      const mockLive = {
        transcribe: vi.fn().mockResolvedValue({
          text: 'Mocked Live Result',
          language: 'en',
          confidence: 0.99,
          durationMs: 2000,
          isMock: false,
        }),
      };

      const factory = new PrismaSTTAdapter({
        mode: 'live',
        apiKey: 'gnani_secret_key',
        liveAdapter: mockLive,
      });

      expect(factory.isLive).toBe(true);
      const result = await factory.transcribe(Buffer.from('audio'));
      expect(mockLive.transcribe).toHaveBeenCalled();
      expect(result.text).toBe('Mocked Live Result');
      expect(result.isMock).toBe(false);
    });

    it('transparently falls back to mock adapter when live adapter fails with error', async () => {
      const failingLive = {
        transcribe: vi.fn().mockRejectedValue(new Error('Network gateway timeout 504')),
      };

      const factory = new PrismaSTTAdapter({
        mode: 'live',
        apiKey: 'gnani_secret_key',
        liveAdapter: failingLive,
        fallbackToMockOnError: true,
      });

      const result = await factory.transcribe(Buffer.from('audio samples'));
      expect(failingLive.transcribe).toHaveBeenCalled();
      expect(result.isMock).toBe(true);
      expect(result.text).toBeTruthy();
    });
  });
});

