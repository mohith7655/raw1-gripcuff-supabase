import {
    collection,
    doc,
    updateDoc,
    onSnapshot,
    query,
    where,
    serverTimestamp,
    Timestamp,
    addDoc,
} from 'firebase/firestore';
import { db } from '../core/config/firebase';

export interface LiveSession {
    id: string;
    hostUid: string;
    guestUid: string;
    hostName: string;
    guestName: string;
    hostAvatarUrl: string | null;
    guestAvatarUrl: string | null;
    videoId: string;
    videoTitle: string;
    isLive: boolean;
    liveStartedAt: Timestamp | null;
}

export interface JoinRequest {
    id: string;
    sessionId: string;
    requesterId: string;
    requesterName: string;
    requesterAvatar: string | null;
    status: 'pending' | 'allowed' | 'denied';
    createdAt: Timestamp;
}

const SESSIONS_COL = 'workoutSessions';

export class LiveSessionService {
    static async markLive(sessionId: string): Promise<void> {
        try {
            await updateDoc(doc(db, SESSIONS_COL, sessionId), {
                isLive: true,
                liveStartedAt: serverTimestamp(),
            });
        } catch (e) {
            console.warn('[LiveSessionService] markLive failed:', e);
        }
    }

    static async markEnded(sessionId: string): Promise<void> {
        try {
            await updateDoc(doc(db, SESSIONS_COL, sessionId), {
                isLive: false,
            });
        } catch (e) {
            console.warn('[LiveSessionService] markEnded failed:', e);
        }
    }

    static subscribeLiveSessions(
        callback: (sessions: LiveSession[]) => void
    ): () => void {
        const q = query(
            collection(db, SESSIONS_COL),
            where('isLive', '==', true)
        );
        return onSnapshot(q, (snap) => {
            const sessions = snap.docs.map(d => ({ id: d.id, ...d.data() } as LiveSession));
            callback(sessions);
        }, (err) => {
            console.warn('[LiveSessionService] subscribeLiveSessions error:', err);
        });
    }

    static async requestToJoin(
        sessionId: string,
        requester: { uid: string; name: string; avatarUrl: string | null }
    ): Promise<string> {
        const ref = await addDoc(
            collection(db, SESSIONS_COL, sessionId, 'joinRequests'),
            {
                sessionId,
                requesterId: requester.uid,
                requesterName: requester.name,
                requesterAvatar: requester.avatarUrl,
                status: 'pending',
                createdAt: serverTimestamp(),
            }
        );
        return ref.id;
    }

    static async respondToJoinRequest(
        sessionId: string,
        requestId: string,
        response: 'allowed' | 'denied'
    ): Promise<void> {
        await updateDoc(
            doc(db, SESSIONS_COL, sessionId, 'joinRequests', requestId),
            { status: response }
        );
    }

    static subscribeToJoinRequests(
        sessionId: string,
        callback: (requests: JoinRequest[]) => void
    ): () => void {
        const q = query(
            collection(db, SESSIONS_COL, sessionId, 'joinRequests'),
            where('status', '==', 'pending')
        );
        return onSnapshot(q, (snap) => {
            const requests = snap.docs.map(d => ({ id: d.id, ...d.data() } as JoinRequest));
            callback(requests);
        });
    }

    static subscribeMyJoinRequest(
        sessionId: string,
        requestId: string,
        callback: (status: string) => void
    ): () => void {
        return onSnapshot(
            doc(db, SESSIONS_COL, sessionId, 'joinRequests', requestId),
            (snap) => {
                if (snap.exists()) {
                    callback((snap.data() as JoinRequest).status);
                }
            }
        );
    }
}
