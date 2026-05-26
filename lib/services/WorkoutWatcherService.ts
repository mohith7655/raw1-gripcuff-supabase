/**
 * WorkoutWatcherService
 *
 * Tracks live presence for a workout video using Supabase Realtime Presence.
 * Each watcher joins the channel `workout_presence_${videoId}` and broadcasts
 * their profile state. The channel automatically removes watchers when their
 * connection drops (no manual heartbeat needed for cleanup).
 *
 * Architecture
 * ─────────────
 * • subscribe()  — creates the Presence channel, wires onChange, returns unsub fn
 * • join()       — calls channel.track() to register the user's presence
 * • heartbeat()  — refreshes lastActive in tracked state (no-op if not subscribed)
 * • leave()      — calls channel.untrack() to remove presence immediately
 * • purgeStale() — no-op: Supabase handles disconnect cleanup automatically
 *
 * The channel registry (module-level Map) ensures a single channel instance per
 * videoId even when join() is called before the subscription is fully established
 * (tracks are queued and flushed once SUBSCRIBED fires).
 */

import { supabase } from '../core/config/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─── Types ─────────────────────────────────────────────────────────────────

const DISPLAY_STALE_MS = 60_000;

export interface WatcherDoc {
    userId: string;
    displayName: string;
    username: string;
    profilePhoto: string | null;
    gender: string | null;
    age: number | null;
    joinedAt: Date | null;
    lastActive: Date | null;
    lastSeen?: Date | null;
}

export interface ActiveWatcher extends WatcherDoc {
    uid: string;
}

export interface JoinProfile {
    displayName: string;
    username?: string | null;
    profilePhoto?: string | null;
    gender?: string | null;
    age?: number | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mostRecentActivityMs(data: WatcherDoc): number {
    const lastActiveMs = data.lastActive instanceof Date ? data.lastActive.getTime() : 0;
    const lastSeenMs   = data.lastSeen   instanceof Date ? data.lastSeen.getTime()   : 0;
    return Math.max(lastActiveMs, lastSeenMs);
}

export function isViewerActive(data: WatcherDoc): boolean {
    const ms = mostRecentActivityMs(data);
    if (ms === 0) return true;
    return Date.now() - ms <= DISPLAY_STALE_MS;
}

// ─── Channel registry ────────────────────────────────────────────────────────

type ChannelEntry = {
    channel: RealtimeChannel;
    subscribeStatus: 'pending' | 'subscribed' | 'error';
    /** Queued track payload — flushed once SUBSCRIBED fires. */
    pendingTrack: null | Record<string, unknown>;
    /** Most-recently tracked state for heartbeat refreshes. */
    userState: null | Record<string, unknown>;
};

const channelRegistry = new Map<string, ChannelEntry>();

// ─── Service ──────────────────────────────────────────────────────────────────

export class WorkoutWatcherService {

    // ── Subscribe ─────────────────────────────────────────────────────────────
    // Creates (or replaces) a Supabase Realtime Presence channel for `videoId`.
    // Calls `onChange` whenever the watcher list changes.
    // Returns an unsubscribe / cleanup function.

