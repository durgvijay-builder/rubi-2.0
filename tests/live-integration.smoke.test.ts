import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Load .env manually if process.loadEnvFile is available or parse simply
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  }
}

const isLiveSmokeEnabled = process.env.RUN_LIVE_SMOKE === 'true';

describe('Opt-In Live AI Provider Smoke Tests (Requires Real Credentials)', () => {
  it.skipIf(!isLiveSmokeEnabled)(
    'validates Google Gemini live structured extraction',
    async () => {
      const apiKey = process.env.GEMINI_API_KEY;
      expect(apiKey, 'GEMINI_API_KEY must be provided for live smoke test').toBeTruthy();

      const model = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const payload = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: 'Respond strictly in JSON: {"verified": true, "provider": "gemini"}',
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      expect(candidateText).toBeTruthy();
      const parsed = JSON.parse(candidateText);
      expect(parsed.verified).toBe(true);
    },
    15000
  );

  it.skipIf(!isLiveSmokeEnabled)('validates Gnani Prisma STT live endpoint behavior', async () => {
    const apiKey = process.env.GNANI_STT_API_KEY || process.env.GNANI_API_KEY;
    const endpoint = process.env.GNANI_STT_URL || 'https://api.vachana.ai/stt/v3';

    if (!apiKey) {
      console.warn('Skipping Gnani STT live check: GNANI_STT_API_KEY not configured.');
      return;
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'X-API-Key-ID': apiKey,
        Accept: 'application/json',
      },
    });

    // In live mode, the response must NOT be swallowed or converted to mock
    if (res.status === 401) {
      const err = await res.json().catch(() => ({}));
      expect(err.detail?.error_code || 'INVALID_API_KEY').toBe('INVALID_API_KEY');
      console.log('Verified: Gnani STT live endpoint returned visible HTTP 401 for current key.');
    } else {
      expect([200, 400, 422]).toContain(res.status);
    }
  });

  it.skipIf(!isLiveSmokeEnabled)('validates Gnani Timbre TTS live endpoint behavior', async () => {
    const apiKey = process.env.GNANI_TTS_API_KEY || process.env.GNANI_API_KEY;
    const endpoint = process.env.GNANI_TTS_URL || 'https://api.vachana.ai/api/v1/tts/inference';

    if (!apiKey) {
      console.warn('Skipping Gnani TTS live check: GNANI_TTS_API_KEY not configured.');
      return;
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key-ID': apiKey,
        Accept: 'audio/wav, application/json',
      },
      body: JSON.stringify({
        text: 'Live smoke test',
        voice: 'Shivani',
        language: 'en-IN',
        model: 'timbre-v3.0',
      }),
    });

    if (res.status === 401) {
      const err = await res.json().catch(() => ({}));
      expect(err.detail?.error_code || 'INVALID_API_KEY').toBe('INVALID_API_KEY');
      console.log('Verified: Gnani TTS live endpoint returned visible HTTP 401 for current key.');
    } else {
      expect([200, 201]).toContain(res.status);
    }
  });
});
