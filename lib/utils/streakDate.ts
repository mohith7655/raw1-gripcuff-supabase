/**
 * Canonical timezone-aware date utilities for streak and challenge tracking.
 *
 * Single source of truth — import from here, never from dateKey.ts or userDate.ts
 * directly in streak / challenge / leaderboard logic.
 *
 * Rules:
 *  - All public functions receive an explicit IANA timezone string.
 *  - Calendar arithmetic uses noon-UTC anchoring (Date.UTC + 12h) so that
 *    timezone offsets up to ±12h never cross a date boundary.
 *  - NEVER use new Date().toISOString(), getUTCDay(), or UTC-midnight logic.
 *  - NEVER read the device timezone inside this file.
 *
 * Weekday convention (matches JS getDay()):
 *   0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday,
 *   4 = Thursday, 5 = Friday, 6 = Saturday
 */

// ── Intl formatter helpers ─────────────────────────────────────────────────

function formatParts(
    timezone: string,
    date: Date,
    options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormatPart[] {
    try {
        return new Intl.DateTimeFormat('en-US', { timeZone: timezone || undefined, ...options }).formatToParts(date);
    } catch {
        return new Intl.DateTimeFormat('en-US', options).formatToParts(date);
    }
}

function intlPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
    return Number(parts.find(p => p.type === type)?.value ?? 0);
}

// ── Core date key ──────────────────────────────────────────────────────────

/**
 * Returns YYYY-MM-DD for `date` in the given IANA timezone.
 * Falls back to device timezone on error.
 */
export function getDateKey(timezone: string, date: Date = new Date()): string {
    try {
        // en-CA locale produces ISO-8601 (YYYY-MM-DD) natively.
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: timezone || undefined,
        }).format(date);
    } catch {
        const d = date;
        return (
            d.getFullYear() +
            '-' + String(d.getMonth() + 1).padStart(2, '0') +
            '-' + String(d.getDate()).padStart(2, '0')
        );
    }
}

// ── "now" accessor (testable seam) ─────────────────────────────────────────

/**
 * Returns the current Date object.
 * The `timezone` parameter is accepted for API consistency and future mocking;
 * Date always represents the same instant regardless of timezone.
 */
export function getUserNow(_timezone: string): Date {
    return new Date();
}

// ── Weekday index ──────────────────────────────────────────────────────────

/**
 * Returns the weekday index of `date` in the given timezone.
 * Convention: 0 = Sunday, 1 = Monday, … 6 = Saturday  (JS getDay() standard).
 */
export function getWeekdayIndex(timezone: string, date: Date = new Date()): number {
    const parts = formatParts(timezone, date, {
        year: 'numeric', month: 'numeric', day: 'numeric',
    });
    const y  = intlPart(parts, 'year');
    const mo = intlPart(parts, 'month') - 1; // 0-indexed
    const d  = intlPart(parts, 'day');
    // new Date(y, mo, d) creates local midnight; .getDay() gives the universal
    // day-of-week for that calendar date, which is timezone-independent.
    return new Date(y, mo, d).getDay(); // 0=Sun … 6=Sat
}

// ── Week-start (Monday) ────────────────────────────────────────────────────

/**
 * Returns the YYYY-MM-DD date key for Monday of the week containing `date`
 * in the given timezone. Uses noon-UTC anchoring for DST safety.
 */
export function getWeekStart(timezone: string, date: Date = new Date()): string {
    const todayKey = getDateKey(timezone, date);
    const [y, m, d] = todayKey.split('-').map(Number);
    // daysFromMonday: how many days back is Monday?
    // Sun=0→6, Mon=1→0, Tue=2→1, ..., Sat=6→5
    const todayWday = getWeekdayIndex(timezone, date);
    const daysFromMonday = (todayWday + 6) % 7;
    // Noon UTC on that calendar date → format in user timezone
    return getDateKey(timezone, new Date(Date.UTC(y, m - 1, d - daysFromMonday, 12)));
}

// ── Same-local-day check ───────────────────────────────────────────────────

/**
 * Returns true if dateA and dateB fall on the same calendar day in the given timezone.
 */
export function isSameLocalDay(dateA: Date, dateB: Date, timezone: string): boolean {
    return getDateKey(timezone, dateA) === getDateKey(timezone, dateB);
}

// ── Relative date keys ─────────────────────────────────────────────────────