    static subscribe(
        videoId: string,
        onChange: (watchers: ActiveWatcher[]) => void,
        onError?: (err: Error) => void,
    ): () => void {
        const key = `workout_presence_${videoId}`;

        // Tear down any stale channel first
        const existing = channelRegistry.get(key);
        if (existing) {
            existing.channel.untrack().catch(() => {});
            supabase.removeChannel(existing.channel);
            channelRegistry.delete(key);
        }

        const channel = supabase.channel(key, {
            config: { presence: { key } },
        });

        const entry: ChannelEntry = {
            channel,
            subscribeStatus: 'pending',
            pendingTrack: null,
            userState: null,
        };
        channelRegistry.set(key, entry);

        // Helper: snapshot current presenceState → ActiveWatcher[]
        const toWatchers = (): ActiveWatcher[] => {
            const state = channel.presenceState<Record<string, unknown>>();
            const seen = new Set<string>();
            const list: ActiveWatcher[] = [];
            for (const presences of Object.values(state)) {
                for (const p of presences as any[]) {
                    const uid: string = p.uid ?? '';
                    if (!uid || seen.has(uid)) continue;
                    seen.add(uid);
                    list.push({
                        uid,
                        userId: uid,
                        displayName: p.displayName || p.username || 'Viewer',
                        username:    p.username    || p.displayName || 'viewer',
                        profilePhoto: p.profilePhoto ?? null,
                        gender:       p.gender       ?? null,
                        age:          p.age          ?? null,
                        joinedAt:   p.joinedAt   ? new Date(p.joinedAt)   : null,
                        lastActive: p.lastActive ? new Date(p.lastActive) : null,
                    });
                }
            }
            return list;
        };

        channel
            .on('presence', { event: 'sync' },  () => onChange(toWatchers()))
            .on('presence', { event: 'join' },  () => onChange(toWatchers()))
            .on('presence', { event: 'leave' }, () => onChange(toWatchers()))
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    entry.subscribeStatus = 'subscribed';
                    // Emit initial state (may be empty)
                    onChange(toWatchers());
                    // Flush any track that arrived before the channel was ready
                    if (entry.pendingTrack) {
                        const payload = entry.pendingTrack;
                        entry.pendingTrack = null;
                        channel.track(payload).catch(e =>
                            console.warn('[WorkoutWatcherService] flush pendingTrack failed:', e),
                        );
                    }
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    entry.subscribeStatus = 'error';
                    onError?.(err instanceof Error ? err : new Error(`Presence channel ${status}`));
                }
            });

        return () => {
            const e = channelRegistry.get(key);
            if (e) {
                e.channel.untrack().catch(() => {});
                supabase.removeChannel(e.channel);
                channelRegistry.delete(key);
            }
            onChange([]); // clear viewer list on cleanup
        };
    }

    // ── Join ──────────────────────────────────────────────────────────────────
    // Tracks the current user's presence in the channel.
    // If the channel is not yet SUBSCRIBED, queues the track for later.

    static async join(videoId: string, uid: string, profile: JoinProfile): Promise<void> {
        const key = `workout_presence_${videoId}`;
        const entry = channelRegistry.get(key);
        if (!entry) {
            console.warn('[WorkoutWatcherService] join called before subscribe for', videoId);
            return;
        }

        const state: Record<string, unknown> = {
            uid,
            displayName:  profile.displayName,
            username:     profile.username ?? profile.displayName,
            profilePhoto: profile.profilePhoto ?? null,
            gender:       profile.gender  ?? null,
            age:          profile.age     ?? null,
            joinedAt:   new Date().toISOString(),
            lastActive: new Date().toISOString(),
        };

        entry.userState = state;

        if (entry.subscribeStatus === 'subscribed') {
            await entry.channel.track(state);
        } else {
            entry.pendingTrack = state; // will be flushed in subscribe callback
        }

        console.log('[WorkoutWatcherService] joined presence', { videoId, uid });
    }

    // ── Heartbeat ─────────────────────────────────────────────────────────────
    // Refreshes lastActive so stale-viewer filtering stays accurate.
    // Supabase maintains the WebSocket connection; this just updates state.

    static async heartbeat(videoId: string, uid: string): Promise<void> {
        const key = `workout_presence_${videoId}`;
        const entry = channelRegistry.get(key);
        if (!entry || entry.subscribeStatus !== 'subscribed') return;

        const state: Record<string, unknown> = {
            ...(entry.userState ?? {}),
            uid,
            lastActive: new Date().toISOString(),
        };
        entry.userState = state;

        await entry.channel.track(state).catch(e =>
            console.warn('[WorkoutWatcherService] heartbeat track failed:', e),
        );
    }

    // ── Leave ─────────────────────────────────────────────────────────────────
    // Explicitly removes the current user's presence without tearing down the
    // listener (other watchers' presence is still tracked after this call).

    static async leave(videoId: string, uid: string): Promise<void> {
        const key = `workout_presence_${videoId}`;
        const entry = channelRegistry.get(key);
        if (!entry) return;

        await entry.channel.untrack().catch(() => {});
        entry.userState = null;
        console.log('[WorkoutWatcherService] left presence', { videoId, uid });
    }

    // ── Purge stale viewers ───────────────────────────────────────────────────
    // Supabase Realtime handles cleanup automatically on connection drop.

    static async purgeStaleViewers(_videoId: string): Promise<void> {
        // no-op — handled by Supabase WebSocket lifecycle
    }
}
