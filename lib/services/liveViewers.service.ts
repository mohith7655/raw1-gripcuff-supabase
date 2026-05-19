import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../core/config/firebase';
import { WatcherDoc, isViewerActive } from './WorkoutWatcherService';

export interface LiveViewerEntry {
    uid: string;
    displayName: string;
    username: string;
    profilePhoto: string | null;
    gender: string | null;
    age: number | null;
    joinedAt: import('firebase/firestore').Timestamp | null;
    isFriend: boolean;
}

/**
 * Real-time subscription to live viewers for a video.
 * Excludes the current user and attaches isFriend to each entry.
 * Returns the Firestore unsubscribe function.
 */
export function subscribeLiveViewersForVideo(
    videoId: string,
    currentUid: string,
    friendUids: string[],
    onChange: (viewers: LiveViewerEntry[]) => void
): () => void {
    const ref = collection(db, 'liveViewers', videoId, 'viewers');

    return onSnapshot(
        ref,
        { includeMetadataChanges: false },
        (snap) => {
            const viewers: LiveViewerEntry[] = [];
            snap.docs.forEach((docSnap) => {
                if (docSnap.id === currentUid) return;
                const data = docSnap.data() as WatcherDoc;
                if (!isViewerActive(data)) return;
                viewers.push({
                    uid: docSnap.id,
                    displayName: data.displayName,
                    username: data.username,
                    profilePhoto: data.profilePhoto ?? null,
                    gender: data.gender ?? null,
                    age: data.age ?? null,
                    joinedAt: data.joinedAt ?? null,
                    isFriend: friendUids.includes(docSnap.id),
                });
            });
            onChange(viewers);
        },
        (err) => {
            console.warn('[LiveViewersService] snapshot error:', err);
        }
    );
}
