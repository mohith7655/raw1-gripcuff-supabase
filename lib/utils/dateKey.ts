/**
 * Single source of truth for local-timezone date keys (YYYY-MM-DD).
 * NEVER uses UTC methods — always uses device local time so that midnight
 * rolls over correctly regardless of the user's timezone.
 */

export function getLocalDateKey(date?: Date): string {
    const d = date ?? new Date();
    return (
        d.getFullYear() +
        '-' +
        String(d.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(d.getDate()).padStart(2, '0')
    );
}

export function getLocalYesterdayKey(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return getLocalDateKey(d);
}

export function getLocalLast7DayKeys(): string[] {
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(getLocalDateKey(d));
    }
    return days;
}

/** Milliseconds from now until the next local midnight (+ optional buffer ms). */
export function msUntilLocalMidnight(bufferMs = 0): number {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    return Math.max(0, midnight.getTime() - now.getTime() + bufferMs);
}

export function debugDateInfo(): void {
    const now = new Date();
    const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const localKey = getLocalDateKey();
    const utcKey = now.toISOString().split('T')[0];
    console.log('[DateKey] device timezone:', deviceTz);
    console.log('[DateKey] device date key:', localKey);
    console.log('[DateKey] UTC date key:', utcKey);
    console.log('[DateKey] device local time:', now.toLocaleTimeString());
    if (localKey !== utcKey) {
        console.warn('[DateKey] ⚠️  device date differs from UTC — midnight rollover zone');
    }
}
