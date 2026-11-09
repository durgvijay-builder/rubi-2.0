import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { generatePlayableWavBuffer, MockPrismaSTTAdapter } from '@rubi/mock-adapters';
import crypto from 'crypto';

describe('Empirical STT & Speech Pipeline Stress Test Suite', () => {
  const sampleWav = generatePlayableWavBuffer({ durationMs: 800 }).buffer;
  const mockSTT = new MockPrismaSTTAdapter();

  // =========================================================================
  // 1. UNIT STRESS: MockPrismaSTTAdapter
  // =========================================================================
  describe('MockPrismaSTTAdapter Empirical Unit Tests', () => {
    it('handles completely corrupt binary garbage without throwing or crashing', async () => {
      const garbageBuffers = [
        crypto.randomBytes(1),
        crypto.randomBytes(7),
        crypto.randomBytes(43),
        crypto.randomBytes(44),
        crypto.randomBytes(45),
        crypto.randomBytes(1024),
        crypto.randomBytes(65536),
      ];

      for (const buf of garbageBuffers) {
        const res = await mockSTT.transcribe(buf);
        expect(res).toBeDefined();
        expect(typeof res.text).toBe('string');
        expect(typeof res.confidence).toBe('number');
        expect(typeof res.durationMs).toBe('number');
        expect(res.isMock).toBe(true);
      }
    });

    it('handles truncated WAV headers (1 to 44 bytes)', async () => {
      const fullHeader = sampleWav.subarray(0, 44);
      for (let len = 1; len <= 44; len++) {
        const truncated = fullHeader.subarray(0, len);
        const res = await mockSTT.transcribe(truncated);
        expect(res).toBeDefined();
        expect(typeof res.text).toBe('string');
      }
    });

    it('handles zero-byte buffer safely', async () => {
      const emptyBuf = Buffer.alloc(0);
      const res = await mockSTT.transcribe(emptyBuf);
      expect(res.text).toBe('');
      expect(res.confidence).toBe(0.0);
      expect(res.durationMs).toBe(0);
    });

    it('correctly detects silence on small zeroed buffers (<44 bytes)', async () => {
      // A 20-byte buffer of pure zeros (silence)
      const silent20 = Buffer.alloc(20, 0);
      const res20 = await mockSTT.transcribe(silent20);
      expect(res20.text).toBe('');
      expect(res20.confidence).toBe(0.0);
    });

    it('does not skip first 44 bytes when buffer is raw non-WAV PCM audio', async () => {
      // 44 bytes of loud audio followed by 1 zero byte
      const loud44_plus_zero = Buffer.concat([Buffer.alloc(44, 0x7f), Buffer.alloc(1, 0)]);
      const res45 = await mockSTT.transcribe(loud44_plus_zero);
      expect(res45.text).not.toBe('');
      expect(res45.confidence).toBeGreaterThan(0.9);
    });

    it('handles multi-lingual inputs and unsupported language codes gracefully', async () => {
      const supportedLangs = ['en', 'hi', 'hi-en'] as const;
      for (const lang of supportedLangs) {
        const res = await mockSTT.transcribe(sampleWav, { language: lang });
        expect(res.language).toBe(lang);
        expect(res.text).toBeTruthy();
      }

      // Unsupported language codes default to Hinglish fixtures
      const unsupportedCodes = ['fr', 'de', 'es', 'zh', 'ja', 'klingon', '', 'unknown'] as any;
      for (const code of unsupportedCodes) {
        const res = await mockSTT.transcribe(sampleWav, { language: code });
        expect(res).toBeDefined();
        expect(typeof res.text).toBe('string');
        expect(res.language).toBe('hi-en');
      }
    });

    it('handles massive audio buffer (30MB) in memory without memory leak or crash', async () => {
      const bigBuf = Buffer.alloc(30 * 1024 * 1024, 0x7f);
      const res = await mockSTT.transcribe(bigBuf);
      expect(res).toBeDefined();
      expect(res.text).toBeTruthy();
    });

    it('handles concurrent transcribe calls on single adapter instance', async () => {
      const promises = Array.from({ length: 50 }, (_, i) =>
        mockSTT.transcribe(sampleWav, {
          language: i % 3 === 0 ? 'en' : i % 3 === 1 ? 'hi' : 'hi-en',
        })
      );
      const results = await Promise.all(promises);
      expect(results).toHaveLength(50);
      for (const r of results) {
        expect(r.text).toBeTruthy();
        expect(r.isMock).toBe(true);
      }
    });
  });

  // =========================================================================
  // 2. ENDPOINT STRESS: POST /api/speech/transcribe
  // =========================================================================
  describe('POST /api/speech/transcribe Adversarial & Boundary Tests', () => {
    // 2.1 Corrupt / truncated audio
    it('handles corrupt and truncated audio payload gracefully without crashing', async () => {
      const corruptPayloads = [
        Buffer.from([0x00]),
        Buffer.from([0xff, 0xfe, 0xfd]),
        Buffer.from('RIFF\x00\x00\x00\x00WAVEfmt '),
        crypto.randomBytes(512),
      ];

      for (const payload of corruptPayloads) {
        const res = await request(app)
          .post('/api/speech/transcribe')
          .set('Content-Type', 'audio/wav')
          .send(payload);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('text');
        expect(res.body).toHaveProperty('confidence');
      }
    });

    // 2.2 Zero-byte audio files
    it('handles zero-byte audio payload with HTTP 200 and confidence 0.0', async () => {
      const res = await request(app)
        .post('/api/speech/transcribe')
        .set('Content-Type', 'audio/wav')
        .send(Buffer.alloc(0));

      expect(res.status).toBe(200);
      expect(res.body.text).toBe('');
      expect(res.body.transcript).toBe('');
      expect(res.body.confidence).toBe(0.0);
      expect(res.body.warning).toBe('No speech detected.');
    });

    it('handles JSON body lacking audioBase64 or audio buffer without hanging', async () => {
      const res = await request(app)
        .post('/api/speech/transcribe')
        .set('Content-Type', 'application/json')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.text).toBe('');
      expect(res.body.confidence).toBe(0.0);
      expect(res.body.warning).toBe('No speech detected.');
    });

    it('handles JSON body with only language field without hanging', async () => {
      const res = await request(app)
        .post('/api/speech/transcribe')
        .set('Content-Type', 'application/json')
        .send({ language: 'en' });

      expect(res.status).toBe(200);
      expect(res.body.text).toBe('');
      expect(res.body.confidence).toBe(0.0);
      expect(res.body.warning).toBe('No speech detected.');
    });

    it('handles valid base64 audio JSON payload with audioBase64', async () => {
      const res = await request(app)
        .post('/api/speech/transcribe')
        .set('Content-Type', 'application/json')
        .send({ audioBase64: sampleWav.toString('base64') });

      expect(res.status).toBe(200);
      expect(res.body.text).toBeTruthy();
    });

    it('handles empty audioBase64 string gracefully', async () => {
      const res = await request(app)
        .post('/api/speech/transcribe')
        .set('Content-Type', 'application/json')
        .send({ audioBase64: '' });

      expect(res.status).toBe(200);
      expect(res.body.text).toBe('');
      expect(res.body.confidence).toBe(0.0);
    });

    // 2.3 Audio exceeding 25MB boundary
    it('rejects payload exceeding 25MB boundary via Content-Length header with HTTP 413', async () => {
      const res = await request(app)
        .post('/api/speech/transcribe')
        .set('Content-Type', 'audio/wav')
        .set('content-length', (25 * 1024 * 1024 + 1).toString())
        .send();

      expect(res.status).toBe(413);
      expect(res.body.error).toBe('Payload Too Large');
      expect(res.body.message).toContain('25MB');
    });

    it('rejects 30MB payload with HTTP 413', async () => {
      const res = await request(app)
        .post('/api/speech/transcribe')
        .set('Content-Type', 'audio/wav')
        .set('content-length', (30 * 1024 * 1024).toString())
        .send();

      expect(res.status).toBe(413);
      expect(res.body.error).toBe('Payload Too Large');
    });

    // 2.4 Invalid MIME types
    it('rejects application/pdf with HTTP 415', async () => {
      const res = await request(app)
        .post('/api/speech/transcribe')
        .set('Content-Type', 'application/pdf')
        .send(Buffer.from('%PDF-1.5 test pdf content'));

      expect(res.status).toBe(415);
      expect(res.body.error).toBe('Unsupported Media Type');
    });

    it('rejects image/png with HTTP 415', async () => {
      const res = await request(app)
        .post('/api/speech/transcribe')
        .set('Content-Type', 'image/png')
        .send(Buffer.from('\x89PNG\r\n\x1a\nfake png data'));

      expect(res.status).toBe(415);
      expect(res.body.error).toBe('Unsupported Media Type');
    });

    it('rejects image/jpeg with HTTP 415', async () => {
      const res = await request(app)
        .post('/api/speech/transcribe')
        .set('Content-Type', 'image/jpeg')
        .send(Buffer.from('\xFF\xD8\xFFfake jpeg'));

      expect(res.status).toBe(415);
      expect(res.body.error).toBe('Unsupported Media Type');
    });

    it('rejects text/plain with HTTP 415 Unsupported Media Type', async () => {
      const res = await request(app)
        .post('/api/speech/transcribe')
        .set('Content-Type', 'text/plain')
        .send('This is not an audio file, it is plain text.');

      expect(res.status).toBe(415);
      expect(res.body.error).toBe('Unsupported Media Type');
      expect(res.body.message).toContain('Only WAV, MP3, WebM, and OGG');
    });

    it('rejects text/html with HTTP 415 Unsupported Media Type', async () => {
      const res = await request(app)
        .post('/api/speech/transcribe')
        .set('Content-Type', 'text/html')
        .send('<html><body><h1>Not audio</h1></body></html>');

      expect(res.status).toBe(415);
      expect(res.body.error).toBe('Unsupported Media Type');
    });

    it('rejects application/zip with HTTP 415 Unsupported Media Type', async () => {
      const res = await request(app)
        .post('/api/speech/transcribe')
        .set('Content-Type', 'application/zip')
        .send(Buffer.from('PK\x03\x04fakezipcontent1234567890'));

      expect(res.status).toBe(415);
      expect(res.body.error).toBe('Unsupported Media Type');
    });

    it('preserves HTTP 400 Bad Request status code from body-parser on malformed JSON', async () => {
      const res = await request(app)
        .post('/api/speech/transcribe')
        .set('Content-Type', 'application/json')
        .send('{"malformed_json: ');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Bad Request');
    });

    it('preserves multipart audio payload containing [0x0D, 0x0A, 0x2D, 0x2D] without premature truncation', async () => {
      const boundary = '----TestBoundary12345';
      const audioWithCrlfDashes = Buffer.concat([
        Buffer.from('RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x44\xac\x00\x00\x88\x58\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00'),
        Buffer.from([0x0D, 0x0A, 0x2D, 0x2D]), // Valid PCM sample bytes
        Buffer.from('EXTRA_AUDIO_DATA_AFTER_MATCH'),
      ]);

      const multipartBody = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="pcm.wav"\r\nContent-Type: audio/wav\r\n\r\n`),
        audioWithCrlfDashes,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);

      const res = await request(app)
        .post('/api/speech/transcribe')
        .set('Content-Type', `multipart/form-data; boundary=${boundary}`)
        .send(multipartBody);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('transcript');
    });

    // 2.5 Multi-lingual requests
    it('handles en language code via query', async () => {
      const res = await request(app)
        .post('/api/speech/transcribe?language=en')
        .set('Content-Type', 'audio/wav')
        .send(sampleWav);

      expect(res.status).toBe(200);
      expect(res.body.language).toBe('en');
    });

    it('handles hi language code via header', async () => {
      const res = await request(app)
        .post('/api/speech/transcribe')
        .set('Content-Type', 'audio/wav')
        .set('x-language', 'hi')
        .send(sampleWav);

      expect(res.status).toBe(200);
      expect(res.body.language).toBe('hi');
    });

    it('handles hi-en language code via header', async () => {
      const res = await request(app)
        .post('/api/speech/transcribe')
        .set('Content-Type', 'audio/wav')
        .set('x-language', 'hi-en')
        .send(sampleWav);

      expect(res.status).toBe(200);
      expect(res.body.language).toBe('hi-en');
    });

    it('handles unsupported language codes gracefully by falling back to hi-en', async () => {
      const res = await request(app)
        .post('/api/speech/transcribe?language=es')
        .set('Content-Type', 'audio/wav')
        .send(sampleWav);

      expect(res.status).toBe(200);
      expect(res.body.language).toBe('hi-en');
    });

    // 2.6 Concurrency: multiple simultaneous transcribe requests
    it('handles 30 simultaneous transcribe requests without race condition or crash', async () => {
      const requests = Array.from({ length: 30 }, (_, i) => {
        const lang = i % 3 === 0 ? 'en' : i % 3 === 1 ? 'hi' : 'hi-en';
        return request(app)
          .post(`/api/speech/transcribe?language=${lang}`)
          .set('Content-Type', 'audio/wav')
          .send(sampleWav);
      });

      const responses = await Promise.all(requests);
      expect(responses).toHaveLength(30);

      for (let i = 0; i < responses.length; i++) {
        const res = responses[i]!;
        expect(res.status).toBe(200);
        expect(res.body.text).toBeTruthy();
        const expectedLang = i % 3 === 0 ? 'en' : i % 3 === 1 ? 'hi' : 'hi-en';
        expect(res.body.language).toBe(expectedLang);
      }
    });

    it('handles 50 simultaneous mixed requests (transcribe + empty + mock override) concurrently', async () => {
      const requests = Array.from({ length: 50 }, (_, i) => {
        const reqBuilder = request(app).post('/api/speech/transcribe').set('Content-Type', 'audio/wav');
        if (i % 5 === 0) {
          return reqBuilder.send(Buffer.alloc(0));
        } else if (i % 5 === 1) {
          return reqBuilder.set('x-mock-transcript', encodeURIComponent(`Concurrent mock test ${i}`)).send(sampleWav);
        } else if (i % 5 === 2) {
          return reqBuilder.set('x-language', 'en').send(sampleWav);
        } else if (i % 5 === 3) {
          return reqBuilder.set('x-language', 'hi').send(sampleWav);
        } else {
          return reqBuilder.send(sampleWav);
        }
      });

      const responses = await Promise.all(requests);
      expect(responses).toHaveLength(50);
      for (const res of responses) {
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('text');
      }
    });
  });
});
