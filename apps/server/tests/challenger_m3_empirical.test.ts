import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { MockPrismaSTTAdapter, generatePlayableWavBuffer } from '@rubi/mock-adapters';

describe('CHALLENGER 1 EMPIRICAL AUDIT: Milestone 3 Speech Pipeline Remediation', () => {
  const sampleWav = generatePlayableWavBuffer({ durationMs: 1000 }).buffer;
  const mockSTT = new MockPrismaSTTAdapter();

  // =========================================================================
  // CHALLENGE 1: Empty JSON bodies ({} and {"language":"hi"}) on POST /api/speech/transcribe
  // Must resolve in <10ms with HTTP 200 { text: '', confidence: 0.0 } with ZERO hang.
  // =========================================================================
  describe('Challenge 1: Empty JSON Bodies Zero-Hang & Fast Resolution', () => {
    it('resolves empty JSON {} in <10ms with HTTP 200 and { text: "", confidence: 0.0 }', async () => {
      // Warm up connection first
      await request(app).post('/api/speech/transcribe').set('Content-Type', 'application/json').send({});

      const timings: number[] = [];
      const iterations = 25;

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        const res = await request(app)
          .post('/api/speech/transcribe')
          .set('Content-Type', 'application/json')
          .send({});
        const elapsed = performance.now() - start;
        timings.push(elapsed);

        expect(res.status).toBe(200);
        expect(res.body.text).toBe('');
        expect(res.body.transcript).toBe('');
        expect(res.body.confidence).toBe(0.0);
        expect(res.body.warning).toBe('No speech detected.');
      }

      const avgMs = timings.reduce((a, b) => a + b, 0) / timings.length;
      const minMs = Math.min(...timings);
      const maxMs = Math.max(...timings);

      console.log(`[Challenge 1 - {}] ${iterations} runs: min=${minMs.toFixed(2)}ms, max=${maxMs.toFixed(2)}ms, avg=${avgMs.toFixed(2)}ms`);
      // Assert average is well under 10ms
      expect(avgMs).toBeLessThan(10);
    });

    it('resolves {"language":"hi"} in <10ms with HTTP 200 and { text: "", confidence: 0.0 }', async () => {
      const timings: number[] = [];
      const iterations = 25;

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        const res = await request(app)
          .post('/api/speech/transcribe')
          .set('Content-Type', 'application/json')
          .send({ language: 'hi' });
        const elapsed = performance.now() - start;
        timings.push(elapsed);

        expect(res.status).toBe(200);
        expect(res.body.text).toBe('');
        expect(res.body.transcript).toBe('');
        expect(res.body.confidence).toBe(0.0);
        expect(res.body.warning).toBe('No speech detected.');
      }

      const avgMs = timings.reduce((a, b) => a + b, 0) / timings.length;
      const minMs = Math.min(...timings);
      const maxMs = Math.max(...timings);

      console.log(`[Challenge 1 - {"language":"hi"}] ${iterations} runs: min=${minMs.toFixed(2)}ms, max=${maxMs.toFixed(2)}ms, avg=${avgMs.toFixed(2)}ms`);
      expect(avgMs).toBeLessThan(10);
    });

    it('resolves arbitrary JSON keys (no audio) immediately without hanging', async () => {
      const payloads = [
        { foo: 'bar', baz: 123 },
        { language: 'en', extraParam: true },
        { audioBase64: '' },
        { audio: null },
      ];

      for (const payload of payloads) {
        const start = performance.now();
        const res = await request(app)
          .post('/api/speech/transcribe')
          .set('Content-Type', 'application/json')
          .send(payload);
        const elapsed = performance.now() - start;

        expect(elapsed).toBeLessThan(50);
        expect(res.status).toBe(200);
        expect(res.body.text).toBe('');
        expect(res.body.confidence).toBe(0.0);
      }
    });
  });

  // =========================================================================
  // CHALLENGE 2: Non-audio formats (text/plain, text/html, application/zip, text/csv)
  // Must verify they all return HTTP 415 Unsupported Media Type.
  // =========================================================================
  describe('Challenge 2: Non-Audio Formats Return HTTP 415', () => {
    const nonAudioTypes = [
      { contentType: 'text/plain', body: 'Hello world transcription attempt' },
      { contentType: 'text/html', body: '<!DOCTYPE html><html><body>Test</body></html>' },
      { contentType: 'application/zip', body: Buffer.from('PK\x03\x04mockzipdata000000000000') },
      { contentType: 'text/csv', body: 'col1,col2,col3\nval1,val2,val3' },
      { contentType: 'application/pdf', body: Buffer.from('%PDF-1.4 test binary data') },
      { contentType: 'application/xml', body: '<root><data>test</data></root>' },
      { contentType: 'image/jpeg', body: Buffer.from('\xFF\xD8\xFF\xE0\x00\x10JFIF') },
      { contentType: 'video/mp4', body: Buffer.from('\x00\x00\x00\x18ftypmp42') },
    ];

    for (const { contentType, body } of nonAudioTypes) {
      it(`rejects Content-Type: ${contentType} with HTTP 415`, async () => {
        const res = await request(app)
          .post('/api/speech/transcribe')
          .set('Content-Type', contentType)
          .send(body);

        expect(res.status).toBe(415);
        expect(res.body.error).toBe('Unsupported Media Type');
        expect(res.body.message).toContain('Only WAV, MP3, WebM, and OGG audio formats are supported');
      });
    }

    it('rejects unsupported media type header override x-file-type: unsupported with HTTP 415', async () => {
      const res = await request(app)
        .post('/api/speech/transcribe')
        .set('Content-Type', 'audio/wav')
        .set('x-file-type', 'unsupported')
        .send(sampleWav);

      expect(res.status).toBe(415);
      expect(res.body.error).toBe('Unsupported Media Type');
    });
  });

  // =========================================================================
  // CHALLENGE 3: Silence detection on small zeroed buffers (<45 bytes, 1 byte, 20 bytes)
  // Must return { text: '', confidence: 0.0 }.
  // =========================================================================
  describe('Challenge 3: Silence Detection on Small Zeroed Buffers', () => {
    const smallZeroLengths = [1, 2, 5, 10, 20, 32, 40, 43, 44];

    for (const len of smallZeroLengths) {
      it(`unit: MockPrismaSTTAdapter returns empty text & 0.0 confidence for ${len}-byte zeroed buffer`, async () => {
        const zeroBuf = Buffer.alloc(len, 0);
        const result = await mockSTT.transcribe(zeroBuf);

        expect(result.text).toBe('');
        expect(result.confidence).toBe(0.0);
        expect(result.isMock).toBe(true);
      });

      it(`endpoint: POST /api/speech/transcribe returns empty text & 0.0 confidence for ${len}-byte zeroed buffer`, async () => {
        const zeroBuf = Buffer.alloc(len, 0);
        const res = await request(app)
          .post('/api/speech/transcribe')
          .set('Content-Type', 'audio/wav')
          .send(zeroBuf);

        expect(res.status).toBe(200);
        expect(res.body.text).toBe('');
        expect(res.body.confidence).toBe(0.0);
      });
    }
  });

  // =========================================================================
  // CHALLENGE 4: Raw PCM loud audio — verify first 44 bytes are not skipped
  // =========================================================================
  describe('Challenge 4: Raw PCM Loud Audio First 44 Bytes Preservation', () => {
    it('detects sound in bytes 0..43 of raw PCM (no RIFF/WAVE) when bytes 44..99 are zeros', async () => {
      // Create a 100-byte buffer where bytes 0..43 are loud (0x7F) and bytes 44..99 are all 0x00.
      // If the first 44 bytes are skipped (e.g. naive WAV assumption), the remaining bytes are all 0,
      // which would falsely detect silence!
      // If the first 44 bytes are NOT skipped, it sees the 0x7F samples and transcribes non-empty text.
      const rawPcmLoudFirst44 = Buffer.concat([
        Buffer.alloc(44, 0x7f),
        Buffer.alloc(56, 0x00),
      ]);

      // 1. Adapter level verification
      const adapterResult = await mockSTT.transcribe(rawPcmLoudFirst44);
      expect(adapterResult.text).not.toBe('');
      expect(adapterResult.confidence).toBeGreaterThan(0.9);

      // 2. Endpoint level verification
      const endpointRes = await request(app)
        .post('/api/speech/transcribe')
        .set('Content-Type', 'application/octet-stream')
        .send(rawPcmLoudFirst44);

      expect(endpointRes.status).toBe(200);
      expect(endpointRes.body.text).not.toBe('');
      expect(endpointRes.body.confidence).toBeGreaterThan(0.9);
    });

    it('detects sound when only byte 0 is non-zero in raw PCM', async () => {
      const rawPcmSingleByte = Buffer.alloc(50, 0);
      rawPcmSingleByte[0] = 0x5a; // byte 0 is loud

      const adapterResult = await mockSTT.transcribe(rawPcmSingleByte);
      expect(adapterResult.text).not.toBe('');
      expect(adapterResult.confidence).toBeGreaterThan(0.9);
    });

    it('contrasts with authentic RIFF/WAVE header where first 44 bytes ARE header and subsequent zeros ARE silence', async () => {
      // Authentic 44-byte WAV header from generator followed by 56 zero bytes of PCM silence
      const wavHeader44 = sampleWav.subarray(0, 44);
      expect(wavHeader44.length).toBe(44);

      const wavSilentAudio = Buffer.concat([
        wavHeader44,
        Buffer.alloc(56, 0),
      ]);

      const adapterResult = await mockSTT.transcribe(wavSilentAudio);
      // Because this IS a WAV file, skipping header allows correctly detecting that the audio data is pure silence!
      expect(adapterResult.text).toBe('');
      expect(adapterResult.confidence).toBe(0.0);
    });
  });

  // =========================================================================
  // CHALLENGE 5: Multipart audio containing PCM sequence [0x0D, 0x0A, 0x2D, 0x2D]
  // Must verify it is preserved in full without premature truncation.
  // =========================================================================
  describe('Challenge 5: Multipart Audio Boundary Collision Sequence Preservation', () => {
    it('preserves entire audio buffer including data after [0x0D, 0x0A, 0x2D, 0x2D]', async () => {
      const boundary = 'AdversarialChallengerBoundary987654321';
      
      // Construct PCM payload containing CRLF + '--' sequence ([0x0D, 0x0A, 0x2D, 0x2D])
      // followed by a substantial tail that would be lost if naive split occurred
      const prefix = Buffer.alloc(100, 0x41); // 'AAAA...'
      const collisionSeq = Buffer.from([0x0D, 0x0A, 0x2D, 0x2D]); // \r\n--
      const postfix = Buffer.alloc(200, 0x42); // 'BBBB...'
      
      const fullAudioPayload = Buffer.concat([prefix, collisionSeq, postfix]);
      expect(fullAudioPayload.length).toBe(304);

      const multipartBody = Buffer.concat([
        Buffer.from(`--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="audio"; filename="recorded_meeting.pcm"\r\n'),
        Buffer.from('Content-Type: application/octet-stream\r\n\r\n'),
        fullAudioPayload,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);

      const res = await request(app)
        .post('/api/speech/transcribe')
        .set('Content-Type', `multipart/form-data; boundary=${boundary}`)
        .send(multipartBody);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('text');
      expect(res.body.text).not.toBe('');
      expect(res.body.confidence).toBeGreaterThan(0.9);
    });

    it('handles multiple [0x0D, 0x0A, 0x2D, 0x2D] sequences in multipart payload without corruption', async () => {
      const boundary = 'MultiBoundaryMarkerTest112233';
      const repeatedCollisionPayload = Buffer.concat([
        Buffer.from('CHUNK1_LOUD_AUDIO_DATA_'),
        Buffer.from([0x0D, 0x0A, 0x2D, 0x2D]),
        Buffer.from('CHUNK2_LOUD_AUDIO_DATA_'),
        Buffer.from([0x0D, 0x0A, 0x2D, 0x2D]),
        Buffer.from('CHUNK3_LOUD_AUDIO_DATA_'),
      ]);

      const multipartBody = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="multi.wav"\r\nContent-Type: audio/wav\r\n\r\n`),
        repeatedCollisionPayload,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);

      const res = await request(app)
        .post('/api/speech/transcribe')
        .set('Content-Type', `multipart/form-data; boundary=${boundary}`)
        .send(multipartBody);

      expect(res.status).toBe(200);
      expect(res.body.text).toBeTruthy();
    });
  });

  // =========================================================================
  // CHALLENGE 6: Malformed JSON returns HTTP 400 Bad Request, NOT HTTP 500
  // =========================================================================
  describe('Challenge 6: Malformed JSON Returns HTTP 400 Bad Request', () => {
    const malformedJsonInputs = [
      { name: 'unterminated string', payload: '{"title": "incomplete' },
      { name: 'missing curly bracket', payload: '{"key": "value"' },
      { name: 'trailing comma without value', payload: '{"key": "value", }' },
      { name: 'unquoted keys and values', payload: '{foo: bar}' },
      { name: 'naked syntax error token', payload: '<<<NOT_JSON>>>' },
      { name: 'truncated array', payload: '{"items": [1, 2, ' },
      { name: 'colon without value', payload: '{"data": }' },
    ];

    for (const { name, payload } of malformedJsonInputs) {
      it(`returns HTTP 400 for malformed JSON (${name})`, async () => {
        const res = await request(app)
          .post('/api/speech/transcribe')
          .set('Content-Type', 'application/json')
          .send(payload);

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Bad Request');
        expect(res.body).not.toHaveProperty('error', 'Internal Server Error');
      });
    }

    it('returns HTTP 400 for malformed JSON on POST /api/speech/synthesize', async () => {
      const res = await request(app)
        .post('/api/speech/synthesize')
        .set('Content-Type', 'application/json')
        .send('{"text": "broken synth');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Bad Request');
    });
  });
});
