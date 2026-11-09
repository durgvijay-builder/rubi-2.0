import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';

describe('Empirical Adversarial Stress Tests: POST & GET /api/speech/synthesize', () => {
  // =========================================================================
  // 1. Binary Audio Streaming Content-Negotiation & Header Verification
  // =========================================================================
  describe('Binary Streaming Content-Negotiation', () => {
    it('returns raw binary WAV stream when Accept is "audio/wav"', async () => {
      const res = await request(app)
        .post('/api/speech/synthesize')
        .set('Accept', 'audio/wav')
        .send({ text: 'Binary WAV stream test' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('audio/wav');
      expect(Buffer.isBuffer(res.body)).toBe(true);
      const buf = res.body as Buffer;

      // RIFF header byte verification
      expect(buf.toString('ascii', 0, 4)).toBe('RIFF');
      expect(buf.readUInt32LE(4)).toBe(buf.length - 8);
      expect(buf.toString('ascii', 8, 12)).toBe('WAVE');
      expect(buf.toString('ascii', 12, 16)).toBe('fmt ');
      expect(buf.readUInt32LE(16)).toBe(16);
      expect(buf.readUInt16LE(20)).toBe(1); // PCM
      expect(buf.readUInt16LE(22)).toBe(1); // Mono
      expect(buf.readUInt32LE(24)).toBe(44100); // 44.1kHz
      expect(buf.readUInt16LE(34)).toBe(16); // 16-bit
      expect(buf.toString('ascii', 36, 40)).toBe('data');

      // Content-Length header verification
      expect(res.headers['content-length']).toBe(buf.length.toString());
      expect(res.headers['content-disposition']).toBe('inline; filename="synthesized.wav"');
    });

    it('returns raw binary WAV stream when Accept is "audio/*"', async () => {
      const res = await request(app)
        .post('/api/speech/synthesize')
        .set('Accept', 'audio/*')
        .send({ text: 'Audio wildcard stream test' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('audio/wav');
      expect(Buffer.isBuffer(res.body)).toBe(true);
      expect(res.body.toString('ascii', 0, 4)).toBe('RIFF');
    });

    it('returns binary WAV stream when format=binary query param is present', async () => {
      const res = await request(app)
        .post('/api/speech/synthesize?format=binary')
        .send({ text: 'Query format=binary stream test' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('audio/wav');
      expect(Buffer.isBuffer(res.body)).toBe(true);
      expect(res.body.toString('ascii', 0, 4)).toBe('RIFF');
    });

    it('returns binary WAV stream when format=wav query param is present', async () => {
      const res = await request(app)
        .post('/api/speech/synthesize?format=wav')
        .send({ text: 'Query format=wav stream test' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('audio/wav');
      expect(Buffer.isBuffer(res.body)).toBe(true);
    });

    it('returns binary WAV stream when stream=true query param is present', async () => {
      const res = await request(app)
        .post('/api/speech/synthesize?stream=true')
        .send({ text: 'Query stream=true stream test' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('audio/wav');
      expect(Buffer.isBuffer(res.body)).toBe(true);
    });

    it('returns JSON response by default (Accept: */* or application/json)', async () => {
      const res = await request(app)
        .post('/api/speech/synthesize')
        .set('Accept', 'application/json')
        .send({ text: 'JSON response verification' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/json');
      expect(typeof res.body.audioBase64).toBe('string');
      expect(res.body.mimeType).toBe('audio/wav');
      expect(res.body.durationMs).toBeGreaterThan(0);
      expect(res.body.isMock).toBe(true);

      // Verify decoded base64 is a byte-accurate RIFF WAV buffer
      const decodedBuffer = Buffer.from(res.body.audioBase64, 'base64');
      expect(decodedBuffer.toString('ascii', 0, 4)).toBe('RIFF');
      expect(decodedBuffer.readUInt32LE(4)).toBe(decodedBuffer.length - 8);
      expect(decodedBuffer.toString('ascii', 8, 12)).toBe('WAVE');
      expect(decodedBuffer.toString('ascii', 12, 16)).toBe('fmt ');
      expect(decodedBuffer.readUInt16LE(20)).toBe(1);
      expect(decodedBuffer.readUInt32LE(24)).toBe(44100);
      expect(decodedBuffer.readUInt16LE(34)).toBe(16);
      expect(decodedBuffer.toString('ascii', 36, 40)).toBe('data');
    });

    it('returns raw binary WAV stream on composite Accept header ("audio/wav, text/html")', async () => {
      const res = await request(app)
        .post('/api/speech/synthesize')
        .set('Accept', 'audio/wav, text/html;q=0.9')
        .send({ text: 'Composite accept header check' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('audio/wav');
      expect(Buffer.isBuffer(res.body)).toBe(true);
      const buf = res.body as Buffer;
      expect(buf.toString('ascii', 0, 4)).toBe('RIFF');
      expect(buf.toString('ascii', 8, 12)).toBe('WAVE');
    });
  });

  // =========================================================================
  // 2. Input Validation, Malformed Payloads & Edge Cases
  // =========================================================================
  describe('Input Validation & Error Guarding', () => {
    it('rejects empty text string with HTTP 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/speech/synthesize')
        .send({ text: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Bad Request');
      expect(res.body.message).toContain('Text is required');
    });

    it('rejects whitespace-only text with HTTP 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/speech/synthesize')
        .send({ text: '    \t\n   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Bad Request');
    });

    it('rejects missing text property with HTTP 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/speech/synthesize')
        .send({ voice: 'Shivani' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Bad Request');
    });

    it('rejects non-string text types (number, boolean, object, array) with HTTP 400', async () => {
      const invalidTypes = [12345, true, false, { message: 'hi' }, ['an', 'array'], null];

      for (const invalid of invalidTypes) {
        const res = await request(app)
          .post('/api/speech/synthesize')
          .send({ text: invalid });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Bad Request');
      }
    });

    it('handles 1-character text successfully', async () => {
      const res = await request(app)
        .post('/api/speech/synthesize')
        .send({ text: 'Z' });

      expect(res.status).toBe(200);
      expect(res.body.spokenText).toBe('Z');
      expect(res.body.durationMs).toBe(1200); // Clamped minimum
    });

    it('handles massive text (12,000 chars) clamping duration to 15s', async () => {
      const massiveText = 'Task backlog item confirmation. '.repeat(400);
      expect(massiveText.length).toBeGreaterThan(12000);

      const res = await request(app)
        .post('/api/speech/synthesize')
        .send({ text: massiveText });

      expect(res.status).toBe(200);
      expect(res.body.durationMs).toBe(15000); // Maximum clamped
      expect(res.body.durationSeconds).toBe(15);
    });

    it('handles Hindi Unicode characters and preserves spokenText accurately', async () => {
      const hindiPrompt = 'कृपया अगला स्प्रिंट टास्क अप्रूव करें।';
      const res = await request(app)
        .post('/api/speech/synthesize')
        .send({ text: hindiPrompt, language: 'hi' });

      expect(res.status).toBe(200);
      expect(res.body.spokenText).toBe(hindiPrompt);
      expect(res.body.audioBase64).toBeTruthy();
    });

    it('handles emojis and symbols without corrupting response', async () => {
      const emojiPrompt = '⚡ Complete sprint task #42! 🎯 🚀';
      const res = await request(app)
        .post('/api/speech/synthesize')
        .send({ text: emojiPrompt });

      expect(res.status).toBe(200);
      expect(res.body.spokenText).toBe(emojiPrompt);
      expect(res.body.audioBase64).toBeTruthy();
    });
  });

  // =========================================================================
  // 3. Speed Parameter Handling in HTTP Endpoint
  // =========================================================================
  describe('Speed Parameter Variations in API Endpoint', () => {
    const sampleText = 'Testing speed multiplier in synthesize endpoint.';

    it('honors speed: 0.5 (slow) producing longer duration', async () => {
      const normalRes = await request(app)
        .post('/api/speech/synthesize')
        .send({ text: sampleText, speed: 1.0 });

      const slowRes = await request(app)
        .post('/api/speech/synthesize')
        .send({ text: sampleText, speed: 0.5 });

      expect(slowRes.body.durationMs).toBeGreaterThan(normalRes.body.durationMs);
    });

    it('honors speed: 2.0 (fast) producing shorter duration', async () => {
      const normalRes = await request(app)
        .post('/api/speech/synthesize')
        .send({ text: sampleText, speed: 1.0 });

      const fastRes = await request(app)
        .post('/api/speech/synthesize')
        .send({ text: sampleText, speed: 2.0 });

      expect(fastRes.body.durationMs).toBeLessThan(normalRes.body.durationMs);
    });

    it('clamps speed 0.25 to 0.5x gracefully', async () => {
      const res025 = await request(app)
        .post('/api/speech/synthesize')
        .send({ text: sampleText, speed: 0.25 });

      const res050 = await request(app)
        .post('/api/speech/synthesize')
        .send({ text: sampleText, speed: 0.5 });

      expect(res025.status).toBe(200);
      expect(res025.body.durationMs).toBe(res050.body.durationMs);
    });

    it('clamps speed 4.0 to 2.0x gracefully', async () => {
      const res400 = await request(app)
        .post('/api/speech/synthesize')
        .send({ text: sampleText, speed: 4.0 });

      const res200 = await request(app)
        .post('/api/speech/synthesize')
        .send({ text: sampleText, speed: 2.0 });

      expect(res400.status).toBe(200);
      expect(res400.body.durationMs).toBe(res200.body.durationMs);
    });

    it('clamps negative speed (-2.0) to 0.5x gracefully', async () => {
      const res = await request(app)
        .post('/api/speech/synthesize')
        .send({ text: sampleText, speed: -2.0 });

      expect(res.status).toBe(200);
      const resMin = await request(app)
        .post('/api/speech/synthesize')
        .send({ text: sampleText, speed: 0.5 });
      expect(res.body.durationMs).toBe(resMin.body.durationMs);
    });

    it('handles non-numeric speed string ("ultra-fast") by ignoring and defaulting to 1.0', async () => {
      const stringSpeedRes = await request(app)
        .post('/api/speech/synthesize')
        .send({ text: sampleText, speed: 'ultra-fast' });

      const normalRes = await request(app)
        .post('/api/speech/synthesize')
        .send({ text: sampleText, speed: 1.0 });

      expect(stringSpeedRes.status).toBe(200);
      expect(stringSpeedRes.body.durationMs).toBe(normalRes.body.durationMs);
    });
  });

  // =========================================================================
  // 4. GET /api/speech/synthesize Endpoint
  // =========================================================================
  describe('GET /api/speech/synthesize Endpoint', () => {
    it('returns binary WAV stream with audio/wav Content-Type', async () => {
      const res = await request(app)
        .get('/api/speech/synthesize')
        .query({ text: 'HTML5 audio element test', voice: 'Shivani' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('audio/wav');
      expect(Buffer.isBuffer(res.body)).toBe(true);
      expect(res.body.toString('ascii', 0, 4)).toBe('RIFF');
      expect(res.headers['content-disposition']).toBe('inline; filename="spoken.wav"');
    });

    it('rejects missing text query param with HTTP 400', async () => {
      const res = await request(app).get('/api/speech/synthesize');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Bad Request');
    });

    it('rejects empty text query param with HTTP 400', async () => {
      const res = await request(app).get('/api/speech/synthesize?text=');
      expect(res.status).toBe(400);
    });

    it('supports speed query parameter in GET request', async () => {
      const slowRes = await request(app)
        .get('/api/speech/synthesize')
        .query({ text: 'Speed query parameter in GET', speed: '0.5' });

      const fastRes = await request(app)
        .get('/api/speech/synthesize')
        .query({ text: 'Speed query parameter in GET', speed: '2.0' });

      expect(slowRes.status).toBe(200);
      expect(fastRes.status).toBe(200);
      expect(slowRes.body.length).toBeGreaterThan(fastRes.body.length);
    });
  });

  // =========================================================================
  // 5. High Concurrency Stress Test
  // =========================================================================
  describe('High Concurrency Synthesize Stress Test', () => {
    it('handles 25 concurrent synthesis requests without failure or data corruption', async () => {
      const requests = Array.from({ length: 25 }, (_, i) =>
        request(app)
          .post('/api/speech/synthesize')
          .send({
            text: `Concurrent test task #${i}: Confirming deployment pipeline status.`,
            voice: i % 2 === 0 ? 'Shivani' : 'Avinash',
          })
      );

      const responses = await Promise.all(requests);

      for (let i = 0; i < responses.length; i++) {
        const res = responses[i];
        expect(res.status).toBe(200);
        expect(res.body.audioBase64).toBeTruthy();
        expect(res.body.isMock).toBe(true);

        // Verify buffer integrity for every concurrent response
        const buf = Buffer.from(res.body.audioBase64, 'base64');
        expect(buf.toString('ascii', 0, 4)).toBe('RIFF');
        expect(buf.toString('ascii', 8, 12)).toBe('WAVE');
        expect(buf.readUInt32LE(4)).toBe(buf.length - 8);
      }
    });
  });
});
