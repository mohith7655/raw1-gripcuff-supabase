/**
 * Single source of truth for the user's IANA timezone.
 *
 * Resolution priority (first match wins):
 *  1. Active workout location  → lat/lng → tz-lookup  (offline, instant)
 *  2. Current device timezone  (always reflects where the user actually is)
 *  3. Last resort: UTC
 */

import tzLookup from 'tz-lookup';

// ── Session-scoped in-memory cache ──────────────────────────────────────────
const _cache = new Map<string, string>();

// ── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Offline lat/lng → IANA timezone string.
 */
export function getTimezoneFromLocation(lat: number, lng: number): string | null {
    try {
        const tz = tzLookup(lat, lng) as string;
        if (tz && typeof tz === 'string') return tz;
        return null;
    } catch {
        return null;
    }
}

/**
 * Pure function — derives IANA timezone for a user.
 * Locations are stored as address strings without lat/lng, so device timezone is used.
 */
export function getActiveWorkoutTimezone(userData: Record<string, any>): string {
    const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (device) return device;

    if (typeof userData?.timezone === 'string' && userData.timezone) {
        return userData.timezone;
    }

    return 'UTC';
}

// ── Async service ─────────────────────────────────────────────────────────────

export const TimezoneService = {
    /**
     * Get the effective IANA timezone for a user.
     * Uses device timezone as the primary source.
     */
    async getForUser(uid: string): Promise<string> {
        if (_cache.has(uid)) return _cache.get(uid)!;

        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        _cache.set(uid, tz);
        return tz;
    },

    /**
     * Force re-resolve: clears cache and re-reads.
     */
    async resolveAndSave(uid: string): Promise<string> {
        _cache.delete(uid);
        return TimezoneService.getForUser(uid);
    },

    /** Invalidate in-memory cache. */
    invalidateCache(uid: string): void {
        _cache.delete(uid);
    },
};
