import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    Image,
    ActivityIndicator,
    Alert,
    StyleSheet,
    Platform,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
    ArrowLeft,
    CircleUserRound,
    UserCheck,
    UserPlus,
    UserX,
    Clock,
    Search,
    Users,
    Contact,
} from 'lucide-react-native';
import { useFriend } from '../providers/FriendContext';
import { useAuth } from '../providers/AuthContext';
import { FriendService } from '../services/friend.service';
import { RelationshipStatus } from '../models/Friend';
import { User } from '../models/User';
import { AppTheme, FontSizes, FontWeights } from '../core/theme/app_theme';
import { SCREEN_PADDING } from '../constants/theme';


// ── Small reusable components ────────────────────────────────────────────────

function Avatar({ uri, size = 44 }: { uri?: string; size?: number }) {
    if (uri) {
        return (
            <Image
                key={uri}
                source={{ uri }}
                style={{ width: size, height: size, borderRadius: size / 2 }}
            />
        );
    }
    return (
        <View
            style={[
                styles.avatarFallback,
                { width: size, height: size, borderRadius: size / 2 },
            ]}
        >
            <CircleUserRound color={AppTheme.primaryColor} size={size * 0.55} />
        </View>
    );
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
    return (
        <View style={styles.emptyState}>
            {icon}
            <Text style={styles.emptyText}>{message}</Text>
        </View>
    );
}

function SectionHeader({ title }: { title: string }) {
    return <Text style={styles.sectionHeader}>{title}</Text>;
}

// ── Tab: Friends ─────────────────────────────────────────────────────────────

