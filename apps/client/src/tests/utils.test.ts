import { describe, it, expect } from 'vitest';
import { cn, formatDuration, formatDate } from '../lib/utils.js';

describe('Client Utility Functions', () => {
  describe('cn (Tailwind class merging)', () => {
    it('merges class names and handles conditional classes cleanly', () => {
      const result = cn('px-4 py-2', true && 'bg-blue-600', false && 'hidden', 'text-white');
      expect(result).toBe('px-4 py-2 bg-blue-600 text-white');
    });

    it('resolves conflicting tailwind utilities by giving precedence to later values', () => {
      const result = cn('px-4 px-6 text-red-500 text-blue-500');
      expect(result).toBe('px-6 text-blue-500');
    });
  });

  describe('formatDuration (timer formatting mm:ss)', () => {
    it('formats 0 seconds as 00:00', () => {
      expect(formatDuration(0)).toBe('00:00');
    });

    it('formats single-digit seconds as 00:05', () => {
      expect(formatDuration(5)).toBe('00:05');
    });

    it('formats 65 seconds as 01:05', () => {
      expect(formatDuration(65)).toBe('01:05');
    });

    it('formats multi-minute intervals correctly (e.g. 125s -> 02:05)', () => {
      expect(formatDuration(125)).toBe('02:05');
    });

    it('sanitizes negative, NaN, and non-finite inputs to 00:00', () => {
      expect(formatDuration(-1)).toBe('00:00');
      expect(formatDuration(-100)).toBe('00:00');
      expect(formatDuration(NaN)).toBe('00:00');
      expect(formatDuration(Infinity)).toBe('00:00');
      expect(formatDuration(-Infinity)).toBe('00:00');
    });
  });

  describe('formatDate (ISO date formatter)', () => {
    it('returns "No deadline" for null or undefined', () => {
      expect(formatDate(null)).toBe('No deadline');
      expect(formatDate(undefined)).toBe('No deadline');
    });

    it('formats valid ISO date strings into readable human format', () => {
      const formatted = formatDate('2026-11-13T17:00:00.000Z');
      expect(formatted).toMatch(/Nov|13|2026/i);
    });

    it('safely handles invalid date strings by returning original text', () => {
      expect(formatDate('invalid-date-string')).toBe('invalid-date-string');
    });
  });
});
