import { roundUpTo15Minutes, resolvePreferredSlot, resolveAnchorTime, type TimeTuple } from './anchors.js';

export interface TimeInterval {
  start: Date;
  end: Date;
}

export interface ZonedDateParts {
  year: number;
  month: number; // 1-12
  day: number;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ...
  hour: number;
  minute: number;
  second: number;
}

/**
 * Extracts wall-clock calendar parts of a Date in a specific IANA timezone.
 */
export function getZonedDateParts(
  date: Date = new Date(),
  timeZone: string = 'Asia/Kolkata'
): ZonedDateParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  let year = 0;
  let month = 0;
  let day = 0;
  let hour = 0;
  let minute = 0;
  let second = 0;
  let weekdayStr = '';

  for (const p of parts) {
    if (p.type === 'year') year = parseInt(p.value, 10);
    if (p.type === 'month') month = parseInt(p.value, 10);
    if (p.type === 'day') day = parseInt(p.value, 10);
    if (p.type === 'hour') hour = parseInt(p.value, 10);
    if (p.type === 'minute') minute = parseInt(p.value, 10);
    if (p.type === 'second') second = parseInt(p.value, 10);
    if (p.type === 'weekday') weekdayStr = p.value.toLowerCase();
  }

  if (hour === 24) hour = 0;
  const dayMap: Record<string, number> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
  };
  const dayOfWeek = dayMap[weekdayStr.slice(0, 3)] ?? date.getUTCDay();

  return { year, month, day, dayOfWeek, hour, minute, second };
}

/**
 * Converts a wall-clock local date and time in an IANA timezone into a true UTC Date.
 * Accurately handles DST transitions without hardcoding static offsets.
 */
export function zonedTimeToUtc(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  timeZone: string = 'Asia/Kolkata'
): Date {
  const approximateUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const getOffsetMs = (date: Date): number => {
    const parts = formatter.formatToParts(date);
    let fY = 0, fM = 0, fD = 0, fH = 0, fMin = 0, fS = 0;
    for (const p of parts) {
      if (p.type === 'year') fY = parseInt(p.value, 10);
      if (p.type === 'month') fM = parseInt(p.value, 10);
      if (p.type === 'day') fD = parseInt(p.value, 10);
      if (p.type === 'hour') fH = parseInt(p.value, 10);
      if (p.type === 'minute') fMin = parseInt(p.value, 10);
      if (p.type === 'second') fS = parseInt(p.value, 10);
    }
    if (fH === 24) fH = 0;
    const localTimeAsUtc = Date.UTC(fY, fM - 1, fD, fH, fMin, fS);
    return localTimeAsUtc - date.getTime();
  };

  const offsetMs = getOffsetMs(approximateUtc);
  let trueUtc = new Date(approximateUtc.getTime() - offsetMs);

  // Second refinement pass across DST boundary
  const refinedOffset = getOffsetMs(trueUtc);
  if (refinedOffset !== offsetMs) {
    trueUtc = new Date(approximateUtc.getTime() - refinedOffset);
  }

  return trueUtc;
}

/**
 * Resolves a date string or anchor phrase into a concrete Date object.
 * If anchor phrase contains a time, applies that hour/minute to the base date.
 */
export function resolveAnchorToDate(
  phrase: string | null | undefined,
  baseDate: Date = new Date()
): Date | null {
  const time = resolvePreferredSlot(phrase);
  if (!time) return null;

  const resolved = new Date(baseDate);
  resolved.setHours(time.hour, time.minute, 0, 0);
  return resolved;
}

/**
 * Searches for the next available time slot for a given duration.
 * Iterates in 15-minute intervals avoiding collisions with busy intervals.
 */
export function findNextFreeSlot(
  durationMinutes: number,
  preferredStart: Date,
  busySlots: TimeInterval[] = [],
  dayEndHour: number = 23
): Date | null {
  let candidate = roundUpTo15Minutes(new Date(preferredStart));
  const dayEnd = new Date(candidate);
  dayEnd.setHours(dayEndHour, 0, 0, 0);

  const durationMs = durationMinutes * 60 * 1000;

  while (candidate.getTime() + durationMs <= dayEnd.getTime()) {
    const slotEnd = new Date(candidate.getTime() + durationMs);
    const conflict = busySlots.find(
      (busy) => candidate < busy.end && slotEnd > busy.start
    );

    if (!conflict) {
      return candidate;
    }

    // Fast-forward past conflicting interval rounded up to 15 minutes
    candidate = roundUpTo15Minutes(new Date(conflict.end));
  }

  return null;
}

