import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../core/config/supabase';
import { useAuth } from '../providers/AuthContext';

export type VideoInteractionType = 'exercise_library' | 'premade_workout';

export type VideoInteractionField =
    | 'liked'
    | 'disliked'
    | 'want_to_try'
    | 'favourited';

// One-shot diagnostic — writes a known row to confirm the same supabase
// singleton can read/write with the current session. Logs the raw response
// so we can see PG error codes (RLS, NOT NULL, etc.).
async function testSupabaseConnection(uid: string) {
    console.log('[TEST] starting supabase write test, uid:', uid);
    const { data, error } = await supabase
        .from('video_interactions')
        .upsert(
            {
                user_id: uid,
                video_id: 'test-video-123',
                video_type: 'exercise_library',
                liked: true,
                disliked: false,
                want_to_try: false,
                favourited: true,
            },
            { onConflict: 'user_id,video_id,video_type' },
        )
        .select();
    if (error) console.error('[TEST] write failed:', JSON.stringify(error));
    else console.log('[TEST] write success, data:', JSON.stringify(data));

    const { data: readData, error: readErr } = await supabase
        .from('video_interactions')
        .select('*')
        .eq('user_id', uid)
        .eq('video_id', 'test-video-123')
        .eq('video_type', 'exercise_library')
        .maybeSingle();
    if (readErr) console.error('[TEST] read failed:', JSON.stringify(readErr));
    else console.log('[TEST] read success, data:', JSON.stringify(readData));
}

