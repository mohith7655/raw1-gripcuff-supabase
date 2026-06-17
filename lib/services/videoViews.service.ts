import { useEffect, useState } from 'react';
import { supabase } from '../core/config/supabase';

// Global, YouTube-style view counts shared by every user. Backed by the
// public.video_views table + increment_video_view RPC (see migration
// 20260618_video_views.sql).

export type VideoViewType = 'exercise_library' | 'premade_workout';

// ── Shared in-memory cache + request batching ─────────────────────────────────
// Many GridVideoCards mount at once; instead of one query per card we coalesce
// all the ids requested within a 50ms window into a single `.in(...)` query.
const cache = new Map<string, number>();
const listeners = new Map<string, Set<() => void>>();
let pending = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/** YouTube-style compact view label: 932, 1.2K, 3.4M. */
export function formatViews(n: number): string {
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

    const { data, error } = await supabase
        .from('video_views')
        .select('video_id, view_count')
        .in('video_id', ids);

    if (error) return;

    const seen = new Set<string>();
    for (const row of data ?? []) {
        cache.set(row.video_id, Number(row.view_count) || 0);
        seen.add(row.video_id);
    }
    // Ids with no row yet have zero views — cache that so we don't re-query.
    for (const id of ids) {
        if (!seen.has(id) && !cache.has(id)) cache.set(id, 0);
    }
    ids.forEach(notify);
}

/**
 * Subscribe a component to the global view count for a single video.
 * Returns the count, or `null` while the first fetch is still in flight.
 */
export function useVideoViews(videoId: string | null | undefined): number | null {
    const [, force] = useState(0);

    useEffect(() => {
        if (!videoId) return;
        const cb = () => force((n) => n + 1);

        let set = listeners.get(videoId);
        if (!set) {
            set = new Set();
            listeners.set(videoId, set);
        }
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

/** Pre-fetch counts for a batch of ids (e.g. a list screen) into the cache. */
export async function prefetchVideoViews(videoIds: string[]): Promise<void> {
    const missing = videoIds.filter((id) => id && !cache.has(id));
    if (missing.length === 0) return;
    const { data, error } = await supabase
        .from('video_views')
        .select('video_id, view_count')
        .in('video_id', missing);
    if (error) return;
    const seen = new Set<string>();
    for (const row of data ?? []) {
        cache.set(row.video_id, Number(row.view_count) || 0);
        seen.add(row.video_id);
    }
    for (const id of missing) if (!seen.has(id)) cache.set(id, 0);
    missing.forEach(notify);
}

/**
 * Record one view and bump the shared cache. Safe to call on every watch;
 * the screen guards against firing more than once per visit.
 */
export async function incrementVideoView(
    videoId: string,
    videoType: VideoViewType,
): Promise<void> {
    if (!videoId) return;
    const { data, error } = await supabase.rpc('increment_video_view', {
        p_video_id: videoId,
        p_video_type: videoType,
    });
    if (error) return;
    const next = typeof data === 'number' ? data : Number(data);
    if (!Number.isNaN(next)) {
        cache.set(videoId, next);
        notify(videoId);
    }
}
