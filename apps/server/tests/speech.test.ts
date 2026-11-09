import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { generatePlayableWavBuffer } from '@rubi/mock-adapters';

describe('Speech Pipeline API Routes (/api/speech)', () => {
  const sampleWav = generatePlayableWavBuffer({ durationMs: 1200 }).buffer;

  describe('POST /api/speech/transcribe', () => {
    it('transcribes valid WAV audio buffer into Hinglish by default', async () => {
      const res = await request(app)
        .post('/api/speech/transcribe')
        .set('Content-Type', 'audio/wav')
        .send(sampleWav);

      expect(res.status).toBe(200);
      expect(res.body.text).toBeTruthy();
      expect(res.body.transcript).toBe(res.body.text);
      expect(res.body.language).toBe('hi-en');
      expect(res.body.confidence).toBeGreaterThanOrEqual(0.9);
      expect(res.body.durationMs).toBeGreaterThan(0);
      expect(res.body.isMock).toBe(true);
    });

    it('transcribes into English when x-language header is "en"', async () => {
      const res = await request(app)
        .post('/api/speech/transcribe')
        .set('Content-Type', 'audio/wav')
        .set('x-language', 'en')
        .send(sampleWav);

      expect(res.status).toBe(200);
      expect(res.body.language).toBe('en');
      expect(res.body.text).toBeTruthy();
      expect(res.body.isMock).toBe(true);
    });

    it('transcribes into Hindi when query parameter language is "hi"', async () => {
      const res = await request(app)
        .post('/api/speech/transcribe?language=hi')
        .set('Content-Type', 'audio/wav')
        .send(sampleWav);

      expect(res.status).toBe(200);
      expect(res.body.language).toBe('hi');
      expect(res.body.text).toBeTruthy();
    });

    it('honors x-mock-transcript test override header', async () => {
      const testTranscript = 'Custom sprint planning transcript for test verification';
      const res = await request(app)
        .post('/api/speech/transcribe')
        .set('Content-Type', 'audio/wav')
        .set('x-mock-transcript', encodeURIComponent(testTranscript))
        .send(sampleWav);

      expect(res.status).toBe(200);
      expect(res.body.text).toBe(testTranscript);
      expect(res.body.transcript).toBe(testTranscript);
    });

    it('handles x-simulate-empty header gracefully with confidence 0.0', async () => {
      const res = await request(app)
        .post('/api/speech/transcribe')
        .set('Content-Type', 'audio/wav')
        .set('x-simulate-empty', 'true')
        .send(sampleWav);

      expect(res.status).toBe(200);
      expect(res.body.text).toBe('');
      expect(res.body.confidence).toBe(0.0);
      expect(res.body.warning).toBe('No speech detected.');
    });

    it('handles empty audio request with confidence 0.0', async () => {
      const res = await request(app)
        .post('/api/speech/transcribe')
        .set('Content-Type', 'audio/wav')
        .send(Buffer.alloc(0));

      expect(res.status).toBe(200);
      expect(res.body.text).toBe('');
      expect(res.body.confidence).toBe(0.0);
    });

    it('rejects unsupported media type with HTTP 415', async () => {
      const res = await request(app)
        .post('/api/speech/transcribe')
        .set('Content-Type', 'application/pdf')
        .send(Buffer.from('%PDF-1.4 sample pdf content'));

      expect(res.status).toBe(415);
      expect(res.body.error).toBe('Unsupported Media Type');
    });

    it('rejects oversized payload (>25MB) with HTTP 413', async () => {
      const res = await request(app)
        .post('/api/speech/transcribe')
        .set('Content-Type', 'audio/wav')
        .set('content-length', (26 * 1024 * 1024).toString())
        .send();

      expect(res.status).toBe(413);
      expect(res.body.error).toBe('Payload Too Large');
    });

    it('accepts base64 encoded audio JSON payload', async () => {
      const res = await request(app)
        .post('/api/speech/transcribe')
        .send({
          audioBase64: sampleWav.toString('base64'),
          language: 'en',
        });

      expect(res.status).toBe(200);
      expect(res.body.language).toBe('en');
      expect(res.body.text).toBeTruthy();
    });

    it('works via /api/transcribe alias endpoint', async () => {
      const res = await request(app)
        .post('/api/transcribe')
        .set('Content-Type', 'audio/wav')
        .send(sampleWav);

      expect(res.status).toBe(200);
      expect(res.body.text).toBeTruthy();
    });
  });

  describe('POST /api/speech/synthesize', () => {
    it('synthesizes text to speech returning JSON with audioBase64 by default', async () => {
      const confirmationText = 'Sprint planning meeting scheduled for tomorrow at 10 AM.';
      const res = await request(app)
        .post('/api/speech/synthesize')
        .send({
          text: confirmationText,
          voice: 'Shivani',
          language: 'hi-en',
        });

      expect(res.status).toBe(200);
      expect(res.body.mimeType).toBe('audio/wav');
      expect(res.body.spokenText).toBe(confirmationText);
      expect(res.body.voiceUsed).toBe('Shivani');
      expect(res.body.audioBase64).toBeTruthy();
      expect(res.body.isMock).toBe(true);

      // Verify returned base64 decodes to valid RIFF WAV buffer
      const audioBuffer = Buffer.from(res.body.audioBase64, 'base64');
      expect(audioBuffer.toString('ascii', 0, 4)).toBe('RIFF');
      expect(audioBuffer.toString('ascii', 8, 12)).toBe('WAVE');
    });

    it('returns binary audio/wav stream when Accept header is audio/wav', async () => {
      const res = await request(app)
        .post('/api/speech/synthesize')
        .set('Accept', 'audio/wav')
        .send({
          text: 'Spoken binary audio stream confirmation',
          voice: 'Avinash',
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('audio/wav');
      expect(Buffer.isBuffer(res.body)).toBe(true);
      expect(res.body.toString('ascii', 0, 4)).toBe('RIFF');
      expect(res.body.toString('ascii', 8, 12)).toBe('WAVE');
    });

    it('returns binary stream when query format=binary is set', async () => {
      const res = await request(app)
        .post('/api/speech/synthesize?format=binary')
        .send({
          text: 'Streaming binary confirmation',
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('audio/wav');
      expect(Buffer.isBuffer(res.body)).toBe(true);
    });

    it('returns 400 Bad Request when text is missing or empty', async () => {
      const res = await request(app)
        .post('/api/speech/synthesize')
        .send({
          text: '   ',
          voice: 'Shivani',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Bad Request');
    });

    it('works via /api/tts alias endpoint', async () => {
      const res = await request(app)
        .post('/api/tts')
        .send({
          text: 'Testing /api/tts alias',
        });

      expect(res.status).toBe(200);
      expect(res.body.audioBase64).toBeTruthy();
    });
  });

  describe('GET /api/speech/synthesize', () => {
    it('streams binary audio/wav for direct browser audio element playback', async () => {
      const res = await request(app)
        .get('/api/speech/synthesize')
        .query({
          text: 'Playback audio chime',
          voice: 'Shivani',
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('audio/wav');
      expect(Buffer.isBuffer(res.body)).toBe(true);
      expect(res.body.toString('ascii', 0, 4)).toBe('RIFF');
    });

    it('returns 400 Bad Request when text query param is omitted', async () => {
      const res = await request(app).get('/api/speech/synthesize');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Bad Request');
    });
  });
});

