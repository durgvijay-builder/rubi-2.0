export interface TimeTuple {
  hour: number;
  minute: number;
}

export const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

/**
 * Rounds a Date up to the next 15-minute boundary using millisecond-level ceiling math.
 * Avoids sub-minute truncation bugs where non-zero seconds on a 15-minute mark (e.g. 14:15:30)
 * would otherwise round down to 14:15:00 instead of advancing to 14:30:00.
 */
export function roundUpTo15Minutes(date: Date): Date {
  return new Date(Math.ceil(date.getTime() / FIFTEEN_MINUTES_MS) * FIFTEEN_MINUTES_MS);
}

/**
 * 42 Colloquial Hinglish social anchor mappings to 24-hour (hour, minute) tuples.
 * Extracted from legacy config/anchors.py.
 */
export const HINGLISH_ANCHOR_MAP: Readonly<Record<string, TimeTuple>> = {
  // Morning (07:00)
  'subah uthne ke baad': { hour: 7, minute: 0 },
  'subah': { hour: 7, minute: 0 },
  'uthne ke baad': { hour: 7, minute: 0 },
  'wakeup': { hour: 7, minute: 0 },
  'wake up': { hour: 7, minute: 0 },

  // Breakfast (09:00)
  'breakfast ke baad': { hour: 9, minute: 0 },
  'breakfast ke bad': { hour: 9, minute: 0 },
  'breakfast': { hour: 9, minute: 0 },
  'nashte ke baad': { hour: 9, minute: 0 },
  'nashte ke bad': { hour: 9, minute: 0 },

  // Forenoon (10:00 - 11:00)
  'subah 10 baje': { hour: 10, minute: 0 },
  'subah 11 baje': { hour: 11, minute: 0 },

  // Lunch (13:30 - 14:00)
  'lunch': { hour: 13, minute: 30 },
  'dopahar': { hour: 13, minute: 30 },
  'lunch ke baad': { hour: 14, minute: 0 },
  'lunch ke bad': { hour: 14, minute: 0 },
  'dopahar ke baad': { hour: 14, minute: 0 },
  'dopahar ke bad': { hour: 14, minute: 0 },
  'khane ke baad': { hour: 14, minute: 0 },
  'khane ke bad': { hour: 14, minute: 0 },

  // Afternoon (15:00 - 16:30)
  'dopahar baad': { hour: 15, minute: 0 },
  'shaam se pehle': { hour: 16, minute: 30 },

  // Evening (17:00 - 18:00)
  'shaam': { hour: 17, minute: 0 },
  'shaam ko': { hour: 17, minute: 0 },
  'evening': { hour: 17, minute: 0 },
  'shaam ke baad': { hour: 18, minute: 0 },
  'shaam ke bad': { hour: 18, minute: 0 },

  // Dinner (20:30 - 21:30)
  'dinner': { hour: 20, minute: 30 },
  'raat ka khana': { hour: 20, minute: 30 },
  'dinner ke baad': { hour: 21, minute: 30 },
  'dinner ke bad': { hour: 21, minute: 30 },
  'khana khane ke baad': { hour: 21, minute: 30 },
  'khana khane ke bad': { hour: 21, minute: 30 },

  // Night (21:00)
  'raat': { hour: 21, minute: 0 },
  'raat ko': { hour: 21, minute: 0 },
  'raat mein': { hour: 21, minute: 0 },
  'night': { hour: 21, minute: 0 },

  // Bedtime (23:00)
  'sone se pehle': { hour: 23, minute: 0 },
  'sone se pahle': { hour: 23, minute: 0 },
  'so jaane se pehle': { hour: 23, minute: 0 },
  'bedtime': { hour: 23, minute: 0 },
  'so jaao': { hour: 23, minute: 0 },
};

/**
 * Resolves explicit clock time strings with optional Hindi indicators ("baje", "बजे", "am", "pm").
 * Direct TypeScript port of legacy core/anchor_resolver.py:59-72.
 * Examples: "5 baje", "5 बजे", "2:30 pm", "14:00", "10 am"
 */
export function resolveExplicitClockTime(phrase: string): TimeTuple | null {
  if (!phrase) return null;

  // Normalize string and strip Hindi clock markers "baje" and "बजे"
  const cleaned = phrase
    .toLowerCase()
    .replace(/\s*(?:baje|बजे)/gi, '')
    .trim();

  // Match: 1-2 digit hour, optional :minute (2 digits), optional am/pm meridiem
  const match = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match || !match[1]) return null;

  let hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  const meridiem = match[3] ? match[3].toLowerCase() : null;

  // Validate time boundaries
  if (minute > 59 || hour > (meridiem ? 12 : 23)) {
    return null;
  }

  // Convert 12-hour meridiem to 24-hour format
  if (meridiem) {
    hour = (hour % 12) + (meridiem === 'pm' ? 12 : 0);
  }

  if (hour > 23) return null;

  return { hour, minute };
}

/**
 * Resolves colloquial Hinglish anchor phrases from HINGLISH_ANCHOR_MAP.
 * Matches exact phrase first, followed by longest substring matching.
 */
export function resolveAnchorTime(phrase: string): TimeTuple | null {
  if (!phrase) return null;
  const normalized = phrase.trim().toLowerCase();
  if (normalized in HINGLISH_ANCHOR_MAP) {
    const val = HINGLISH_ANCHOR_MAP[normalized];
    return val ? { hour: val.hour, minute: val.minute } : null;
  }

  // Longest matching substring wins
  let bestMatch: string | null = null;
  for (const key of Object.keys(HINGLISH_ANCHOR_MAP)) {
    if (normalized.includes(key)) {
      if (!bestMatch || key.length > bestMatch.length) {
        bestMatch = key;
      }
    }
  }

  if (bestMatch) {
    const val = HINGLISH_ANCHOR_MAP[bestMatch];
    return val ? { hour: val.hour, minute: val.minute } : null;
  }

  return null;
}

/**
 * Complete composite preferred slot resolver.
 * 1. Evaluates explicit clock expressions (e.g. "5 baje", "5 बजे", "4:30 pm").
 * 2. Falls back to colloquial social anchor mappings (e.g. "lunch ke baad", "sone se pehle").
 */
export function resolvePreferredSlot(phrase: string | null | undefined): TimeTuple | null {
  if (
    !phrase ||
    phrase.trim() === '' ||
    phrase.toLowerCase() === 'flexible' ||
    phrase.toLowerCase() === 'null'
  ) {
    return null;
  }

  // 1. Explicit clock time parsing (legacy core/anchor_resolver.py:59-72)
  const clock = resolveExplicitClockTime(phrase);
  if (clock) return clock;

  // 2. Hinglish anchor map lookup (exact or longest substring)
  return resolveAnchorTime(phrase);
}
