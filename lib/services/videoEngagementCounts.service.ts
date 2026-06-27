import { useEffect, useState } from 'react';
import { supabase } from '../core/config/supabase';

/**
 * Global "how many people" counts per video, shared by all users:
 *   • tries     — users who marked "Try it" on the video
 *   • favorites — users who favorited the video
 *
 * Backed by public.video_tries / public.video_favorites membership tables and the
 * video_engagement_counts(ids[]) RPC (see migration 20260628_video_engagement.sql).
 * Counts are batched (50ms window) and cached, mirroring videoViews.service.
 */
export interface EngagementCounts { tries: number; favorites: number; }

const cache = new Map<string, EngagementCounts>();
const listeners = new Map<string, Set<() => void>>();
let pending = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/** Compact label: 932, 1.2K, 3.4M. */
export function formatEngagement(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 >= 100_000 ? 1 : 0)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 >= 100 ? 1 : 0)}K`;
    return String(n);
}

function notify(videoId: string) {
    listeners.get(videoId)?.forEach((cb) => cb());
}

function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(flush, 50);
}

async function flush() {
    flushTimer = null;
    const ids = Array.from(pending);
    pending = new Set();
    if (ids.length === 0) return;

    const { data, error } = await supabase.rpc('video_engagement_counts', { p_ids: ids });
    if (error) return;

    const seen = new Set<string>();
    for (const row of (data ?? []) as any[]) {
        cache.set(row.video_id, {
            tries: Number(row.try_count) || 0,
            favorites: Number(row.favorite_count) || 0,
        });
        seen.add(row.video_id);
    }
    for (const id of ids) if (!seen.has(id) && !cache.has(id)) cache.set(id, { tries: 0, favorites: 0 });
    ids.forEach(notify);
}

/** Subscribe a component to the engagement counts for one video. */
export function useVideoEngagementCounts(videoId: string | null | undefined): EngagementCounts | null {
    const [, force] = useState(0);

    useEffect(() => {
        if (!videoId) return;
        const cb = () => force((n) => n + 1);
        let set = listeners.get(videoId);
        if (!set) { set = new Set(); listeners.set(videoId, set); }
        set.add(cb);

        if (!cache.has(videoId)) {
            pending.add(videoId);
            scheduleFlush();
        }

        return () => {
            set!.delete(cb);
            if (set!.size === 0) listeners.delete(videoId);
        };
    }, [videoId]);

    return videoId ? cache.get(videoId) ?? null : null;
}

// Optimistically nudge a cached count after the current user toggles.
function bump(videoId: string, key: keyof EngagementCounts, delta: number) {
    const cur = cache.get(videoId);
    if (!cur) return;
    cache.set(videoId, { ...cur, [key]: Math.max(0, cur[key] + delta) });
    notify(videoId);
}

/** Persist the current user's favorite membership and adjust the shared count. */
export async function setVideoFavorite(uid: string | null, videoId: string | null | undefined, on: boolean): Promise<void> {
    if (!uid || !videoId) return;
    if (on) {
        await supabase.from('video_favorites')
            .upsert({ user_id: uid, video_id: videoId }, { onConflict: 'user_id,video_id', ignoreDuplicates: true });
    } else {
        await supabase.from('video_favorites').delete().eq('user_id', uid).eq('video_id', videoId);
    }
    bump(videoId, 'favorites', on ? 1 : -1);
}

/** Persist the current user's "trying" membership and adjust the shared count. */
export async function setVideoTrying(uid: string | null, videoId: string | null | undefined, on: boolean): Promise<void> {
    if (!uid || !videoId) return;
    if (on) {
        await supabase.from('video_tries')
            .upsert({ user_id: uid, video_id: videoId }, { onConflict: 'user_id,video_id', ignoreDuplicates: true });
    } else {
        await supabase.from('video_tries').delete().eq('user_id', uid).eq('video_id', videoId);
    }
    bump(videoId, 'tries', on ? 1 : -1);
}
