/**
 * FriendsScreen (v2)
 *
 * Three tabs: Friends · Requests · Suggestions
 * Suggestions tab surfaces open-to-connect users not yet connected.
 * Pull-to-refresh, search, real-time presence dots, friend actions.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    FlatList,
    Image,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AmbientBackground } from '../components/theme';
import { useNavigation } from '@react-navigation/native';
import {
    ArrowLeft,
    Search, UserPlus, UserCheck, UserX, Clock,
    MessageCircle, Dumbbell, ChevronRight,
    Flame, Users,
} from 'lucide-react-native';
import { useFriend } from '../providers/FriendContext';
import { useAuth } from '../providers/AuthContext';
import { FriendService } from '../services/friend.service';
import { SocialProfileService } from '../services/socialProfile.service';
import { RelationshipStatus } from '../models/Friend';
import { User } from '../models/User';
import { AppTheme } from '../core/theme/app_theme';
import { TierAvatar } from '../components/profile/TierAvatar';
import { ThermometerHeat } from '../components/profile/ThermometerHeat';
import { useProfilePreview } from '../providers/ProfilePreviewProvider';
import { genderMeta as genderMetaOf, appActiveLabel, computeHeats, ActivityHeats } from '../utils/activityHeat';
import { loadActivityMap } from '../services/activityMap.service';

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
    bg:          '#EEEEF2',
    // Glass UI — translucent card/input fills + luminous white border that read as
    // frosted glass over the <AmbientBackground> mesh.
    bgCard:      'rgba(255,255,255,0.62)',
    bgInput:     'rgba(255,255,255,0.62)',
    accent:      '#4C4E78',
    accentSoft:  'rgba(76,78,120,0.08)',
    accentBorder:'rgba(76,78,120,0.18)',
    green:       '#22C55E',
    greenSoft:   'rgba(34,197,94,0.1)',
    text:        '#211832',
    textMuted:   '#7A7C90',
    textDim:     '#B8B9CC',
    border:      'rgba(255,255,255,0.9)',
    danger:      '#EF4444',
    dangerSoft:  'rgba(239,68,68,0.1)',
};

type TabId = 'friends' | 'requests' | 'suggestions';

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({
    uri, size = 48, online = false, uid, name, lastActiveAt,
}: { uri?: string | null; size?: number; online?: boolean; uid?: string | null; name?: string | null; lastActiveAt?: string | null }) {
    // Mirror the ring padding so the presence dot sits on the avatar's corner.
    const STROKE = Math.max(2, Math.min(5, Math.round(size * 0.042)));
    const GAP    = Math.max(2, Math.min(6, Math.round(size * 0.052)));
    const pad    = GAP + STROKE;
    return (
        <View style={{ position: 'relative' }}>
            <TierAvatar uri={uri} size={size} uid={uid} name={name} showBadge={false} lastActiveAt={lastActiveAt} />
            {online && (
                <View style={{
                    position: 'absolute', bottom: pad - 1, right: pad - 1,
                    width: 12, height: 12, borderRadius: 6,
                    backgroundColor: C.green,
                    borderWidth: 2, borderColor: C.bg,
                    zIndex: 20,
                }} />
            )}
        </View>
    );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ emoji, title, body }: { emoji: string; title: string; body: string }) {
    return (
        <View style={s.empty}>
            <Text style={s.emptyEmoji}>{emoji}</Text>
            <Text style={s.emptyTitle}>{title}</Text>
            <Text style={s.emptyBody}>{body}</Text>
        </View>
    );
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

function TabBar({
    active, onChange, requestCount,
}: { active: TabId; onChange: (t: TabId) => void; requestCount: number }) {
    const tabs: { id: TabId; label: string; badge?: number }[] = [
        { id: 'friends',     label: 'Friends' },
        { id: 'requests',    label: 'Requests', badge: requestCount },
        { id: 'suggestions', label: 'Suggestions' },
    ];

    return (
        <View style={s.tabBar}>
            {tabs.map(tab => (
                <TouchableOpacity
                    key={tab.id}
                    style={[s.tab, active === tab.id && s.tabActive]}
                    onPress={() => onChange(tab.id)}
                    activeOpacity={0.7}
                >
                    <Text style={[s.tabText, active === tab.id && s.tabTextActive]}>
                        {tab.label}
                    </Text>
                    {tab.badge != null && tab.badge > 0 && (
                        <View style={s.tabBadge}>
                            <Text style={s.tabBadgeText}>{tab.badge}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            ))}
        </View>
    );
}

// ─── Friends tab ──────────────────────────────────────────────────────────────

function FriendsTab() {
    const navigation = useNavigation<any>();
    const { friends, loading, removeFriend } = useFriend();
    const { supabaseUserId } = useAuth();

    const [query,     setQuery]     = useState('');
    const [refreshing, setRefreshing] = useState(false);

    const filtered = query.trim()
        ? friends.filter(f =>
            f.fullName.toLowerCase().includes(query.toLowerCase()) ||
            f.username.toLowerCase().includes(query.toLowerCase())
          )
        : friends;

    const onRefresh = async () => {
        setRefreshing(true);
        // FriendContext reloads on its own mount; just wait briefly
        await new Promise(r => setTimeout(r, 800));
        setRefreshing(false);
    };

    const handleRemove = (f: User) => {
        const doIt = () => removeFriend(f.uid).catch((e: Error) => Alert.alert('Error', e.message));
        if (Platform.OS === 'web') {
            if ((window as any).confirm(`Remove ${f.fullName}?`)) doIt();
        } else {
            Alert.alert('Remove Friend', `Remove ${f.fullName} from your friends list?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: doIt },
            ]);
        }
    };

    if (loading) return <ActivityIndicator color={C.accent} style={{ marginTop: 60 }} />;

    return (
        <>
        <FlatList
            data={filtered}
            keyExtractor={i => i.uid}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, paddingTop: 8 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
                <View style={{ gap: 10, marginBottom: 12 }}>
                    {/* Search bar */}
                    <View style={s.searchBar}>
                        <Search size={16} color={C.textMuted} />
                        <TextInput
                            style={s.searchInput}
                            value={query}
                            onChangeText={setQuery}
                            placeholder="Search friends..."
                            placeholderTextColor={C.textDim}
                            autoCapitalize="none"
                        />
                    </View>

                    {friends.length > 0 && (
                        <Text style={s.listCount}>
                            {friends.length} {friends.length === 1 ? 'friend' : 'friends'}
                        </Text>
                    )}
                </View>
            }
            renderItem={({ item }) => (
                <FriendRow
                    user={item}
                    onProfile={() => navigation.navigate('SocialProfileScreen', { uid: item.uid })}
                    onMessage={() => navigation.navigate('ChatRoom', {
                        friendUid: item.uid,
                        friendName: item.fullName || item.username,
                        friendAvatar: item.profileImageUrl,
                    })}
                    onRemove={() => handleRemove(item)}
                />
            )}
            ListEmptyComponent={
                <EmptyState
                    emoji="👥"
                    title="No friends yet"
                    body="Discover people in the Suggestions tab and start connecting!"
                />
            }
        />
        </>
    );
}

