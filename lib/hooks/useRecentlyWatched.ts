import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../core/config/supabase';
import { useAuth } from '../providers/AuthContext';

export type RecentVideo = {
    videoId: string;
    videoType: 'exercise_library' | 'premade_workout';
    lastWatchedAt: string;
};

export function useRecentlyWatched(limit = 10) {
    const { supabaseUserId } = useAuth();
    const [videos, setVideos] = useState<RecentVideo[]>([]);

    const fetch = useCallback(async () => {
        if (!supabaseUserId) { setVideos([]); return; }
        const { data } = await supabase
            .from('video_interactions')
            .select('video_id, video_type, last_watched_at')
            .eq('user_id', supabaseUserId)
            .not('last_watched_at', 'is', null)
            .order('last_watched_at', { ascending: false })
            .limit(limit);
        setVideos(
            (data ?? []).map((r: any) => ({
                videoId: r.video_id,
                videoType: r.video_type,
                lastWatchedAt: r.last_watched_at,
            }))
        );
    }, [supabaseUserId, limit]);

    useFocusEffect(useCallback(() => { fetch(); }, [fetch]));

    return { videos, refetch: fetch };
}

export async function recordVideoWatch(
    userId: string,
    videoId: string,
    videoType: 'exercise_library' | 'premade_workout'
) {
    await supabase
        .from('video_interactions')
        .upsert(
            { user_id: userId, video_id: videoId, video_type: videoType, last_watched_at: new Date().toISOString() },
            { onConflict: 'user_id,video_id,video_type' }
        );
}
