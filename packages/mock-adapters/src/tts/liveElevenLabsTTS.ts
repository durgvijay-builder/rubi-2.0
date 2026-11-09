import type { ITTSAdapter, TTSOptions, TTSResult } from '@rubi/shared';

export interface LiveElevenLabsTTSOptions {
  apiKey?: string;
  voiceId?: string;
  modelId?: string;
  endpointUrl?: string;
  fetchFn?: typeof fetch;
}

/**
 * Live HTTP client for ElevenLabs Neural Text-to-Speech API.
 * Connects to https://api.elevenlabs.io/v1/text-to-speech/{voice_id}
 */
export class LiveElevenLabsTTSAdapter implements ITTSAdapter {
  private readonly apiKey: string;
  private readonly voiceId: string;
  private readonly modelId: string;
  private readonly endpointUrl: string;
  private readonly fetch: typeof fetch;

  constructor(options?: LiveElevenLabsTTSOptions) {
    this.apiKey =
      options?.apiKey ??
      process.env.ELEVENLABS_API_KEY ??
      '';
    this.voiceId =
      options?.voiceId ??
      process.env.ELEVENLABS_VOICE_ID ??
      '21m00Tcm4TlvDq8ikWAM'; // Default voice: Rachel
    this.modelId =
      options?.modelId ??
      process.env.ELEVENLABS_MODEL_ID ??
      'eleven_multilingual_v2';
    this.endpointUrl =
      options?.endpointUrl ??
      `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`;
    this.fetch = options?.fetchFn ?? globalThis.fetch;
  }

  async synthesize(text: string, options?: TTSOptions): Promise<TTSResult> {
    if (!this.apiKey) {
      throw new Error(
        'ELEVENLABS_API_KEY is required for LiveElevenLabsTTSAdapter. Set ELEVENLABS_API_KEY environment variable or pass to constructor.'
      );
    }

    const trimmedText = text?.trim() ?? '';
    if (!trimmedText) {
      throw new Error('TTS synthesis requires non-empty text input.');
    }

    const voiceId = options?.voice ?? this.voiceId;
    const url = this.endpointUrl.includes(this.voiceId) && voiceId !== this.voiceId
      ? `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`
      : this.endpointUrl;

    const payload = {
      text: trimmedText,
      model_id: this.modelId,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        speed: options?.speed ?? 1.0,
      },
    };

    const response = await this.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': this.apiKey,
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown network error');
      throw new Error(
        `ElevenLabs TTS API failed with HTTP ${response.status} (${response.statusText}): ${errorText}`
      );
    }

    const arrayBuf = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuf);
    const durationMs = Math.max(1000, Math.round((trimmedText.length * 60) / (options?.speed ?? 1.0)));

    return {
      audioBuffer,
      mimeType: 'audio/mpeg',
      durationMs,
      isMock: false,
    };
  }
}