// ─── Gender pill + activity status + heat chips (shared row content) ────────────
// Mirrors the Connections sheet on the profile screen.

function GenderPill({ gender }: { gender?: string | null }) {
    const gm = genderMetaOf(gender);
    if (!gm) return null;
    return (
        <View style={[s.genderPill, { backgroundColor: gm.bg, borderColor: gm.border }]}>
            <Text style={[s.genderIcon, { color: gm.color }]}>{gm.icon}</Text>
        </View>
    );
}

function ActivityStatus({ lastActiveAt }: { lastActiveAt?: string | null }) {
    const a = appActiveLabel(lastActiveAt);
    return (
        <View style={s.activityRow}>
            <View style={[s.activityDot, { backgroundColor: a.color }]} />
            <Text style={[s.activityText, { color: a.color }]}>{a.text}</Text>
        </View>
    );
}

// Hot/cold heat chips — social (connects) + workout, loaded lazily per user.
function HeatChips({ uid, workoutSessions }: { uid: string; workoutSessions?: number }) {
    const [heats, setHeats]       = useState<ActivityHeats | null>(null);
    const [connects, setConnects] = useState<number | null>(null);

    useEffect(() => {
        let alive = true;
        loadActivityMap(uid)
            .then(d => { if (alive) setHeats(computeHeats(d)); })
            .catch(() => {});
        FriendService.getFriendUids(uid)
            .then(uids => { if (alive) setConnects(uids.length); })
            .catch(() => {});
        return () => { alive = false; };
    }, [uid]);

    if (!heats) return null;
    return (
        <View style={s.heatRow}>
            <View style={s.heatChip}>
                <Users size={11} color={C.textMuted} strokeWidth={2.4} />
                <Text style={[s.heatCount, { color: C.textMuted }]}>{connects ?? 0}</Text>
                <ThermometerHeat heat={heats.social} size={13} color={C.textMuted} outline={C.textMuted} />
            </View>
            <View style={s.heatChip}>
                <Dumbbell size={11} color={C.textMuted} strokeWidth={2.4} />
                <Text style={[s.heatCount, { color: C.textMuted }]}>{workoutSessions ?? 0}</Text>
                <ThermometerHeat heat={heats.workout} size={13} color={C.textMuted} outline={C.textMuted} />
            </View>
        </View>
    );
}

