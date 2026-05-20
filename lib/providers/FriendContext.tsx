import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FriendService } from '../services/friend.service';
import { FriendRequest } from '../models/Friend';
import { User } from '../models/User';
import { useAuth } from './AuthContext';

interface FriendContextType {
    friends: User[];
    incomingRequests: FriendRequest[];
    outgoingRequests: FriendRequest[];
    loading: boolean;
    error: string | null;
    searchResults: User[];
    searching: boolean;
    sendRequest: (toUid: string) => Promise<void>;
    acceptRequest: (requestId: string, fromUid: string, toUid: string) => Promise<void>;
    declineRequest: (requestId: string) => Promise<void>;
    removeFriend: (friendUid: string) => Promise<void>;
    searchUsers: (query: string) => void;
    clearSearch: () => void;
    refreshFriends: () => Promise<void>;
    clearError: () => void;
}

const FriendContext = createContext<FriendContextType | undefined>(undefined);

export function FriendProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();

    const [friends, setFriends] = useState<User[]>([]);
    const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
    const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [searching, setSearching] = useState(false);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const loadAll = useCallback(async (uid: string) => {
        try {
            setLoading(true);
            setError(null);
            const [f, inc, out] = await Promise.all([
                FriendService.getFriends(uid),
                FriendService.getIncomingRequests(uid),
                FriendService.getOutgoingRequests(uid),
            ]);
            setFriends(f);
            setIncomingRequests(inc);
            setOutgoingRequests(out);
        } catch (err) {
            const msg = (err as Error).message;
            if (!msg.includes('timed out')) setError(msg);
        } finally {
            setLoading(false);
        }
    }, []);

    // Re-fetch + realtime subscription whenever the signed-in user changes
    useEffect(() => {
        if (!user?.uid) {
            setFriends([]);
            setIncomingRequests([]);
            setOutgoingRequests([]);
            return;
        }

        loadAll(user.uid);

        const unsub = FriendService.subscribeToRequests(user.uid, () => {
            loadAll(user.uid);
        });

        return unsub;
    }, [user?.uid, loadAll]);

    const sendRequest = async (toUid: string) => {
        console.log('[FriendContext] sendRequest triggered for toUid:', toUid);
        if (!user?.uid) {
            console.warn('[FriendContext] sendRequest aborted: no user.uid');
            return;
        }
        try {
            setError(null);
            console.log('[FriendContext] Calling FriendService.sendFriendRequest...');
            await FriendService.sendFriendRequest(user.uid, toUid);
            console.log('[FriendContext] FriendService returned success. Reloading all data...');
            await loadAll(user.uid);
            console.log('[FriendContext] loadAll finished.');
        } catch (err) {
            const msg = (err as Error).message;
            console.error('[FriendContext] sendRequest error:', msg);
            setError(msg);
            throw err;
        }
    };

    const acceptRequest = async (requestId: string, fromUid: string, toUid: string) => {
        if (!user?.uid) return;
        try {
            setError(null);
            await FriendService.acceptFriendRequest(requestId, fromUid, toUid);
            await loadAll(user.uid);
        } catch (err) {
            const msg = (err as Error).message;
            setError(msg);
            throw err;
        }
    };

    const declineRequest = async (requestId: string) => {
        if (!user?.uid) return;
        try {
            setError(null);
            await FriendService.declineFriendRequest(requestId);
            await loadAll(user.uid);
        } catch (err) {
            const msg = (err as Error).message;
            setError(msg);
            throw err;
        }
    };

    const removeFriend = async (friendUid: string) => {
        if (!user?.uid) return;
        try {
            setError(null);
            await FriendService.removeFriend(user.uid, friendUid);
            await loadAll(user.uid);
        } catch (err) {
            const msg = (err as Error).message;
            setError(msg);
            throw err;
        }
    };

    const searchUsers = useCallback((query: string) => {
        if (!user?.uid) return;

        if (!query.trim()) {
            setSearchResults([]);
            return;
        }

        // Debounce: cancel any in-flight timer before starting a new one
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

        setSearching(true);
        searchTimerRef.current = setTimeout(async () => {
            try {
                const results = await FriendService.searchUsers(query, user.uid);
                setSearchResults(results);
            } catch (err) {
                console.warn('[FriendContext] searchUsers error:', err);
                setSearchResults([]);
            } finally {
                setSearching(false);
            }
        }, 400);
    }, [user?.uid]);

    const clearSearch = () => setSearchResults([]);

    const refreshFriends = async () => {
        if (user?.uid) await loadAll(user.uid);
    };

    const clearError = () => setError(null);

    return (
        <FriendContext.Provider
            value={{
                friends,
                incomingRequests,
                outgoingRequests,
                loading,
                error,
                searchResults,
                searching,
                sendRequest,
                acceptRequest,
                declineRequest,
                removeFriend,
                searchUsers,
                clearSearch,
                refreshFriends,
                clearError,
            }}
        >
            {children}
        </FriendContext.Provider>
    );
}

export function useFriend() {
    const ctx = useContext(FriendContext);
    if (!ctx) throw new Error('useFriend must be used within FriendProvider');
    return ctx;
}
