import {
    collection,
    doc,
    setDoc,
    updateDoc,
    getDoc,
    query,
    where,
    getDocs,
    serverTimestamp,
    Timestamp,
} from 'firebase/firestore';
import { db } from '../core/config/firebase';

export type StrangerInviteStatus =
    | 'pending'
    | 'accepted'
    | 'declined'
    | 'expired'
    | 'cancelled';

export interface StrangerInvite {
    inviteId: string;
    inviterId: string;
    inviterUsername: string;
    inviterPhoto: string | null;
    inviterAge: number | null;
    inviterGender: string | null;
    targetUserId: string;
    workoutId: string;
    workoutTitle: string;
    workoutThumbnail: string | null;
    status: StrangerInviteStatus;
    createdAt: Timestamp;
    expiresAt: Timestamp;
    channelName: string;
    sessionId: string | null;
}

const INVITE_TIMEOUT_MS = 10_000; // 10 seconds
const COL = 'strangerInvites';

export class StrangerInviteService {
    // ── Create ──────────────────────────────────────────────────────────────────

    static async createInvite(params: {
        inviterId: string;
        targetUserId: string;
        workoutId: string;
        workoutTitle: string;
        workoutThumbnail?: string | null;
    }): Promise<string> {
        const { inviterId, targetUserId, workoutId, workoutTitle, workoutThumbnail } = params;

        if (inviterId === targetUserId) throw new Error('Cannot invite yourself');

        // Block if inviter already has a pending outgoing invite for this workout
        const existing = await getDocs(
            query(
                collection(db, COL),
                where('inviterId', '==', inviterId),
                where('workoutId', '==', workoutId),
                where('status', '==', 'pending'),
            ),
        );
        if (!existing.empty) throw new Error('You already have a pending invite for this workout');

        // Block if target already has a pending incoming invite from this inviter
        const dup = await getDocs(
            query(
                collection(db, COL),
                where('inviterId', '==', inviterId),
                where('targetUserId', '==', targetUserId),
                where('status', '==', 'pending'),
            ),
        );
        if (!dup.empty) throw new Error('Already invited this person');

        // Fetch inviter profile for the invite card
        const inviterSnap = await getDoc(doc(db, 'users', inviterId));
        const inviterData = inviterSnap.data() ?? {};
        const inviterUsername =
            inviterData.username ||
            inviterData.displayName ||
            inviterData.fullName ||
            inviterData.email?.split('@')[0] ||
            'Someone';
        const inviterPhoto: string | null = inviterData.profileImageUrl ?? inviterData.photoURL ?? null;
        const inviterAge: number | null = inviterData.age ?? null;
        const inviterGender: string | null = inviterData.gender ?? null;

        const inviteRef = doc(collection(db, COL));
        const inviteId = inviteRef.id;
        const now = Date.now();

        const invite: Omit<StrangerInvite, 'inviteId'> = {
            inviterId,
            inviterUsername,
            inviterPhoto,
            inviterAge,
            inviterGender,
            targetUserId,
            workoutId,
            workoutTitle,
            workoutThumbnail: workoutThumbnail ?? null,
            status: 'pending',
            createdAt: Timestamp.fromMillis(now),
            expiresAt: Timestamp.fromMillis(now + INVITE_TIMEOUT_MS),
            channelName: inviteId,
            sessionId: null,
        };

        await setDoc(inviteRef, invite);
        return inviteId;
    }

    // ── Accept ──────────────────────────────────────────────────────────────────

    static async acceptInvite(inviteId: string, acceptorUid: string): Promise<void> {
        const ref = doc(db, COL, inviteId);
        const snap = await getDoc(ref);
        if (!snap.exists()) throw new Error('Invite not found');

        const data = snap.data() as StrangerInvite;
        if (data.status !== 'pending') throw new Error(`Invite is already ${data.status}`);
        if (data.targetUserId !== acceptorUid) throw new Error('Not authorised to accept this invite');

        const now = Date.now();
        if (data.expiresAt.toMillis() < now) {
            await updateDoc(ref, { status: 'expired' });
            throw new Error('Invite has expired');
        }

        // Fetch acceptor profile for the session doc
        const acceptorSnap = await getDoc(doc(db, 'users', acceptorUid));
        const acceptorData = acceptorSnap.data() ?? {};
        const acceptorName =
            acceptorData.fullName ||
            acceptorData.username ||
            acceptorData.displayName ||
            acceptorData.email?.split('@')[0] ||
            'Partner';
        const acceptorPhoto: string | null = acceptorData.profileImageUrl ?? acceptorData.photoURL ?? null;

        // Create a workoutSessions doc (using inviteId as sessionId) so both users
        // can land on SyncedVideoPlayerScreen with shared play/pause sync state.
        const sessionRef = doc(db, 'workoutSessions', inviteId);
        await setDoc(sessionRef, {
            id: inviteId,
            hostUid: data.inviterId,
            guestUid: acceptorUid,
            hostName: data.inviterUsername,
            guestName: acceptorName,
            hostAvatarUrl: data.inviterPhoto ?? null,
            guestAvatarUrl: acceptorPhoto,
            videoId: data.workoutId,
            videoTitle: data.workoutTitle,
            status: 'accepted',
            scheduledAt: Timestamp.fromMillis(now),
            createdAt: Timestamp.fromMillis(now),
            updatedAt: Timestamp.fromMillis(now),
        });

        await updateDoc(ref, { status: 'accepted', sessionId: inviteId });
    }

    // ── Decline ─────────────────────────────────────────────────────────────────

    static async declineInvite(inviteId: string, declinerUid: string): Promise<void> {
        const ref = doc(db, COL, inviteId);
        const snap = await getDoc(ref);
        if (!snap.exists()) return;

        const data = snap.data() as StrangerInvite;
        if (data.targetUserId !== declinerUid) throw new Error('Not authorised');
        if (data.status !== 'pending') return;

        await updateDoc(ref, { status: 'declined' });
    }

    // ── Cancel (sender aborts) ───────────────────────────────────────────────────

    static async cancelInvite(inviteId: string, cancellerUid: string): Promise<void> {
        const ref = doc(db, COL, inviteId);
        const snap = await getDoc(ref);
        if (!snap.exists()) return;

        const data = snap.data() as StrangerInvite;
        if (data.inviterId !== cancellerUid) throw new Error('Not authorised');
        if (data.status !== 'pending') return;

        await updateDoc(ref, { status: 'cancelled' });
    }

    // ── Expire (server-side or client fallback) ──────────────────────────────────

    static async expireInvite(inviteId: string): Promise<void> {
        const ref = doc(db, COL, inviteId);
        const snap = await getDoc(ref);
        if (!snap.exists()) return;
        if (snap.data()?.status !== 'pending') return;
        await updateDoc(ref, { status: 'expired' });
    }

    // ── Read ─────────────────────────────────────────────────────────────────────

    static async getInvite(inviteId: string): Promise<StrangerInvite | null> {
        const snap = await getDoc(doc(db, COL, inviteId));
        if (!snap.exists()) return null;
        return { inviteId: snap.id, ...(snap.data() as Omit<StrangerInvite, 'inviteId'>) };
    }
}
