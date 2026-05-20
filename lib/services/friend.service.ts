import { User } from '../models/User';
import { FriendRequest, Friend, RelationshipStatus } from '../models/Friend';
import { NotificationService } from './notification.service';

// ── Timeout wrapper ────────────────────────────────────────────────────────
const withTimeout = <T>(promise: Promise<T>, ms: number = 5000): Promise<T> => {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error('Request timed out')), ms)
        ),
    ]);
};

// ── Helpers ────────────────────────────────────────────────────────────────

/** Returns the canonical friends doc ID for any two uids (sorted alphabetically) */
function friendDocId(uid1: string, uid2: string): string {
    return [uid1, uid2].sort().join('_');
}

// ── Service ─────────────────────────────────────────────────────────────────

export class FriendService {
    static async searchUsers(searchQuery: string, currentUid: string): Promise<User[]> {
        if (!searchQuery.trim()) return [];
        return [];
    }

    /**
     * Send a friend request from fromUid to toUid.
     */
    static async sendFriendRequest(fromUid: string, toUid: string): Promise<void> {
        // Dual-write: Supabase is source of truth for notification reads/listeners.
        NotificationService.insert({
            toUid,
            fromUid,
            fromName: fromUid,
            avatar: null,
            type: 'friend_request',
            title: 'Friend Request',
            body: `Someone sent you a friend request`,
            requestId: '',
        }).catch((e) => console.warn('[FriendService] Supabase notification write failed:', e));
    }

    /**
     * Accept an incoming friend request.
     */
    static async acceptFriendRequest(
        requestId: string,
        fromUid: string,
        toUid: string
    ): Promise<void> {}

    /**
     * Decline an incoming friend request.
     */
    static async declineFriendRequest(requestId: string): Promise<void> {}

    /**
     * Remove an existing friend.
     */
    static async removeFriend(currentUid: string, friendUid: string): Promise<void> {}

    /**
     * Get all pending incoming requests for a user.
     */
    static async getIncomingRequests(uid: string): Promise<FriendRequest[]> {
        return [];
    }

    /**
     * Get all pending outgoing requests for a user.
     */
    static async getOutgoingRequests(uid: string): Promise<FriendRequest[]> {
        return [];
    }

    /**
     * Get the full User profiles for all friends of a given user.
     */
    static async getFriends(uid: string): Promise<User[]> {
        return [];
    }

    /**
     * Returns just the UIDs of all friends for a user.
     */
    static async getFriendUids(currentUid: string): Promise<string[]> {
        return [];
    }

    /**
     * Returns the current relationship status between two users.
     */
    static async getRequestStatus(
        currentUid: string,
        targetUid: string
    ): Promise<RelationshipStatus> {
        return 'none';
    }
}
