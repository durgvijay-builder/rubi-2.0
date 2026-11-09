import type {
  ProviderId,
  ProviderStatusCode,
  ProviderErrorCategory,
  ProviderHealthDetail,
  SystemProvidersStatus,
} from '@rubi/shared';
import { prisma } from '../db.js';

/**
 * Sanitizes error strings to guarantee secrets, API keys, bearer tokens,
 * and filesystem paths are never leaked to logs, network responses, or client UI.
 */
export function sanitizeErrorMessage(rawMessage: string): string {
  if (!rawMessage) return 'Unknown error';

  let sanitized = rawMessage;

  // 1. Remove Windows drive paths (e.g. C:\Users\... or d:\Programming\...)
  sanitized = sanitized.replace(/[a-zA-Z]:\\[^\s"',;)}\]]+/gi, '[FILE_PATH_REDACTED]');

  // 2. Remove Unix-style home paths
  sanitized = sanitized.replace(/(?:\/Users|\/home)\/[^\s"',;)}\]]+/gi, '[FILE_PATH_REDACTED]');

  // 3. Remove URL query parameter keys (e.g. key=AIza... or api_key=...)
  sanitized = sanitized.replace(/(?:key|api_key|apiKey|token|secret)=([^\s&"']+)/gi, '$1=[REDACTED]');

  // 4. Remove bearer / authorization tokens
  sanitized = sanitized.replace(/Bearer\s+[a-zA-Z0-9_\-.]+/gi, 'Bearer [REDACTED]');

  // 5. Remove long hex / base64 / token-like sequences (> 24 chars)
  sanitized = sanitized.replace(/\b[a-zA-Z0-9_-]{28,}\b/g, '[TOKEN_REDACTED]');

  // Clean and simplify common HTTP error patterns
  if (sanitized.includes('401') || sanitized.toLowerCase().includes('invalid_api_key') || sanitized.toLowerCase().includes('unauthorized')) {
    return 'Authentication failed: Invalid or unauthorized API credentials.';
  }
  if (sanitized.includes('403') || sanitized.toLowerCase().includes('forbidden')) {
    return 'Forbidden: Access denied by provider for the given credentials.';
  }
  if (sanitized.includes('429') || sanitized.toLowerCase().includes('quota') || sanitized.toLowerCase().includes('rate limit')) {
    return 'Rate limit exceeded: Provider request quota exhausted.';
  }
  if (sanitized.includes('ECONNREFUSED') || sanitized.includes('ENOTFOUND') || sanitized.includes('ETIMEDOUT')) {
    return 'Network error: Unable to reach provider service endpoint.';
  }
  if (sanitized.includes('UNSUPPORTED_AUDIO_FORMAT') || sanitized.includes('Unsupported audio format')) {
    return 'Unsupported audio format. Provider accepts WAV, MP3, OGG, AAC, and FLAC.';
  }

  return sanitized.trim();
}

export function categorizeError(error: unknown): ProviderErrorCategory {
  const str = String(error instanceof Error ? error.message : error).toLowerCase();
  if (str.includes('401') || str.includes('invalid_api_key') || str.includes('unauthorized') || str.includes('403') || str.includes('forbidden')) {
    return 'AUTH';
  }
  if (str.includes('429') || str.includes('quota') || str.includes('rate limit') || str.includes('resource_exhausted')) {
    return 'RATE_LIMIT';
  }
  if (str.includes('timeout') || str.includes('etimedout')) {
    return 'TIMEOUT';
  }
  if (str.includes('econnrefused') || str.includes('enotfound') || str.includes('network')) {
    return 'NETWORK';
  }
  if (str.includes('500') || str.includes('502') || str.includes('503') || str.includes('504')) {
    return 'SERVER_ERROR';
  }
  if (str.includes('required') || str.includes('not set') || str.includes('missing')) {
    return 'CONFIG';
  }
  return 'SERVER_ERROR';
}

export class ProviderStatusService {
  private providers: Map<ProviderId, ProviderHealthDetail> = new Map();

  constructor() {
    this.initProviders();
  }

  private initProviders() {
    const rubiMode = (process.env.RUBI_MODE ?? 'offline').toLowerCase();
    const isLive = rubiMode === 'live';

    // 1. Database
    this.providers.set('database', {
      id: 'database',
      name: 'PostgreSQL Relational DB',
      status: 'NOT_VERIFIED',
      isMock: false,
      configuredModel: 'PostgreSQL 15+ / Prisma ORM',
    });

    // 2. STT
    const hasSttKey = Boolean(process.env.GNANI_STT_API_KEY || process.env.GNANI_API_KEY);
    this.providers.set('stt', {
      id: 'stt',
      name: 'Gnani Prisma STT',
      status: isLive ? (hasSttKey ? 'NOT_VERIFIED' : 'AUTHENTICATION_FAILED') : 'OFFLINE_MOCK',
      isMock: !isLive,
      configuredModel: 'prisma-v3.0',
    });

    // 3. Gemini
    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);
    const geminiModel = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
    this.providers.set('gemini', {
      id: 'gemini',
      name: 'Google Gemini',
      status: isLive ? (hasGeminiKey ? 'NOT_VERIFIED' : 'AUTHENTICATION_FAILED') : 'OFFLINE_MOCK',
      isMock: !isLive,
      configuredModel: geminiModel,
    });

    // 4. TTS (Gnani Timbre or ElevenLabs depending on RUBI_TTS_PROVIDER)
    const ttsProvider = (process.env.RUBI_TTS_PROVIDER ?? 'gnani').toLowerCase();
    const isElevenLabs = ttsProvider === 'elevenlabs';
    const hasTtsKey = isElevenLabs
      ? Boolean(process.env.ELEVENLABS_API_KEY)
      : Boolean(process.env.GNANI_TTS_API_KEY || process.env.GNANI_API_KEY);

    this.providers.set('tts', {
      id: 'tts',
      name: isElevenLabs ? 'ElevenLabs TTS' : 'Gnani Timbre TTS',
      status: isLive ? (hasTtsKey ? 'NOT_VERIFIED' : 'AUTHENTICATION_FAILED') : 'OFFLINE_MOCK',
      isMock: !isLive,
      configuredModel: isElevenLabs
        ? (process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2')
        : 'timbre-v3.0',
    });
  }

  recordSuccess(id: ProviderId, model?: string) {
    const existing = this.providers.get(id);
    if (!existing) return;

    this.providers.set(id, {
      ...existing,
      status: 'CONNECTED',
      isMock: false,
      lastVerifiedAt: new Date().toISOString(),
      lastError: null,
      errorCategory: null,
      configuredModel: model ?? existing.configuredModel,
    });
  }

  recordFailure(id: ProviderId, error: unknown, category?: ProviderErrorCategory) {
    const existing = this.providers.get(id);
    if (!existing) return;

    const rawMessage = error instanceof Error ? error.message : String(error);
    const cat = category ?? categorizeError(error);
    const isAuth = cat === 'AUTH' || cat === 'CONFIG';
    const status: ProviderStatusCode = isAuth ? 'AUTHENTICATION_FAILED' : 'UNAVAILABLE';
    const sanitizedMsg = sanitizeErrorMessage(rawMessage);

    this.providers.set(id, {
      ...existing,
      status,
      lastFailureAt: new Date().toISOString(),
      lastError: sanitizedMsg,
      errorCategory: cat,
    });
  }

  getStatus(): SystemProvidersStatus {
    const rubiMode = (process.env.RUBI_MODE ?? 'offline').toLowerCase() as 'live' | 'offline' | 'auto';
    const db = this.providers.get('database')!;
    const stt = this.providers.get('stt')!;
    const gemini = this.providers.get('gemini')!;
    const tts = this.providers.get('tts')!;

    let overallStatus: 'healthy' | 'degraded' | 'offline' = 'healthy';
    if (rubiMode === 'offline') {
      overallStatus = 'offline';
    } else {
      const anyAuthFailed = [stt, gemini, tts].some((p) => p.status === 'AUTHENTICATION_FAILED');
      const anyUnavailable = [stt, gemini, tts].some((p) => p.status === 'UNAVAILABLE');
      if (anyAuthFailed || anyUnavailable || db.status !== 'CONNECTED') {
        overallStatus = 'degraded';
      }
    }

    return {
      database: db,
      stt,
      gemini,
      tts,
      mode: rubiMode,
      overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  /**
   * Actively probes services to verify live connectivity.
   */
  async verifyAll(): Promise<SystemProvidersStatus> {
    const rubiMode = (process.env.RUBI_MODE ?? 'offline').toLowerCase();

    // 1. Verify Database
    try {
      await prisma.$queryRaw`SELECT 1`;
      this.recordSuccess('database');
    } catch (err) {
      this.recordFailure('database', err, 'SERVER_ERROR');
    }

    if (rubiMode !== 'live') {
      // Offline mode
      return this.getStatus();
    }

    // 2. Verify Gemini
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      this.recordFailure('gemini', 'GEMINI_API_KEY is not configured', 'CONFIG');
    } else {
      try {
        const model = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
            generationConfig: { maxOutputTokens: 1 },
          }),
        });
        if (res.ok) {
          this.recordSuccess('gemini', model);
        } else {
          const errText = await res.text();
          this.recordFailure('gemini', `HTTP ${res.status}: ${errText}`);
        }
      } catch (err) {
        this.recordFailure('gemini', err);
      }
    }

    // 3. Verify Gnani STT
    const sttKey = process.env.GNANI_STT_API_KEY || process.env.GNANI_API_KEY;
    if (!sttKey) {
      this.recordFailure('stt', 'GNANI_STT_API_KEY is not configured', 'CONFIG');
    } else {
      try {
        const endpoint = process.env.GNANI_STT_URL || 'https://api.vachana.ai/stt/v3';
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'X-API-Key-ID': sttKey,
            Accept: 'application/json',
          },
        });
        // 401/403 means auth failure; 200 or 400 (missing body) means key was accepted
        if (res.status === 401 || res.status === 403) {
          const errText = await res.text();
          this.recordFailure('stt', `HTTP ${res.status}: ${errText}`, 'AUTH');
        } else if (res.ok || res.status === 400 || res.status === 422) {
          // If status is 400/422, auth succeeded but payload was empty
          this.recordSuccess('stt');
        } else {
          this.recordFailure('stt', `HTTP ${res.status}`);
        }
      } catch (err) {
        this.recordFailure('stt', err);
      }
    }

    // 4. Verify Active TTS Provider (Gnani or ElevenLabs)
    const isElevenLabsTTS = (process.env.RUBI_TTS_PROVIDER ?? 'gnani').toLowerCase() === 'elevenlabs';
    if (isElevenLabsTTS) {
      const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
      if (!elevenLabsKey) {
        this.recordFailure('tts', 'ELEVENLABS_API_KEY is not configured', 'CONFIG');
      } else {
        try {
          const res = await fetch('https://api.elevenlabs.io/v1/user', {
            method: 'GET',
            headers: {
              'xi-api-key': elevenLabsKey,
              Accept: 'application/json',
            },
          });
          if (res.status === 401 || res.status === 403) {
            const errText = await res.text();
            this.recordFailure('tts', `HTTP ${res.status}: ${errText}`, 'AUTH');
          } else if (res.ok) {
            this.recordSuccess('tts', process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2');
          } else {
            this.recordFailure('tts', `HTTP ${res.status}`);
          }
        } catch (err) {
          this.recordFailure('tts', err);
        }
      }
    } else {
      const ttsKey = process.env.GNANI_TTS_API_KEY || process.env.GNANI_API_KEY;
      if (!ttsKey) {
        this.recordFailure('tts', 'GNANI_TTS_API_KEY is not configured', 'CONFIG');
      } else {
        try {
          const endpoint = process.env.GNANI_TTS_URL || 'https://api.vachana.ai/api/v1/tts/inference';
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key-ID': ttsKey,
              Accept: 'audio/wav, application/json',
            },
            body: JSON.stringify({
              text: 'ping',
              voice: 'Shivani',
              language: 'en-IN',
              model: 'timbre-v3.0',
            }),
          });
          if (res.status === 401 || res.status === 403) {
            const errText = await res.text();
            this.recordFailure('tts', `HTTP ${res.status}: ${errText}`, 'AUTH');
          } else if (res.ok) {
            this.recordSuccess('tts', 'timbre-v3.0');
          } else {
            this.recordFailure('tts', `HTTP ${res.status}`);
          }
        } catch (err) {
          this.recordFailure('tts', err);
        }
      }
    }

    return this.getStatus();
  }
}

export const providerStatusService = new ProviderStatusService();

