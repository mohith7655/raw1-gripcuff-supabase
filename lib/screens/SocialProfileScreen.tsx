/**
 * SocialProfileScreen
 *
 * Strava-style social profile. Handles two modes automatically:
 *   • Own profile  → Edit float, QR button, Settings icon
 *   • Other user   → Message + Connect / Connected CTA at bottom
 *
 * Route params: { uid: string }
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Animated,
    Image,
    Platform,
    RefreshControl,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import {
    ArrowLeft, Edit2, QrCode, Settings, MessageCircle,
    UserPlus, UserCheck, MapPin, Users, Award, Star,
    Flame, Zap, Dumbbell, ChevronRight,
} from 'lucide-react-native';
import { useAuth } from '../providers/AuthContext';
import { useFriend } from '../providers/FriendContext';
import { UserService } from '../services/user.service';
import { SocialProfileService } from '../services/socialProfile.service';
import { FriendService } from '../services/friend.service';
import { StreakService, StreakData } from '../services/streak.service';
import { ALL_BADGES } from '../services/rewards.service';
import { User } from '../models/User';
import { SocialProfile, HOBBY_META, CONNECTION_GOAL_META, AGE_GROUP_META } from '../models/SocialProfile';
import { RelationshipStatus } from '../models/Friend';
import { AppTheme } from '../core/theme/app_theme';

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
    bg:           '#070d1a',
    bgCard:       '#0f1923',
    bgInner:      'rgba(255,255,255,0.035)',
    accent:       '#ff7a00',
    accentSoft:   'rgba(255,122,0,0.12)',
    accentBorder: 'rgba(255,122,0,0.22)',
    green:        '#22C55E',
    greenSoft:    'rgba(34,197,94,0.12)',
    greenBorder:  'rgba(34,197,94,0.28)',
    text:         '#FFFFFF',
    textMuted:    '#94A3B8',
    textDim:      '#4a5568',
    border:       'rgba(255,255,255,0.07)',
    hero1:        '#0d1f35',
    hero2:        '#070d1a',
};

// ─── Small utility components ─────────────────────────────────────────────────

function Avatar({ uri, size = 110 }: { uri?: string | null; size?: number }) {
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
        <View style={[{
            width: size, height: size, borderRadius: size / 2,
            backgroundColor: C.bgCard,
            alignItems: 'center', justifyContent: 'center',
        }]}>
            <Text style={{ fontSize: size * 0.38 }}>
                {/* initials or generic icon */}
                👤
            </Text>
        </View>
    );
}

function SectionCard({ title, children, style }: { title?: string; children: React.ReactNode; style?: any }) {
    return (
        <View style={[card.wrapper, style]}>
            {title ? <Text style={card.title}>{title}</Text> : null}
            {children}
        </View>
    );
}

