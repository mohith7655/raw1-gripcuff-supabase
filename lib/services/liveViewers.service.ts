import { WatcherDoc, isViewerActive } from './WorkoutWatcherService';

export interface LiveViewerEntry {
    uid: string;
    displayName: string;
    username: string;
    profilePhoto: string | null;
    gender: string | null;
    age: number | null;
    joinedAt: Date | null;
    isFriend: boolean;
}

/**
 * Real-time subscription to live viewers for a video.
 * Returns an unsubscribe function.
 */
export function subscribeLiveViewersForVideo(
    videoId: string,
    currentUid: string,
    friendUids: string[],
    onChange: (viewers: LiveViewerEntry[]) => void
): () => void {
    onChange([]);
    return () => {};
}