export function useVideoInteractions(
    videoId: string | null | undefined,
    videoType: VideoInteractionType,
) {
    const { supabaseUserId } = useAuth();

    console.log('[VideoInteraction] hook init — videoId:', videoId, 'videoType:', videoType, 'authUid:', supabaseUserId);

    const [liked, setLiked] = useState(false);
    const [disliked, setDisliked] = useState(false);
    const [wantToTry, setWantToTry] = useState(false);
    const [favourited, setFavourited] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Mirrors the four flags so toggleInteraction always reads the current
    // values, even when fired in quick succession before React re-renders.
    const stateRef = useRef({ liked: false, disliked: false, wantToTry: false, favourited: false });
    useEffect(() => {
        stateRef.current = { liked, disliked, wantToTry, favourited };
    }, [liked, disliked, wantToTry, favourited]);

    const resolveUserId = useCallback(async (): Promise<string | null> => {
        if (supabaseUserId) return supabaseUserId;
        const { data, error: userErr } = await supabase.auth.getUser();
        if (userErr) {
            console.warn('[VideoInteraction] getUser error:', userErr);
            return null;
        }
        return data.user?.id ?? null;
    }, [supabaseUserId]);

    // One-shot supabase write test on first mount where a uid is available.
    // Module-scoped flag so it fires once per app session, not per hook instance.
    const ranTestRef = useRef(false);
    useEffect(() => {
        if (ranTestRef.current) return;
        let cancelled = false;
        (async () => {
            const uid = await resolveUserId();
            if (cancelled || ranTestRef.current || !uid) return;
            ranTestRef.current = true;
            await testSupabaseConnection(uid);
        })();
        return () => {
            cancelled = true;
        };
    }, [resolveUserId]);

    // Load saved interaction row on mount / when video or auth changes.
    useEffect(() => {
        let cancelled = false;

        if (!videoId) {
            console.warn('[VideoInteraction] load skipped: videoId is', videoId, '— Postgres unique constraint cannot match NULL=NULL');
            setLiked(false);
            setDisliked(false);
            setWantToTry(false);
            setFavourited(false);
            return () => {
                cancelled = true;
            };
        }

        (async () => {
            setLoading(true);
            setError(null);
            try {
                const uid = await resolveUserId();
                if (!uid) {
                    console.warn('[VideoInteraction] load skipped: no userId');
                    if (!cancelled) {
                        setLiked(false);
                        setDisliked(false);
                        setWantToTry(false);
                        setFavourited(false);
                    }
                    return;
                }

                console.log('[VideoInteraction] load →', { userId: uid, videoId, videoType });
                const { data, error: loadErr } = await supabase
                    .from('video_interactions')
                    .select('*')
                    .eq('user_id', uid)
                    .eq('video_id', videoId)
                    .eq('video_type', videoType)
                    .maybeSingle();

                console.log(
                    '[VideoInteraction] load result:',
                    'videoId:', videoId,
                    'videoType:', videoType,
                    'userId:', uid,
                    'data:', JSON.stringify(data),
                    'error:', JSON.stringify(loadErr),
                );

                if (loadErr) {
                    console.error('[VideoInteraction] load error:', JSON.stringify(loadErr));
                    if (!cancelled) setError(loadErr.message);
                    return;
                }

                if (cancelled) return;

                if (data) {
                    console.log('[VideoInteraction] load hit — hydrating state from row', data);
                    setLiked(!!data.liked);
                    setDisliked(!!data.disliked);
                    setWantToTry(!!data.want_to_try);
                    setFavourited(!!data.favourited);
                    stateRef.current = {
                        liked: !!data.liked,
                        disliked: !!data.disliked,
                        wantToTry: !!data.want_to_try,
                        favourited: !!data.favourited,
                    };
                } else {
                    console.log('[VideoInteraction] load miss — no existing row');
                    setLiked(false);
                    setDisliked(false);
                    setWantToTry(false);
                    setFavourited(false);
                    stateRef.current = { liked: false, disliked: false, wantToTry: false, favourited: false };
                }
            } catch (e: any) {
                console.error('[VideoInteraction] load exception:', e);
                if (!cancelled) setError(e?.message ?? 'Failed to load');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [videoId, videoType, supabaseUserId, resolveUserId]);

    const toggleInteraction = useCallback(
        async (field: VideoInteractionField) => {
            if (!videoId) {
                console.warn('[VideoInteraction] toggle skipped: no videoId', { field, videoId });
                return;
            }

            const userId = await resolveUserId();
            console.log('[VideoInteraction] userId at upsert time:', userId);
            if (!userId) {
                console.warn('[VideoInteraction] toggle skipped: no userId', { field, videoId });
                return;
            }

            const prev = stateRef.current;
            const next = { ...prev };

            switch (field) {
                case 'liked':
                    next.liked = !prev.liked;
                    if (next.liked) next.disliked = false;
                    break;
                case 'disliked':
                    next.disliked = !prev.disliked;
                    if (next.disliked) next.liked = false;
                    break;
                case 'want_to_try':
                    next.wantToTry = !prev.wantToTry;
                    break;
                case 'favourited':
                    next.favourited = !prev.favourited;
                    break;
            }

            const newLiked = next.liked;
            const newDisliked = next.disliked;
            const newWantToTry = next.wantToTry;
            const newFavourited = next.favourited;

            setLiked(newLiked);
            setDisliked(newDisliked);
            setWantToTry(newWantToTry);
            setFavourited(newFavourited);
            stateRef.current = next;

            console.log('[VideoInteraction] upsert →', {
                user_id: userId,
                video_id: videoId,
                video_type: videoType,
                liked: newLiked,
                disliked: newDisliked,
                want_to_try: newWantToTry,
                favourited: newFavourited,
            });

            const { data, error: upsertErr } = await supabase
                .from('video_interactions')
                .upsert(
                    {
                        user_id: userId,
                        video_id: videoId,
                        video_type: videoType,
                        liked: newLiked,
                        disliked: newDisliked,
                        want_to_try: newWantToTry,
                        favourited: newFavourited,
                    },
                    { onConflict: 'user_id,video_id,video_type' },
                )
                .select();

            console.log(
                '[VideoInteraction] upsert result:',
                JSON.stringify(data),
                'error:',
                JSON.stringify(upsertErr),
            );

            if (upsertErr) {
                console.error('[VideoInteraction] upsert error:', JSON.stringify(upsertErr));
                setLiked(prev.liked);
                setDisliked(prev.disliked);
                setWantToTry(prev.wantToTry);
                setFavourited(prev.favourited);
                stateRef.current = prev;
                setError(upsertErr.message);
            } else {
                console.log('[VideoInteraction] upsert success');
                setError(null);
            }
        },
        [videoId, videoType, resolveUserId],
    );

    return {
        liked,
        disliked,
        wantToTry,
        favourited,
        loading,
        error,
        toggleInteraction,
    };
}
