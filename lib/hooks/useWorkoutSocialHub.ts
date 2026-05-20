import { useMemo } from 'react';

export interface SocialScheduledEntry {
    id: string;
    userId: string;
    displayName: string;
    programTitle: string | null;
    workoutTitle: string | null;
    videoTitle: string;
    combinedTitle: string;
    scheduledFor: Date;
    isPublic: boolean;
    isMine: boolean;
}

export interface SocialOpenEntry {
    id: string;
    kind: 'stranger_invite' | 'workout_session';
    status: string;
    title: string;
    subtitle: string;
    startsAt: Date | null;
    hostUid: string | null;
    hostName: string | null;
}

interface Params {
    videoId: string | null | undefined;
    currentUid: string | null | undefined;
    activeLiveCount: number;
}

export function useWorkoutSocialHub({ videoId, currentUid, activeLiveCount }: Params) {
    return useMemo(() => ({
        scheduled: [] as SocialScheduledEntry[],
        open: [] as SocialOpenEntry[],
        badges: {
            live: activeLiveCount,
            scheduled: 0,
            open: 0,
        },
    }), [activeLiveCount]);
}
