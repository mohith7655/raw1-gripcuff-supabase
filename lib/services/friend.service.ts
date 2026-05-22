import { supabase } from '../core/config/supabase';
import { User } from '../models/User';
import { FriendRequest, Friend, RelationshipStatus } from '../models/Friend';
import { NotificationService } from './notification.service';

// ── Row → Model helpers ────────────────────────────────────────────────────────

const toAppUser = (row: any): User => ({
    uid: row.id,
    email: row.email || '',
    fullName: row.full_name || 'User',
    username: row.username || (row.email ? String(row.email).split('@')[0] : 'user'),
    profileImageUrl: row.avatar_url || undefined,
    phone: row.phone || undefined,
    dateOfBirth: row.date_of_birth || undefined,
    gender: row.gender || undefined,
    age: row.age != null ? Number(row.age) : undefined,
    completedVideos: Number(row.completed_videos ?? 0),
    totalVideos: Number(row.total_videos ?? 0),
    credits: Number(row.credits ?? 0),
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    currentStreak: Number(row.current_streak ?? 0),
    bestStreak: Number(row.best_streak ?? 0),
    lastWorkoutDate: row.last_workout_date || null,
    weeklyActivity: typeof row.weekly_activity === 'string'
        ? JSON.parse(row.weekly_activity)
        : (row.weekly_activity || {}),
    completedWorkouts: Number(row.completed_workouts ?? 0),
    watchedMinutes: Number(row.watched_minutes ?? 0),
    totalLiveSessions: Number(row.total_live_sessions ?? 0),
});

const toFriendRequest = (row: any): FriendRequest => ({
    id: row.id,
    fromUid: row.sender_id,
    toUid: row.receiver_id,
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at ?? row.created_at),
});

// ── Service ────────────────────────────────────────────────────────────────────

export class FriendService {

    /**
     * Search users by email or username (case-insensitive partial match).
     * Excludes the current user from results.
     */
    static async searchUsers(searchQuery: string, currentUid: string): Promise<User[]> {
        if (!searchQuery.trim()) return [];
        const normalized = searchQuery.toLowerCase().trim();
        console.log('[Friends] searching:', normalized);

        const { data, error } = await supabase
            .from('users')
            .select('*')
            .or(`email.ilike.%${normalized}%,username.ilike.%${normalized}%`)
            .neq('id', currentUid)
            .limit(20);

        if (error) {
            console.warn('[Friends] searchUsers error:', error.message);
            return [];
        }

        const results = (data ?? []).map(toAppUser);
        console.log('[Friends] results:', results.length);
        return results;
    }

    /**
     * Send a friend request from fromUid to toUid.
     * No-ops if a request already exists in either direction.
     */
    static async sendFriendRequest(fromUid: string, toUid: string): Promise<void> {
        // Check for existing friendship first
        const [fa, fb] = [fromUid, toUid].sort();
        const { data: existingFriendship } = await supabase
            .from('friendships')
            .select('id')
            .eq('user_a', fa)
            .eq('user_b', fb)
            .maybeSingle();

        if (existingFriendship) {
            console.log('[Friends] already friends — skipping request');
            return;
        }

        // Check for existing request in either direction (use limit(1) since OR can return 2 rows)
        const { data: existingReqs, error: checkErr } = await supabase
            .from('friend_requests')
            .select('id')
            .or(
                `and(sender_id.eq.${fromUid},receiver_id.eq.${toUid}),` +
                `and(sender_id.eq.${toUid},receiver_id.eq.${fromUid})`
            )
            .limit(1);

        if (checkErr) console.error('[Friends Error] duplicate check failed:', checkErr.message);

        if (existingReqs && existingReqs.length > 0) {
            console.log('[Friends] request already exists — skipping');
            return;
        }

        const { error } = await supabase
            .from('friend_requests')
            .insert({ sender_id: fromUid, receiver_id: toUid, status: 'pending' });

        if (error) throw new Error(error.message);
        console.log('[Friends] request sent');

        // Fetch sender's display name for the notification (best-effort, don't block)
        supabase
            .from('users')
            .select('full_name, username')
            .eq('id', fromUid)
            .maybeSingle()
            .then(({ data: sender }) => {
                const fromName = sender?.full_name || sender?.username || 'Someone';
                NotificationService.insert({
                    toUid,
                    fromUid,
                    fromName,
                    type: 'friend_request',
                    title: 'Friend Request',
                    body: `${fromName} sent you a friend request`,
                }).catch((e) => console.warn('[Friends] notification write failed:', e));
            });
    }

    /**
     * Accept an incoming friend request and create a friendship row.
     */
    static async acceptFriendRequest(
        requestId: string,
        fromUid: string,
        toUid: string,
    ): Promise<void> {
        const { error: updateErr } = await supabase
            .from('friend_requests')
            .update({ status: 'accepted' })
            .eq('id', requestId);

        if (updateErr) throw new Error(updateErr.message);

        // Create canonical friendship (user_a < user_b alphabetically to avoid duplicates)
        const [user_a, user_b] = [fromUid, toUid].sort();
        const { error: friendErr } = await supabase
            .from('friendships')
            .upsert({ user_a, user_b }, { onConflict: 'user_a,user_b' });

        if (friendErr) throw new Error(friendErr.message);
        console.log('[Friends] request accepted');
    }

