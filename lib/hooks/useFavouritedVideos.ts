import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../core/config/supabase';
import { useAuth } from '../providers/AuthContext';

export interface FavouritedVideosResult {
    exerciseIds: Set<string>;
    workoutIds: Set<string>;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

export function useFavouritedVideos(): FavouritedVideosResult {
    const { supabaseUserId } = useAuth();
    const [exerciseIds, setExerciseIds] = useState<Set<string>>(new Set());
    const [workoutIds, setWorkoutIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchFavourites = useCallback(async () => {
        if (!supabaseUserId) {
            console.log('[Favorites] fetch skipped: no userId yet');
            setExerciseIds(new Set());
            setWorkoutIds(new Set());
            return;
        }

        setLoading(true);
        setError(null);

        const { data, error: queryErr } = await supabase
            .from('video_interactions')
            .select('video_id, video_type')
            .eq('user_id', supabaseUserId)
            .eq('favourited', true);

        console.log('[Favorites] fetched rows:', data, 'error:', queryErr);

        if (queryErr) {
            setError(queryErr.message);
            setLoading(false);
            return;
        }

        const ex = new Set<string>();
        const wk = new Set<string>();
        for (const row of data ?? []) {
            if (row.video_type === 'exercise_library') ex.add(row.video_id);
            else if (row.video_type === 'premade_workout') wk.add(row.video_id);
        }
        setExerciseIds(ex);
        setWorkoutIds(wk);
        setLoading(false);
    }, [supabaseUserId]);

    useFocusEffect(
        useCallback(() => {
            console.log('[Favorites] screen focused — refetching');
            fetchFavourites();
        }, [fetchFavourites]),
    );

    return { exerciseIds, workoutIds, loading, error, refetch: fetchFavourites };
}
