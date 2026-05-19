/**
 * Single source of truth for the user's IANA timezone.
 *
 * Resolution priority (first match wins):
 *  1. Active workout location  → lat/lng → tz-lookup  (offline, instant)
 *  2. Current device timezone  (always reflects where the user actually is)
 *  3. Stored users/{uid}.timezone in Firestore  (last resort — may be stale)
 *
 * tz-lookup bundles a full timezone polygon dataset — no network call required.
 *
 * NOTE: Stored Firestore timezone is intentionally ranked BELOW device timezone.
 * A stale stored value (e.g. "America/Chicago" for a Spain user) causes wrong
 * date keys, broken streaks, and missed circle highlights. The device clock is
 * authoritative; Firestore storage is just a cache for offline/web scenarios.
 */

import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../core/config/firebase';
import tzLookup from 'tz-lookup';

// ── Session-scoped in-memory cache ──────────────────────────────────────────
// Keyed by uid. Invalidated via invalidateCache(uid) whenever workoutLocation changes.
const _cache = new Map<string, string>();

// ── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Offline lat/lng → IANA timezone string.
 * Returns null if coordinates are invalid or tz-lookup throws.
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
 * Pure function — derives IANA timezone from a Firestore user data object.
 *
 * Priority:
 *  1. Active workout location lat/lng  → tz-lookup
 *  2. Device timezone  (authoritative — reflects where the user physically is)
 *  3. Stored Firestore timezone  (last resort — may be stale)
 */
export function getActiveWorkoutTimezone(userData: Record<string, any>): string {
    const selectedKey = userData?.workoutLocation as string | null ?? null;
    const locations: Record<string, any> = userData?.locations ?? {};

    // 1a. Try the selected workout location first
    const activeLoc = selectedKey ? locations[selectedKey] : null;
    if (activeLoc?.lat != null && activeLoc?.lng != null) {
        const tz = getTimezoneFromLocation(Number(activeLoc.lat), Number(activeLoc.lng));
        if (tz) {
            console.log(
                '[Timezone] source=workout_location',
                'key=' + selectedKey,
                'resolved=' + tz,
                'lat=' + activeLoc.lat, 'lng=' + activeLoc.lng,
            );
            return tz;
        }
    }

    // 1b. Try any other configured location
    const anyLoc = Object.entries(locations).find(([, v]) => v?.lat != null && v?.lng != null);
    if (anyLoc) {
        const [spotKey, loc] = anyLoc;
        const tz = getTimezoneFromLocation(Number(loc.lat), Number(loc.lng));
        if (tz) {
            console.log(
                '[Timezone] source=fallback_location',
                'key=' + spotKey,
                'resolved=' + tz,
                'lat=' + loc.lat, 'lng=' + loc.lng,
            );
            return tz;
        }
    }

    // 1c. Legacy single location field
    const legacy = userData?.location;
    if (legacy?.lat != null && legacy?.lng != null) {
        const tz = getTimezoneFromLocation(Number(legacy.lat), Number(legacy.lng));
        if (tz) {
            console.log('[Timezone] source=legacy_location resolved=' + tz);
            return tz;
        }
    }

    // 2. Device timezone — always reflects the user's current locale/clock.
    //    This intentionally outranks the stored Firestore field, which can be stale
    //    (e.g. "America/Chicago" persisted for a user who has moved to Spain).
    const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (device) {
        const stored = typeof userData?.timezone === 'string' ? userData.timezone : null;
        if (stored && stored !== device) {
            console.log('[Timezone] stored=' + stored + ' device=' + device + ' → using device (stored is stale)');
        } else {
            console.log('[Timezone] source=device resolved=' + device);
        }
        return device;
    }

    // 3. Last resort: stored Firestore timezone
    if (typeof userData?.timezone === 'string' && userData.timezone) {
        console.log('[Timezone] source=firestore_stored resolved=' + userData.timezone + ' (device tz unavailable)');
        return userData.timezone;
    }

    console.warn('[Timezone] all sources failed — falling back to UTC');
    return 'UTC';
}

// ── Async service ─────────────────────────────────────────────────────────────

export const TimezoneService = {
    /**
     * Get the effective IANA timezone for a user.
     * Reads user doc from Firestore, applies getActiveWorkoutTimezone(), then caches.
     * The active workout location's lat/lng ALWAYS wins over any stored timezone value.
     */
    async getForUser(uid: string): Promise<string> {
        if (_cache.has(uid)) return _cache.get(uid)!;

        try {
            const snap = await getDoc(doc(db, 'users', uid));
            const data = snap.data() ?? {};
            const tz = getActiveWorkoutTimezone(data);

            _cache.set(uid, tz);

            // Persist correct timezone back to Firestore whenever it differs from what's stored.
            // This self-heals stale values (e.g. "America/Chicago" for a Spain device).
            if (tz !== data.timezone) {
                console.log('[Timezone] auto-correcting Firestore: ' + (data.timezone ?? '(none)') + ' → ' + tz);
                updateDoc(doc(db, 'users', uid), { timezone: tz }).catch(() => {});
            }

            return tz;
        } catch (e) {
            console.warn('[Timezone] getForUser failed, using device TZ:', e);
            const fallback = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
            _cache.set(uid, fallback);
            return fallback;
        }
    },

    /**
     * Force re-resolve: clears cache and re-reads from Firestore.
     * Call this whenever workoutLocation or location data changes.
     */
    async resolveAndSave(uid: string): Promise<string> {
        _cache.delete(uid);
        return TimezoneService.getForUser(uid);
    },

    /** Invalidate in-memory cache so the next getForUser re-reads from Firestore. */
    invalidateCache(uid: string): void {
        _cache.delete(uid);
        console.log('[Timezone] cache invalidated for', uid);
    },
};
