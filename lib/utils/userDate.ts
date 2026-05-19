/**
 * Timezone-aware date helpers — thin re-exports from streakDate.ts.
 *
 * All arithmetic now uses noon-UTC anchoring so that DST transitions and
 * timezone offsets never produce duplicate or skipped date keys.
 *
 * Import from streakDate.ts directly in new code.
 * These exports exist for backward-compatibility with existing callers.
 */

import {
    getDateKey,
    getYesterdayKey,
    getLastNDayKeys,
    getWeekdayIndex as _getWeekdayIndex,
    buildWeekDates,
    getTimeSlot,
} from './streakDate';

// ── Re-exports (same names as before) ─────────────────────────────────────

/** YYYY-MM-DD in the given timezone. */
export function getUserDateKey(timezone: string, date: Date = new Date()): string {
    return getDateKey(timezone, date);
}

/** YYYY-MM-DD for yesterday in the given timezone (noon-UTC anchored). */
export function getUserYesterdayKey(timezone: string): string {
    return getYesterdayKey(timezone);
}

/** Last 7 YYYY-MM-DD keys, oldest-first, in the given timezone (noon-UTC anchored). */
export function getUserLast7DayKeys(timezone: string): string[] {
    return getLastNDayKeys(timezone, 7);
}

/** HH:MM (24-hour, zero-padded) in the given timezone. */
export function getUserTimeSlot(timezone: string, date: Date = new Date()): string {
    return getTimeSlot(timezone, date);
}

/**
 * Weekday index in the given timezone.
 * Returns Mon=0 … Sun=6 to match the existing callers and DAY_LABELS array.
 * (New code should call getWeekdayIndex from streakDate.ts which uses 0=Sun.)
 */
export function getUserWeekdayIndex(timezone: string, date: Date = new Date()): number {
    // streakDate uses 0=Sun … 6=Sat; convert to Mon=0 … Sun=6 for legacy callers.
    const js = _getWeekdayIndex(timezone, date); // 0=Sun
    return js === 0 ? 6 : js - 1;               // Mon=0 … Sun=6
}

/**
 * Mon–Sun YYYY-MM-DD keys for the current week (noon-UTC anchored).
 * Index 0 = Monday of this week, index 6 = Sunday.
 */
export function buildUserWeekKeys(timezone: string): string[] {
    return buildWeekDates(timezone, 0);
}

/**
 * Mon–Sun YYYY-MM-DD keys for a week at the given offset from the current week.
 * offset=0 → this week, offset=-1 → last week, etc. (noon-UTC anchored).
 */
export function buildUserWeekDates(timezone: string, offset: number): string[] {
    return buildWeekDates(timezone, offset);
}

/**
 * Human-readable local datetime string for debug logs.
 * e.g. "2026-05-19 14:35:02 (Asia/Kolkata)"
 */
export function getUserLocalString(timezone: string, date: Date = new Date()): string {
    try {
        const d = new Intl.DateTimeFormat('en-CA', {
            timeZone: timezone || undefined,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false,
        }).format(date).replace(', ', ' ');
        return `${d} (${timezone})`;
    } catch {
        return date.toLocaleString();
    }
}
