import {
    collection,
    query as fsQuery,
    where,
    orderBy,
    getDocs,
    addDoc,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    Timestamp,
} from 'firebase/firestore';
import { db } from '../core/config/firebase';
import { User } from '../models/User';
import { FriendRequest, Friend, RelationshipStatus } from '../models/Friend';
import { NotificationService } from './notification.service';

// ── Timeout wrapper (same pattern as user.service.ts) ──────────────────────
const withTimeout = <T>(promise: Promise<T>, ms: number = 5000): Promise<T> => {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error('Firestore request timed out')), ms)
        ),
    ]);
};

// ── Helpers ────────────────────────────────────────────────────────────────

/** Returns the canonical friends doc ID for any two uids (sorted alphabetically) */
function friendDocId(uid1: string, uid2: string): string {
    return [uid1, uid2].sort().join('_');
}

/** Converts raw Firestore data into a FriendRequest */
function toFriendRequest(id: string, data: Record<string, unknown>): FriendRequest {
    return {
        id,
        fromUid: data.fromUid as string,
        toUid: data.toUid as string,
        status: data.status as FriendRequest['status'],
        createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
        updatedAt: (data.updatedAt as Timestamp)?.toDate() ?? new Date(),
    };
}

/** Converts raw Firestore data into a Friend */
function toFriend(id: string, data: Record<string, unknown>): Friend {
    return {
        id,
        uids: data.uids as string[],
        createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
    };
}

// ── Service ─────────────────────────────────────────────────────────────────

export class FriendService {
    /**
     * DEBUG VERSION — timeout wrapper removed so errors surface directly.
     * Restore withTimeout() once search is confirmed working.
     */
    static async searchUsers(searchQuery: string, currentUid: string): Promise<User[]> {
        console.log('searchUsers START — db:', (db as any)._databaseId?.database ?? (db as any)._settings?.host ?? 'unknown');

        if (!searchQuery.trim()) return [];

        const cleaned = searchQuery.trim().toLowerCase();
        const cleanedEnd = cleaned + '\uf8ff'; // Unicode character for prefix matching

        try {
            const usersRef = collection(db, 'users');

            console.log('[searchUsers] Building queries for:', cleaned);
            const emailQ = fsQuery(usersRef, where('email', '==', cleaned));
            const usernameQ = fsQuery(usersRef, where('username', '==', cleaned));
            const usernamePrefixQ = fsQuery(
                usersRef,
                orderBy('username'),
                where('username', '>=', cleaned),
                where('username', '<=', cleanedEnd)
            );
            const emailPrefixQ = fsQuery(
                usersRef,
                orderBy('email'),
                where('email', '>=', cleaned),
                where('email', '<=', cleanedEnd)
            );

            console.log('[searchUsers] Running getDocs (no timeout wrapper)...');
            const [emailSnap, usernameSnap, usernamePrefixSnap, emailPrefixSnap] = await Promise.all([
                getDocs(emailQ),
                getDocs(usernameQ),
                getDocs(usernamePrefixQ),
                getDocs(emailPrefixQ),
            ]);

            console.log('[searchUsers] emailSnap:', emailSnap.size, '| usernameSnap:', usernameSnap.size, '| usernamePrefix:', usernamePrefixSnap.size, '| emailPrefix:', emailPrefixSnap.size);

            const seen = new Set<string>();
            const results: User[] = [];

            for (const docSnap of [...emailSnap.docs, ...usernameSnap.docs, ...usernamePrefixSnap.docs, ...emailPrefixSnap.docs]) {
                if (docSnap.id === currentUid) continue;
                if (seen.has(docSnap.id)) continue;
                seen.add(docSnap.id);
                results.push({ ...(docSnap.data() as User), uid: docSnap.id });
            }

            console.log('[searchUsers] Final results:', results.length);
            return results;

        } catch (err: unknown) {
            const e = err as { code?: string; message?: string };
            console.error('[searchUsers] ERROR code:', e?.code);
            console.error('[searchUsers] ERROR message:', e?.message);
            try { console.error('[searchUsers] FULL:', JSON.stringify(err)); } catch { console.error('[searchUsers] FULL (not serialisable):', err); }
            return [];
        }
    }


