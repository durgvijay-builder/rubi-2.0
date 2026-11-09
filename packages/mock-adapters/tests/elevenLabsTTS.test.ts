import { describe, it, expect, vi } from 'vitest';
import { LiveElevenLabsTTSAdapter } from '../src/tts/liveElevenLabsTTS.js';
import { TimbreTTSAdapter } from '../src/tts/timbreTTS.js';

describe('ElevenLabs TTS Adapter & Provider Selection', () => {
  it('throws error when ELEVENLABS_API_KEY is not configured', async () => {
    const adapter = new LiveElevenLabsTTSAdapter({ apiKey: '' });
    await expect(adapter.synthesize('Hello world')).rejects.toThrow(
      'ELEVENLABS_API_KEY is required for LiveElevenLabsTTSAdapter'
    );
  });

  it('rejects empty text input', async () => {
    const adapter = new LiveElevenLabsTTSAdapter({ apiKey: 'test_key' });
    await expect(adapter.synthesize('   ')).rejects.toThrow(
      'TTS synthesis requires non-empty text input'
    );
  });

  it('successfully makes HTTP request with xi-api-key and returns MP3 audioBuffer', async () => {
    const mockAudioBytes = Buffer.from([0xff, 0xfb, 0x90, 0x44, 0x01, 0x02, 0x03, 0x04]);

    const arrayBuffer = mockAudioBytes.buffer.slice(
      mockAudioBytes.byteOffset,
      mockAudioBytes.byteOffset + mockAudioBytes.byteLength
    );

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'audio/mpeg' }),
      arrayBuffer: async () => arrayBuffer,
    });

    const adapter = new LiveElevenLabsTTSAdapter({
      apiKey: 'el_test_key_123',
      voiceId: '21m00Tcm4TlvDq8ikWAM',
      modelId: 'eleven_multilingual_v2',
      fetchFn: mockFetch as any,
    });

    const result = await adapter.synthesize('Task completed successfully.');

    expect(result.isMock).toBe(false);
    expect(result.mimeType).toBe('audio/mpeg');
    expect(result.audioBuffer).toBeInstanceOf(Buffer);
    expect(result.audioBuffer.length).toBe(mockAudioBytes.length);
    expect(result.durationMs).toBeGreaterThan(0);

    // Verify fetch parameters
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [callUrl, callInit] = mockFetch.mock.calls[0];
    expect(callUrl).toContain('21m00Tcm4TlvDq8ikWAM');
    expect(callInit.headers['xi-api-key']).toBe('el_test_key_123');
    expect(callInit.headers['Accept']).toBe('audio/mpeg');

    const bodyObj = JSON.parse(callInit.body);
    expect(bodyObj.text).toBe('Task completed successfully.');
    expect(bodyObj.model_id).toBe('eleven_multilingual_v2');
  });

  it('TimbreTTSAdapter dynamically selects elevenlabs when RUBI_TTS_PROVIDER=elevenlabs', async () => {
    const originalEnv = process.env.RUBI_TTS_PROVIDER;
    const originalKey = process.env.ELEVENLABS_API_KEY;

    try {
      process.env.RUBI_TTS_PROVIDER = 'elevenlabs';
      process.env.ELEVENLABS_API_KEY = 'mock_xi_key';
      process.env.RUBI_MODE = 'live';

      const factoryAdapter = new TimbreTTSAdapter();
      expect(factoryAdapter.provider).toBe('elevenlabs');
      expect(factoryAdapter.isLive).toBe(true);
    } finally {
      process.env.RUBI_TTS_PROVIDER = originalEnv;
      process.env.ELEVENLABS_API_KEY = originalKey;
    }
  });

  it('TimbreTTSAdapter defaults to gnani when RUBI_TTS_PROVIDER is unset or gnani', async () => {
    const originalEnv = process.env.RUBI_TTS_PROVIDER;
    const originalKey = process.env.GNANI_TTS_API_KEY;

    try {
      process.env.RUBI_TTS_PROVIDER = 'gnani';
      process.env.GNANI_TTS_API_KEY = 'mock_gnani_key';
      process.env.RUBI_MODE = 'live';

      const factoryAdapter = new TimbreTTSAdapter();
      expect(factoryAdapter.provider).toBe('gnani');
      expect(factoryAdapter.isLive).toBe(true);
    } finally {
      process.env.RUBI_TTS_PROVIDER = originalEnv;
      process.env.GNANI_TTS_API_KEY = originalKey;
    }
  });
});
