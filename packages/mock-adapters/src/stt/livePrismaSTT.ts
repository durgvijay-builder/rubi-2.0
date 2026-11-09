import { detectAudioFormat, type ISTTAdapter, type STTOptions, type STTResult } from '@rubi/shared';

export interface LivePrismaSTTOptions {
  apiKey?: string;
  endpointUrl?: string;
  fetchFn?: typeof fetch;
}

/**
 * Live HTTP client for Gnani.ai Prisma STT transcription service.
 * Connects to https://api.vachana.ai/stt/v3 (Prisma v3.0 REST API)
 */
export class LivePrismaSTTAdapter implements ISTTAdapter {
  private readonly apiKey: string;
  private readonly endpointUrl: string;
  private readonly fetch: typeof fetch;

  constructor(options?: LivePrismaSTTOptions) {
    this.apiKey =
      options?.apiKey ??
      process.env.GNANI_STT_API_KEY ??
      process.env.GNANI_API_KEY ??
      '';
    this.endpointUrl =
      options?.endpointUrl ??
      process.env.GNANI_STT_URL ??
      'https://api.vachana.ai/stt/v3';
    this.fetch = options?.fetchFn ?? globalThis.fetch;
  }

  async transcribe(audioBuffer: Buffer, options?: STTOptions): Promise<STTResult> {
    if (!this.apiKey) {
      throw new Error(
        'GNANI_STT_API_KEY or GNANI_API_KEY is required for LivePrismaSTTAdapter. Set GNANI_STT_API_KEY environment variable or pass to constructor.'
      );
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      return {
        text: '',
        language: options?.language ?? 'hi-en',
        confidence: 0.0,
        durationMs: 0,
        isMock: false,
      };
    }

    // Inspect audio buffer magic bytes to determine real format
    const formatInfo = detectAudioFormat(audioBuffer);

    // Resolve accurate MIME type and extension based on magic bytes inspection
    let mimeType: string;
    let extension: string;

    if (formatInfo.isValid) {
      mimeType = options?.mimeType ?? options?.encoding ?? formatInfo.mimeType;
      extension = formatInfo.extension;
    } else if (options?.mimeType || options?.encoding) {
      mimeType = options?.mimeType ?? options?.encoding ?? 'audio/wav';
      extension = options?.filename?.split('.').pop() || (mimeType.includes('webm') ? 'webm' : 'wav');
    } else {
      mimeType = 'audio/wav';
      extension = 'wav';
    }

    const filename = options?.filename ?? `audio.${extension}`;

    // Map internal language codes to Gnani Prisma v3.0 language_code parameter
    const languageCode = this.mapLanguageCode(options?.language);

    const formData = new FormData();
    const arrayBuffer = new ArrayBuffer(audioBuffer.length);
    new Uint8Array(arrayBuffer).set(audioBuffer);
    const audioBlob = new Blob([arrayBuffer], { type: mimeType });
    formData.append('audio_file', audioBlob, filename);
    formData.append('model', 'prisma-v3.0');
    formData.append('language_code', languageCode);

    const response = await this.fetch(this.endpointUrl, {
      method: 'POST',
      headers: {
        'X-API-Key-ID': this.apiKey,
        Accept: 'application/json',
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown network error');
      throw new Error(
        `Gnani Prisma STT API failed with HTTP ${response.status} (${response.statusText}): ${errorText}`
      );
    }

    const data = (await response.json()) as {
      success?: boolean;
      request_id?: string;
      transcript?: string;
      text?: string;
      confidence?: number;
      detected_language_code?: string;
      language_detected?: string;
      language?: string;
      processing_time?: number;
      end_to_end_latency?: number;
      duration_sec?: number;
      duration_ms?: number;
    };

    const text = data.transcript ?? data.text ?? '';
    const confidence = typeof data.confidence === 'number' ? data.confidence : 0.95;
    const detectedLang =
      data.detected_language_code ??
      data.language_detected ??
      data.language ??
      options?.language ??
      'hi-en';
    const durationMs =
      typeof data.duration_ms === 'number'
        ? data.duration_ms
        : typeof data.duration_sec === 'number'
          ? Math.round(data.duration_sec * 1000)
          : typeof data.processing_time === 'number'
            ? Math.round(data.processing_time * 1000)
            : Math.round((audioBuffer.length / 32000) * 1000);

    return {
      text,
      language: detectedLang,
      confidence,
      durationMs,
      isMock: false,
    };
  }

  private mapLanguageCode(lang?: 'en' | 'hi' | 'hi-en'): string {
    switch (lang) {
      case 'en':
        return 'en-IN';
      case 'hi':
        return 'hi-IN';
      case 'hi-en':
      default:
        return 'indic-auto';
    }
  }
}
