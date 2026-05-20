/**
 * WatchTrackingService — production-grade per-second watch analytics.
 *
 * Design:
 * - All counters in module-level vars — zero React state, zero rerenders.
 * - 1s tick increments pendingSeconds ONLY while _isWatching === true.
 * - Every 15s a batch flush writes to Supabase via the atomic RPC
 *   `increment_watch_time(p_user_id, p_seconds, p_new_session)`.
 * - Visibility changes use a 15s delayed pause — mobile browsers (Android Chrome/Edge)
 *   fire document.hidden for transient UI interactions (address bar, swipe, overlays).
 *   Pausing immediately would kill tracking after 1–2 real seconds.
 * - AppState (native) pauses immediately — native backgrounding is authoritative.
 * - Flush is guarded by _flushInFlight so calls never stack.
 * - Seconds are restored on flush failure — data is never lost.
 *
 * Public API:
 *   startSession(uid)     — first play of a new video/session; increments total_watch_sessions
 *   pauseWatchSession()   — video paused or buffering; stops the 1s tick, keeps flush loop
 *   resumeWatchSession()  — user unpauses within the same session; restarts the tick
 *   stopSession()         — permanent stop (screen unmount / navigation away)
 *   flushNow()            — immediately persist any pending seconds
 *   teardown()            — full cleanup (logout)
 *   formatWatchTime(s)    — human-readable duration
 */

import { Platform, AppState, AppStateStatus } from 'react-native';
import { supabase } from '../core/config/supabase';

const TICK_MS  = 1_000;   // local increment interval
const FLUSH_MS = 15_000;  // Supabase write interval

// ── Module-level singleton state ──────────────────────────────────────────────

let _userId: string | null = null;
let _pendingSeconds = 0;
let _isWatching = false;
let _flushInFlight = false;
let _sessionCountedForCurrentSession = false;

let _tickId:  ReturnType<typeof setInterval> | null = null;
let _flushId: ReturnType<typeof setInterval> | null = null;
// Delayed-pause timer for web visibility changes (mobile browsers fire hidden spuriously).
// 15s grace window: if the tab becomes visible again within 15s, the pause is cancelled.
let _hiddenTimeoutId: ReturnType<typeof setTimeout> | null = null;
let _appStateSub: any = null;
let _visibilityHandler: (() => void) | null = null;
let _listenersAttached = false;
let _onFlush: ((flushedSeconds: number) => void) | null = null;

// ── Internal helpers ──────────────────────────────────────────────────────────

function _tick() {
    if (!_isWatching) return;
    _pendingSeconds += 1;
}

async function _flush(isNewSession = false) {
    if (!_userId || _pendingSeconds <= 0) return;
    if (_flushInFlight) return;

    _flushInFlight = true;
    const uid = _userId;
    const seconds = _pendingSeconds;
    const countSession = isNewSession && !_sessionCountedForCurrentSession;
    _pendingSeconds = 0;

    console.log(`[WatchTracking] flushing ${seconds}s${countSession ? ' (new session)' : ''}`);

    try {
        const { error } = await supabase.rpc('increment_watch_time', {
            p_user_id:     uid,
            p_seconds:     seconds,
            p_new_session: countSession,
        });
        if (error) {
            _pendingSeconds += seconds; // restore — don't lose data
            console.warn('[WatchTracking] flush failed — restored pending:', error.message);
        } else {
            if (countSession) _sessionCountedForCurrentSession = true;
            console.log(`[WatchTracking] flushed ${seconds}s OK`);
            _onFlush?.(seconds); // optimistic UI patch
        }
    } catch (e: any) {
        _pendingSeconds += seconds;
        console.warn('[WatchTracking] flush exception — restored pending:', e?.message);
    } finally {
        _flushInFlight = false;
    }
}

function _startTick() {
    if (_tickId !== null) return;
    _tickId = setInterval(_tick, TICK_MS);
}

function _stopTick() {
    if (_tickId !== null) { clearInterval(_tickId); _tickId = null; }
}

function _startFlushLoop() {
    if (_flushId !== null) return;
    _flushId = setInterval(() => { _flush(); }, FLUSH_MS);
}