    /**
     * Send a friend request from fromUid to toUid.
     * Throws if a pending request already exists or they are already friends.
     */
    static async sendFriendRequest(fromUid: string, toUid: string): Promise<void> {
        console.log('[FriendService.sendFriendRequest] starting...', { fromUid, toUid });
        const requestsRef = collection(db, 'friendRequests');

        try {
            console.log('[FriendService.sendFriendRequest] STEP 1: Checking existing requests');
            const [sentSnap, receivedSnap] = await Promise.all([
                withTimeout(getDocs(fsQuery(requestsRef,
                    where('fromUid', '==', fromUid),
                    where('toUid', '==', toUid),
                    where('status', '==', 'pending')
                ))),
                withTimeout(getDocs(fsQuery(requestsRef,
                    where('fromUid', '==', toUid),
                    where('toUid', '==', fromUid),
                    where('status', '==', 'pending')
                ))),
            ]);

            console.log('[FriendService.sendFriendRequest] STEP 2: Checking friends doc');
            if (!sentSnap.empty) throw new Error('Friend request already sent.');
            if (!receivedSnap.empty) throw new Error('This person already sent you a request. Accept it from the Requests tab.');

            const friendRef = doc(db, 'friends', friendDocId(fromUid, toUid));
            const friendSnap = await withTimeout(getDoc(friendRef));
            if (friendSnap.exists()) throw new Error('You are already friends.');
            const senderSnap = await withTimeout(getDoc(doc(db, 'users', fromUid)));
            const senderData = senderSnap.exists() ? (senderSnap.data() as Record<string, any>) : {};
            const senderName =
                senderData.fullName ||
                senderData.displayName ||
                senderData.username ||
                senderData.email ||
                'Someone';
            const senderAvatar = senderData.profileImageUrl || senderData.avatar || null;

            console.log('[FriendService.sendFriendRequest] STEP 3: Creating addDoc friend request');
            const now = Timestamp.now();
            const requestRef = await withTimeout(
                addDoc(requestsRef, {
                    fromUid,
                    toUid,
                    status: 'pending',
                    createdAt: now,
                    updatedAt: now,
                })
            );
            await withTimeout(
                addDoc(collection(db, 'notifications'), {
                    toUid,
                    fromUid,
                    fromName: senderName,
                    avatar: senderAvatar,
                    type: 'friend_request',
                    title: 'Friend Request',
                    body: `${senderName} sent you a friend request`,
                    requestId: requestRef.id,
                    read: false,
                    createdAt: now,
                })
            );

            // Dual-write: Supabase is source of truth for notification reads/listeners.
            NotificationService.insert({
                toUid,
                fromUid,
                fromName: senderName,
                avatar: senderAvatar,
                type: 'friend_request',
                title: 'Friend Request',
                body: `${senderName} sent you a friend request`,
                requestId: requestRef.id,
            }).catch((e) => console.warn('[FriendService] Supabase notification write failed:', e));

            console.log('[FriendService.sendFriendRequest] DONE: Document created.');
        } catch (err: unknown) {
            console.error('[FriendService.sendFriendRequest] FAILED at one of the steps. Error:', err);
            throw err;
        }
    }

    /**
     * Accept an incoming friend request.
     * Updates the request status and creates the friends doc.
     */
    static async acceptFriendRequest(
        requestId: string,
        fromUid: string,
        toUid: string
    ): Promise<void> {
        const now = Timestamp.now();
        const docId = friendDocId(fromUid, toUid);

        await Promise.all([
            withTimeout(
                updateDoc(doc(db, 'friendRequests', requestId), {
                    status: 'accepted',
                    updatedAt: now,
                })
            ),
            withTimeout(
                setDoc(doc(db, 'friends', docId), {
                    uids: [fromUid, toUid].sort(),
                    createdAt: now,
                })
            ),
        ]);
    }

    /**
     * Decline an incoming friend request.
     */
    static async declineFriendRequest(requestId: string): Promise<void> {
        await withTimeout(
            updateDoc(doc(db, 'friendRequests', requestId), {
                status: 'declined',
                updatedAt: Timestamp.now(),
            })
        );
    }

