import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../core/config/firebase';
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
 * sendVideoInvite — unified implementation that creates a workout session
 * so the existing Cloud Function `onWorkoutInvite` will send push notifications.
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

        // Best-effort fallback: write a notification doc so the invite appears in-app
        const fallbackBody = `${payload.fromName} invited you to watch "${payload.videoTitle}"`;
        try {
            await addDoc(collection(db, 'notifications'), {
                toUid: payload.toUid,
                fromUid: payload.fromUid,
                fromName: payload.fromName,
                fromAvatarUrl: payload.fromAvatarUrl ?? null,
                type: 'video_invite',
                videoId: payload.videoId,
                videoTitle: payload.videoTitle,
                message: fallbackBody,
                read: false,
                createdAt: serverTimestamp(),
            });
            console.log('[sendVideoInvite] fallback notification written');
        } catch (e) {
            console.error('[sendVideoInvite] fallback notification failed:', e);
        }

        // Dual-write: Supabase is source of truth for notification reads/listeners.
        NotificationService.insert({
            toUid: payload.toUid,
            fromUid: payload.fromUid,
            fromName: payload.fromName,
            avatar: payload.fromAvatarUrl,
            type: 'video_invite',
            title: `${payload.fromName} invited you`,
            body: fallbackBody,
        }).catch((e) => console.warn('[sendVideoInvite] Supabase notification write failed:', e));
    }
}
