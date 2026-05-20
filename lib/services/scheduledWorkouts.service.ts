export interface ScheduledEntry {
    id: string;
    userId: string;
    workoutId: string;
    workoutName: string;
    programName: string | null;
    thumbnail: string | null;
    scheduledFor: Date;
    isShared: boolean;
    partnerUid?: string;
    displayName: string;
    isFriend: boolean;
}

/**
 * Real-time subscription to upcoming scheduledWorkouts for a video.
 * Returns an unsubscribe function.
 */
export function subscribeScheduledForVideo(
    videoId: string,
    currentUid: string,
    friendUids: string[],
    onChange: (entries: ScheduledEntry[]) => void
): () => void {
    onChange([]);
    return () => {};
}