// ─── Friend row ───────────────────────────────────────────────────────────────

function FriendRow({ user, onProfile, onMessage, onRemove }: {
    user: User;
    onProfile: () => void;
    onMessage: () => void;
    onRemove: () => void;
}) {
    // Consider "online" if last activity within 15 min (use updatedAt as proxy)
    const isOnline = user.updatedAt
        && (Date.now() - user.updatedAt.getTime()) < 15 * 60_000;

    return (
        <TouchableOpacity style={s.friendRow} onPress={onProfile} activeOpacity={0.8}>
            <Avatar uri={user.profileImageUrl} size={48} online={!!isOnline} uid={user.uid} name={user.fullName} lastActiveAt={user.lastActiveAt} />
            <View style={s.rowInfo}>
                <View style={s.nameRow}>
                    <Text style={s.rowName} numberOfLines={1}>{user.fullName || user.username || 'Athlete'}</Text>
                    <GenderPill gender={user.gender} />
                </View>
                {user.username ? <Text style={s.rowSub} numberOfLines={1}>@{user.username}</Text> : null}
                <ActivityStatus lastActiveAt={user.lastActiveAt} />
                <HeatChips uid={user.uid} workoutSessions={user.totalWatchSessions} />
            </View>
            <View style={s.rowActions}>
                <TouchableOpacity style={s.actionMsg} onPress={onMessage} activeOpacity={0.75}>
                    <MessageCircle size={16} color={C.accent} />
                </TouchableOpacity>
                <TouchableOpacity style={s.actionDanger} onPress={onRemove} activeOpacity={0.75}>
                    <UserX size={16} color={C.danger} />
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );
}

// ─── Requests tab ─────────────────────────────────────────────────────────────

