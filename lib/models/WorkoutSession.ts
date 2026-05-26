import { Video } from './Video';

export interface WorkoutSession {
    id: string;                 // Document ID
    hostUid: string;            // The user who created the invite (you)
    guestUid: string;           // The friend you invited
    hostName: string;           // Cache the host's name for easy UI rendering
    guestName: string;          // Cache the guest's name for easy UI rendering
    guestAvatarUrl?: string;    // Cache the guest's profile pic
    hostAvatarUrl?: string;     // Cache the host's profile pic
    videoId: string;            // The ID of the workout video
    videoTitle: string;         // Cache the video title for the UI
    scheduledAt: Date;          // The exact date & time selected
    status: 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled' | 'expired';
    sessionType?: 'self' | 'friend' | 'premade';
    inviteType?: 'instant' | 'scheduled';
    category?: string;
    programName?: string;
    thumbnail?: string;
    resendCount?: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface WorkoutInviteNotification {
    id: string;
    toUid: string;
    fromUid: string;
    fromName: string;
    fromAvatarUrl?: string;
    type: 'workout_invite';
    sessionId: string;
    message: string;
    read: boolean;
    createdAt: Date;
}