/**
 * Returns YYYY-MM-DD for yesterday in the given timezone.
 * Uses noon-UTC anchoring (subtracts one calendar day from today's date key).
 */
export function getYesterdayKey(timezone: string): string {
    const [y, m, d] = getDateKey(timezone).split('-').map(Number);
    return getDateKey(timezone, new Date(Date.UTC(y, m - 1, d - 1, 12)));
}

/**
 * Returns the last `n` YYYY-MM-DD date keys, oldest-first, in the given timezone.
 * Today is always the last element. Uses noon-UTC anchoring.
 */
export function getLastNDayKeys(timezone: string, n: number = 7): string[] {
    const [y, m, d] = getDateKey(timezone).split('-').map(Number);
    return Array.from({ length: n }, (_, i) =>
        getDateKey(timezone, new Date(Date.UTC(y, m - 1, d - (n - 1 - i), 12)))
    );
}

// ── Week date array ────────────────────────────────────────────────────────

/**
 * Returns 7 YYYY-MM-DD keys for the week at `offset` from the current week,
 * in Monday–Sunday order. offset=0 = this week, offset=-1 = last week, etc.
 *
 * Uses noon-UTC anchoring so that DST transitions and cross-midnight timezone
 * offsets never produce duplicate or skipped date keys.
 */
export function buildWeekDates(timezone: string, offset: number = 0): string[] {
    const todayKey = getDateKey(timezone);
    const [y, m, d] = todayKey.split('-').map(Number);

    const todayWday = getWeekdayIndex(timezone);
    // Days back to Monday (Sun=0→6, Mon=1→0, Tue=2→1, … Sat=6→5)
    const daysFromMonday = (todayWday + 6) % 7;

    return Array.from({ length: 7 }, (_, i) => {
        const dayOffset = i - daysFromMonday + offset * 7;
        return getDateKey(timezone, new Date(Date.UTC(y, m - 1, d + dayOffset, 12)));
    });
}

// ── Midnight timer ─────────────────────────────────────────────────────────

/**
 * Returns milliseconds from NOW until the next local midnight in the given
 * timezone, plus an optional buffer. Uses the local time components so that
 * DST shifts (23/25-hour days) are handled correctly.
 */
export function msUntilMidnight(timezone: string, bufferMs: number = 0): number {
    const now = new Date();
    const parts = formatParts(timezone, now, {
        hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false,
    });
    const h = intlPart(parts, 'hour') % 24;
    const min = intlPart(parts, 'minute');
    const sec = intlPart(parts, 'second');
    const elapsedSeconds = h * 3600 + min * 60 + sec;
    const remainingSeconds = 86400 - elapsedSeconds;
    return Math.max(0, remainingSeconds * 1000 + bufferMs);
}

// ── Time-of-day slot ───────────────────────────────────────────────────────

/**
 * Returns "HH:MM" in 24-hour format for the given timezone.
 */
export function getTimeSlot(timezone: string, date: Date = new Date()): string {
    const parts = formatParts(timezone, date, {
        hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const h = intlPart(parts, 'hour') % 24;
    const min = intlPart(parts, 'minute');
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

// ── Debug logging ──────────────────────────────────────────────────────────

/**
 * Emits a structured [Streak] debug log with all key date values.
 * Call this at the start of any streak or challenge operation.
 */
export function logStreakDebug(params: {
    timezone: string;
    label?: string;
    activityFound?: boolean;
    challengeCompleted?: boolean;
}): void {
    const { timezone, label = 'debug', activityFound, challengeCompleted } = params;
    const now = new Date();
    const localDateKey = getDateKey(timezone);
    const weekday = getWeekdayIndex(timezone);  // 0=Sun … 6=Sat
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const todayIndex = weekday; // alias for clarity

    console.log(
        `[Streak] ${label}\n` +
        `  timezone:          ${timezone}\n` +
        `  localDateKey:      ${localDateKey}\n` +
        `  weekday:           ${DAY_NAMES[weekday]} (index ${weekday})\n` +
        `  todayIndex:        ${todayIndex}\n` +
        (activityFound !== undefined  ? `  activityFound:     ${activityFound}\n`  : '') +
        (challengeCompleted !== undefined ? `  challengeCompleted: ${challengeCompleted}\n` : '') +
        `  utcNow:            ${now.toISOString()}`
    );
}
