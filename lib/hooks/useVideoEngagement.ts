import { useState, useEffect, useCallback } from 'react';
import {
    doc,
    onSnapshot,
    setDoc,
    deleteDoc,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from '../core/config/firebase';
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

    useEffect(() => {
        if (!uid || !videoId) return;
        const ref = doc(db, 'users', uid, 'videoInteractions', videoId);
        return onSnapshot(ref, (snap) => {
            if (snap.exists()) {
                const d = snap.data();
                setState({
                    liked: !!d.liked,
                    disliked: !!d.disliked,
                    tryIntent: !!d.tryIntent,
                });
            } else {
                setState({ liked: false, disliked: false, tryIntent: false });
            }
        });
    }, [uid, videoId]);

    const patchAnalytics = useCallback(
        (updates: Partial<Record<string, any>>) => {
            if (!uid || !videoId) return;
            setDoc(
                doc(db, 'users', uid, 'videoAnalytics', videoId),
                { ...updates, updatedAt: serverTimestamp() },
                { merge: true },
            ).catch(() => {});
        },
        [uid, videoId],
    );

    const patchInteractions = useCallback(
        (updates: Partial<Record<string, any>>) => {
            if (!uid || !videoId) return;
            return setDoc(
                doc(db, 'users', uid, 'videoInteractions', videoId),
                { ...updates, updatedAt: serverTimestamp() },
                { merge: true },
            );
        },
        [uid, videoId],
    );

    const toggleLike = useCallback(async () => {
        if (!uid || !videoId) return;
        const wasLiked = state.liked;
        const wasDisliked = state.disliked;
        const newLiked = !wasLiked;
        const newDisliked = newLiked ? false : wasDisliked;
        await patchInteractions({ liked: newLiked, disliked: newDisliked });
        patchAnalytics({ liked: newLiked, disliked: newDisliked });
        const delta = newLiked
            ? { likes: 1, ...(wasDisliked ? { dislikes: -1 } : {}) }
            : { likes: -1 };
        updateGlobalEngagement(videoId, delta).catch(() => {});
    }, [uid, videoId, state, patchInteractions, patchAnalytics]);

    const toggleDislike = useCallback(async () => {
        if (!uid || !videoId) return;
        const wasDisliked = state.disliked;
        const wasLiked = state.liked;
        const newDisliked = !wasDisliked;
        const newLiked = newDisliked ? false : wasLiked;
        await patchInteractions({ liked: newLiked, disliked: newDisliked });
        patchAnalytics({ liked: newLiked, disliked: newDisliked });
        const delta = newDisliked
            ? { dislikes: 1, ...(wasLiked ? { likes: -1 } : {}) }
            : { dislikes: -1 };
        updateGlobalEngagement(videoId, delta).catch(() => {});
    }, [uid, videoId, state, patchInteractions, patchAnalytics]);

    const toggleTryIntent = useCallback(async () => {
        if (!uid || !videoId) return;
        const newVal = !state.tryIntent;
        if (newVal) {
            await setDoc(
                doc(db, 'users', uid, 'tryList', videoId),
                {
                    videoId,
                    title: meta?.title ?? null,
                    category: meta?.category ?? null,
                    difficulty: meta?.difficulty ?? null,
                    thumbnail: meta?.thumbnail ?? null,
                    addedAt: serverTimestamp(),
                },
                { merge: true },
            );
        } else {
            await deleteDoc(doc(db, 'users', uid, 'tryList', videoId));
        }
        await patchInteractions({ tryIntent: newVal });
        patchAnalytics({ tryIntent: newVal });
    }, [uid, videoId, state, meta, patchInteractions, patchAnalytics]);

    return { state, toggleLike, toggleDislike, toggleTryIntent };
}
