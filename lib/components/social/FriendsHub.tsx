import React, { useEffect, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
    ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useProfilePreview } from '../../providers/ProfilePreviewProvider';
import {
    Search, UserPlus, UserCheck, UserX, Clock, MessageCircle, Flame, Dumbbell,
} from 'lucide-react-native';
import { TierAvatar } from '../profile/TierAvatar';
import { useFriend } from '../../providers/FriendContext';
import { useAuth } from '../../providers/AuthContext';
import { FriendService } from '../../services/friend.service';
import { SocialProfileService } from '../../services/socialProfile.service';
import { RelationshipStatus } from '../../models/Friend';
import { User } from '../../models/User';
import { supabase } from '../../core/config/supabase';

const ORANGE = '#4C4E78';
const MUTED = '#7A7C90';
const GREEN = '#22C55E';
const DANGER = '#EF4444';

type Suggestion = {
    id: string;
    fullName: string;
    username: string;
    avatarUrl: string | null;
    currentStreak: number;
    completedWorkouts: number;
};

/** Friends + Requests + Suggestions, all in one scroll for the Social → Friends tab. */
export function FriendsHub() {
    const navigation = useNavigation<any>();
    const preview = useProfilePreview();
    const { user, supabaseUserId } = useAuth();
    const {
        friends, incomingRequests, outgoingRequests,
        acceptRequest, declineRequest, sendRequest,
        searchUsers, searchResults, searching, clearSearch,
    } = useFriend();

    const [query, setQuery] = useState('');
    const [statusMap, setStatusMap] = useState<Record<string, RelationshipStatus>>({});
    const [busyUid, setBusyUid] = useState<string | null>(null);
    const [actionReq, setActionReq] = useState<string | null>(null);
    const [senders, setSenders] = useState<Record<string, User>>({});
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [sentUids, setSentUids] = useState<Set<string>>(new Set());

    // ── Fetch profiles for incoming request senders ──
    useEffect(() => {
        const uids = [...new Set(incomingRequests.map(r => r.fromUid))];
        if (uids.length === 0) { setSenders({}); return; }
        supabase.from('users').select('*').in('id', uids).then(({ data }) => {
            const map: Record<string, User> = {};
            (data ?? []).forEach((row: any) => {
                map[row.id] = {
                    uid: row.id, email: row.email || '', fullName: row.full_name || 'User',
                    username: row.username || '', profileImageUrl: row.avatar_url || undefined,
                    completedVideos: 0, totalVideos: 0, credits: 0, createdAt: new Date(), updatedAt: new Date(),
                };
            });
            setSenders(map);
        });
    }, [incomingRequests]);

    // ── Load "people you may know" suggestions ──
    useEffect(() => {
        if (!supabaseUserId) return;
        const exclude = [
            ...friends.map(f => f.uid),
            ...incomingRequests.map(r => r.fromUid),
            ...outgoingRequests.map(r => r.toUid),
        ];
        SocialProfileService.getSuggestions(supabaseUserId, exclude, 12)
            .then((rows) => setSuggestions(rows as Suggestion[]))
            .catch(() => {});
    }, [supabaseUserId, friends, incomingRequests, outgoingRequests]);

    // ── Resolve relationship status for search results ──
    useEffect(() => {
        if (!user?.uid || searchResults.length === 0) return;
        Promise.all(searchResults.map(async r => ({ uid: r.uid, status: await FriendService.getRequestStatus(user.uid, r.uid) })))
            .then(entries => {
                const map: Record<string, RelationshipStatus> = {};
                entries.forEach(({ uid, status }) => { map[uid] = status; });
                setStatusMap(map);
            });
    }, [searchResults, user?.uid]);

    const onQuery = (t: string) => {
        setQuery(t);
        if (!t.trim()) { clearSearch(); return; }
        searchUsers(t.trim());
    };

    const handleAdd = async (uid: string) => {
        setBusyUid(uid);
        try {
            await sendRequest(uid);
            setSentUids(p => new Set(p).add(uid));
            setStatusMap(p => ({ ...p, [uid]: 'pending_sent' }));
        } catch (e: any) { Alert.alert('Error', e.message); }
        finally { setBusyUid(null); }
    };

    const handleAccept = async (id: string, fromUid: string, toUid: string) => {
        setActionReq(id);
        try { await acceptRequest(id, fromUid, toUid); }
        catch (e: any) { Alert.alert('Error', e.message); }
        finally { setActionReq(null); }
    };
    const handleDecline = async (id: string) => {
        setActionReq(id);
        try { await declineRequest(id); }
        catch (e: any) { Alert.alert('Error', e.message); }
        finally { setActionReq(null); }
    };

    const goProfile = (uid: string) =>
        preview ? preview.open({ uid }) : navigation.navigate('SocialProfileScreen', { uid });
    const goChat = (f: User) => navigation.navigate('ChatRoom', {
        friendUid: f.uid, friendName: f.fullName || f.username, friendAvatar: f.profileImageUrl,
    });

    const filteredFriends = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return friends;
        return friends.filter(f => f.fullName?.toLowerCase().includes(q) || f.username?.toLowerCase().includes(q));
    }, [friends, query]);

    const showingSearch = query.trim().length > 0 && searchResults.length > 0;

    return (
        <ScrollView
            contentContainerStyle={s.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
        >
            {/* Search */}
            <View style={s.searchBar}>
                <Search size={16} color={MUTED} />
                <TextInput
                    style={s.searchInput}
                    value={query}
                    onChangeText={onQuery}
                    placeholder="Search people or friends…"
                    placeholderTextColor="#D8D8E4"
                    autoCapitalize="none"
                    returnKeyType="search"
                />
                {query.length > 0 && (
                    <TouchableOpacity onPress={() => onQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={{ color: MUTED, fontSize: 18 }}>×</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Search results */}
            {searching && <ActivityIndicator color={ORANGE} style={{ marginTop: 16 }} />}
            {showingSearch && (
                <View style={s.section}>
                    <Text style={s.sectionTitle}>Search Results</Text>
                    {searchResults.map(item => {
                        const status = statusMap[item.uid] ?? 'none';
                        const busy = busyUid === item.uid;
                        return (
                            <View key={item.uid} style={s.row}>
                                <TouchableOpacity style={s.rowLeft} activeOpacity={0.8} onPress={() => goProfile(item.uid)}>
                                    <TierAvatar uri={item.profileImageUrl} size={42} uid={item.uid} name={item.fullName} radius={11} disableProfileLink />
                                    <View style={s.rowInfo}>
                                        <Text style={s.rowName} numberOfLines={1}>@{item.username}</Text>
                                        <Text style={s.rowSub} numberOfLines={1}>{item.fullName}</Text>
                                    </View>
                                </TouchableOpacity>
                                {busy ? <ActivityIndicator color={ORANGE} size="small" />
                                    : status === 'friends' ? <View style={s.pill}><UserCheck size={13} color={GREEN} /><Text style={[s.pillText, { color: GREEN }]}>Friends</Text></View>
                                    : status === 'pending_sent' ? <View style={s.pill}><Clock size={12} color={ORANGE} /><Text style={[s.pillText, { color: ORANGE }]}>Sent</Text></View>
                                    : <TouchableOpacity style={s.addBtn} onPress={() => handleAdd(item.uid)} activeOpacity={0.8}><UserPlus size={13} color="#fff" /><Text style={s.addBtnText}>Add</Text></TouchableOpacity>}
                            </View>
                        );
                    })}
                </View>
            )}

            {/* Requests */}
            {incomingRequests.length > 0 && (
                <View style={s.section}>
                    <Text style={s.sectionTitle}>Requests · <Text style={{ color: ORANGE }}>{incomingRequests.length}</Text></Text>
                    {incomingRequests.map(req => {
                        const sender = senders[req.fromUid];
                        const busy = actionReq === req.id;
                        return (
                            <View key={req.id} style={s.row}>
                                <TouchableOpacity style={s.rowLeft} activeOpacity={0.8} onPress={() => goProfile(req.fromUid)}>
                                    <TierAvatar uri={sender?.profileImageUrl} size={44} uid={req.fromUid} name={sender?.fullName} radius={11} disableProfileLink />
                                    <View style={s.rowInfo}>
                                        <Text style={s.rowName} numberOfLines={1}>@{sender?.username ?? req.fromUid.slice(0, 8)}</Text>
                                        <Text style={s.rowSub} numberOfLines={1}>{sender?.fullName ?? 'New request'}</Text>
                                    </View>
                                </TouchableOpacity>
                                {busy ? <ActivityIndicator color={ORANGE} size="small" /> : (
                                    <View style={s.rowActions}>
                                        <TouchableOpacity style={s.addBtn} onPress={() => handleAccept(req.id, req.fromUid, req.toUid)} activeOpacity={0.8}>
                                            <UserCheck size={13} color="#fff" /><Text style={s.addBtnText}>Accept</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={s.declineBtn} onPress={() => handleDecline(req.id)} activeOpacity={0.8}>
                                            <UserX size={15} color={DANGER} />
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </View>
            )}

            {/* Suggestions */}
            {suggestions.length > 0 && (
                <View style={s.section}>
                    <Text style={s.sectionTitle}>People You May Know</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 2 }}>
                        {suggestions.map(sug => {
                            const sent = sentUids.has(sug.uid);
                            const busy = busyUid === sug.uid;
                            return (
                                <View key={sug.uid} style={s.suggCard}>
                                    <TouchableOpacity activeOpacity={0.85} onPress={() => goProfile(sug.uid)} style={{ alignItems: 'center' }}>
                                        <TierAvatar uri={sug.avatarUrl} size={60} uid={sug.uid} name={sug.fullName} radius={16} disableProfileLink />
                                        <Text style={s.suggName} numberOfLines={1}>@{sug.username}</Text>
                                        <Text style={s.suggSub} numberOfLines={1}>{sug.fullName}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[s.suggBtn, sent && s.suggBtnSent]}
                                        onPress={() => !sent && handleAdd(sug.uid)}
                                        disabled={sent || busy}
                                        activeOpacity={0.85}
                                    >
                                        {busy ? <ActivityIndicator color="#211832" size="small" />
                                            : sent ? <><Clock size={12} color={ORANGE} /><Text style={[s.suggBtnText, { color: ORANGE }]}>Sent</Text></>
                                            : <><UserPlus size={13} color="#fff" /><Text style={s.suggBtnText}>Add</Text></>}
                                    </TouchableOpacity>
                                </View>
                            );
                        })}
                    </ScrollView>
                </View>
            )}

            {/* Friends */}
            <View style={s.section}>
                <Text style={s.sectionTitle}>
                    Your Friends{friends.length > 0 ? <Text style={{ color: MUTED }}>  ·  {friends.length}</Text> : null}
                </Text>
                {filteredFriends.length === 0 ? (
                    <View style={s.empty}>
                        <Dumbbell color={MUTED} size={26} />
                        <Text style={s.emptyText}>{query ? 'No matching friends' : 'No friends yet — add some above!'}</Text>
                    </View>
                ) : filteredFriends.map(f => (
                    <View key={f.uid} style={s.row}>
                        <TouchableOpacity style={s.rowLeft} activeOpacity={0.8} onPress={() => goProfile(f.uid)}>
                            <TierAvatar uri={f.profileImageUrl} size={44} uid={f.uid} name={f.fullName} radius={11} disableProfileLink />
                            <View style={s.rowInfo}>
                                <Text style={s.rowName} numberOfLines={1}>@{f.username}</Text>
                                <View style={s.metaRow}>
                                    <Text style={s.rowSub} numberOfLines={1}>{f.fullName || f.username}</Text>
                                    {(f.currentStreak ?? 0) > 0 && (
                                        <View style={s.streak}>
                                            <Flame size={11} color={ORANGE} />
                                            <Text style={s.streakText}>{f.currentStreak}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.msgBtn} onPress={() => goChat(f)} activeOpacity={0.8}>
                            <MessageCircle size={18} color={ORANGE} />
                        </TouchableOpacity>
                    </View>
                ))}
            </View>
        </ScrollView>
    );
}

const s = StyleSheet.create({
    content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 120, gap: 18 },
    searchBar: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1, borderColor: 'rgba(33,24,50,0.08)',
        borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    },
    searchInput: { flex: 1, color: '#211832', fontSize: 14, padding: 0 },
    section: { gap: 10 },
    sectionTitle: { color: '#211832', fontSize: 16, fontWeight: '800' },
    row: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#EEEEF2', borderRadius: 14, padding: 12,
        borderWidth: 1, borderColor: 'rgba(33,24,50,0.05)',
    },
    rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    rowInfo: { flex: 1 },
    rowName: { color: '#211832', fontSize: 14, fontWeight: '700' },
    rowSub: { color: MUTED, fontSize: 12, marginTop: 2 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
    streak: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    streakText: { color: ORANGE, fontSize: 11, fontWeight: '700' },
    rowActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    addBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: '#211832', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8,
    },
    addBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    declineBtn: {
        width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
    },
    msgBtn: {
        width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(76,78,120,0.1)', borderWidth: 1, borderColor: 'rgba(76,78,120,0.2)',
    },
    pill: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7,
        borderWidth: 1, borderColor: 'rgba(33,24,50,0.12)',
    },
    pillText: { fontSize: 12, fontWeight: '700' },
    suggCard: {
        width: 130, alignItems: 'center', gap: 4,
        backgroundColor: '#EEEEF2', borderRadius: 16, padding: 14,
        borderWidth: 1, borderColor: 'rgba(33,24,50,0.05)',
    },
    suggName: { color: '#211832', fontSize: 13, fontWeight: '700', marginTop: 8, maxWidth: 110, textAlign: 'center' },
    suggSub: { color: MUTED, fontSize: 11, maxWidth: 110, textAlign: 'center' },
    suggBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
        backgroundColor: '#211832', borderRadius: 18, paddingVertical: 7, paddingHorizontal: 16, marginTop: 8, alignSelf: 'stretch',
    },
    suggBtnSent: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(33,24,50,0.2)' },
    suggBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    empty: { alignItems: 'center', gap: 8, paddingVertical: 24 },
    emptyText: { color: MUTED, fontSize: 13 },
});
