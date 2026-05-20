import { useState, useCallback } from 'react';
import { updateGlobalEngagement } from '../services/videoEngagement.service';

export interface EngagementState {
    liked: boolean;
    disliked: boolean;
    tryIntent: boolean;
}

interface VideoMeta {
    title?: string;
    category?: string;
    difficulty?: string;
    thumbnail?: string;
    youtubeId?: string;
    videoUrl?: string;
}

export function useVideoEngagement(
    uid: string | null,
    videoId: string | null,
    meta?: VideoMeta,
) {
    const [state, setState] = useState<EngagementState>({
        liked: false,
        disliked: false,
        tryIntent: false,
    });

    const toggleLike = useCallback(async () => {
        if (!uid || !videoId) return;
        const wasLiked = state.liked;
        const wasDisliked = state.disliked;
        const newLiked = !wasLiked;
        const newDisliked = newLiked ? false : wasDisliked;
        setState(s => ({ ...s, liked: newLiked, disliked: newDisliked }));
        const delta = newLiked
            ? { likes: 1, ...(wasDisliked ? { dislikes: -1 } : {}) }
            : { likes: -1 };
        updateGlobalEngagement(videoId, delta).catch(() => {});
    }, [uid, videoId, state]);

    const toggleDislike = useCallback(async () => {
        if (!uid || !videoId) return;
        const wasDisliked = state.disliked;
        const wasLiked = state.liked;
        const newDisliked = !wasDisliked;
        const newLiked = newDisliked ? false : wasLiked;
        setState(s => ({ ...s, liked: newLiked, disliked: newDisliked }));
        const delta = newDisliked
            ? { dislikes: 1, ...(wasLiked ? { likes: -1 } : {}) }
            : { dislikes: -1 };
        updateGlobalEngagement(videoId, delta).catch(() => {});
    }, [uid, videoId, state]);

    const toggleTryIntent = useCallback(async () => {
        if (!uid || !videoId) return;
        const newVal = !state.tryIntent;
        setState(s => ({ ...s, tryIntent: newVal }));
    }, [uid, videoId, state]);

    return { state, toggleLike, toggleDislike, toggleTryIntent };
}
