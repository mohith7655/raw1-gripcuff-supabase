/**
 * WatchTrackingService
 *
 * Production-grade, per-second watch analytics.
 *
 * Design:
 * - All counters live in module-level variables (no React state).
 * - 1-second tick increments pendingSeconds ONLY while isWatching === true.
 * - Every 15 seconds a batch flush writes to Supabase via atomic RPC.
 * - Visibility/AppState events pause the tick and flush immediately.
 * - Safe for concurrent calls — guarded by isWatching and flushInFlight flags.
 */

import { Platform, AppState, AppStateStatus } from 'react-native';
import { supabase } from '../core/config/supabase';

const TICK_MS   = 1_000;   // increment local counter every 1 second
const FLUSH_MS  = 15_000;  // write to Supabase every 15 seconds

// ── Module-level state (singleton) ───────────────────────────────────────────

let _userId: string | null = null;
let _pendingSeconds = 0;
let _isWatching = false;
let _flushInFlight = false;
let _sessionCountedForCurrentSession = false;

let _tickId: ReturnType<typeof setInterval> | null = null;
let _flushId: ReturnType<typeof setInterval> | null = null;
let _appStateSub: any = null;
let _visibilityHandler: (() => void) | null = null;
let _listenersAttached = false;

// ── Internal helpers ─────────────────────────────────────────────────────────

function _tick() {
    if (!_isWatching) return;
    _pendingSeconds += 1;
    // Verbose tick logging commented out by default — uncomment to debug:
    // console.log(`[Watch] +1s — pending: ${_pendingSeconds}s`);
}

async function _flush(isNewSession = false) {
    if (!_userId || _pendingSeconds <= 0) return;
    if (_flushInFlight) return; // don't stack calls

    _flushInFlight = true;
    const uid = _userId;
    const seconds = _pendingSeconds;
    const newSession = isNewSession && !_sessionCountedForCurrentSession;
    _pendingSeconds = 0;

    console.log(`[Watch] flushing ${seconds}s${newSession ? ' (new session)' : ''}`);

    try {
        const { error } = await supabase.rpc('increment_watch_time', {
            p_user_id:     uid,
            p_seconds:     seconds,
            p_new_session: newSession,
        });

        if (error) {
            // Restore the seconds — don't lose data
            _pendingSeconds += seconds;
            console.warn('[Watch] flush failed — restored pending:', error.message);
        } else {
            if (newSession) _sessionCountedForCurrentSession = true;
            console.log(`[Watch] flushed ${seconds}s OK`);
        }
    } catch (e: any) {
        _pendingSeconds += seconds;
        console.warn('[Watch] flush exception — restored pending:', e?.message);
    } finally {
        _flushInFlight = false;
    }
}

function _startTick() {
    if (_tickId !== null) return;
    _tickId = setInterval(_tick, TICK_MS);
}

function _stopTick() {
    if (_tickId !== null) {
        clearInterval(_tickId);
        _tickId = null;
    }
}

function _startFlushLoop() {
    if (_flushId !== null) return;
    _flushId = setInterval(() => { _flush(); }, FLUSH_MS);
}

function _stopFlushLoop() {
    if (_flushId !== null) {
        clearInterval(_flushId);
        _flushId = null;
    }
}

function _handleAppState(nextState: AppStateStatus) {
    if (nextState === 'active') {
        if (_isWatching) {
            _startTick();
            console.log('[Watch] app foregrounded — tick resumed');
        }
    } else {
        _stopTick();
        _flush();
        console.log('[Watch] app backgrounded — paused + flushed');
    }
}

function _handleVisibility() {
    if (typeof document === 'undefined') return;
    if (document.hidden) {
        _stopTick();
        _flush();
        console.log('[Watch] tab hidden — paused + flushed');
    } else {
        if (_isWatching) {
            _startTick();
            console.log('[Watch] tab visible — tick resumed');
        }
    }
}

function _attachListeners() {
    if (_listenersAttached) return;
    _listenersAttached = true;

    if (Platform.OS === 'web') {
        if (typeof document !== 'undefined') {
            _visibilityHandler = _handleVisibility;
            document.addEventListener('visibilitychange', _visibilityHandler);
        }
    } else {
        _appStateSub = AppState.addEventListener('change', _handleAppState);
    }
}

// ── Public API ────────────────────────────────────────────────────────────────

export const WatchTrackingService = {
    /**
     * Call when the video starts playing.
     * Safe to call repeatedly — idempotent while the same user is watching.
     */
    startSession(uid: string): void {
        _attachListeners();

        // If user changed, flush any pending seconds for the previous user first
        if (_userId && _userId !== uid && _pendingSeconds > 0) {
            _flush();
        }

        if (_userId !== uid) {
            _userId = uid;
            _pendingSeconds = 0;
            _sessionCountedForCurrentSession = false;
        }

        if (_isWatching) return;
        _isWatching = true;

        _startTick();
        _startFlushLoop();

        // Flush now to record the session start (increments total_watch_sessions once)
        _flush(true);

        console.log('[Watch] started');
    },

    /**
     * Call when the video pauses, buffers, or loses focus.
     * Does NOT flush — call flushNow() separately if you need immediate persistence.
     */
    stopSession(): void {
        if (!_isWatching) return;
        _isWatching = false;
        _stopTick();
        // Keep the flush loop running so any residual pending seconds get written
        console.log('[Watch] stopped');
    },

    /**
     * Call on screen unmount or navigation blur to persist any remaining seconds.
     */
    async flushNow(): Promise<void> {
        _stopTick();
        await _flush();
    },

    /**
     * Full teardown — call when the user logs out or the app is destroyed.
     */
    async teardown(): Promise<void> {
        _isWatching = false;
        _stopTick();
        _stopFlushLoop();
        await _flush();

        if (Platform.OS === 'web') {
            if (_visibilityHandler && typeof document !== 'undefined') {
                document.removeEventListener('visibilitychange', _visibilityHandler);
                _visibilityHandler = null;
            }
        } else {
            _appStateSub?.remove();
            _appStateSub = null;
        }
        _listenersAttached = false;
        _userId = null;
        _pendingSeconds = 0;
        _sessionCountedForCurrentSession = false;
        console.log('[Watch] torn down');
    },

    /** Format seconds into a human-readable string. */
    formatWatchTime(totalSeconds: number): string {
        if (totalSeconds < 60) return `${totalSeconds}s`;
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m ${s}s`;
    },
};