const WEEKDAY_MAP: Record<string, number> = {
  sunday: 0,
  sun: 0,
  ravivar: 0,
  raviwar: 0,
  itvar: 0,
  itwar: 0,
  monday: 1,
  mon: 1,
  somvar: 1,
  somwar: 1,
  tuesday: 2,
  tue: 2,
  mangalvar: 2,
  mangalwar: 2,
  wednesday: 3,
  wed: 3,
  budhvar: 3,
  budhwar: 3,
  thursday: 4,
  thu: 4,
  guruvar: 4,
  guruwar: 4,
  brihaspativar: 4,
  friday: 5,
  fri: 5,
  shukravar: 5,
  shukrawar: 5,
  jumma: 5,
  saturday: 6,
  sat: 6,
  shanivar: 6,
  shaniwar: 6,
};

/**
 * Extracts a time tuple (hour, minute) from a text phrase, searching
 * for explicit clock times ("4 PM", "5:30 pm", "10 am", "10 baje") or social anchors.
 */
export function extractTimeFromPhrase(phrase: string): TimeTuple | null {
  if (!phrase) return null;

  // 1. Direct slot match
  const directSlot = resolvePreferredSlot(phrase);
  if (directSlot) return directSlot;

  // 2. Embedded clock time search: e.g. "at 4 PM", "5:30 pm", "5 PM", "10 am", "10 baje"
  const clockMatch = phrase.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|baje|बजे)\b/i);
  if (clockMatch && clockMatch[1]) {
    let hour = parseInt(clockMatch[1], 10);
    const minute = clockMatch[2] ? parseInt(clockMatch[2], 10) : 0;
    const meridiem = clockMatch[3] ? clockMatch[3].toLowerCase() : '';

    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
    if (meridiem === 'baje' || meridiem === 'बजे') {
      if (/\b(?:shaam|dopahar|raat|evening|night)\b/i.test(phrase) && hour < 12) {
        hour += 12;
      }
    }
    return { hour, minute };
  }

  // 3. Hinglish anchor lookup
  return resolveAnchorTime(phrase);
}

/**
 * Detects multiple distinct work session times in a single utterance.
 * e.g. "at 5 and 7 PM", "at 10 AM and 2 PM".
 */
export function extractMultipleTimesFromPhrase(
  phrase: string
): Array<{ hour: number; minute: number; text: string }> {
  if (!phrase) return [];

  // Match pattern: "at 5 and 7 PM" / "5 and 7:30 pm"
  const multiMatch = phrase.match(
    /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(?:and|&|,)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|baje|बजे)\b/i
  );
  if (multiMatch && multiMatch[1] && multiMatch[3] && multiMatch[5]) {
    let h1 = parseInt(multiMatch[1], 10);
    const m1 = multiMatch[2] ? parseInt(multiMatch[2], 10) : 0;
    let h2 = parseInt(multiMatch[3], 10);
    const m2 = multiMatch[4] ? parseInt(multiMatch[4], 10) : 0;
    const meridiem = multiMatch[5].toLowerCase();

    if (meridiem === 'pm') {
      if (h1 < 12) h1 += 12;
      if (h2 < 12) h2 += 12;
    } else if (meridiem === 'am') {
      if (h1 === 12) h1 = 0;
      if (h2 === 12) h2 = 0;
    }
    return [
      { hour: h1, minute: m1, text: `${h1}:${m1.toString().padStart(2, '0')}` },
      { hour: h2, minute: m2, text: `${h2}:${m2.toString().padStart(2, '0')}` },
    ];
  }

  // Both times have explicit meridiem: "5 PM and 7 PM"
  const matches = [...phrase.matchAll(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|baje|बजे)\b/gi)];
  if (matches.length >= 2) {
    const results: Array<{ hour: number; minute: number; text: string }> = [];
    for (const match of matches) {
      if (!match[1] || !match[3]) continue;
      let h = parseInt(match[1], 10);
      const m = match[2] ? parseInt(match[2], 10) : 0;
      const meridiem = match[3].toLowerCase();
      if (meridiem === 'pm' && h < 12) h += 12;
      if (meridiem === 'am' && h === 12) h = 0;
      results.push({ hour: h, minute: m, text: match[0] });
    }
    return results;
  }

  return [];
}

/**
 * Resolves relative date phrases ("tomorrow", "kal", "parson", "Friday at 4 PM", etc.)
 * into an ISO 8601 UTC string. Defaults to UTC if timeZone is not specified,
 * preserving legacy UTC assertions while supporting full IANA timezone conversion
 * (e.g. 'Asia/Kolkata', 'America/New_York') without static offsets or DST shifts.
 */