    /**
     * Remove an existing friend.
     * Deletes the friends doc and marks the original request as declined.
     */
    static async removeFriend(currentUid: string, friendUid: string): Promise<void> {
        const docId = friendDocId(currentUid, friendUid);
        await withTimeout(deleteDoc(doc(db, 'friends', docId)));

        // Best-effort: update original accepted request back to declined
        try {
            const requestsRef = collection(db, 'friendRequests');
            const [snap1, snap2] = await Promise.all([
                getDocs(fsQuery(requestsRef,
                    where('fromUid', '==', currentUid),
                    where('toUid', '==', friendUid),
                    where('status', '==', 'accepted')
                )),
                getDocs(fsQuery(requestsRef,
                    where('fromUid', '==', friendUid),
                    where('toUid', '==', currentUid),
                    where('status', '==', 'accepted')
                )),
            ]);
            const allDocs = [...snap1.docs, ...snap2.docs];
            await Promise.all(
                allDocs.map((d) =>
                    updateDoc(d.ref, { status: 'declined', updatedAt: Timestamp.now() })
                )
            );
        } catch (e) {
            console.warn('FriendService.removeFriend: could not update request status:', e);
        }
    }

    /**
     * Get all pending incoming requests for a user.
     */
    static async getIncomingRequests(uid: string): Promise<FriendRequest[]> {
        const snapshot = await withTimeout(
            getDocs(
                fsQuery(
                    collection(db, 'friendRequests'),
                    where('toUid', '==', uid),
                    where('status', '==', 'pending')
                )
            )
        );
        return snapshot.docs.map((d) => toFriendRequest(d.id, d.data() as Record<string, unknown>));
    }

    /**
     * Get all pending outgoing requests for a user.
     */
    static async getOutgoingRequests(uid: string): Promise<FriendRequest[]> {
        const snapshot = await withTimeout(
            getDocs(
                fsQuery(
                    collection(db, 'friendRequests'),
                    where('fromUid', '==', uid),
                    where('status', '==', 'pending')
                )
            )
        );
        return snapshot.docs.map((d) => toFriendRequest(d.id, d.data() as Record<string, unknown>));
    }

    /**
     * Get the full User profiles for all friends of a given user.
     */
    static async getFriends(uid: string): Promise<User[]> {
        const snapshot = await withTimeout(
            getDocs(
                fsQuery(
                    collection(db, 'friends'),
                    where('uids', 'array-contains', uid)
                )
            )
        );

        if (snapshot.empty) return [];

        const friends = snapshot.docs.map((d) => toFriend(d.id, d.data() as Record<string, unknown>));
        const friendUids = friends
            .map((f) => f.uids.find((u) => u !== uid))
            .filter((u): u is string => !!u);

        const profiles = await Promise.all(
            friendUids.map(async (friendUid) => {
                try {
                    const docSnap = await withTimeout(getDoc(doc(db, 'users', friendUid)));
                    if (!docSnap.exists()) return null;
                    return { ...(docSnap.data() as User), uid: docSnap.id };
                } catch {
                    return null;
                }
            })
        );

        return profiles.filter((p): p is User => p !== null);
    }

    /**
     * Returns just the UIDs of all friends for a user.
     * Faster than getFriends() — no user profile lookups.
     */
    static async getFriendUids(currentUid: string): Promise<string[]> {
        try {
            const snapshot = await withTimeout(
                getDocs(
                    fsQuery(
                        collection(db, 'friends'),
                        where('uids', 'array-contains', currentUid)
                    )
                )
            );
            return snapshot.docs.flatMap((d) => {
                const uids = ((d.data() as { uids: string[] }).uids) ?? [];
                return uids.filter((u: string) => u !== currentUid);
            });
        } catch {
            return [];
        }
    }

    /**
     * Returns the current relationship status between two users.
     */
    static async getRequestStatus(
        currentUid: string,
        targetUid: string
    ): Promise<RelationshipStatus> {
        try {
            const [friendSnap, sentSnap, receivedSnap] = await Promise.all([
                withTimeout(getDoc(doc(db, 'friends', friendDocId(currentUid, targetUid)))),
                withTimeout(
                    getDocs(fsQuery(
                        collection(db, 'friendRequests'),
                        where('fromUid', '==', currentUid),
                        where('toUid', '==', targetUid),
                        where('status', '==', 'pending')
                    ))
                ),
                withTimeout(
                    getDocs(fsQuery(
                        collection(db, 'friendRequests'),
                        where('fromUid', '==', targetUid),
                        where('toUid', '==', currentUid),
                        where('status', '==', 'pending')
                    ))
                ),
            ]);

            if (friendSnap.exists()) return 'friends';
            if (!sentSnap.empty) return 'pending_sent';
            if (!receivedSnap.empty) return 'pending_received';
            return 'none';
        } catch {
            return 'none';
        }
    }
}
