import { describe, it, expect } from 'vitest';
import {
  resolveRelativeDate,
  normalizeDeadline,
  resolveAnchorToDate,
  findNextFreeSlot,
} from '../src/utils/dateResolver.js';

describe('Relative Date & Deadline Resolver', () => {
  // Fixed baseline: Saturday, November 7, 2026, 00:00:00 UTC
  const BASE_DATE = new Date('2026-11-07T00:00:00.000Z');

  describe('resolveRelativeDate', () => {
    it('returns null for empty, undefined, or "null" string', () => {
      expect(resolveRelativeDate(null)).toBeNull();
      expect(resolveRelativeDate(undefined)).toBeNull();
      expect(resolveRelativeDate('')).toBeNull();
      expect(resolveRelativeDate('   ')).toBeNull();
      expect(resolveRelativeDate('null')).toBeNull();
    });

    it('preserves existing ISO 8601 strings', () => {
      const iso = '2026-11-13T17:00:00.000Z';
      expect(resolveRelativeDate(iso, BASE_DATE)).toBe(iso);
    });

    it('resolves "tomorrow" to +1 day at 17:00 UTC default', () => {
      const resolved = resolveRelativeDate('tomorrow', BASE_DATE);
      expect(resolved).toBe('2026-11-08T17:00:00.000Z');
    });

    it('resolves "tomorrow 5 PM" to +1 day at 17:00 UTC', () => {
      const resolved = resolveRelativeDate('tomorrow 5 PM', BASE_DATE);
      expect(resolved).toBe('2026-11-08T17:00:00.000Z');
    });

    it('resolves Hinglish "kal subah 10 baje" to +1 day at 10:00 UTC', () => {
      const resolved = resolveRelativeDate('kal subah 10 baje', BASE_DATE);
      expect(resolved).toBe('2026-11-08T10:00:00.000Z');
    });

    it('resolves Hinglish "parson" / "parso" to +2 days at 17:00 UTC', () => {
      const resolved = resolveRelativeDate('parson', BASE_DATE);
      expect(resolved).toBe('2026-11-09T17:00:00.000Z');
    });

    it('resolves "day after tomorrow" to +2 days', () => {
      const resolved = resolveRelativeDate('day after tomorrow', BASE_DATE);
      expect(resolved).toBe('2026-11-09T17:00:00.000Z');
    });

    it('resolves "Friday at 4 PM" from Saturday Nov 7 to upcoming Friday Nov 13 at 16:00 UTC', () => {
      const resolved = resolveRelativeDate('Friday at 4 PM', BASE_DATE);
      expect(resolved).toBe('2026-11-13T16:00:00.000Z');
    });

    it('resolves "before Friday" from Saturday Nov 7 to upcoming Friday Nov 13 at 17:00 UTC', () => {
      const resolved = resolveRelativeDate('before Friday', BASE_DATE);
      expect(resolved).toBe('2026-11-13T17:00:00.000Z');
    });

    it('resolves "end of week" to upcoming Friday', () => {
      const resolved = resolveRelativeDate('end of week', BASE_DATE);
      expect(resolved).toBe('2026-11-13T17:00:00.000Z');
    });

    it('resolves "next week" to +7 days', () => {
      const resolved = resolveRelativeDate('next week', BASE_DATE);
      expect(resolved).toBe('2026-11-14T17:00:00.000Z');
    });

    it('normalizeDeadline delegates transparently to resolveRelativeDate', () => {
      expect(normalizeDeadline('kal subah 10 baje', BASE_DATE)).toBe(
        resolveRelativeDate('kal subah 10 baje', BASE_DATE)
      );
    });
  });

  describe('resolveAnchorToDate and findNextFreeSlot backward compatibility', () => {
    it('resolves clock time anchor to Date object', () => {
      const date = resolveAnchorToDate('5 baje', BASE_DATE);
      expect(date).toBeInstanceOf(Date);
      expect(date?.getHours()).toBe(5);
    });

    it('finds next free slot with 15-minute alignment', () => {
      const start = new Date(BASE_DATE);
      start.setHours(9, 0, 0, 0);
      const free = findNextFreeSlot(30, start, []);
      expect(free).not.toBeNull();
      expect(free?.getMinutes() % 15).toBe(0);
    });
  });
});
