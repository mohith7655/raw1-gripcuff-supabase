import { useState, useEffect } from 'react';
import {
    doc,
    onSnapshot,
    setDoc,
    serverTimestamp,
    increment,
    getDoc,
} from 'firebase/firestore';
import { db } from '../core/config/firebase';

export interface GlobalVideoCounts {
    totalLikes: number;
    totalDislikes: number;
}

export function formatCount(n: number): string {
    if (n >= 10000) return `${Math.round(n / 1000)}k`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
}

export async function updateGlobalEngagement(
    videoId: string,
    delta: { likes?: number; dislikes?: number },
): Promise<void> {
    if (!videoId || videoId === 'default-video') return;
    const updates: Record<string, any> = { updatedAt: serverTimestamp() };
    if (delta.likes) updates.totalLikes = increment(delta.likes);
    if (delta.dislikes) updates.totalDislikes = increment(delta.dislikes);
    await setDoc(doc(db, 'videos', videoId), updates, { merge: true }).catch(() => {});
}

export function useVideoGlobalCounts(videoId: string | null): GlobalVideoCounts {
    const [counts, setCounts] = useState<GlobalVideoCounts>({ totalLikes: 0, totalDislikes: 0 });

    useEffect(() => {
        if (!videoId || videoId === 'default-video') return;
        return onSnapshot(doc(db, 'videos', videoId), (snap) => {
            if (snap.exists()) {
                const d = snap.data();
                setCounts({
                    totalLikes: Math.max(0, d.totalLikes ?? 0),
                    totalDislikes: Math.max(0, d.totalDislikes ?? 0),
                });
            }
        });
    }, [videoId]);

    return counts;
}

export async function getGlobalEngagementBoosts(
    videoIds: string[],
): Promise<Record<string, number>> {
    const snaps = await Promise.all(
        videoIds.map((id) => getDoc(doc(db, 'videos', id)).catch(() => null)),
    );
    const boosts: Record<string, number> = {};
    snaps.forEach((snap, i) => {
        if (snap?.exists()) {
            const d = snap.data();
            const likes = Math.max(0, d.totalLikes ?? 0);
            const dislikes = Math.max(0, d.totalDislikes ?? 0);
            // Capped at +15 so global popularity can't override user preference signals
            boosts[videoIds[i]] = Math.min((likes * 2 - dislikes * 1.5) / 100, 15);
        }
    });
    return boosts;
}
