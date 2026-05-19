import { Timestamp } from 'firebase/firestore';
import { Video } from './Video';

export interface WorkoutSession {
    id: string;                 // Firestore document ID
    hostUid: string;            // The user who created the invite (you)
    guestUid: string;           // The friend you invited
    hostName: string;           // Cache the host's name for easy UI rendering
    guestName: string;          // Cache the guest's name for easy UI rendering
    guestAvatarUrl?: string;    // Cache the guest's profile pic
    hostAvatarUrl?: string;     // Cache the host's profile pic
    videoId: string;            // The ID of the workout video
    videoTitle: string;         // Cache the video title for the UI
    scheduledAt: Timestamp;     // The exact date & time selected
    status: 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled' | 'expired';
    sessionType?: 'friend' | 'premade'; // premade = solo pre-made workout watch
    inviteType?: 'instant' | 'scheduled';
    category?: string;          // Workout category e.g. "Stretching"
    programName?: string;       // Program name e.g. "Morning Mobility Routine"
    thumbnail?: string;         // Video thumbnail URL
    resendCount?: number;       // How many times this invite has been resent (max 3)
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface WorkoutInviteNotification {
    id: string;                 // Firestore document ID
    toUid: string;              // The user receiving the invite
    fromUid: string;            // The user who sent the invite
    fromName: string;           // Easy rendering
    fromAvatarUrl?: string;     // Easy rendering
    type: 'workout_invite';     // Type of notification
    sessionId: string;          // Reference back to the WorkoutSession doc
    message: string;            // Summary like "Rishi invited you to work out..."
    read: boolean;              // Drives the badge count
    createdAt: Timestamp;
}