function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
    return (
        <TouchableOpacity
            style={[chip.base, active && chip.active]}
            onPress={onPress}
            activeOpacity={onPress ? 0.7 : 1}
        >
            <Text style={[chip.text, active && chip.textActive]}>{label}</Text>
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

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ emoji, value, label }: { emoji: string; value: string | number; label: string }) {
    return (
        <View style={stat.card}>
            <Text style={stat.emoji}>{emoji}</Text>
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
    const { sendRequest, friends, incomingRequests } = useFriend();

    const uid       = route.params?.uid as string ?? supabaseUserId ?? '';
    const isOwn     = uid === supabaseUserId;

    const [user,       setUser]       = useState<User | null>(null);
    const [social,     setSocial]     = useState<SocialProfile | null>(null);
    const [streakData, setStreakData] = useState<StreakData | null>(null);
    const [relStatus,  setRelStatus]  = useState<RelationshipStatus>('none');
    const [loading,    setLoading]    = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [connectBusy, setConnectBusy] = useState(false);

    const scrollY = useRef(new Animated.Value(0)).current;

    // ── Data loading ──────────────────────────────────────────────────────────

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

    useEffect(() => { load(); }, [load]);

    const onRefresh = () => { setRefreshing(true); load(true); };

    // ── Connect action ────────────────────────────────────────────────────────

    const handleConnect = async () => {
        if (!supabaseUserId || relStatus !== 'none') return;
        setConnectBusy(true);
        try {
            await sendRequest(uid);
            setRelStatus('pending_sent');
        } catch {}
        finally { setConnectBusy(false); }
    };

    // ── Derived ───────────────────────────────────────────────────────────────

    const headerOpacity = scrollY.interpolate({
        inputRange: [0, 80],
        outputRange: [0, 1],
        extrapolate: 'clamp',
    });

    const earnedBadgeIds = new Set(streakData?.badges ?? []);
    const earnedBadges   = ALL_BADGES.filter(b => earnedBadgeIds.has(b.id));

    const connectLabel = () => {
        if (connectBusy) return '...';
        switch (relStatus) {
            case 'friends':         return 'Connected ✓';
            case 'pending_sent':    return 'Requested';
            case 'pending_received': return 'Accept';
            default:                return 'Connect';
        }
    };

    // ── Loading skeleton ──────────────────────────────────────────────────────

    if (loading) {
        return (
            <SafeAreaView style={s.safe} edges={['top']}>
                <View style={s.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn}>
                        <ArrowLeft size={22} color={C.text} />
                    </TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
                    <View style={{ alignItems: 'center', paddingVertical: 24, gap: 12 }}>
                        <Skeleton width={110} height={110} radius={55} />
                        <Skeleton width={140} height={18} />
                        <Skeleton width={90} height={13} />
                        <Skeleton width={200} height={13} />
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <Skeleton width="31%" height={80} radius={14} />
                        <Skeleton width="31%" height={80} radius={14} />
                        <Skeleton width="31%" height={80} radius={14} />
                    </View>
                    {[1, 2, 3].map(i => <Skeleton key={i} width="100%" height={90} radius={14} />)}
                </ScrollView>
            </SafeAreaView>
        );
    }

    const displayName = user?.fullName || 'Athlete';
    const username    = user?.username  || '';

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <SafeAreaView style={s.safe} edges={['top']}>

            {/* ── Transparent sticky header ── */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn}>
                    <ArrowLeft size={22} color={C.text} />
                </TouchableOpacity>

                {/* Fading title (appears as you scroll) */}
                <Animated.Text style={[s.headerTitle, { opacity: headerOpacity }]} numberOfLines={1}>
                    {displayName}
                </Animated.Text>

                <View style={s.headerRight}>
                    {isOwn && (
                        <>
                            <TouchableOpacity
                                style={s.iconBtn}
                                onPress={() => navigation.navigate('QRProfileScreen', { uid, username, displayName })}
                            >
                                <QrCode size={20} color={C.text} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={s.iconBtn}
                                onPress={() => navigation.navigate('ProfileScreen')}
                            >
                                <Settings size={20} color={C.text} />
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>

            <Animated.ScrollView
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: Platform.OS !== 'web' })}
                scrollEventThrottle={16}
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

                {/* ── HERO ──────────────────────────────────────────────── */}
                <LinearGradient
                    colors={[C.hero1, C.hero2]}
                    style={s.hero}
                >
                    {/* Avatar ring */}
                    <View style={s.avatarRing}>
                        <Avatar uri={user?.profileImageUrl} size={110} />
                        {/* Edit float */}
                        {isOwn && (
                            <TouchableOpacity
                                style={s.editFloat}
                                onPress={() => navigation.navigate('EditSocialProfileScreen')}
                                activeOpacity={0.8}
                            >
                                <Edit2 size={12} color="#fff" />
                            </TouchableOpacity>
                        )}
                    </View>

                    <Text style={s.heroName}>{displayName}</Text>
                    <Text style={s.heroUsername}>@{username}</Text>

                    {social?.bio ? (
                        <Text style={s.heroBio} numberOfLines={2}>{social.bio}</Text>
                    ) : isOwn ? (
                        <TouchableOpacity
                            onPress={() => navigation.navigate('EditSocialProfileScreen')}
                            style={s.addBioBtn}
                        >
                            <Text style={s.addBioText}>+ Add bio</Text>
                        </TouchableOpacity>
                    ) : null}

                    {social?.openToConnect && (
                        <View style={s.openBadge}>
                            <View style={s.openDot} />
                            <Text style={s.openText}>Open to Connect</Text>
                        </View>
                    )}
                </LinearGradient>

                {/* ── STATS ROW ─────────────────────────────────────────── */}
                <View style={s.statsRow}>
                    <StatCard emoji="🔥" value={streakData?.currentStreak ?? 0} label="Day Streak" />
                    <View style={s.statDivider} />
                    <StatCard emoji="💪" value={streakData?.totalWorkouts ?? 0} label="Workouts" />
                    <View style={s.statDivider} />
                    <StatCard emoji="⚡" value={streakData?.bestStreak ?? 0} label="Best Streak" />
                </View>

                <View style={s.body}>

                    {/* ── WHAT I DO ──────────────────────────────────────── */}
                    {social?.whatIDo ? (
                        <SectionCard title="What I Do">
                            <Text style={s.whatIDoText}>{social.whatIDo}</Text>
                        </SectionCard>
                    ) : isOwn ? (
                        <TouchableOpacity
                            style={[card.wrapper, s.addFieldBtn]}
                            onPress={() => navigation.navigate('EditSocialProfileScreen')}
                            activeOpacity={0.7}
                        >
                            <Text style={s.addFieldText}>+ Add "What I Do"</Text>
                        </TouchableOpacity>
                    ) : null}

                    {/* ── LOOKING TO MEET ────────────────────────────────── */}
                    {(social?.lookingToMeet || (social?.connectionGoals && social.connectionGoals.length > 0)) && (
                        <SectionCard title="Looking to Meet">
                            {social?.lookingToMeet && (
                                <View style={s.meetPillRow}>
                                    {(['social', 'professional', 'both'] as const).map(opt => (
                                        <View
                                            key={opt}
                                            style={[s.meetPill, social.lookingToMeet === opt && s.meetPillActive]}
                                        >
                                            <Text style={[s.meetPillText, social.lookingToMeet === opt && s.meetPillTextActive]}>
                                                {opt.charAt(0).toUpperCase() + opt.slice(1)}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                            {social?.connectionGoals && social.connectionGoals.length > 0 && (
                                <View style={s.chipRow}>
                                    {social.connectionGoals.map(goal => {
                                        const meta = CONNECTION_GOAL_META[goal];
                                        return (
                                            <View key={goal} style={s.goalChip}>
                                                <Text style={s.goalChipText}>
                                                    {meta.emoji} {meta.label}
                                                </Text>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}
                        </SectionCard>
                    )}

                    {/* ── GYM LOCATION ───────────────────────────────────── */}
                    {(social?.gymName || social?.gymArea) && (
                        <SectionCard>
                            <View style={s.gymRow}>
                                <View style={s.gymIcon}>
                                    <MapPin size={16} color={C.accent} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    {social.gymName && (
                                        <Text style={s.gymName}>{social.gymName}</Text>
                                    )}
                                    {social.gymArea && (
                                        <Text style={s.gymArea}>{social.gymArea}</Text>
                                    )}
                                </View>
                                <View style={s.gymBadge}>
                                    <Text style={s.gymBadgeText}>Gym</Text>
                                </View>
                            </View>
                        </SectionCard>
                    )}

                    {/* ── HOBBIES ────────────────────────────────────────── */}
                    {social?.hobbies && social.hobbies.length > 0 && (
                        <SectionCard title="Hobbies & Interests">
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={{ marginHorizontal: -4 }}
                                contentContainerStyle={{ paddingHorizontal: 4, gap: 8, flexDirection: 'row' }}
                            >
                                {social.hobbies.map(h => {
                                    const meta = HOBBY_META[h];
                                    if (!meta) return null;
                                    return (
                                        <View key={h} style={s.hobbyChip}>
                                            <Text style={s.hobbyEmoji}>{meta.emoji}</Text>
                                            <Text style={s.hobbyLabel}>{meta.label}</Text>
                                        </View>
                                    );
                                })}
                            </ScrollView>
                        </SectionCard>
                    )}

                    {/* ── COMMUNITY ──────────────────────────────────────── */}
                    {(social?.communityNote || social?.helpingBeginners || social?.openToMentor ||
                      (social?.openToTrainAgeGroups && social.openToTrainAgeGroups.length > 0)) && (
                        <SectionCard title="Community">
                            {social?.communityNote ? (
                                <Text style={s.communityNote}>{social.communityNote}</Text>
                            ) : null}
                            <View style={s.communityFlags}>
                                {social?.helpingBeginners && (
                                    <View style={s.communityFlag}>
                                        <Text style={s.communityFlagText}>🙌 Helping Beginners</Text>
                                    </View>
                                )}
                                {social?.openToMentor && (
                                    <View style={s.communityFlag}>
                                        <Text style={s.communityFlagText}>🎓 Open to Mentor</Text>
                                    </View>
                                )}
                            </View>
                            {social?.openToTrainAgeGroups && social.openToTrainAgeGroups.length > 0 && (
                                <View style={{ marginTop: 10 }}>
                                    <Text style={s.communitySubLabel}>Trains age groups:</Text>
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
                        </SectionCard>
                    )}

                    {/* ── BADGES ─────────────────────────────────────────── */}
                    {earnedBadges.length > 0 && (
                        <SectionCard title="Badges">
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ gap: 10, paddingRight: 4 }}
                            >
                                {earnedBadges.map(badge => (
                                    <View key={badge.id} style={s.badgeCard}>
                                        <Text style={s.badgeEmoji}>{badge.emoji}</Text>
                                        <Text style={s.badgeLabel}>{badge.label}</Text>
                                    </View>
                                ))}
                            </ScrollView>
                        </SectionCard>
                    )}

                    {/* Empty state for own profile — prompt to fill out */}
                    {isOwn && !social?.whatIDo && !social?.bio && !social?.gymName && (
                        <TouchableOpacity
                            style={s.fillPromptCard}
                            onPress={() => navigation.navigate('EditSocialProfileScreen')}
                            activeOpacity={0.8}
                        >
                            <Star size={28} color={C.accent} />
                            <Text style={s.fillPromptTitle}>Complete your social profile</Text>
                            <Text style={s.fillPromptBody}>
                                Add your bio, hobbies, and gym location to connect with the community.
                            </Text>
                            <View style={s.fillPromptBtn}>
                                <Text style={s.fillPromptBtnText}>Set up profile →</Text>
                            </View>
                        </TouchableOpacity>
                    )}

                </View>
            </Animated.ScrollView>

            {/* ── BOTTOM CTA (other users) ───────────────────────────────── */}
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
        backgroundColor: C.bg,
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        position: 'absolute',
        top: Platform.OS === 'ios' ? 48 : 8,
        left: 0, right: 0,
        zIndex: 10,
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '700',
        color: C.text,
    },
    headerRight: {
        flexDirection: 'row',
        gap: 4,
    },
    iconBtn: {
        width: 38, height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(0,0,0,0.35)',
        alignItems: 'center', justifyContent: 'center',
    },

    // Hero
    hero: {
        paddingTop: Platform.OS === 'ios' ? 100 : 72,
        paddingBottom: 28,
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    avatarRing: {
        width: 118, height: 118,
        borderRadius: 59,
        borderWidth: 3,
        borderColor: C.accent,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 16,
        boxShadow: '0 0 22px rgba(255,122,0,0.24)',
    },
    editFloat: {
        position: 'absolute',
        bottom: 0, right: 0,
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: C.accent,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: C.bg,
    },
    heroName: {
        fontSize: 22,
        fontWeight: '800',
        color: C.text,
        textAlign: 'center',
    },
    heroUsername: {
        fontSize: 14,
        color: C.textMuted,
        marginTop: 3,
        marginBottom: 8,
    },
    heroBio: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.65)',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 12,
        paddingHorizontal: 20,
    },
    addBioBtn: {
        marginBottom: 10,
    },
    addBioText: {
        color: C.accent,
        fontSize: 13,
        fontWeight: '600',
    },
    openBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: C.greenSoft,
        borderWidth: 1, borderColor: C.greenBorder,
        borderRadius: 20,
        paddingHorizontal: 14, paddingVertical: 6,
        marginTop: 4,
    },
    openDot: {
        width: 7, height: 7, borderRadius: 3.5,
        backgroundColor: C.green,
    },
    openText: {
        color: C.green,
        fontSize: 12,
        fontWeight: '700',
    },

    // Stats
    statsRow: {
        flexDirection: 'row',
        marginHorizontal: 16,
        marginTop: 16,
        marginBottom: 4,
        backgroundColor: C.bgCard,
        borderRadius: 16,
        borderWidth: 1, borderColor: C.border,
        overflow: 'hidden',
    },
    statDivider: {
        width: 1,
        backgroundColor: C.border,
        marginVertical: 14,
    },

    // Body
    body: {
        paddingHorizontal: 16,
        paddingTop: 12,
        gap: 12,
    },

    // What I Do
    whatIDoText: {
        fontSize: 15,
        color: C.text,
        fontWeight: '500',
        lineHeight: 22,
    },

    // Looking to Meet
    meetPillRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    meetPill: {
        paddingHorizontal: 16, paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: C.bgInner,
        borderWidth: 1, borderColor: C.border,
    },
    meetPillActive: {
        backgroundColor: C.accentSoft,
        borderColor: C.accentBorder,
    },
    meetPillText: {
        fontSize: 13,
        color: C.textMuted,
        fontWeight: '600',
    },
    meetPillTextActive: {
        color: C.accent,
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

    // Gym
    gymRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    gymIcon: {
        width: 38, height: 38, borderRadius: 12,
        backgroundColor: C.accentSoft,
        alignItems: 'center', justifyContent: 'center',
    },
    gymName: {
        fontSize: 14,
        fontWeight: '700',
        color: C.text,
    },
    gymArea: {
        fontSize: 12,
        color: C.textMuted,
        marginTop: 2,
    },
    gymBadge: {
        backgroundColor: C.accentSoft,
        borderRadius: 8,
        paddingHorizontal: 10, paddingVertical: 4,
    },
    gymBadgeText: {
        color: C.accent,
        fontSize: 11,
        fontWeight: '700',
    },

    // Hobbies
    hobbyChip: {
        alignItems: 'center',
        backgroundColor: C.bgInner,
        borderWidth: 1, borderColor: C.border,
        borderRadius: 12,
        paddingHorizontal: 12, paddingVertical: 10,
        minWidth: 68,
    },
    hobbyEmoji: {
        fontSize: 22,
        marginBottom: 4,
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
        color: 'rgba(255,255,255,0.7)',
        lineHeight: 20,
        marginBottom: 12,
    },
    communityFlags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    communityFlag: {
        backgroundColor: C.greenSoft,
        borderWidth: 1, borderColor: C.greenBorder,
        borderRadius: 20,
        paddingHorizontal: 12, paddingVertical: 6,
    },
    communityFlagText: {
        color: C.green,
        fontSize: 12,
        fontWeight: '600',
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
    badgeCard: {
        alignItems: 'center',
        backgroundColor: C.accentSoft,
        borderWidth: 1, borderColor: C.accentBorder,
        borderRadius: 14,
        paddingVertical: 12, paddingHorizontal: 14,
        minWidth: 76,
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

    // Add field prompts
    addFieldBtn: {
        alignItems: 'center',
        justifyContent: 'center',
        borderStyle: 'dashed',
        borderColor: C.border,
        paddingVertical: 18,
    },
    addFieldText: {
        color: C.textMuted,
        fontSize: 13,
        fontWeight: '600',
    },

    // Fill prompt card (empty own profile)
    fillPromptCard: {
        backgroundColor: C.bgCard,
        borderRadius: 16,
        borderWidth: 1, borderColor: C.accentBorder,
        padding: 24,
        alignItems: 'center',
        gap: 8,
        marginTop: 4,
    },
    fillPromptTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: C.text,
        textAlign: 'center',
    },
    fillPromptBody: {
        fontSize: 13,
        color: C.textMuted,
        textAlign: 'center',
        lineHeight: 19,
    },
    fillPromptBtn: {
        marginTop: 8,
        backgroundColor: C.accent,
        borderRadius: 20,
        paddingHorizontal: 24, paddingVertical: 10,
    },
    fillPromptBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
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
        backgroundColor: C.bg,
        borderTopWidth: 1, borderTopColor: C.border,
    },
    ctaMessage: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: C.bgCard,
        borderRadius: 14,
        paddingVertical: 14,
        borderWidth: 1, borderColor: C.border,
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
        borderRadius: 14,
        paddingVertical: 14,
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
        paddingVertical: 18,
        gap: 4,
    },
    emoji: { fontSize: 20 },
    value: {
        fontSize: 22,
        fontWeight: '800',
        color: C.text,
    },
    label: {
        fontSize: 10,
        color: C.textMuted,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
});

const card = StyleSheet.create({
    wrapper: {
        backgroundColor: C.bgCard,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: C.border,
    },
    title: {
        fontSize: 11,
        fontWeight: '700',
        color: C.textDim,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 12,
    },
});

const chip = StyleSheet.create({
    base: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: C.bgInner,
        borderWidth: 1,
        borderColor: C.border,
    },
    active: {
        backgroundColor: C.accentSoft,
        borderColor: C.accentBorder,
    },
    text: {
        fontSize: 13,
        color: C.textMuted,
        fontWeight: '600',
    },
    textActive: {
        color: C.accent,
    },
});
