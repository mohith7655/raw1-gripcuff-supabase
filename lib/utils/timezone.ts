/**
 * Lightweight timezone resolver.
 *
 * Priority:
 *  1. Current device timezone  (Intl — always reflects the user's actual clock)
 *  2. Stored user.timezone     (last resort — may be stale)
 *  3. 'UTC'                    (hard fallback)
 *
 * Use this instead of accessing user.timezone directly.
 * TimezoneService (async) handles workout-location lat/lng resolution;
 * this utility is the synchronous equivalent for components and quick checks.
 */
export function getResolvedTimezone(user?: { timezone?: string }): string {
    const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (device) return device;
    if (user?.timezone) return user.timezone;
    return 'UTC';
}