function RequestsTab() {
    const {
        incomingRequests, outgoingRequests,
        acceptRequest, declineRequest,
        searchUsers, searchResults, clearSearch, searching,
    } = useFriend();
    const { supabaseUserId, user } = useAuth();

    const [profiles, setProfiles] = useState<Record<string, User>>({});
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // ── Find friends section ───────────────────────────────────────────────────
    const [query,       setQuery]      = useState('');
    const [hasSearched, setHasSearched] = useState(false);
    const [localResults, setLocalResults] = useState<User[]>([]);
    const [statusMap, setStatusMap] = useState<Record<string, RelationshipStatus>>({});
    const [actionBusy, setActionBusy] = useState<string | null>(null);
    const { sendRequest, incomingRequests: incoming } = useFriend();

    // Fetch profiles for request senders/receivers
    useEffect(() => {
        const uids = [
            ...incomingRequests.map(r => r.fromUid),
            ...outgoingRequests.map(r => r.toUid),
        ];
        const unique = [...new Set(uids)];
        if (unique.length === 0) return;
        import('../core/config/supabase').then(({ supabase }) =>
            supabase.from('users').select('*').in('id', unique)
        ).then(({ data }) => {
            const map: Record<string, User> = {};
            (data ?? []).forEach((row: any) => {
                map[row.id] = {
                    uid: row.id,
                    email: row.email || '',
                    fullName: row.full_name || 'User',
                    username: row.username || '',
                    profileImageUrl: row.avatar_url || undefined,
                    completedVideos: 0, totalVideos: 0, credits: 0,
                    createdAt: new Date(), updatedAt: new Date(),
                };
            });
            setProfiles(map);
        }).catch(() => {});
    }, [incomingRequests, outgoingRequests]);

    const handleAccept = async (requestId: string, fromUid: string, toUid: string) => {
        setActionLoading(requestId);
        try { await acceptRequest(requestId, fromUid, toUid); }
        catch (e: any) { Alert.alert('Error', e.message); }
        finally { setActionLoading(null); }
    };
    const handleDecline = async (requestId: string) => {
        setActionLoading(requestId);
        try { await declineRequest(requestId); }
        catch (e: any) { Alert.alert('Error', e.message); }
        finally { setActionLoading(null); }
    };

    // Search
    useEffect(() => { setLocalResults(searchResults); }, [searchResults]);

    useEffect(() => {
        if (!user?.uid || localResults.length === 0) return;
        Promise.all(
            localResults.map(async r => ({ uid: r.uid, status: await FriendService.getRequestStatus(user.uid, r.uid) }))
        ).then(entries => {
            const map: Record<string, RelationshipStatus> = {};
            entries.forEach(({ uid, status }) => { map[uid] = status; });
            setStatusMap(map);
        });
    }, [localResults, user?.uid]);

    const handleQueryChange = (t: string) => {
        setQuery(t);
        if (!t.trim()) { clearSearch(); setLocalResults([]); setHasSearched(false); return; }
        setHasSearched(true);
        searchUsers(t);
    };

    const handleSearchSubmit = () => {
        if (!query.trim()) return;
        setHasSearched(true);
        searchUsers(query.trim());
    };

    const handleSearchAction = async (target: User) => {
        if (!user?.uid) return;
        const status = statusMap[target.uid] ?? 'none';
        setActionBusy(target.uid);
        try {
            if (status === 'none') {
                await sendRequest(target.uid);
                setStatusMap(p => ({ ...p, [target.uid]: 'pending_sent' }));
            } else if (status === 'pending_received') {
                const req = incoming.find(r => r.fromUid === target.uid && r.toUid === user.uid);
                if (req) {
                    await acceptRequest(req.id, req.fromUid, req.toUid);
                    setStatusMap(p => ({ ...p, [target.uid]: 'friends' }));
                }
            }
        } catch (e: any) { Alert.alert('Error', e.message); }
        finally { setActionBusy(null); }
    };

    return (
        <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, paddingTop: 8, gap: 16 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
        >
            {/* ── Find people ── */}
            <View style={s.card}>
                <Text style={s.cardTitle}>Find People</Text>
                <View style={s.searchBar}>
                    <Search size={16} color={C.textMuted} />
                    <TextInput
                        style={s.searchInput}
                        value={query}
                        onChangeText={handleQueryChange}
                        onSubmitEditing={handleSearchSubmit}
                        placeholder="Search by username or email..."
                        placeholderTextColor={C.textDim}
                        autoCapitalize="none"
                        returnKeyType="search"
                    />
                    {query.length > 0 && (
                        <TouchableOpacity onPress={() => handleQueryChange('')} style={{ padding: 4 }}>
                            <Text style={{ color: C.textMuted, fontSize: 16 }}>×</Text>
                        </TouchableOpacity>
                    )}
                </View>
                {searching && <ActivityIndicator color={C.accent} style={{ marginTop: 12 }} />}
                {hasSearched && !searching && localResults.length === 0 && (
                    <Text style={s.noResults}>No users found</Text>
                )}
                {localResults.map(item => {
                    const status = statusMap[item.uid] ?? 'none';
                    const busy   = actionBusy === item.uid;
                    return (
                        <View key={item.uid} style={s.searchRow}>
                            <Avatar uri={item.profileImageUrl} size={40} uid={item.uid} name={item.fullName} />
                            <View style={s.rowInfo}>
                                <Text style={s.rowName}>{item.fullName || item.username || 'Athlete'}</Text>
                                {item.username ? <Text style={s.rowSub}>@{item.username}</Text> : null}
                            </View>
                            {busy ? (
                                <ActivityIndicator color={C.accent} size="small" />
                            ) : status === 'friends' ? (
                                <View style={s.badgeFriend}>
                                    <UserCheck size={13} color={C.green} />
                                    <Text style={s.badgeFriendText}>Friends</Text>
                                </View>
                            ) : status === 'pending_sent' ? (
                                <View style={s.badgePending}>
                                    <Clock size={12} color={C.accent} />
                                    <Text style={s.badgePendingText}>Sent</Text>
                                </View>
                            ) : status === 'pending_received' ? (
                                <TouchableOpacity style={s.btnAccept} onPress={() => handleSearchAction(item)} activeOpacity={0.75}>
                                    <UserCheck size={13} color="#211832" />
                                    <Text style={s.btnAcceptText}>Accept</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity style={s.btnAdd} onPress={() => handleSearchAction(item)} activeOpacity={0.75}>
                                    <UserPlus size={13} color="#211832" />
                                    <Text style={s.btnAddText}>Add</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    );
                })}
            </View>

            {/* ── Incoming requests ── */}
            <View style={s.card}>
                <Text style={s.cardTitle}>
                    Incoming
                    {incomingRequests.length > 0 && (
                        <Text style={{ color: C.accent }}> · {incomingRequests.length}</Text>
                    )}
                </Text>
                {incomingRequests.length === 0 ? (
                    <Text style={s.emptyCard}>No pending requests</Text>
                ) : incomingRequests.map(req => {
                    const sender = profiles[req.fromUid];
                    const busy   = actionLoading === req.id;
                    return (
                        <View key={req.id} style={s.requestRow}>
                            <Avatar uri={sender?.profileImageUrl} size={44} uid={sender?.uid} name={sender?.fullName} />
                            <View style={s.rowInfo}>
                                <Text style={s.rowName}>{sender?.fullName ?? sender?.username ?? '...'}</Text>
                                <Text style={s.rowSub}>@{sender?.username ?? req.fromUid.slice(0, 8)}</Text>
                            </View>
                            {busy ? (
                                <ActivityIndicator color={C.accent} size="small" />
                            ) : (
                                <View style={s.rowActions}>
                                    <TouchableOpacity
                                        style={s.btnAccept}
                                        onPress={() => handleAccept(req.id, req.fromUid, req.toUid)}
                                        activeOpacity={0.75}
                                    >
                                        <UserCheck size={13} color="#211832" />
                                        <Text style={s.btnAcceptText}>Accept</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={s.btnDecline}
                                        onPress={() => handleDecline(req.id)}
                                        activeOpacity={0.75}
                                    >
                                        <UserX size={14} color={C.danger} />
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    );
                })}
            </View>

            {/* ── Sent requests ── */}
            {outgoingRequests.length > 0 && (
                <View style={s.card}>
                    <Text style={s.cardTitle}>Sent</Text>
                    {outgoingRequests.map(req => {
                        const recipient = profiles[req.toUid];
                        return (
                            <View key={req.id} style={s.requestRow}>
                                <Avatar uri={recipient?.profileImageUrl} size={44} uid={recipient?.uid} name={recipient?.fullName} />
                                <View style={s.rowInfo}>
                                    <Text style={s.rowName}>{recipient?.fullName ?? recipient?.username ?? '...'}</Text>
                                    <Text style={s.rowSub}>@{recipient?.username ?? req.toUid.slice(0, 8)}</Text>
                                </View>
                                <View style={s.badgePending}>
                                    <Clock size={12} color={C.accent} />
                                    <Text style={s.badgePendingText}>Pending</Text>
                                </View>
                            </View>
                        );
                    })}
                </View>
            )}
        </ScrollView>
    );
}

// ─── Suggestions tab ──────────────────────────────────────────────────────────

function SuggestionsTab() {
    const navigation = useNavigation<any>();
    const preview = useProfilePreview();
    const { supabaseUserId } = useAuth();
    const { friends, sendRequest } = useFriend();

    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [loading,     setLoading]     = useState(true);
    const [refreshing,  setRefreshing]  = useState(false);
    const [sentUids,    setSentUids]    = useState<Set<string>>(new Set());

    const load = useCallback(async (silent = false) => {
        if (!supabaseUserId) return;
        if (!silent) setLoading(true);
        try {
            const friendUids = friends.map(f => f.uid);
            const data = await SocialProfileService.getSuggestions(supabaseUserId, friendUids, 20);
            setSuggestions(data);
        } catch {}
        finally { setLoading(false); setRefreshing(false); }
    }, [supabaseUserId, friends]);

    useEffect(() => { load(); }, [load]);

    const onRefresh = () => { setRefreshing(true); load(true); };

    const handleConnect = async (uid: string) => {
        setSentUids(prev => new Set([...prev, uid]));
        try {
            await sendRequest(uid);
        } catch {
            setSentUids(prev => { const n = new Set(prev); n.delete(uid); return n; });
        }
    };

    if (loading) return <ActivityIndicator color={C.accent} style={{ marginTop: 60 }} />;

    if (suggestions.length === 0) {
        return (
            <EmptyState
                emoji="🌍"
                title="No suggestions right now"
                body="As more users set 'Open to Connect', they'll appear here."
            />
        );
    }

    return (
        <FlatList
            data={suggestions}
            keyExtractor={item => item.uid}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, paddingTop: 8, gap: 12 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
            ListHeaderComponent={
                <Text style={s.suggestionHeader}>
                    People open to connect with you
                </Text>
            }
            renderItem={({ item }) => {
                const sent = sentUids.has(item.uid);
                return (
                    <TouchableOpacity
                        style={s.suggestionCard}
                        onPress={() => preview
                            ? preview.open({ uid: item.uid, fullName: item.fullName, username: item.username, avatarUrl: item.avatarUrl })
                            : navigation.navigate('SocialProfileScreen', { uid: item.uid })}
                        activeOpacity={0.85}
                    >
                        <Avatar uri={item.avatarUrl} size={52} uid={item.uid} name={item.fullName} lastActiveAt={item.lastActiveAt} />
                        <View style={s.rowInfo}>
                            <View style={s.nameRow}>
                                <Text style={s.rowName} numberOfLines={1}>{item.fullName || item.username || 'Athlete'}</Text>
                                <GenderPill gender={item.gender} />
                            </View>
                            {item.username ? <Text style={s.rowSub}>@{item.username}</Text> : null}
                            <ActivityStatus lastActiveAt={item.lastActiveAt} />
                            <HeatChips uid={item.uid} workoutSessions={item.totalWatchSessions} />
                        </View>
                        <View style={s.suggestionActions}>
                            {sent ? (
                                <View style={s.badgePending}>
                                    <Clock size={12} color={C.accent} />
                                    <Text style={s.badgePendingText}>Sent</Text>
                                </View>
                            ) : (
                                <TouchableOpacity
                                    style={s.btnConnect}
                                    onPress={() => handleConnect(item.uid)}
                                    activeOpacity={0.8}
                                >
                                    <UserPlus size={14} color="#211832" />
                                    <Text style={s.btnConnectText}>Connect</Text>
                                </TouchableOpacity>
                            )}
                            <ChevronRight size={14} color={C.textDim} style={{ marginTop: 4 }} />
                        </View>
                    </TouchableOpacity>
                );
            }}
        />
    );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function FriendsScreen() {
    const navigation = useNavigation<any>();
    const { supabaseUserId } = useAuth();
    const { incomingRequests } = useFriend();
    const [activeTab, setActiveTab] = useState<TabId>('friends');

    return (
        <AmbientBackground>
        <SafeAreaView style={s.safe} edges={['top']}>
            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn}>
                    <ArrowLeft size={22} color={C.text} />
                </TouchableOpacity>
                <Text style={s.headerTitle}>Friends</Text>
                <TouchableOpacity
                    style={s.iconBtn}
                    onPress={() => navigation.navigate('SocialProfileScreen', { uid: supabaseUserId })}
                >
                    <UserPlus size={22} color={C.text} strokeWidth={1.9} />
                </TouchableOpacity>
            </View>

            {/* Tab bar */}
            <TabBar
                active={activeTab}
                onChange={setActiveTab}
                requestCount={incomingRequests.length}
            />

            {/* Tab content */}
            <View style={{ flex: 1 }}>
                {activeTab === 'friends'     && <FriendsTab />}
                {activeTab === 'requests'    && <RequestsTab />}
                {activeTab === 'suggestions' && <SuggestionsTab />}
            </View>
        </SafeAreaView>
        </AmbientBackground>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    iconBtn: {
        width: 38, height: 38,
        borderRadius: 19,
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        fontSize: 18,
        fontWeight: '800',
        color: C.text,
    },
    profileIconWrap: {
        width: 34, height: 34,
        borderRadius: 17,
        backgroundColor: C.bgCard,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: C.accentBorder,
    },

    // Tab bar — orange underline style
    tabBar: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 12,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabActive: {
        borderBottomColor: '#4C4E78',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: C.textMuted,
    },
    tabTextActive: {
        color: C.text,
        fontWeight: '700',
    },
    tabBadge: {
        backgroundColor: C.accent,
        borderRadius: 8,
        paddingHorizontal: 5,
        paddingVertical: 1,
        minWidth: 18,
        alignItems: 'center',
    },
    tabBadgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '800',
    },

    // Friend row
    friendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.bgCard,
        borderRadius: 14,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: C.border,
        gap: 12,
    },
    rowInfo: {
        flex: 1,
        gap: 2,
    },
    rowName: {
        fontSize: 14,
        fontWeight: '700',
        color: C.text,
    },
    rowSub: {
        fontSize: 12,
        color: C.textMuted,
    },
    rowMeta: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 4,
    },
    // Name + gender pill (matches profile / connections layout)
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
    },
    genderPill: {
        width: 20, height: 20, borderRadius: 6,
        alignItems: 'center', justifyContent: 'center', borderWidth: 1,
    },
    genderIcon: { fontSize: 12, fontWeight: '900', lineHeight: 15 },
    // Activity status line (Active now · Active 2d ago · Activity hidden)
    activityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: 3,
    },
    activityDot: { width: 7, height: 7, borderRadius: 4 },
    activityText: { fontSize: 11, fontWeight: '700' },
    // Hot/cold heat chips
    heatRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 6,
    },
    heatChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    heatCount: { fontSize: 12, fontWeight: '800' },
    metaChip: {
        backgroundColor: 'rgba(33,24,50,0.06)',
        borderRadius: 8,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    metaChipText: {
        fontSize: 10,
        color: C.textMuted,
        fontWeight: '600',
    },
    rowActions: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
    },
    actionMsg: {
        width: 36, height: 36,
        borderRadius: 10,
        backgroundColor: C.accentSoft,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: C.accentBorder,
    },
    actionDanger: {
        width: 36, height: 36,
        borderRadius: 10,
        backgroundColor: C.dangerSoft,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
    },

    // Card (requests tab)
    card: {
        backgroundColor: C.bgCard,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: C.border,
        gap: 12,
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: C.text,
    },
    emptyCard: {
        fontSize: 13,
        color: C.textMuted,
        textAlign: 'center',
        paddingVertical: 8,
    },

    // Request row
    requestRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingTop: 4,
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 6,
        borderTopWidth: 1,
        borderTopColor: C.border,
    },
    noResults: {
        textAlign: 'center',
        color: C.textMuted,
        fontSize: 13,
        paddingVertical: 8,
    },

    // Search bar
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: C.bgInput,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: C.border,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: C.text,
        paddingVertical: 0,
    },

    // Invite button
    inviteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: C.bgCard,
        borderRadius: 12,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: C.accentBorder,
    },
    inviteBtnText: {
        color: C.accent,
        fontWeight: '700',
        fontSize: 14,
    },

    listCount: {
        fontSize: 12,
        color: C.textMuted,
        fontWeight: '600',
    },

    // Action buttons
    btnAdd: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: C.accent, borderRadius: 8,
        paddingVertical: 6, paddingHorizontal: 12,
    },
    btnAddText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

    btnAccept: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: '#22c55e', borderRadius: 8,
        paddingVertical: 6, paddingHorizontal: 12,
    },
    btnAcceptText: { color: '#211832', fontSize: 12, fontWeight: '700' },

    btnDecline: {
        width: 32, height: 32, borderRadius: 8,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: C.dangerSoft,
        borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
    },

    badgeFriend: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: 'rgba(34,197,94,0.1)',
        borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)',
        borderRadius: 8, paddingVertical: 5, paddingHorizontal: 9,
    },
    badgeFriendText: { color: C.green, fontSize: 11, fontWeight: '600' },

    badgePending: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: C.accentSoft,
        borderWidth: 1, borderColor: C.accentBorder,
        borderRadius: 8, paddingVertical: 5, paddingHorizontal: 9,
    },
    badgePendingText: { color: C.accent, fontSize: 11, fontWeight: '600' },

    // Suggestion card
    suggestionHeader: {
        fontSize: 12,
        fontWeight: '600',
        color: C.textMuted,
        marginBottom: 4,
    },
    suggestionCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: C.bgCard,
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: C.border,
        gap: 12,
    },
    suggestionWhat: {
        fontSize: 11,
        color: C.textMuted,
        fontWeight: '600',
        marginTop: 2,
    },
    suggestionGym: {
        fontSize: 11,
        color: C.textMuted,
        marginTop: 1,
    },
    suggestionStats: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 4,
    },
    suggestionStat: {
        fontSize: 11,
        color: C.textMuted,
        fontWeight: '600',
    },
    suggestionActions: {
        alignItems: 'center',
        gap: 4,
    },
    btnConnect: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: C.accent,
        borderRadius: 10, paddingVertical: 7, paddingHorizontal: 12,
    },
    btnConnectText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

    // Empty states
    empty: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
        paddingVertical: 80,
        gap: 8,
    },
    emptyEmoji: { fontSize: 44, marginBottom: 4 },
    emptyTitle: { fontSize: 18, fontWeight: '800', color: C.text, textAlign: 'center' },
    emptyBody:  { fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 21 },
});
