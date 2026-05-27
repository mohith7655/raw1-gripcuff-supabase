/**
 * SocialProfileScreen
 *
 * Flat dark social profile. Handles two modes automatically:
 *   • Own profile  → edit pencils on each section, QR + Settings icons
 *   • Other user   → no edit affordances, Message + Connect CTA at bottom
 *
 * Route params: { uid: string }
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Image,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import {
    ArrowLeft, Briefcase, ChevronRight, Dumbbell, Edit2, Flame, Heart, Home,
    MapPin, MessageCircle, QrCode, Settings, Trees, Trophy,
    UserCheck, UserPlus,
} from 'lucide-react-native';
import { useAuth } from '../providers/AuthContext';
import { useFriend } from '../providers/FriendContext';
import { UserService } from '../services/user.service';
import { SocialProfileService } from '../services/socialProfile.service';
import { FriendService } from '../services/friend.service';
import { StreakService, StreakData } from '../services/streak.service';
import { ALL_BADGES } from '../services/rewards.service';
import { User } from '../models/User';
import {
    AGE_GROUP_META, CONNECTION_GOAL_META, HOBBY_META, SocialProfile,
} from '../models/SocialProfile';
import { RelationshipStatus } from '../models/Friend';

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
    bgTop:        '#06111F',
    bgBottom:     '#081521',
    bgCard:       'rgba(12,20,35,0.92)',
    bgInner:      'rgba(255,255,255,0.04)',
    accent:       '#FF7A00',
    accentSoft:   'rgba(255,122,0,0.14)',
    accentBorder: 'rgba(255,122,0,0.45)',
    green:        '#22C55E',
    greenSoft:    'rgba(34,197,94,0.14)',
    greenBorder:  'rgba(34,197,94,0.45)',
    purple:       '#A78BFA',
    purpleSoft:   'rgba(167,139,250,0.14)',
    purpleBorder: 'rgba(167,139,250,0.45)',
    text:         '#FFFFFF',
    textMuted:    '#9CA3AF',
    textDim:      '#64748B',
    border:       'rgba(255,255,255,0.06)',
    glow:         'rgba(56,103,214,0.18)',
};

// ─── Helper components ────────────────────────────────────────────────────────

function Avatar({ uri, size = 80 }: { uri?: string | null; size?: number }) {
    const [err, setErr] = useState(false);
    if (uri && !err) {
        return (
            <Image
                source={{ uri }}
                style={{ width: size, height: size, borderRadius: size / 2 }}
                onError={() => setErr(true)}
            />
        );
    }
    return (
        <View style={{
            width: size, height: size, borderRadius: size / 2,
            backgroundColor: C.bgCard,
            alignItems: 'center', justifyContent: 'center',
        }}>
            <Text style={{ fontSize: size * 0.38 }}>👤</Text>
        </View>
    );
}

function SectionCard({
    title, children, style, onEdit, right,
}: {
    title?: string;
    children: React.ReactNode;
    style?: any;
    onEdit?: () => void;
    right?: React.ReactNode;
}) {
    return (
        <View style={[card.wrapper, style]}>
            {(title || onEdit || right) ? (
                <View style={card.header}>
                    {title ? <Text style={card.title}>{title}</Text> : <View />}
                    <View style={card.headerRight}>
                        {right}
                        {onEdit ? (
                            <TouchableOpacity onPress={onEdit} style={card.editBtn} hitSlop={10}>
                                <Edit2 size={13} color={C.textMuted} />
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </View>
            ) : null}
            {children}
        </View>
    );
}

function LocationCard({
    title, icon, name, address, placeholder, isOwn, onEdit,
}: {
    title: string;
    icon: React.ReactNode;
    name?: string | null;
    address?: string | null;
    placeholder: string;
    isOwn: boolean;
    onEdit: () => void;
}) {
    const trimName = (name ?? '').trim();
    const trimAddr = (address ?? '').trim();
    const primary   = trimName || trimAddr;
    const secondary = (trimName && trimAddr && trimName.toLowerCase() !== trimAddr.toLowerCase())
        ? trimAddr
        : null;
    const hasContent = !!primary;

    if (!isOwn && !hasContent) return null;

    const body = (
        <View style={s.locRow}>
            <View style={s.locIcon}>{icon}</View>
            <View style={{ flex: 1 }}>
                {hasContent ? (
                    <>
                        <Text style={s.locName}>{primary}</Text>
                        {secondary ? <Text style={s.locAddress}>{secondary}</Text> : null}
                    </>
                ) : (
                    <Text style={s.placeholder}>{placeholder}</Text>
                )}
            </View>
        </View>
    );
    return (
        <SectionCard title={title} onEdit={isOwn ? onEdit : undefined}>
            {isOwn ? (
                <TouchableOpacity activeOpacity={0.7} onPress={onEdit}>{body}</TouchableOpacity>
            ) : body}
        </SectionCard>
    );
}

function CommunityListRow({
    label, description, isOwn, onPress,
}: {
    label: string;
    description: string;
    isOwn: boolean;
    onPress: () => void;
}) {
    const content = (
        <View style={s.communityRow}>
            <View style={s.communityIcon}>
                <Heart size={15} color={C.purple} fill={C.purple} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={s.communityRowLabel}>{label}</Text>
                <Text style={s.communityRowDesc}>{description}</Text>
            </View>
            {isOwn ? <ChevronRight size={16} color={C.textMuted} /> : null}
        </View>
    );
    if (!isOwn) return content;
    return (
        <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
            {content}
        </TouchableOpacity>
    );
}

function Skeleton({ width, height = 14, radius = 7, style }: any) {
    const anim = useRef(new Animated.Value(0.4)).current;
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: Platform.OS !== 'web' }),
                Animated.timing(anim, { toValue: 0.4, duration: 900, useNativeDriver: Platform.OS !== 'web' }),
            ])
        ).start();
    }, []);
    return (
        <Animated.View style={[{
            width, height, borderRadius: radius,
            backgroundColor: C.bgInner, opacity: anim,
        }, style]} />
    );
}

function StatItem({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
    return (
        <View style={stat.card}>
            <View style={stat.iconWrap}>{icon}</View>
            <Text style={stat.value}>{value}</Text>
            <Text style={stat.label}>{label}</Text>
        </View>
    );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function SocialProfileScreen() {
    const navigation = useNavigation<any>();
    const route      = useRoute<any>();
    const { supabaseUserId } = useAuth();
    const { sendRequest } = useFriend();

    const uid       = (route.params?.uid as string) ?? supabaseUserId ?? '';
    const isOwn     = uid === supabaseUserId;

    const [user,        setUser]        = useState<User | null>(null);
    const [social,      setSocial]      = useState<SocialProfile | null>(null);
    const [streakData,  setStreakData]  = useState<StreakData | null>(null);
    const [relStatus,   setRelStatus]   = useState<RelationshipStatus>('none');
    const [loading,     setLoading]     = useState(true);
    const [refreshing,  setRefreshing]  = useState(false);
    const [connectBusy, setConnectBusy] = useState(false);

    const load = useCallback(async (silent = false) => {
        if (!uid) return;
        if (!silent) setLoading(true);
        try {
            const [u, sp, streak] = await Promise.all([
                UserService.getProfile(uid),
                SocialProfileService.get(uid),
                StreakService.getStreakData(uid),
            ]);
            setUser(u);
            setSocial(sp);
            setStreakData(streak);
            console.log('[SocialProfileScreen] locations from supabase:', {
                gymName: sp?.gymName, gymArea: sp?.gymArea, gymAddress: sp?.gymAddress,
                houseName: sp?.houseName, houseAddress: sp?.houseAddress,
                parkName: sp?.parkName, parkAddress: sp?.parkAddress,
                hobbies: sp?.hobbies,
            });

            if (!isOwn && supabaseUserId) {
                const status = await FriendService.getRequestStatus(supabaseUserId, uid);
                setRelStatus(status);
            }
        } catch (e) {
            console.warn('[SocialProfileScreen] load error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [uid, isOwn, supabaseUserId]);

    useFocusEffect(useCallback(() => { load(true); }, [load]));

    const onRefresh = () => { setRefreshing(true); load(true); };

    const goToEdit = () => navigation.navigate('EditSocialProfileScreen');

    const handleConnect = async () => {
        if (!supabaseUserId || relStatus !== 'none') return;
        setConnectBusy(true);
        try {
            await sendRequest(uid);
            setRelStatus('pending_sent');
        } catch {}
        finally { setConnectBusy(false); }
    };

    const earnedBadgeIds = new Set(streakData?.badges ?? []);
    const earnedBadges   = ALL_BADGES.filter(b => earnedBadgeIds.has(b.id));
    const badgesShown    = earnedBadges.slice(0, 4);
    const badgesOverflow = earnedBadges.length - badgesShown.length;

    const connectLabel = () => {
        if (connectBusy) return '...';
        switch (relStatus) {
            case 'friends':          return 'Connected ✓';
            case 'pending_sent':     return 'Requested';
            case 'pending_received': return 'Accept';
            default:                 return 'Connect';
        }
    };

    // ── Loading skeleton ──────────────────────────────────────────────────────
    if (loading) {
        return (
            <SafeAreaView style={s.safe} edges={['top']}>
                <LinearGradient
                    colors={[C.bgTop, C.bgBottom]}
                    style={s.gradientBg}
                    pointerEvents="none"
                />
                <View style={s.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn}>
                        <ArrowLeft size={22} color={C.text} />
                    </TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
                    <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                        <Skeleton width={80} height={80} radius={40} />
                        <View style={{ gap: 8 }}>
                            <Skeleton width={140} height={18} />
                            <Skeleton width={90} height={13} />
                        </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Skeleton width="31%" height={70} radius={14} />
                        <Skeleton width="31%" height={70} radius={14} />
                        <Skeleton width="31%" height={70} radius={14} />
                    </View>
                    {[1, 2, 3].map(i => <Skeleton key={i} width="100%" height={80} radius={14} />)}
                </ScrollView>
            </SafeAreaView>
        );
    }

    const displayName = user?.fullName || 'Athlete';
    const username    = user?.username  || '';

    const meetActive           = social?.lookingToMeet ?? null;
    const showSocialPill       = meetActive === 'social' || meetActive === 'both';
    const showProfessionalPill = meetActive === 'professional' || meetActive === 'both';
    const hasMeetData =
        !!meetActive || !!(social?.connectionGoals && social.connectionGoals.length > 0);

    const hasCommunity = !!(
        social?.communityNote ||
        social?.helpingBeginners ||
        social?.openToMentor ||
        (social?.openToTrainAgeGroups && social.openToTrainAgeGroups.length > 0)
    );

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <LinearGradient
                colors={[C.bgTop, C.bgBottom]}
                style={s.gradientBg}
                pointerEvents="none"
            />

            {/* ── Flat header ── */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn}>
                    <ArrowLeft size={22} color={C.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }} />
                <View style={s.headerRight}>
                    {isOwn && (
                        <>
                            <TouchableOpacity
                                style={s.iconBtn}
                                onPress={() => navigation.navigate('ProfileScreen')}
                            >
                                <Settings size={20} color={C.text} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={s.iconBtn}
                                onPress={() => navigation.navigate('QRProfileScreen', {
                                    uid, username, displayName,
                                    avatarUrl: user?.profileImageUrl,
                                    streak: streakData?.currentStreak ?? 0,
                                    workouts: streakData?.totalWorkouts ?? 0,
                                    prs: streakData?.bestStreak ?? 0,
                                    bio: social?.bio,
                                    whatIDo: social?.whatIDo,
                                    lookingToMeet: social?.lookingToMeet,
                                    connectionGoals: social?.connectionGoals,
                                    hobbies: social?.hobbies,
                                    gymName: social?.gymName,
                                    gymAddress: social?.gymArea || social?.gymAddress,
                                    houseName: social?.houseName,
                                    houseAddress: social?.houseAddress,
                                    parkName: social?.parkName,
                                    parkAddress: social?.parkAddress,
                                    openToMentor: social?.openToMentor,
                                    helpingBeginners: social?.helpingBeginners,
                                    communityNote: social?.communityNote,
                                })}
                            >
                                <QrCode size={20} color={C.text} />
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>

            <ScrollView
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={C.accent}
                        colors={[C.accent]}
                    />
                }
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: isOwn ? 40 : 120 }}
            >

                {/* ── Identity ── */}
                <View style={s.identity}>
                    <View style={s.avatarRing}>
                        <Avatar uri={user?.profileImageUrl} size={96} />
                        {isOwn && (
                            <TouchableOpacity
                                style={s.editFloat}
                                onPress={goToEdit}
                                activeOpacity={0.8}
                            >
                                <Edit2 size={12} color="#fff" />
                            </TouchableOpacity>
                        )}
                    </View>
                    <Text style={s.identityName}>{displayName}</Text>
                    {username ? <Text style={s.identityUsername}>@{username}</Text> : null}
                    {social?.openToConnect && (
                        <View style={s.openBadge}>
                            <View style={s.openDot} />
                            <Text style={s.openText}>Open to connect</Text>
                        </View>
                    )}
                </View>

                {/* ── Stats ── */}
                <View style={s.statsRow}>
                    <StatItem icon={<Flame size={20} color={C.accent} />} value={streakData?.currentStreak ?? 0} label="Day Streak" />
                    <View style={s.statDivider} />
                    <StatItem icon={<Dumbbell size={20} color={C.accent} />} value={streakData?.totalWorkouts ?? 0} label="Workouts" />
                    <View style={s.statDivider} />
                    <StatItem icon={<Trophy size={20} color={C.accent} />} value={streakData?.bestStreak ?? 0} label="PRs" />
                </View>

                <View style={s.body}>

                    {/* ── About me ── */}
                    {(isOwn || social?.bio) && (
                        <SectionCard title="About me" onEdit={isOwn ? goToEdit : undefined}>
                            {social?.bio ? (
                                <Text style={s.aboutText}>{social.bio}</Text>
                            ) : (
                                <Text style={s.placeholder}>Add a bio to tell people about yourself</Text>
                            )}
                        </SectionCard>
                    )}

                    {/* ── What I do ── */}
                    {(isOwn || social?.whatIDo) && (
                        <SectionCard title="What I do" onEdit={isOwn ? goToEdit : undefined}>
                            <View style={s.inlineRow}>
                                <View style={s.inlineIcon}>
                                    <Briefcase size={18} color={C.purple} />
                                </View>
                                {social?.whatIDo ? (
                                    <Text style={s.whatIDoText}>{social.whatIDo}</Text>
                                ) : (
                                    <Text style={[s.placeholder, { flex: 1 }]}>Add what you do</Text>
                                )}
                            </View>
                        </SectionCard>
                    )}

                    {/* ── Looking to meet ── */}
                    {(isOwn || hasMeetData) && (
                        <SectionCard title="Looking to meet" onEdit={isOwn ? goToEdit : undefined}>
                            {hasMeetData ? (
                                <>
                                    {meetActive ? (
                                        <View style={s.meetPillRow}>
                                            {showSocialPill && (
                                                <View style={[s.meetPillFilled, s.meetPillOrange]}>
                                                    <Text style={s.meetPillFilledText}>Social</Text>
                                                </View>
                                            )}
                                            {showProfessionalPill && (
                                                <View style={[s.meetPillFilled, s.meetPillGreen]}>
                                                    <Text style={s.meetPillFilledText}>Professional</Text>
                                                </View>
                                            )}
                                        </View>
                                    ) : null}
                                    {social?.connectionGoals && social.connectionGoals.length > 0 ? (
                                        <View style={s.chipRow}>
                                            {social.connectionGoals.map(goal => {
                                                const meta = CONNECTION_GOAL_META[goal];
                                                return (
                                                    <View key={goal} style={s.goalChip}>
                                                        <Text style={s.goalChipText}>
                                                            {meta.emoji ? `${meta.emoji} ` : ''}{meta.label}
                                                        </Text>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    ) : null}
                                </>
                            ) : (
                                <Text style={s.placeholder}>Tell people what connections you're open to</Text>
                            )}
                        </SectionCard>
                    )}

                    {/* ── Gym ── */}
                    <LocationCard
                        title="Gym I go to"
                        icon={<MapPin size={16} color={C.accent} />}
                        name={social?.gymName}
                        address={social?.gymArea || social?.gymAddress}
                        placeholder="Add your gym location"
                        isOwn={isOwn}
                        onEdit={goToEdit}
                    />

                    {/* ── Home area ── */}
                    <LocationCard
                        title="Home area"
                        icon={<Home size={16} color={C.accent} />}
                        name={social?.houseName}
                        address={social?.houseAddress}
                        placeholder="Add your home area"
                        isOwn={isOwn}
                        onEdit={goToEdit}
                    />

                    {/* ── Local park ── */}
                    <LocationCard
                        title="Local park"
                        icon={<Trees size={16} color={C.accent} />}
                        name={social?.parkName}
                        address={social?.parkAddress}
                        placeholder="Add your local park"
                        isOwn={isOwn}
                        onEdit={goToEdit}
                    />

                    {/* ── Hobbies ── */}
                    {(isOwn || (social?.hobbies && social.hobbies.length > 0)) && (
                        <SectionCard title="Hobbies" onEdit={isOwn ? goToEdit : undefined}>
                            {social?.hobbies && social.hobbies.length > 0 ? (
                                <View style={s.hobbyWrap}>
                                    {social.hobbies.map(h => {
                                        const meta = HOBBY_META[h];
                                        if (!meta) return null;
                                        return (
                                            <View key={h} style={s.hobbyItem}>
                                                <View style={s.hobbyCircle}>
                                                    <Text style={s.hobbyEmoji}>{meta.emoji}</Text>
                                                </View>
                                                <Text style={s.hobbyLabel} numberOfLines={1}>{meta.label}</Text>
                                            </View>
                                        );
                                    })}
                                </View>
                            ) : (
                                <Text style={s.placeholder}>Add your hobbies & interests</Text>
                            )}
                        </SectionCard>
                    )}

                    {/* ── Community ── */}
                    {(isOwn || hasCommunity) && (
                        <SectionCard title="Community" onEdit={isOwn ? goToEdit : undefined}>
                            {hasCommunity ? (
                                <View style={{ gap: 10 }}>
                                    {social?.communityNote ? (
                                        <Text style={s.communityNote}>{social.communityNote}</Text>
                                    ) : null}
                                    {social?.helpingBeginners && (
                                        <CommunityListRow
                                            label="Helping Beginners"
                                            description="Happy to guide newcomers to fitness"
                                            isOwn={isOwn}
                                            onPress={goToEdit}
                                        />
                                    )}
                                    {social?.openToMentor && (
                                        <CommunityListRow
                                            label="Open to Mentor"
                                            description="Willing to mentor others on their journey"
                                            isOwn={isOwn}
                                            onPress={goToEdit}
                                        />
                                    )}
                                    {social?.openToTrainAgeGroups && social.openToTrainAgeGroups.length > 0 && (
                                        <View style={{ marginTop: 4 }}>
                                            <Text style={s.communitySubLabel}>Trains age groups</Text>
                                            <View style={s.chipRow}>
                                                {social.openToTrainAgeGroups.map(ag => (
                                                    <View key={ag} style={s.ageChip}>
                                                        <Text style={s.ageChipText}>
                                                            {AGE_GROUP_META[ag as keyof typeof AGE_GROUP_META] ?? ag}
                                                        </Text>
                                                    </View>
                                                ))}
                                            </View>
                                        </View>
                                    )}
                                </View>
                            ) : (
                                <Text style={s.placeholder}>Share how you contribute to the community</Text>
                            )}
                        </SectionCard>
                    )}

                    {/* ── Badges ── */}
                    {earnedBadges.length > 0 && (
                        <SectionCard
                            title="Badges"
                            right={
                                <TouchableOpacity
                                    onPress={() => navigation.navigate('ProfileScreen')}
                                    hitSlop={10}
                                >
                                    <Text style={s.viewAllText}>View all</Text>
                                </TouchableOpacity>
                            }
                        >
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ gap: 10, paddingRight: 4 }}
                            >
                                {badgesShown.map(badge => (
                                    <View key={badge.id} style={s.badgeCard}>
                                        <Text style={s.badgeEmoji}>{badge.emoji}</Text>
                                        <Text style={s.badgeLabel}>{badge.label}</Text>
                                    </View>
                                ))}
                                {badgesOverflow > 0 && (
                                    <View style={s.badgeOverflow}>
                                        <Text style={s.badgeOverflowText}>+{badgesOverflow}</Text>
                                    </View>
                                )}
                            </ScrollView>
                        </SectionCard>
                    )}

                </View>
            </ScrollView>

            {/* ── Bottom CTA (other users) ── */}
            {!isOwn && (
                <View style={s.bottomCta}>
                    <TouchableOpacity
                        style={s.ctaMessage}
                        onPress={() => navigation.navigate('ChatRoom', {
                            friendUid: uid,
                            friendName: displayName,
                            friendAvatar: user?.profileImageUrl,
                        })}
                        activeOpacity={0.85}
                    >
                        <MessageCircle size={18} color="#fff" />
                        <Text style={s.ctaMessageText}>Message</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            s.ctaConnect,
                            relStatus === 'friends'      && s.ctaConnectDone,
                            relStatus === 'pending_sent' && s.ctaConnectPending,
                        ]}
                        onPress={handleConnect}
                        disabled={connectBusy || relStatus === 'friends' || relStatus === 'pending_sent'}
                        activeOpacity={0.85}
                    >
                        {connectBusy
                            ? <ActivityIndicator size="small" color="#fff" />
                            : relStatus === 'friends'
                                ? <UserCheck size={18} color={C.green} />
                                : <UserPlus size={18} color={relStatus === 'pending_sent' ? C.textMuted : '#fff'} />
                        }
                        <Text style={[
                            s.ctaConnectText,
                            relStatus === 'friends'      && { color: C.green },
                            relStatus === 'pending_sent' && { color: C.textMuted },
                        ]}>
                            {connectLabel()}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: C.bgBottom,
    },
    gradientBg: {
        ...StyleSheet.absoluteFillObject,
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    headerRight: {
        flexDirection: 'row',
        gap: 6,
    },
    iconBtn: {
        width: 38, height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center', justifyContent: 'center',
    },

    // Identity (avatar + name + username + open badge), centered
    identity: {
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 18,
        alignItems: 'center',
    },
    avatarRing: {
        width: 108, height: 108, borderRadius: 54,
        borderWidth: 3,
        borderColor: C.accent,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 14,
    },
    editFloat: {
        position: 'absolute',
        bottom: 0, right: 0,
        width: 26, height: 26, borderRadius: 13,
        backgroundColor: C.accent,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: C.bgBottom,
    },
    identityName: {
        fontSize: 18,
        fontWeight: '800',
        color: C.text,
        textAlign: 'center',
    },
    identityUsername: {
        fontSize: 14,
        color: C.textMuted,
        marginTop: 2,
    },
    openBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: C.accentSoft,
        borderWidth: 1, borderColor: C.accentBorder,
        borderRadius: 20,
        paddingHorizontal: 14, paddingVertical: 6,
        marginTop: 12,
    },
    openDot: {
        width: 7, height: 7, borderRadius: 3.5,
        backgroundColor: C.accent,
    },
    openText: {
        color: C.accent,
        fontSize: 12,
        fontWeight: '700',
    },

    // Stats
    statsRow: {
        flexDirection: 'row',
        marginHorizontal: 16,
        backgroundColor: C.bgCard,
        borderRadius: 22,
        borderWidth: 1, borderColor: C.border,
        overflow: 'hidden',
        ...Platform.select({
            web: { boxShadow: '0 10px 28px rgba(56,103,214,0.18)' },
            default: {
                shadowColor: '#3867D6',
                shadowOpacity: 0.18,
                shadowRadius: 18,
                shadowOffset: { width: 0, height: 8 },
                elevation: 6,
            },
        }),
    },
    statDivider: {
        width: 1,
        backgroundColor: C.border,
        marginVertical: 12,
    },

    // Body
    body: {
        paddingHorizontal: 16,
        paddingTop: 14,
        gap: 10,
    },

    // About me
    aboutText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.85)',
        lineHeight: 20,
    },
    placeholder: {
        fontSize: 13,
        color: C.textMuted,
        fontStyle: 'italic',
        lineHeight: 19,
    },

    // What I do (inline icon + text)
    inlineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    inlineIcon: {
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: C.purpleSoft,
        borderWidth: 1, borderColor: C.purpleBorder,
        alignItems: 'center', justifyContent: 'center',
    },
    whatIDoText: {
        flex: 1,
        fontSize: 15,
        color: C.text,
        fontWeight: '600',
    },

    // Looking to meet
    meetPillRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 10,
    },
    meetPillFilled: {
        borderRadius: 20,
        paddingHorizontal: 16, paddingVertical: 8,
    },
    meetPillOrange: {
        backgroundColor: C.accent,
    },
    meetPillGreen: {
        backgroundColor: C.green,
    },
    meetPillFilledText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '700',
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    goalChip: {
        backgroundColor: C.bgInner,
        borderWidth: 1, borderColor: C.border,
        borderRadius: 20,
        paddingHorizontal: 12, paddingVertical: 6,
    },
    goalChipText: {
        fontSize: 12,
        color: C.text,
        fontWeight: '500',
    },

    // Location rows
    locRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    locIcon: {
        width: 40, height: 40, borderRadius: 10,
        backgroundColor: C.accentSoft,
        borderWidth: 1, borderColor: C.accentBorder,
        alignItems: 'center', justifyContent: 'center',
    },
    locName: {
        fontSize: 15,
        fontWeight: '700',
        color: C.text,
    },
    locAddress: {
        fontSize: 12,
        color: C.textMuted,
        marginTop: 2,
    },

    // Hobbies — circular orange-bordered, wrapped grid
    hobbyWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 14,
    },
    hobbyItem: {
        alignItems: 'center',
        width: 64,
    },
    hobbyCircle: {
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: C.accentSoft,
        borderWidth: 2, borderColor: C.accentBorder,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 6,
    },
    hobbyEmoji: {
        fontSize: 26,
    },
    hobbyLabel: {
        fontSize: 11,
        color: C.textMuted,
        fontWeight: '600',
        textAlign: 'center',
    },

    // Community
    communityNote: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.75)',
        lineHeight: 20,
    },
    communityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 6,
    },
    communityIcon: {
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: C.purpleSoft,
        borderWidth: 1, borderColor: C.purpleBorder,
        alignItems: 'center', justifyContent: 'center',
    },
    communityRowLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: C.text,
    },
    communityRowDesc: {
        fontSize: 12,
        color: C.textMuted,
        marginTop: 2,
    },
    communitySubLabel: {
        fontSize: 11,
        color: C.textDim,
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    ageChip: {
        backgroundColor: C.bgInner,
        borderWidth: 1, borderColor: C.border,
        borderRadius: 20,
        paddingHorizontal: 10, paddingVertical: 5,
    },
    ageChipText: {
        fontSize: 11,
        color: C.textMuted,
        fontWeight: '500',
    },

    // Badges
    viewAllText: {
        color: C.accent,
        fontSize: 12,
        fontWeight: '700',
    },
    badgeCard: {
        alignItems: 'center',
        backgroundColor: C.accentSoft,
        borderWidth: 1, borderColor: C.accentBorder,
        borderRadius: 14,
        paddingVertical: 12, paddingHorizontal: 14,
        minWidth: 76,
    },
    badgeOverflow: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: C.bgInner,
        borderWidth: 1, borderColor: C.border,
        borderRadius: 14,
        paddingVertical: 12, paddingHorizontal: 14,
        minWidth: 60,
    },
    badgeOverflowText: {
        color: C.textMuted,
        fontWeight: '800',
        fontSize: 16,
    },
    badgeEmoji: {
        fontSize: 26,
        marginBottom: 6,
    },
    badgeLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: C.text,
        textAlign: 'center',
    },

    // Bottom CTA
    bottomCta: {
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        paddingBottom: Platform.OS === 'ios' ? 28 : 14,
        backgroundColor: C.bgBottom,
        borderTopWidth: 1, borderTopColor: C.border,
    },
    ctaMessage: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: 'transparent',
        borderRadius: 22,
        paddingVertical: 15,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
        minHeight: 52,
    },
    ctaMessageText: {
        color: C.text,
        fontWeight: '700',
        fontSize: 15,
    },
    ctaConnect: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: C.accent,
        borderRadius: 22,
        paddingVertical: 15,
        minHeight: 52,
    },
    ctaConnectDone: {
        backgroundColor: C.greenSoft,
        borderWidth: 1, borderColor: C.greenBorder,
    },
    ctaConnectPending: {
        backgroundColor: C.bgCard,
        borderWidth: 1, borderColor: C.border,
    },
    ctaConnectText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 15,
    },
});

const stat = StyleSheet.create({
    card: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        gap: 4,
    },
    iconWrap: {
        marginBottom: 2,
    },
    value: {
        fontSize: 22,
        fontWeight: '800',
        color: C.text,
    },
    label: {
        fontSize: 10,
        color: C.textMuted,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
});

const card = StyleSheet.create({
    wrapper: {
        backgroundColor: C.bgCard,
        borderRadius: 22,
        padding: 18,
        borderWidth: 1,
        borderColor: C.border,
        ...Platform.select({
            web: { boxShadow: '0 10px 28px rgba(56,103,214,0.18)' },
            default: {
                shadowColor: '#3867D6',
                shadowOpacity: 0.18,
                shadowRadius: 18,
                shadowOffset: { width: 0, height: 8 },
                elevation: 6,
            },
        }),
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontSize: 16,
        fontWeight: '800',
        color: C.text,
    },
    editBtn: {
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.06)',
        alignItems: 'center', justifyContent: 'center',
    },
});
