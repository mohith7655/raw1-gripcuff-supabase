import { WorkoutSession, WorkoutInviteNotification } from '../models/WorkoutSession';
import { NotificationService } from './notification.service';

// Reusing the same timeout logic we used for the FriendService
const withTimeout = <T>(promise: Promise<T>, ms: number = 8000): Promise<T> => {
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
};

// Helper to remove undefined values
const sanitize = (obj: Record<string, any>) => {
    return Object.fromEntries(
        Object.entries(obj).filter(([_, v]) => v !== undefined && v !== null)
    );
};

export class WorkoutSessionService {
    /**
     * Creates a new workout session (invite) and sends a notification to the guest.
     */
    static async createSession(
        hostUid: string,
        hostName: string,
        hostAvatarUrl: string | undefined,
        guestUid: string,
        guestName: string,
        guestAvatarUrl: string | undefined,
        videoId: string,
        videoTitle: string,
        scheduledAt: Date,
        betCredits: number,
        extras?: {
            inviteType?: 'instant' | 'scheduled';
            category?: string;
            programName?: string;
            thumbnail?: string;
        }
    ): Promise<string> {
        const isToday = scheduledAt.toDateString() === new Date().toDateString();
        const dateStr = isToday ? 'Today' : scheduledAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const timeStr = scheduledAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        const message = `${hostName} invited you to work out ${dateStr} at ${timeStr}`;

        // Dual-write: Supabase is source of truth for notification reads/listeners.
        NotificationService.insert({
            toUid: guestUid,
            fromUid: hostUid,
            fromName: hostName,
            type: 'workout_invite',
            title: 'Workout Invite',
            body: message,
            sessionId: '',
        }).catch((e) => console.warn('[WorkoutSessionService] Supabase notification write failed (createSession):', e));

        return '';
    }

    /**
     * Fetches ALL sessions where the user is host or guest.
     */
    static async getAllUserSessions(uid: string): Promise<WorkoutSession[]> {
        return [];
    }

    /**
     * Accepts a pending invite and marks the associated notification as read
     */
    static async acceptSession(sessionId: string, uid: string): Promise<void> {
        await WorkoutSessionService.markNotificationsRead(sessionId, uid);
    }

    /**
     * Declines a pending invite and marks notification as read
     */
    static async declineSession(sessionId: string, uid: string): Promise<void> {
        await WorkoutSessionService.markNotificationsRead(sessionId, uid);
    }

    /**
     * Cancels an outgoing invite (host manually cancels — soft-deletes so it stays visible in Sessions)
     */
    static async cancelSession(sessionId: string): Promise<void> {
        // Dual-write: also mark read in Supabase.
        NotificationService.markReadBySessionAll(sessionId)
            .catch((e) => console.warn('[WorkoutSessionService] Supabase markRead failed (cancelSession):', e));
    }

    /**
     * Marks an instant invite as expired after the sender's countdown runs out.
     */
    static async expireSession(sessionId: string): Promise<void> {
        // Dual-write: also mark read in Supabase.
        NotificationService.markReadBySessionAll(sessionId)
            .catch((e) => console.warn('[WorkoutSessionService] Supabase markRead failed (expireSession):', e));
    }

    /**
     * Helper to mark a notification as read
     */
    static async markNotificationsRead(sessionId: string, toUid: string): Promise<void> {
        // Dual-write: also mark read in Supabase.
        NotificationService.markReadBySession(sessionId, toUid)
            .catch((e) => console.warn('[WorkoutSessionService] Supabase markRead failed (markNotificationsRead):', e));
    }

    static readonly MAX_RESENDS = 3;

    /**
     * Resends a previous invite by flipping it back to pending and incrementing resendCount.
     * Throws if the session has already been resent MAX_RESENDS times.
     */
    static async resendSession(sessionId: string, hostName: string, hostAvatarUrl?: string): Promise<void> {
        const timeStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        const message = `${hostName} re-invited you to work out Today at ${timeStr}`;

        // Dual-write: Supabase is source of truth for notification reads/listeners.
        NotificationService.insert({
            toUid: '',
            fromUid: '',
            fromName: hostName,
            type: 'workout_invite',
            title: 'Workout Invite',
            body: message,
            sessionId,
        }).catch((e) => console.warn('[WorkoutSessionService] Supabase notification write failed (resendSession):', e));
    }
}
