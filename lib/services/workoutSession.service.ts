import { db } from '../core/config/firebase';
import {
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    updateDoc,
    query as fsQuery,
    where,
    Timestamp
} from 'firebase/firestore';
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
        const sessionsRef = collection(db, 'workoutSessions');
        const notificationsRef = collection(db, 'notifications');
        const now = Timestamp.now();
        const scheduledTimestamp = Timestamp.fromDate(scheduledAt);

        // 1. Create the session doc
        // lastNotifiedAt is initialised to null here and written by the
        // onWorkoutInvite Cloud Function immediately after it sends the first
        // push. The repeatWorkoutInvites scheduler uses it to determine whether
        // 30 minutes have elapsed before sending the next reminder.
        const sessionPayload = sanitize({
            hostUid,
            guestUid,
            hostName,
            guestName,
            hostAvatarUrl: hostAvatarUrl || null,
            guestAvatarUrl: guestAvatarUrl || null,
            videoId,
            videoTitle,
            scheduledAt: scheduledTimestamp,
            status: 'pending',
            sessionType: 'friend',
            inviteType: extras?.inviteType ?? 'instant',
            category: extras?.category ?? null,
            programName: extras?.programName ?? null,
            thumbnail: extras?.thumbnail ?? null,
            createdAt: now,
            updatedAt: now,
            betCredits: betCredits || 0,
            hasBet: betCredits > 0,
            lastNotifiedAt: null,
        });

        console.log('[WorkoutSessionService] Creating session payload:', {
            hostUid,
            guestUid,
            videoId,
            videoTitle,
            scheduledAt: scheduledTimestamp.toDate?.() ?? scheduledTimestamp,
        });

        const sessionDoc = await withTimeout(
            addDoc(sessionsRef, sessionPayload)
        );

        console.log('[WorkoutSessionService] Session document created:', sessionDoc.id);

        // 2. Format a pretty date string for the notification message
        const isToday = scheduledAt.toDateString() === new Date().toDateString();
        const dateStr = isToday ? 'Today' : scheduledAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const timeStr = scheduledAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        const message = `${hostName} invited you to work out ${dateStr} at ${timeStr}`;

        // 3. Create the notification doc
        const notificationPayload = sanitize({
            toUid: guestUid,
            fromUid: hostUid,
            fromName: hostName,
            avatar: hostAvatarUrl || null,
            type: 'workout_invite',
            title: 'Workout Invite',
            body: message,
            sessionId: sessionDoc.id,
            message: message,
            read: false,
            createdAt: now,
        });

        console.log('[WorkoutSessionService] Creating notification payload for session:', sessionDoc.id);

        await withTimeout(
            addDoc(notificationsRef, notificationPayload)
        );

        console.log('[WorkoutSessionService] Notification document created for session:', sessionDoc.id);

        // Dual-write: Supabase is source of truth for notification reads/listeners.
        NotificationService.insert({
            toUid: guestUid,
            fromUid: hostUid,
            fromName: hostName,
            avatar: hostAvatarUrl,
            type: 'workout_invite',
            title: 'Workout Invite',
            body: message,
            sessionId: sessionDoc.id,
        }).catch((e) => console.warn('[WorkoutSessionService] Supabase notification write failed (createSession):', e));

        return sessionDoc.id;
    }

    /**
     * Fetches ALL sessions where the user is host or guest.
     * Uses only single-field where clauses (no orderBy, no compound filters)
     * so no composite Firestore indexes are required.
     * Categorisation is done client-side in the context provider.
     */
    static async getAllUserSessions(uid: string): Promise<WorkoutSession[]> {
        const sessionsRef = collection(db, 'workoutSessions');

        const hostQ = fsQuery(sessionsRef, where('hostUid', '==', uid));
        const guestQ = fsQuery(sessionsRef, where('guestUid', '==', uid));

        const [hostSnap, guestSnap] = await Promise.all([
            withTimeout(getDocs(hostQ)),
            withTimeout(getDocs(guestQ))
        ]);

        const merged = [...hostSnap.docs, ...guestSnap.docs];
        const unique = Array.from(new Map(merged.map(doc => [doc.id, doc])).values());

        return unique.map(d => ({ ...(d.data() as any), id: d.id })) as WorkoutSession[];
    }

    /**
     * Accepts a pending invite and marks the associated notification as read
     */
    static async acceptSession(sessionId: string, uid: string): Promise<void> {
        const sessionRef = doc(db, 'workoutSessions', sessionId);
        await withTimeout(updateDoc(sessionRef, {
            status: 'accepted',
            updatedAt: Timestamp.now()
        }));

        // Now clear any unread notifications for this session meant for this user
        await WorkoutSessionService.markNotificationsRead(sessionId, uid);
    }

    /**
     * Declines a pending invite and marks notification as read
     */
    static async declineSession(sessionId: string, uid: string): Promise<void> {
        const sessionRef = doc(db, 'workoutSessions', sessionId);
        await withTimeout(updateDoc(sessionRef, {
            status: 'declined',
            updatedAt: Timestamp.now()
        }));

        await WorkoutSessionService.markNotificationsRead(sessionId, uid);
    }

    /**
     * Cancels an outgoing invite (host manually cancels — soft-deletes so it stays visible in Sessions)
     */
    static async cancelSession(sessionId: string): Promise<void> {
        const sessionRef = doc(db, 'workoutSessions', sessionId);
        await withTimeout(updateDoc(sessionRef, {
            status: 'cancelled',
            updatedAt: Timestamp.now(),
        }));

        // Mark associated notification as read so it leaves the guest's unread queue
        try {
            const notifQ = fsQuery(collection(db, 'notifications'), where('sessionId', '==', sessionId));
            const snap = await getDocs(notifQ);
            snap.docs.forEach(d => updateDoc(d.ref, { read: true }));
        } catch (e) {
            console.log('Failed to cleanup notification for cancelled session:', e);
        }

        // Dual-write: also mark read in Supabase.
        NotificationService.markReadBySessionAll(sessionId)
            .catch((e) => console.warn('[WorkoutSessionService] Supabase markRead failed (cancelSession):', e));
    }

    /**
     * Marks an instant invite as expired after the sender's countdown runs out.
     * Keeps the document so the host sees it in Previous Sessions.
     */
    static async expireSession(sessionId: string): Promise<void> {
        const sessionRef = doc(db, 'workoutSessions', sessionId);
        await withTimeout(updateDoc(sessionRef, {
            status: 'expired',
            updatedAt: Timestamp.now(),
        })).catch(() => {}); // non-critical — ignore if doc no longer exists

        try {
            const notifQ = fsQuery(collection(db, 'notifications'), where('sessionId', '==', sessionId));
            const snap = await getDocs(notifQ);
            snap.docs.forEach(d => updateDoc(d.ref, { read: true }));
        } catch (e) {
            console.log('Failed to cleanup notification for expired session:', e);
        }

        // Dual-write: also mark read in Supabase.
        NotificationService.markReadBySessionAll(sessionId)
            .catch((e) => console.warn('[WorkoutSessionService] Supabase markRead failed (expireSession):', e));
    }

    /**
     * Helper to mark a notification as read
     */
    static async markNotificationsRead(sessionId: string, toUid: string): Promise<void> {
        try {
            const notifQ = fsQuery(
                collection(db, 'notifications'),
                where('sessionId', '==', sessionId),
                where('toUid', '==', toUid)
            );
            const snap = await getDocs(notifQ);

            const updates = snap.docs.map(d => updateDoc(d.ref, { read: true }));
            await Promise.all(updates);
        } catch (e) {
            console.warn('Failed to mark notification read:', e);
        }

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
        const sessionRef = doc(db, 'workoutSessions', sessionId);
        const snap = await withTimeout(getDoc(sessionRef));

        if (!snap.exists()) throw new Error('Session not found');

        const data = snap.data() as any;
        const resendCount: number = data.resendCount ?? 0;

        if (resendCount >= WorkoutSessionService.MAX_RESENDS) {
            throw new Error('max_resends_reached');
        }

        const now = Timestamp.now();

        await withTimeout(updateDoc(sessionRef, {
            status: 'pending',
            scheduledAt: now,
            updatedAt: now,
            resendCount: resendCount + 1,
            lastNotifiedAt: null,
        }));

        // Create a fresh notification so the guest sees it again
        const isToday = true;
        const timeStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        const message = `${hostName} re-invited you to work out Today at ${timeStr}`;

        await withTimeout(addDoc(collection(db, 'notifications'), sanitize({
            toUid: data.guestUid,
            fromUid: data.hostUid,
            fromName: hostName,
            avatar: hostAvatarUrl ?? null,
            type: 'workout_invite',
            title: 'Workout Invite',
            body: message,
            sessionId,
            message,
            read: false,
            createdAt: now,
        })));

        // Dual-write: Supabase is source of truth for notification reads/listeners.
        NotificationService.insert({
            toUid: data.guestUid,
            fromUid: data.hostUid,
            fromName: hostName,
            avatar: hostAvatarUrl,
            type: 'workout_invite',
            title: 'Workout Invite',
            body: message,
            sessionId,
        }).catch((e) => console.warn('[WorkoutSessionService] Supabase notification write failed (resendSession):', e));
    }
}