export function resolveRelativeDate(
  phrase: string | null | undefined,
  baseDate: Date = new Date(),
  timeZone: string = 'UTC'
): string | null {
  if (!phrase || phrase.trim() === '' || phrase.toLowerCase() === 'null') {
    return null;
  }

  const raw = phrase.trim();

  // 1. If already an ISO 8601 string with UTC indicator 'Z' or offset '+/-'
  if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})/i.test(raw)) {
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  // 2. If ISO-like date string without timezone (e.g. "2026-11-09T17:00:00" or "2026-11-09")
  const dateMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (dateMatch && dateMatch[1] && dateMatch[2] && dateMatch[3]) {
    const y = parseInt(dateMatch[1], 10);
    const m = parseInt(dateMatch[2], 10);
    const d = parseInt(dateMatch[3], 10);
    const h = dateMatch[4] ? parseInt(dateMatch[4], 10) : 17;
    const min = dateMatch[5] ? parseInt(dateMatch[5], 10) : 0;
    const utcDate = zonedTimeToUtc(y, m, d, h, min, timeZone);
    return utcDate.toISOString();
  }

  const lower = raw.toLowerCase();

  // Extract base date calendar parts in the user's target timezone
  const baseParts = getZonedDateParts(baseDate, timeZone);

  // Determine time of day (hours, minutes)
  const slot = extractTimeFromPhrase(raw);
  const defaultHour = 17; // 5:00 PM standard end-of-day default
  const defaultMinute = 0;
  const hour = slot ? slot.hour : defaultHour;
  const minute = slot ? slot.minute : defaultMinute;

  let dayOffset: number | null = null;

  // Relative day keywords
  if (/\b(?:day\s+after\s+tomorrow|parson|parso)\b/i.test(lower)) {
    dayOffset = 2;
  } else if (/\b(?:tarson|tarso)\b/i.test(lower)) {
    dayOffset = 3;
  } else if (/\b(?:tomorrow|kal)\b/i.test(lower)) {
    dayOffset = 1;
  } else if (/\b(?:today|aaj)\b/i.test(lower)) {
    dayOffset = 0;
  } else if (/\b(?:next\s+week|agle\s+hafte)\b/i.test(lower)) {
    dayOffset = 7;
  } else if (/\b(?:end\s+of\s+week|hafte\s+ke\s+ant)\b/i.test(lower)) {
    // End of week defaults to upcoming Friday
    const currentDay = baseParts.dayOfWeek;
    const targetDay = 5; // Friday
    let diff = targetDay - currentDay;
    if (diff <= 0) diff += 7;
    dayOffset = diff;
  } else {
    // Check for weekday names
    for (const [name, targetDay] of Object.entries(WEEKDAY_MAP)) {
      const regex = new RegExp(`\\b${name}\\b`, 'i');
      if (regex.test(lower)) {
        const currentDay = baseParts.dayOfWeek;
        let diff = targetDay - currentDay;
        if (diff <= 0) diff += 7;
        dayOffset = diff;
        break;
      }
    }
  }

  // If day offset was determined, calculate true UTC using timezone converter
  if (dayOffset !== null) {
    const utcDate = zonedTimeToUtc(
      baseParts.year,
      baseParts.month,
      baseParts.day + dayOffset,
      hour,
      minute,
      timeZone
    );
    return utcDate.toISOString();
  }

  // If only a time slot was parsed without a relative day keyword (defaults to today)
  if (slot) {
    const utcDate = zonedTimeToUtc(
      baseParts.year,
      baseParts.month,
      baseParts.day,
      slot.hour,
      slot.minute,
      timeZone
    );
    return utcDate.toISOString();
  }

  return null;
}

/**
 * Timezone-aware relative date resolver for personal workload scheduling.
 * Defaults to Asia/Kolkata unless overridden by workspace/user settings.
 */
export function resolveZonedRelativeDate(
  phrase: string | null | undefined,
  baseDate: Date = new Date(),
  timeZone: string = 'Asia/Kolkata'
): string | null {
  return resolveRelativeDate(phrase, baseDate, timeZone);
}

/**
 * Normalizes deadline inputs using timezone-aware resolution.
 */
export function normalizeDeadline(
  phrase: string | null | undefined,
  baseDate: Date = new Date(),
  timeZone: string = 'UTC'
): string | null {
  return resolveRelativeDate(phrase, baseDate, timeZone);
}