    /**
     * Decline (delete) an incoming friend request.
     */
    static async declineFriendRequest(requestId: string): Promise<void> {
        const { error } = await supabase
            .from('friend_requests')
            .delete()
            .eq('id', requestId);

        if (error) throw new Error(error.message);
    }

    /**
     * Remove an existing friendship and clean up any request rows.
     */
    static async removeFriend(currentUid: string, friendUid: string): Promise<void> {
        const [user_a, user_b] = [currentUid, friendUid].sort();

        const { error } = await supabase
            .from('friendships')
            .delete()
            .eq('user_a', user_a)
            .eq('user_b', user_b);

        if (error) throw new Error(error.message);

        // Clean up any accepted request rows too
        await supabase
            .from('friend_requests')
            .delete()
            .or(
                `and(sender_id.eq.${currentUid},receiver_id.eq.${friendUid}),` +
                `and(sender_id.eq.${friendUid},receiver_id.eq.${currentUid})`
            );
    }

    /** Pending incoming requests for a user. */
    static async getIncomingRequests(uid: string): Promise<FriendRequest[]> {
        const { data, error } = await supabase
            .from('friend_requests')
            .select('*')
            .eq('receiver_id', uid)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) {
            console.warn('[Friends] getIncomingRequests error:', error.message);
            return [];
        }
        return (data ?? []).map(toFriendRequest);
    }

    /** Pending outgoing requests for a user. */
    static async getOutgoingRequests(uid: string): Promise<FriendRequest[]> {
        const { data, error } = await supabase
            .from('friend_requests')
            .select('*')
            .eq('sender_id', uid)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) {
            console.warn('[Friends] getOutgoingRequests error:', error.message);
            return [];
        }
        return (data ?? []).map(toFriendRequest);
    }

    /** Full User profiles for all friends of a given user. */
    static async getFriends(uid: string): Promise<User[]> {
        const friendUids = await FriendService.getFriendUids(uid);
        if (friendUids.length === 0) return [];

        const { data, error } = await supabase
            .from('users')
            .select('*')
            .in('id', friendUids);

        if (error) {
            console.warn('[Friends] getFriends error:', error.message);
            return [];
        }
        return (data ?? []).map(toAppUser);
    }

    /** Just the UIDs of all friends for a user. */
    static async getFriendUids(currentUid: string): Promise<string[]> {
        const { data, error } = await supabase
            .from('friendships')
            .select('user_a, user_b')
            .or(`user_a.eq.${currentUid},user_b.eq.${currentUid}`);

        if (error) {
            console.warn('[Friends] getFriendUids error:', error.message);
            return [];
        }
        return (data ?? []).map((row) =>
            row.user_a === currentUid ? row.user_b : row.user_a
        );
    }

    /** Current relationship status between two users. */
    static async getRequestStatus(
        currentUid: string,
        targetUid: string,
    ): Promise<RelationshipStatus> {
        // Check friendship first
        const [user_a, user_b] = [currentUid, targetUid].sort();
        const { data: friendship } = await supabase
            .from('friendships')
            .select('id')
            .eq('user_a', user_a)
            .eq('user_b', user_b)
            .maybeSingle();

        if (friendship) return 'friends';

        // Check pending requests in both directions
        const { data: sent } = await supabase
            .from('friend_requests')
            .select('id')
            .eq('sender_id', currentUid)
            .eq('receiver_id', targetUid)
            .eq('status', 'pending')
            .maybeSingle();

        if (sent) return 'pending_sent';

        const { data: received } = await supabase
            .from('friend_requests')
            .select('id')
            .eq('sender_id', targetUid)
            .eq('receiver_id', currentUid)
            .eq('status', 'pending')
            .maybeSingle();

        if (received) return 'pending_received';

        return 'none';
    }

    /**
     * Subscribe to realtime changes on friend_requests for a given user.
     * Calls onUpdate whenever a row is inserted, updated, or deleted.
     * Returns an unsubscribe function.
     */
    static subscribeToRequests(uid: string, onUpdate: () => void): () => void {
        const channel = supabase
            .channel(`friend-requests-${uid}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'friend_requests' },
                (payload) => {
                    const row = (payload.new ?? payload.old) as any;
                    if (row?.sender_id === uid || row?.receiver_id === uid) {
                        console.log('[Friends] realtime — refreshing for uid', uid);
                        onUpdate();
                    }
                },
            )
            .subscribe((status, err) => {
                if (err) console.error('[Realtime Error] friend_requests subscription:', err);
                else console.log('[Friends] realtime subscribed, status:', status);
            });

        return () => {
            console.log('[Friends] realtime cleaned up for uid', uid);
            supabase.removeChannel(channel);
        };
    }
}