function _stopFlushLoop() {
    if (_flushId !== null) { clearInterval(_flushId); _flushId = null; }
}

function _handleAppState(nextState: AppStateStatus) {
    if (nextState === 'active') {
        if (_isWatching) { _startTick(); console.log('[WatchTracking] foregrounded — tick resumed'); }
    } else {
        _stopTick();
        _flush();
        console.log('[WatchTracking] backgrounded — paused + flushed');
    }
}

function _cancelHiddenTimeout() {
    if (_hiddenTimeoutId !== null) {
        clearTimeout(_hiddenTimeoutId);
        _hiddenTimeoutId = null;
        console.log('[WatchTracking] hidden timer cancelled');
    }
}

function _handleVisibility() {
    if (typeof document === 'undefined') return;
    if (document.hidden) {
        // Mobile browsers (Android Chrome/Edge) fire visibilitychange for transient
        // events: address bar, swipe gestures, permission dialogs, Agora overlays.
        // Wait 15s before actually pausing — if the tab comes back, cancel the pause.
        if (_hiddenTimeoutId !== null) return; // timer already running
        console.log('[WatchTracking] hidden timer started');
        _hiddenTimeoutId = setTimeout(() => {
            _hiddenTimeoutId = null;
            _stopTick();
            _flush();
            console.log('[WatchTracking] delayed hidden pause');
        }, 15_000);
    } else {
        // Tab is visible again — cancel any pending pause and resume the tick.
        _cancelHiddenTimeout();
        if (_isWatching) {
            _startTick();
            console.log('[WatchTracking] visibility restored');
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
     * Call on first play of a new video/session.
     * Increments total_watch_sessions exactly once per session.
     * Safe to call repeatedly — idempotent for the same uid.
     */
    startSession(uid: string): void {
        _attachListeners();

        if (_userId && _userId !== uid && _pendingSeconds > 0) {
            _flush(); // flush previous user's data before switching
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
        _flush(true); // record session start immediately (p_new_session = true)
        console.log('[WatchTracking] started');
    },

    /**
     * Call when video pauses or enters buffering.
     * Stops the 1s tick but keeps the flush loop running.
     * Session state is preserved — call resumeWatchSession() to continue.
     */
    pauseWatchSession(): void {
        if (!_isWatching) return;
        _isWatching = false;
        _stopTick();
        console.log('[WatchTracking] paused');
    },

    /**
     * Call when video resumes playing within the same session.
     * Does NOT increment total_watch_sessions.
     */
    resumeWatchSession(): void {
        if (_isWatching || !_userId) return;
        _isWatching = true;
        _startTick();
        if (_flushId === null) _startFlushLoop();
        console.log('[WatchTracking] resumed');
    },

    /**
     * Call on permanent stop: screen unmount or navigation away.
     * Stops tick + flush loop but does NOT flush — call flushNow() after.
     */
    stopSession(): void {
        _isWatching = false;
        _stopTick();
        _stopFlushLoop();
        _cancelHiddenTimeout();
        _sessionCountedForCurrentSession = false;
        console.log('[WatchTracking] stopped');
    },

    /**
     * Immediately persist any pending seconds to Supabase.
     * Safe to call at any time — no-op if nothing is pending.
     */
    async flushNow(): Promise<void> {
        _stopTick();
        await _flush();
    },

    /**
     * Full teardown: logout or app destroy.
     */
    async teardown(): Promise<void> {
        _isWatching = false;
        _stopTick();
        _stopFlushLoop();
        _cancelHiddenTimeout();
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
        console.log('[WatchTracking] torn down');
    },

    /**
     * Register a callback invoked after every successful flush.
     * UserContext uses this for optimistic UI updates.
     * Pass null to unregister.
     */
    setOnFlush(fn: ((flushedSeconds: number) => void) | null): void {
        _onFlush = fn;
    },

    /** Human-readable duration: 65s → "1m 5s", 3661s → "1h 1m" */
    formatWatchTime(totalSeconds: number): string {
        if (totalSeconds < 60) return `${totalSeconds}s`;
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m ${s}s`;
    },
};