function FriendsTab({ showFind, setShowFind }: { showFind: boolean; setShowFind: (v: boolean) => void }) {
    const navigation = useNavigation<any>();
    const { friends, loading, removeFriend, incomingRequests, outgoingRequests, acceptRequest, declineRequest } = useFriend();
    const { user } = useAuth();
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [profiles, setProfiles] = useState<Record<string, User>>({});

    // Fetch profiles for request senders/recipients via Supabase
    useEffect(() => {
        const uids = [
            ...incomingRequests.map((r) => r.fromUid),
            ...outgoingRequests.map((r) => r.toUid),
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
                } as User;
            });
            setProfiles(map);
        }).catch(() => {});
    }, [incomingRequests, outgoingRequests]);

    const handleRemove = (friend: User) => {
        const doRemove = () => removeFriend(friend.uid).catch((e: Error) => Alert.alert('Error', e.message));
        if (Platform.OS === 'web') {
            if ((window as Window & typeof globalThis).confirm(`Remove ${friend.fullName} from friends?`)) doRemove();
        } else {
            Alert.alert('Remove Friend', `Remove ${friend.fullName} from your friends list?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: doRemove },
            ]);
        }
    };

    const handleAccept = async (requestId: string, fromUid: string, toUid: string) => {
        setActionLoading(requestId);
        try { await acceptRequest(requestId, fromUid, toUid); }
        catch (e: unknown) { Alert.alert('Error', (e as Error).message); }
        finally { setActionLoading(null); }
    };

    const handleDecline = async (requestId: string) => {
        setActionLoading(requestId);
        try { await declineRequest(requestId); }
        catch (e: unknown) { Alert.alert('Error', (e as Error).message); }
        finally { setActionLoading(null); }
    };

    const handleInviteFriends = async () => {
        const message = "Hey, i have just started using raw1 for my fitness. self coaching ,personal coaching and workout coachig and self coaching all in one place. Thought of you, give it a try! https://apps.apple.com";
        const smsUrl = `sms:?body=${encodeURIComponent(message)}`;
        try {
            if (Platform.OS === 'web') { window.open(smsUrl, '_blank'); }
            else { await Linking.openURL(smsUrl); }
        } catch { Alert.alert('Error', 'Could not open SMS app.'); }
    };

    if (loading) return <ActivityIndicator color={AppTheme.primaryColor} style={styles.loader} />;

    return (
        <FlatList
            data={friends}
            keyExtractor={(item) => item.uid}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
                <View style={{ marginBottom: 8 }}>
                    <TouchableOpacity style={styles.inviteContactsBtn} onPress={handleInviteFriends} activeOpacity={0.8}>
                        <Contact color="#fff" size={20} />
                        <Text style={styles.inviteContactsText}>Invite Friends from Contacts</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.findToggleBtn, showFind && styles.findToggleBtnActive]}
                        onPress={() => setShowFind(!showFind)}
                        activeOpacity={0.8}
                    >
                        <Search color={showFind ? '#fff' : AppTheme.textGrey} size={18} />
                        <Text style={[styles.findToggleText, showFind && styles.findToggleTextActive]}>
                            Find Friends
                        </Text>
                    </TouchableOpacity>
                    {showFind && <FindSection />}
                    {friends.length === 0 && !showFind && (
                        <EmptyState icon={<Users color={AppTheme.textGrey} size={40} />} message="No friends yet. Find people to add!" />
                    )}
                </View>
            }
            renderItem={({ item }) => (
                <View style={styles.row}>
                    <Avatar uri={item.profileImageUrl} />
                    <View style={styles.rowInfo}>
                        <Text style={styles.rowName}>{item.fullName}</Text>
                        <Text style={styles.rowSub}>@{item.username}</Text>
                    </View>
                    <View style={styles.rowActions}>
                        <TouchableOpacity
                            style={styles.btnMessage}
                            onPress={() => navigation.navigate('ChatRoom', {
                                friendUid: item.uid,
                                friendName: item.fullName || item.username,
                                friendAvatar: item.profileImageUrl,
                            })}
                            activeOpacity={0.75}
                        >
                            <Text style={styles.btnMessageText}>Message</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.btnDanger} onPress={() => handleRemove(item)} activeOpacity={0.75}>
                            <UserX color="#ff5252" size={16} />
                        </TouchableOpacity>
                    </View>
                </View>
            )}
            ListFooterComponent={
                <View>
                    {/* ── Incoming Requests ── */}
                    <SectionHeader title="Incoming" />
                    {incomingRequests.length === 0 ? (
                        <EmptyState icon={<UserPlus color={AppTheme.textGrey} size={32} />} message="No incoming requests" />
                    ) : (
                        incomingRequests.map((req) => {
                            const sender = profiles[req.fromUid];
                            const busy = actionLoading === req.id;
                            return (
                                <View key={req.id} style={styles.row}>
                                    <Avatar uri={sender?.profileImageUrl} />
                                    <View style={styles.rowInfo}>
                                        <Text style={styles.rowName}>{sender?.fullName ?? '...'}</Text>
                                        <Text style={styles.rowSub}>@{sender?.username ?? req.fromUid}</Text>
                                    </View>
                                    <View style={styles.rowActions}>
                                        {busy ? (
                                            <ActivityIndicator color={AppTheme.primaryColor} size="small" />
                                        ) : (
                                            <>
                                                <TouchableOpacity style={styles.btnAccept} onPress={() => handleAccept(req.id, req.fromUid, req.toUid)} activeOpacity={0.75}>
                                                    <UserCheck color="#fff" size={14} />
                                                    <Text style={styles.btnAcceptText}>Accept</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity style={styles.btnDecline} onPress={() => handleDecline(req.id)} activeOpacity={0.75}>
                                                    <UserX color="#ff5252" size={14} />
                                                </TouchableOpacity>
                                            </>
                                        )}
                                    </View>
                                </View>
                            );
                        })
                    )}

                    {/* ── Sent Requests ── */}
                    <SectionHeader title="Sent" />
                    {outgoingRequests.length === 0 ? (
                        <EmptyState icon={<Clock color={AppTheme.textGrey} size={32} />} message="No pending requests sent" />
                    ) : (
                        outgoingRequests.map((req) => {
                            const recipient = profiles[req.toUid];
                            return (
                                <View key={req.id} style={styles.row}>
                                    <Avatar uri={recipient?.profileImageUrl} />
                                    <View style={styles.rowInfo}>
                                        <Text style={styles.rowName}>{recipient?.fullName ?? '...'}</Text>
                                        <Text style={styles.rowSub}>@{recipient?.username ?? req.toUid}</Text>
                                    </View>
                                    <View style={styles.pendingBadge}>
                                        <Clock color={AppTheme.primaryColor} size={12} />
                                        <Text style={styles.pendingText}>Pending</Text>
                                    </View>
                                </View>
                            );
                        })
                    )}
                </View>
            }
        />
    );
}

// ── Inline Find Section ───────────────────────────────────────────────────────

function FindSection() {
    const [inputValue, setInputValue] = useState('');
    const [localResults, setLocalResults] = useState<User[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    const { searchUsers, clearSearch, searching: isSearching } = useFriend();
    const { user } = useAuth();

    // Status cache: uid -> RelationshipStatus
    const [statusMap, setStatusMap] = useState<Record<string, RelationshipStatus>>({});
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const { sendRequest, acceptRequest, incomingRequests } = useFriend();

    const handleSearch = () => {
        if (!inputValue.trim()) return;
        setLocalResults([]);
        setStatusMap({});
        setHasSearched(true);
        searchUsers(inputValue.trim());
    };

    // Pull results from context after searchUsers updates them
    const { searchResults } = useFriend();
    useEffect(() => {
        setLocalResults(searchResults);
    }, [searchResults]);

    // Refresh status map whenever local results change
    useEffect(() => {
        if (!user?.uid || localResults.length === 0) return;
        Promise.all(
            localResults.map(async (result) => {
                const status = await FriendService.getRequestStatus(user.uid, result.uid);
                return { uid: result.uid, status };
            })
        ).then((entries) => {
            const map: Record<string, RelationshipStatus> = {};
            entries.forEach(({ uid, status }) => { map[uid] = status; });
            setStatusMap(map);
        });
    }, [localResults, user?.uid]);

    const handleClearInput = (text: string) => {
        setInputValue(text);
        if (!text.trim()) {
            clearSearch();
            setLocalResults([]);
            setStatusMap({});
            setHasSearched(false);
        } else {
            // Trigger debounced search on every keystroke
            setHasSearched(true);
            searchUsers(text);
        }
    };

    const handleAction = async (targetUser: User) => {
        console.log('[FriendsScreen] handleAction PRESSED for:', targetUser.username);
        if (!user?.uid) {
            console.warn('[FriendsScreen] handleAction missing user.uid');
            return;
        }
        const status = statusMap[targetUser.uid] ?? 'none';
        console.log('[FriendsScreen] Current status:', status);
        setActionLoading(targetUser.uid);

        try {
            if (status === 'none') {
                console.log('[FriendsScreen] Calling sendRequest...');
                await sendRequest(targetUser.uid);
                console.log('[FriendsScreen] sendRequest SUCCESS, updating UI to pending_sent');
                setStatusMap((prev) => ({ ...prev, [targetUser.uid]: 'pending_sent' }));
            } else if (status === 'pending_received') {
                const req = incomingRequests.find(
                    (r) => r.fromUid === targetUser.uid && r.toUid === user.uid
                );
                if (req) {
                    await acceptRequest(req.id, req.fromUid, req.toUid);
                    setStatusMap((prev) => ({ ...prev, [targetUser.uid]: 'friends' }));
                }
            }
        } catch (e: unknown) {
            console.error('[FriendsScreen] handleAction ERROR:', e);
            Alert.alert('Error', (e as Error).message);
        } finally {
            setActionLoading(null);
        }
    };

    const renderActionButton = (targetUser: User) => {
        const status = statusMap[targetUser.uid] ?? 'none';
        const busy = actionLoading === targetUser.uid;

        if (busy) return <ActivityIndicator color={AppTheme.primaryColor} size="small" />;

        switch (status) {
            case 'friends':
                return (
                    <View style={styles.btnFriends}>
                        <UserCheck color={AppTheme.primaryColor} size={14} />
                        <Text style={styles.btnFriendsText}>Friends</Text>
                    </View>
                );
            case 'pending_sent':
                return (
                    <View style={styles.pendingBadge}>
                        <Clock color={AppTheme.primaryColor} size={12} />
                        <Text style={styles.pendingText}>Pending</Text>
                    </View>
                );
            case 'pending_received':
                return (
                    <TouchableOpacity
                        style={styles.btnAccept}
                        onPress={() => handleAction(targetUser)}
                        activeOpacity={0.75}
                    >
                        <UserCheck color="#fff" size={14} />
                        <Text style={styles.btnAcceptText}>Accept</Text>
                    </TouchableOpacity>
                );
            default:
                return (
                    <TouchableOpacity
                        style={styles.btnAdd}
                        onPress={() => handleAction(targetUser)}
                        activeOpacity={0.75}
                    >
                        <UserPlus color="#fff" size={14} />
                        <Text style={styles.btnAddText}>Add</Text>
                    </TouchableOpacity>
                );
        }
    };

    const isEmpty = inputValue.trim().length === 0;

    return (
        <View style={styles.findSection}>
            {/* Search bar row */}
            <View style={styles.searchRow}>
                <View style={styles.searchContainer}>
                    <Search color={AppTheme.textGrey} size={18} style={{ marginRight: 8 }} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by username or email…"
                        placeholderTextColor={AppTheme.textGrey}
                        value={inputValue}
                        onChangeText={handleClearInput}
                        onSubmitEditing={handleSearch}
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="search"
                        autoFocus
                    />
                </View>
                <TouchableOpacity
                    style={[styles.searchBtn, isEmpty && styles.searchBtnDisabled]}
                    onPress={handleSearch}
                    disabled={isEmpty || isSearching}
                    activeOpacity={0.8}
                >
                    {isSearching
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Search color="#fff" size={18} />
                    }
                </TouchableOpacity>
            </View>

            {isSearching && (
                <ActivityIndicator color={AppTheme.primaryColor} style={{ marginVertical: 12 }} />
            )}

            {hasSearched && localResults.length === 0 && !isSearching && (
                <EmptyState
                    icon={<Search color={AppTheme.textGrey} size={32} />}
                    message="No users found"
                />
            )}

            {localResults.map((item) => (
                <View key={item.uid} style={styles.row}>
                    <Avatar uri={item.profileImageUrl} />
                    <View style={styles.rowInfo}>
                        <Text style={styles.rowName}>{item.fullName}</Text>
                        <Text style={styles.rowSub}>@{item.username}</Text>
                    </View>
                    {renderActionButton(item)}
                </View>
            ))}
        </View>
    );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export function FriendsScreen() {
    const navigation = useNavigation<any>();
    const [showFind, setShowFind] = useState(false);

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft color={AppTheme.primaryColor} size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Friends</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={{ flex: 1 }}>
                <FriendsTab showFind={showFind} setShowFind={setShowFind} />
            </View>
        </SafeAreaView>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: AppTheme.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SCREEN_PADDING,
        paddingVertical: 12,
    },
    backButton: {
        width: 40,
        padding: 4,
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        fontSize: FontSizes.h4,
        fontWeight: FontWeights.bold as 'bold',
        color: AppTheme.textWhite,
    },

    // Find toggle button
    findToggleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 10,
        paddingVertical: 13,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: AppTheme.cardColor,
    },
    findToggleBtnActive: {
        backgroundColor: AppTheme.primaryColor,
        borderColor: AppTheme.primaryColor,
    },
    findToggleText: {
        fontSize: FontSizes.body,
        fontWeight: FontWeights.semibold as '600',
        color: AppTheme.textGrey,
    },
    findToggleTextActive: {
        color: '#fff',
    },
    findSection: {
        marginTop: 12,
    },

    // List
    listContent: {
        paddingHorizontal: SCREEN_PADDING,
        paddingBottom: 40,
        paddingTop: 4,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: AppTheme.cardColor,
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
        gap: 12,
    },
    rowInfo: {
        flex: 1,
        gap: 2,
    },
    rowName: {
        fontSize: FontSizes.body,
        fontWeight: FontWeights.semibold as '600',
        color: AppTheme.textWhite,
    },
    rowSub: {
        fontSize: FontSizes.small,
        color: AppTheme.textGrey,
    },
    rowActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },

    // Avatar fallback
    avatarFallback: {
        backgroundColor: AppTheme.inactiveColor,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Action buttons
    btnAccept: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#22c55e',
        borderRadius: 8,
        paddingVertical: 6,
        paddingHorizontal: 12,
    },
    btnAcceptText: {
        color: '#fff',
        fontSize: FontSizes.small,
        fontWeight: FontWeights.bold as 'bold',
    },
    btnDecline: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,82,82,0.15)',
        borderRadius: 8,
        padding: 6,
        borderWidth: 1,
        borderColor: 'rgba(255,82,82,0.3)',
    },
    btnMessage: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: AppTheme.primaryColor,
        borderRadius: 8,
        paddingVertical: 6,
        paddingHorizontal: 12,
    },
    btnMessageText: {
        color: '#fff',
        fontSize: FontSizes.small,
        fontWeight: FontWeights.bold as 'bold',
    },
    btnDanger: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(255,82,82,0.1)',
        borderRadius: 8,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,82,82,0.25)',
    },
    btnDangerText: {
        color: '#ff5252',
        fontSize: FontSizes.small,
        fontWeight: FontWeights.semibold as '600',
    },
    btnAdd: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: AppTheme.primaryColor,
        borderRadius: 8,
        paddingVertical: 6,
        paddingHorizontal: 12,
    },
    btnAddText: {
        color: '#fff',
        fontSize: FontSizes.small,
        fontWeight: FontWeights.bold as 'bold',
    },
    btnFriends: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(249,115,22,0.1)',
        borderRadius: 8,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: 'rgba(249,115,22,0.3)',
    },
    btnFriendsText: {
        color: AppTheme.primaryColor,
        fontSize: FontSizes.small,
        fontWeight: FontWeights.semibold as '600',
    },
    pendingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(249,115,22,0.12)',
        borderRadius: 8,
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: 'rgba(249,115,22,0.25)',
    },
    pendingText: {
        color: AppTheme.primaryColor,
        fontSize: FontSizes.small,
        fontWeight: FontWeights.medium as '500',
    },

    // Section headers (Requests tab)
    sectionHeader: {
        fontSize: FontSizes.small,
        fontWeight: FontWeights.bold as 'bold',
        color: AppTheme.textGrey,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginTop: 12,
        marginBottom: 8,
    },

    // Search (inline find section)
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        gap: 8,
    },
    searchContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: AppTheme.cardColor,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    searchInput: {
        flex: 1,
        fontSize: FontSizes.body,
        color: AppTheme.textWhite,
        paddingVertical: 0,
    },
    searchBtn: {
        backgroundColor: AppTheme.primaryColor,
        borderRadius: 10,
        paddingVertical: 11,
        paddingHorizontal: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    searchBtnDisabled: {
        opacity: 0.4,
    },

    // Empty state
    emptyState: {
        alignItems: 'center',
        paddingVertical: 48,
        gap: 12,
    },
    emptyText: {
        fontSize: FontSizes.body,
        color: AppTheme.textGrey,
        textAlign: 'center',
    },

    loader: {
        marginTop: 48,
    },

    // Invite Button
    inviteContactsBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1a1a1a',
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    inviteContactsText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 15,
    },

});
