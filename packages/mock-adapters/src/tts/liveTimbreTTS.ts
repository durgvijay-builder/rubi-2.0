import type { ITTSAdapter, TTSOptions, TTSResult } from '@rubi/shared';

export interface LiveTimbreTTSOptions {
  apiKey?: string;
  endpointUrl?: string;
  fetchFn?: typeof fetch;
}

/**
 * Live HTTP client for Gnani.ai Timbre Neural TTS service.
 * Connects to https://api.vachana.ai/api/v1/tts/inference
 */
export class LiveTimbreTTSAdapter implements ITTSAdapter {
  private readonly apiKey: string;
  private readonly endpointUrl: string;
  private readonly fetch: typeof fetch;

  constructor(options?: LiveTimbreTTSOptions) {
    this.apiKey =
      options?.apiKey ??
      process.env.GNANI_TTS_API_KEY ??
      process.env.GNANI_API_KEY ??
      '';
    this.endpointUrl =
      options?.endpointUrl ??
      process.env.GNANI_TTS_URL ??
      'https://api.vachana.ai/api/v1/tts/inference';
    this.fetch = options?.fetchFn ?? globalThis.fetch;
  }

  async synthesize(text: string, options?: TTSOptions): Promise<TTSResult> {
    if (!this.apiKey) {
      throw new Error(
        'GNANI_TTS_API_KEY or GNANI_API_KEY is required for LiveTimbreTTSAdapter. Set GNANI_TTS_API_KEY environment variable or pass to constructor.'
      );
    }

    const trimmedText = text?.trim() ?? '';
    if (!trimmedText) {
      throw new Error('TTS synthesis requires non-empty text input.');
    }

    const languageBcp47 = this.mapLanguageBcp47(options?.language);
    const voiceName = this.mapVoice(options?.voice);

    const payload = {
      text: trimmedText,
      voice: voiceName,
      language: languageBcp47,
      model: 'timbre-v3.0',
      speed: options?.speed ?? 1.0,
    };

    const response = await this.fetch(this.endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key-ID': this.apiKey,
        Accept: 'audio/wav, application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown network error');
      throw new Error(
        `Gnani Timbre TTS API failed with HTTP ${response.status} (${response.statusText}): ${errorText}`
      );
    }

    const contentType = response.headers.get('content-type') ?? '';

    let audioBuffer: Buffer;
    let durationMs = Math.max(1000, Math.round((trimmedText.length * 65) / (options?.speed ?? 1.0)));

    if (contentType.includes('application/json')) {
      const data = (await response.json()) as {
        audioBase64?: string;
        audio_content?: string;
        audio?: string;
        duration_ms?: number;
        duration_sec?: number;
      };
      const base64Str = data.audioBase64 ?? data.audio_content ?? data.audio ?? '';
      audioBuffer = Buffer.from(base64Str, 'base64');
      if (typeof data.duration_ms === 'number') {
        durationMs = data.duration_ms;
      } else if (typeof data.duration_sec === 'number') {
        durationMs = Math.round(data.duration_sec * 1000);
      }
    } else {
      const arrayBuf = await response.arrayBuffer();
      audioBuffer = Buffer.from(arrayBuf);
    }

    return {
      audioBuffer,
      mimeType: 'audio/wav',
      durationMs,
      isMock: false,
    };
  }

  private mapVoice(voice?: string): string {
    if (!voice || !voice.trim()) return 'Shivani';
    const trimmed = voice.trim();
    if (trimmed.toLowerCase() === 'en-us-standard' || trimmed.toLowerCase() === 'default') {
      return 'Shivani';
    }
    return trimmed;
  }

  private mapLanguageBcp47(lang?: string): string {
    if (!lang) return 'hi-IN';
    const normalized = lang.trim().toLowerCase();
    if (normalized === 'en' || normalized === 'en-in' || normalized === 'en-us') {
      return 'en-IN';
    }
    if (normalized === 'hi' || normalized === 'hi-in' || normalized === 'hi-en') {
      return 'hi-IN';
    }
    return lang;
  }
}

