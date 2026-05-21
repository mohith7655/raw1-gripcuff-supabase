import { WorkoutSessionService } from './workoutSession.service';
import { NotificationService } from './notification.service';

export interface VideoInvitePayload {
    fromUid: string;
    fromName: string;
    fromAvatarUrl: string | null;
    toUid: string;
    toName?: string;
    toAvatarUrl?: string | null;
    videoId: string;
    videoTitle: string;
}

/**
 * sendVideoInvite — creates a workout session so both users can join.
 * Falls back to creating a lightweight notification if session creation fails.
 */
export async function sendVideoInvite(payload: VideoInvitePayload): Promise<string | void> {
    console.log('[sendVideoInvite] payload:', {
        fromUid: payload.fromUid,
        toUid: payload.toUid,
        videoId: payload.videoId,
        videoTitle: payload.videoTitle,
    });

    try {
        const sessionId = await WorkoutSessionService.createSession(
            payload.fromUid,
            payload.fromName,
            payload.fromAvatarUrl ?? undefined,
            payload.toUid,
            payload.toName ?? 'Friend',
            payload.toAvatarUrl ?? undefined,
            payload.videoId,
            payload.videoTitle,
            new Date(), // scheduled now
            0 // no bet credits for instant video invites
        );

        console.log('[sendVideoInvite] created sessionId:', sessionId);
        return sessionId;
    } catch (err) {
        console.error('[sendVideoInvite] Failed to create workout session, falling back to notification:', err);

        const fallbackBody = `${payload.fromName} invited you to watch "${payload.videoTitle}"`;

        // Dual-write: Supabase is source of truth for notification reads/listeners.
        NotificationService.insert({
            toUid: payload.toUid,
            fromUid: payload.fromUid,
            fromName: payload.fromName,
            type: 'video_invite',
            title: `${payload.fromName} invited you`,
            body: fallbackBody,
        }).catch((e) => console.warn('[sendVideoInvite] Supabase notification write failed:', e));
    }
}
