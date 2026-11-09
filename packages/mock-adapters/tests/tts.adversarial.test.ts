import { describe, it, expect, vi } from 'vitest';
import {
  generatePlayableWavBuffer,
  MockTimbreTTSAdapter,
  LiveTimbreTTSAdapter,
  TimbreTTSAdapter,
} from '../src/index.js';

describe('Empirical Adversarial Stress Tests: RIFF PCM WAV & Mock Timbre TTS', () => {
  // =========================================================================
  // 1. RIFF PCM WAV Header Byte-for-Byte Structural & Mathematical Integrity
  // =========================================================================
  describe('RIFF Header Byte-for-Byte Structural & Mathematical Verification', () => {
    it('generates an exact RFC / Microsoft RIFF standard 44-byte header with mathematically coherent fields', () => {
      const sampleRates = [8000, 16000, 22050, 44100, 48000];
      const durations = [100, 500, 1000, 2500];

      for (const sampleRate of sampleRates) {
        for (const durationMs of durations) {
          const { buffer, durationMs: retDuration, sampleRate: retSampleRate } =
            generatePlayableWavBuffer({ durationMs, sampleRate });

          expect(retDuration).toBe(durationMs);
          expect(retSampleRate).toBe(sampleRate);

          // 1. ChunkID (bytes 0..3): "RIFF" in ASCII (0x52, 0x49, 0x46, 0x46)
          expect(buffer.toString('ascii', 0, 4)).toBe('RIFF');
          expect(buffer[0]).toBe(0x52);
          expect(buffer[1]).toBe(0x49);
          expect(buffer[2]).toBe(0x46);
          expect(buffer[3]).toBe(0x46);

          // 2. ChunkSize (bytes 4..7): uint32LE == buffer.length - 8
          const chunkSize = buffer.readUInt32LE(4);
          expect(chunkSize).toBe(buffer.length - 8);

          // 3. Format (bytes 8..11): "WAVE" in ASCII (0x57, 0x41, 0x56, 0x45)
          expect(buffer.toString('ascii', 8, 12)).toBe('WAVE');
          expect(buffer[8]).toBe(0x57);
          expect(buffer[9]).toBe(0x41);
          expect(buffer[10]).toBe(0x56);
          expect(buffer[11]).toBe(0x45);

          // 4. Subchunk1ID (bytes 12..15): "fmt " in ASCII (with trailing space 0x20)
          expect(buffer.toString('ascii', 12, 16)).toBe('fmt ');
          expect(buffer[12]).toBe(0x66);
          expect(buffer[13]).toBe(0x6d);
          expect(buffer[14]).toBe(0x74);
          expect(buffer[15]).toBe(0x20);

          // 5. Subchunk1Size (bytes 16..19): uint32LE == 16 for uncompressed linear PCM
          expect(buffer.readUInt32LE(16)).toBe(16);

          // 6. AudioFormat (bytes 20..21): uint16LE == 1 (WAVE_FORMAT_PCM)
          expect(buffer.readUInt16LE(20)).toBe(1);

          // 7. NumChannels (bytes 22..23): uint16LE == 1 (Mono)
          const numChannels = buffer.readUInt16LE(22);
          expect(numChannels).toBe(1);

          // 8. SampleRate (bytes 24..27): uint32LE == requested sampleRate
          const recordedSampleRate = buffer.readUInt32LE(24);
          expect(recordedSampleRate).toBe(sampleRate);

          // 9. ByteRate (bytes 28..31): uint32LE == sampleRate * numChannels * bitsPerSample / 8
          const byteRate = buffer.readUInt32LE(28);
          expect(byteRate).toBe((sampleRate * 1 * 16) / 8);

          // 10. BlockAlign (bytes 32..33): uint16LE == numChannels * bitsPerSample / 8
          const blockAlign = buffer.readUInt16LE(32);
          expect(blockAlign).toBe(2);

          // 11. BitsPerSample (bytes 34..35): uint16LE == 16
          const bitsPerSample = buffer.readUInt16LE(34);
          expect(bitsPerSample).toBe(16);

          // 12. Subchunk2ID (bytes 36..39): "data" in ASCII (0x64, 0x61, 0x74, 0x61)
          expect(buffer.toString('ascii', 36, 40)).toBe('data');
          expect(buffer[36]).toBe(0x64);
          expect(buffer[37]).toBe(0x61);
          expect(buffer[38]).toBe(0x74);
          expect(buffer[39]).toBe(0x61);

          // 13. Subchunk2Size (bytes 40..43): uint32LE == totalSamples * blockAlign
          const expectedTotalSamples = Math.floor((durationMs / 1000) * sampleRate);
          const expectedDataSize = expectedTotalSamples * blockAlign;
          const subchunk2Size = buffer.readUInt32LE(40);
          expect(subchunk2Size).toBe(expectedDataSize);

          // 14. Total buffer length must be exactly 44 + subchunk2Size
          expect(buffer.length).toBe(44 + expectedDataSize);

          // 15. RIFF ChunkSize must equal 36 + subchunk2Size
          expect(chunkSize).toBe(36 + subchunk2Size);
        }
      }
    });

    it('handles boundary condition durationMs = 0 by creating valid empty RIFF container', () => {
      const { buffer, durationMs } = generatePlayableWavBuffer({ durationMs: 0 });
      expect(durationMs).toBe(0);
      expect(buffer.length).toBe(44);
      expect(buffer.toString('ascii', 0, 4)).toBe('RIFF');
      expect(buffer.readUInt32LE(4)).toBe(36);
      expect(buffer.toString('ascii', 8, 12)).toBe('WAVE');
      expect(buffer.toString('ascii', 12, 16)).toBe('fmt ');
      expect(buffer.toString('ascii', 36, 40)).toBe('data');
      expect(buffer.readUInt32LE(40)).toBe(0);
    });

    it('throws RangeError when passed negative durationMs', () => {
      expect(() => generatePlayableWavBuffer({ durationMs: -100 })).toThrow(RangeError);
    });

    it('throws RangeError when passed NaN durationMs', () => {
      expect(() => generatePlayableWavBuffer({ durationMs: NaN })).toThrow(RangeError);
    });
  });

  // =========================================================================
  // 2. Audio Sample Value Range, RMS Energy, Non-Silence & Non-Clipping
  // =========================================================================
  describe('Audio Sample Value Integrity (16-bit PCM Dynamics)', () => {
    it('guarantees all samples are strictly within [-32768, 32767] with non-zero energy', () => {
      const { buffer } = generatePlayableWavBuffer({
        durationMs: 1500,
        sampleRate: 44100,
        amplitude: 0.35,
        frequency: 440,
        chimeHarmonics: true,
      });

      const totalSamples = (buffer.length - 44) / 2;
      expect(totalSamples).toBe(66150);

      let sumSquared = 0;
      let nonZeroCount = 0;
      let peakPositive = 0;
      let peakNegative = 0;
      let consecutiveRailCount = 0;
      let maxConsecutiveRail = 0;

      for (let offset = 44; offset < buffer.length; offset += 2) {
        const sample = buffer.readInt16LE(offset);

        // 16-bit signed integer range bounds
        expect(sample).toBeGreaterThanOrEqual(-32768);
        expect(sample).toBeLessThanOrEqual(32767);

        if (sample !== 0) {
          nonZeroCount++;
        }

        if (sample > peakPositive) peakPositive = sample;
        if (sample < peakNegative) peakNegative = sample;

        sumSquared += sample * sample;

        // Check for hard rail clipping (consecutive samples at max rail)
        if (sample === 32767 || sample === -32768) {
          consecutiveRailCount++;
          if (consecutiveRailCount > maxConsecutiveRail) {
            maxConsecutiveRail = consecutiveRailCount;
          }
        } else {
          consecutiveRailCount = 0;
        }
      }

      // RMS calculation: sqrt(sum(s^2) / N)
      const rms = Math.sqrt(sumSquared / totalSamples);

      // Verify audio is audibly non-silent
      expect(nonZeroCount / totalSamples).toBeGreaterThan(0.95); // >95% non-zero samples
      expect(rms).toBeGreaterThan(1500); // Significant acoustic energy
      expect(peakPositive).toBeGreaterThan(4000); // Audible peaks

      // Verify no hard rail clipping with default amplitude 0.35
      expect(maxConsecutiveRail).toBe(0);
      expect(peakPositive).toBeLessThanOrEqual(32767 * 0.35 + 1); // Respects amplitude scaling
      expect(peakNegative).toBeGreaterThanOrEqual(-32767 * 0.35 - 1);
    });

    it('clamps amplitude extremes [0.0, 2.0] safely within [0.01, 1.0] without integer overflow', () => {
      // Test over-driven amplitude (2.0 clamped to 1.0)
      const overdriven = generatePlayableWavBuffer({
        durationMs: 500,
        amplitude: 2.0,
      });
      for (let offset = 44; offset < overdriven.buffer.length; offset += 2) {
        const s = overdriven.buffer.readInt16LE(offset);
        expect(s).toBeGreaterThanOrEqual(-32768);
        expect(s).toBeLessThanOrEqual(32767);
      }

      // Test zero amplitude (clamped to 0.01 minimum)
      const quiet = generatePlayableWavBuffer({
        durationMs: 500,
        amplitude: 0.0,
      });
      let maxQuietPeak = 0;
      for (let offset = 44; offset < quiet.buffer.length; offset += 2) {
        const s = Math.abs(quiet.buffer.readInt16LE(offset));
        if (s > maxQuietPeak) maxQuietPeak = s;
      }
      expect(maxQuietPeak).toBeLessThanOrEqual(32767 * 0.01 + 2);
      expect(maxQuietPeak).toBeGreaterThan(0); // Clamped to 0.01, not silent
    });

    it('verifies 50ms attack envelope and exponential decay behavior', () => {
      const sampleRate = 44100;
      const { buffer } = generatePlayableWavBuffer({
        durationMs: 1500,
        sampleRate,
        amplitude: 0.5,
      });

      // Sample 0 at offset 44: envelope = 0 / 2205 = 0, so initial sample must be 0
      const initialSample = buffer.readInt16LE(44);
      expect(initialSample).toBe(0);

      // Near attack peak (~50ms = 2205 samples = offset 44 + 4410)
      let peakInAttack = 0;
      for (let i = 0; i < 2205; i++) {
        const s = Math.abs(buffer.readInt16LE(44 + i * 2));
        if (s > peakInAttack) peakInAttack = s;
      }
      expect(peakInAttack).toBeGreaterThan(5000);

      // Tail samples (last 100ms) should be significantly attenuated due to exponential decay
      const totalSamples = (buffer.length - 44) / 2;
      let tailMax = 0;
      for (let i = totalSamples - 4410; i < totalSamples; i++) {
        const s = Math.abs(buffer.readInt16LE(44 + i * 2));
        if (s > tailMax) tailMax = s;
      }
      expect(tailMax).toBeLessThan(peakInAttack * 0.2); // Decay by at least 80%
    });

    it('verifies zero-crossing frequency corresponds to musical chime band (400 - 1800 Hz)', () => {
      const sampleRate = 44100;
      const { buffer } = generatePlayableWavBuffer({
        durationMs: 1000,
        sampleRate,
        frequency: 440,
        chimeHarmonics: true,
      });

      const totalSamples = (buffer.length - 44) / 2;
      let zeroCrossings = 0;
      let prevSign = Math.sign(buffer.readInt16LE(44));

      for (let i = 1; i < totalSamples; i++) {
        const sample = buffer.readInt16LE(44 + i * 2);
        const sign = Math.sign(sample);
        if (sign !== 0 && prevSign !== 0 && sign !== prevSign) {
          zeroCrossings++;
        }
        if (sign !== 0) prevSign = sign;
      }

      // For fundamental 440Hz + 554.37Hz overtones, zero-crossings per second
      // should be roughly 2x the dominant frequency components (~800 to 1800 ZCR)
      expect(zeroCrossings).toBeGreaterThan(600);
      expect(zeroCrossings).toBeLessThan(2500);
    });
  });

  // =========================================================================
  // 3. MockTimbreTTSAdapter Empirical Edge Cases
  // =========================================================================
  describe('MockTimbreTTSAdapter Edge Cases', () => {
    const adapter = new MockTimbreTTSAdapter();

    it('synthesizes valid WAV for empty string with minimum clamped duration (1200ms)', async () => {
      const result = await adapter.synthesize('');
      expect(result.isMock).toBe(true);
      expect(result.mimeType).toBe('audio/wav');
      expect(result.durationMs).toBe(1200);
      expect(result.audioBuffer.length).toBe(44 + 1200 * 44.1 * 2);
      expect(result.audioBuffer.toString('ascii', 0, 4)).toBe('RIFF');
    });

    it('synthesizes valid WAV for whitespace-only text with minimum clamped duration', async () => {
      const result = await adapter.synthesize('     \t \n  ');
      expect(result.durationMs).toBe(1200);
      expect(result.audioBuffer.length).toBe(44 + 1200 * 44.1 * 2);
    });

    it('synthesizes valid WAV for 1-character text with minimum clamped duration (1200ms)', async () => {
      const result = await adapter.synthesize('A');
      expect(result.durationMs).toBe(1200);
      expect(result.audioBuffer.length).toBe(44 + 1200 * 44.1 * 2);
    });

    it('synthesizes valid WAV for 10,000+ characters with maximum clamped duration (15000ms)', async () => {
      const longText = 'Tasks and deadlines across sprints. '.repeat(500); // ~18,000 chars
      expect(longText.length).toBeGreaterThan(10000);

      const result = await adapter.synthesize(longText);
      expect(result.durationMs).toBe(15000);
      // 15000ms at 44.1kHz mono 16-bit: 15 * 44100 * 2 = 1,323,000 bytes
      expect(result.audioBuffer.length).toBe(44 + 1323000);
      expect(result.audioBuffer.toString('ascii', 0, 4)).toBe('RIFF');
      expect(result.audioBuffer.toString('ascii', 8, 12)).toBe('WAVE');
    });

    it('handles Hindi Unicode and Hinglish mixed transcripts correctly', async () => {
      const hindiText = 'नमस्ते! आज का बैकग्राउंड टास्क पूरा हो गया है।';
      const result = await adapter.synthesize(hindiText);

      expect(result.isMock).toBe(true);
      expect(result.durationMs).toBeGreaterThan(1200);
      expect(result.audioBuffer.toString('ascii', 0, 4)).toBe('RIFF');
      expect(result.audioBuffer.length).toBeGreaterThan(44);
    });

    it('handles emojis and symbols correctly without buffer distortion', async () => {
      const emojiText = '🎯 Sprint Planning 🚀 #123 & "quoted" <tag> 완료!';
      const result = await adapter.synthesize(emojiText);

      expect(result.isMock).toBe(true);
      expect(result.audioBuffer.toString('ascii', 0, 4)).toBe('RIFF');
      expect(result.audioBuffer.length).toBeGreaterThan(44);
    });
  });

  // =========================================================================
  // 4. Speed Variations & Boundary Clamping
  // =========================================================================
  describe('Speed Variations & Clamping', () => {
    const adapter = new MockTimbreTTSAdapter();
    const testText = 'Testing speed variations for speech synthesis pipeline.';

    it('clamps speed 0.25x to 0.5x minimum', async () => {
      const r025 = await adapter.synthesize(testText, { speed: 0.25 });
      const r050 = await adapter.synthesize(testText, { speed: 0.5 });
      // Both should clamp to 0.5x
      expect(r025.durationMs).toBe(r050.durationMs);
    });

    it('scales duration correctly between 0.5x, 1.0x, and 2.0x', async () => {
      const slow = await adapter.synthesize(testText, { speed: 0.5 });
      const normal = await adapter.synthesize(testText, { speed: 1.0 });
      const fast = await adapter.synthesize(testText, { speed: 2.0 });

      // Slow (0.5x) duration should be ~2x normal
      expect(slow.durationMs).toBe(Math.round(normal.durationMs / 0.5));
      // Fast (2.0x) duration should be ~0.5x normal
      expect(fast.durationMs).toBe(Math.round(normal.durationMs / 2.0));
      expect(slow.durationMs).toBeGreaterThan(normal.durationMs);
      expect(normal.durationMs).toBeGreaterThan(fast.durationMs);
    });

    it('clamps speed 4.0x to 2.0x maximum', async () => {
      const r400 = await adapter.synthesize(testText, { speed: 4.0 });
      const r200 = await adapter.synthesize(testText, { speed: 2.0 });
      // Both should clamp to 2.0x
      expect(r400.durationMs).toBe(r200.durationMs);
    });

    it('clamps negative speed (-1.0x) to 0.5x minimum', async () => {
      const negativeResult = await adapter.synthesize(testText, { speed: -1.0 });
      const minResult = await adapter.synthesize(testText, { speed: 0.5 });
      expect(negativeResult.durationMs).toBe(minResult.durationMs);
    });

    it('clamps speed 0 to 0.5x minimum', async () => {
      const zeroResult = await adapter.synthesize(testText, { speed: 0 });
      const minResult = await adapter.synthesize(testText, { speed: 0.5 });
      expect(zeroResult.durationMs).toBe(minResult.durationMs);
    });

    it('clamps Infinity and -Infinity gracefully', async () => {
      const infResult = await adapter.synthesize(testText, { speed: Infinity });
      const maxResult = await adapter.synthesize(testText, { speed: 2.0 });
      expect(infResult.durationMs).toBe(maxResult.durationMs);

      const negInfResult = await adapter.synthesize(testText, { speed: -Infinity });
      const minResult = await adapter.synthesize(testText, { speed: 0.5 });
      expect(negInfResult.durationMs).toBe(minResult.durationMs);
    });

    it('rejects speed NaN by throwing RangeError', async () => {
      await expect(adapter.synthesize(testText, { speed: NaN })).rejects.toThrow(RangeError);
    });
  });

  // =========================================================================
  // 5. Custom Sample Rate and Base Frequency Support
  // =========================================================================
  describe('Custom MockTimbreTTSAdapter Configuration', () => {
    it('supports 16kHz sample rate for telephony / speech models', async () => {
      const customAdapter = new MockTimbreTTSAdapter({ sampleRate: 16000, baseFrequency: 880 });
      const result = await customAdapter.synthesize('Telephony audio test');

      expect(result.audioBuffer.readUInt32LE(24)).toBe(16000);
      expect(result.audioBuffer.readUInt32LE(28)).toBe(32000); // 16000 * 2
      expect(result.audioBuffer.toString('ascii', 0, 4)).toBe('RIFF');
    });
  });
});
