import { describe, it, expect } from 'vitest';
import {
  HINGLISH_ANCHOR_MAP,
  roundUpTo15Minutes,
  resolveExplicitClockTime,
  resolveAnchorTime,
  resolvePreferredSlot,
} from '../src/utils/anchors.js';

describe('Hinglish Anchors & Time Resolution Utilities', () => {
  it('contains exactly 42 unique keys in HINGLISH_ANCHOR_MAP', () => {
    const keys = Object.keys(HINGLISH_ANCHOR_MAP);
    expect(keys.length).toBe(42);
  });

  it('correctly maps morning, lunch, and bedtime anchors', () => {
    expect(HINGLISH_ANCHOR_MAP['subah']).toEqual({ hour: 7, minute: 0 });
    expect(HINGLISH_ANCHOR_MAP['nashte ke baad']).toEqual({ hour: 9, minute: 0 });
    expect(HINGLISH_ANCHOR_MAP['lunch ke baad']).toEqual({ hour: 14, minute: 0 });
    expect(HINGLISH_ANCHOR_MAP['shaam']).toEqual({ hour: 17, minute: 0 });
    expect(HINGLISH_ANCHOR_MAP['dinner ke baad']).toEqual({ hour: 21, minute: 30 });
    expect(HINGLISH_ANCHOR_MAP['sone se pehle']).toEqual({ hour: 23, minute: 0 });
  });

  it('resolves longest matching substring over shorter prefix in resolveAnchorTime', () => {
    // "nashte ke baad" contains "nashte ke baad" which should map to 09:00
    const resolved = resolveAnchorTime('kripya mera task nashte ke baad schedule karein');
    expect(resolved).toEqual({ hour: 9, minute: 0 });
  });

  describe('resolveExplicitClockTime', () => {
    it('parses "5 baje" to 05:00', () => {
      expect(resolveExplicitClockTime('5 baje')).toEqual({ hour: 5, minute: 0 });
    });

    it('parses Hindi Devanagari "5 बजे" to 05:00', () => {
      expect(resolveExplicitClockTime('5 बजे')).toEqual({ hour: 5, minute: 0 });
    });

    it('parses "2:30 pm" to 14:30', () => {
      expect(resolveExplicitClockTime('2:30 pm')).toEqual({ hour: 14, minute: 30 });
    });

    it('parses "10 am" to 10:00', () => {
      expect(resolveExplicitClockTime('10 am')).toEqual({ hour: 10, minute: 0 });
    });

    it('parses "14:00" 24-hour clock to 14:00', () => {
      expect(resolveExplicitClockTime('14:00')).toEqual({ hour: 14, minute: 0 });
    });

    it('returns null for non-clock strings', () => {
      expect(resolveExplicitClockTime('kal subah')).toBeNull();
      expect(resolveExplicitClockTime('25:00')).toBeNull();
      expect(resolveExplicitClockTime('3:65')).toBeNull();
    });
  });

  describe('roundUpTo15Minutes (millisecond ceil arithmetic)', () => {
    it('rounds up 14:15:30 to 14:30:00 (fixing legacy second truncation bug)', () => {
      // 14:15:30 -> in legacy code with setSeconds(0,0), it rounded down to 14:15:00!
      // In R.U.B.I. 2.0 with millisecond ceil, it correctly advances to 14:30:00.
      const d = new Date('2026-11-07T14:15:30.000Z');
      const rounded = roundUpTo15Minutes(d);
      expect(rounded.toISOString()).toBe('2026-11-07T14:30:00.000Z');
    });

    it('preserves an exact 15-minute boundary (14:15:00.000)', () => {
      const d = new Date('2026-11-07T14:15:00.000Z');
      const rounded = roundUpTo15Minutes(d);
      expect(rounded.toISOString()).toBe('2026-11-07T14:15:00.000Z');
    });

    it('rounds 14:01:00 up to 14:15:00', () => {
      const d = new Date('2026-11-07T14:01:00.000Z');
      const rounded = roundUpTo15Minutes(d);
      expect(rounded.toISOString()).toBe('2026-11-07T14:15:00.000Z');
    });

    it('rounds 14:46:00 up to 15:00:00', () => {
      const d = new Date('2026-11-07T14:46:00.000Z');
      const rounded = roundUpTo15Minutes(d);
      expect(rounded.toISOString()).toBe('2026-11-07T15:00:00.000Z');
    });
  });

  describe('resolvePreferredSlot', () => {
    it('prioritizes explicit clock expressions over anchors', () => {
      expect(resolvePreferredSlot('4:00 pm')).toEqual({ hour: 16, minute: 0 });
    });

    it('falls back to colloquial anchor maps', () => {
      expect(resolvePreferredSlot('shaam ko')).toEqual({ hour: 17, minute: 0 });
    });

    it('returns null for empty or null strings', () => {
      expect(resolvePreferredSlot('')).toBeNull();
      expect(resolvePreferredSlot(null)).toBeNull();
      expect(resolvePreferredSlot('flexible')).toBeNull();
    });
  });
});
