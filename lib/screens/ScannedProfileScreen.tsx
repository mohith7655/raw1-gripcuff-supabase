/**
 * ScannedProfileScreen — full read-only profile shown after scanning someone's QR.
 * Resolves uid from slug/username/uid route params, then loads and renders
 * the complete profile: hero → stats → about → what-I-do → looking-to-meet →
 * 3 location cards → hobbies → community → badges → bottom action bar.
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
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  ArrowLeft,
  Bike,
  BookOpen,
  Briefcase,
  Camera,
  CircleUserRound,
  Dumbbell,
  HeartHandshake,
  Home,
  MapPin,
  Trees,
  Trophy,
  Users,
} from 'lucide-react-native';
import { useAuth } from '../providers/AuthContext';
import { useFriend } from '../providers/FriendContext';
import { supabase } from '../core/config/supabase';
import { UserService } from '../services/user.service';
import { SocialProfileService } from '../services/socialProfile.service';
import { FriendService } from '../services/friend.service';
import { StreakService, StreakData } from '../services/streak.service';
import { ALL_BADGES, Badge } from '../services/rewards.service';
import { User } from '../models/User';
import { SocialProfile, HOBBY_META, Hobby } from '../models/SocialProfile';
import { RelationshipStatus } from '../models/Friend';
import { StatPill } from '../components/profile/StatPill';
import { ChipPill } from '../components/profile/ChipPill';
import { LocationRow } from '../components/profile/LocationRow';
import { ProfileCard } from '../components/profile/ProfileCard';
import { HobbyCircle } from '../components/profile/HobbyCircle';

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  bg:           '#0d1520',
  bgCard:       'rgba(255,255,255,0.04)',
  border:       'rgba(255,255,255,0.06)',
  orange:       '#ff7a00',
  accentSoft:   'rgba(255,122,0,0.12)',
  accentBorder: 'rgba(255,122,0,0.28)',
  purple:       '#8b5cf6',
  purpleSoft:   'rgba(139,92,246,0.12)',
  purpleBorder: 'rgba(139,92,246,0.35)',
  green:        '#22c55e',
  text:         '#ffffff',
  muted:        '#9ca3af',
};

type IconComp = React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;

const HOBBY_ICONS: Partial<Record<Hobby, IconComp>> = {
  gym:         Dumbbell,
  cycling:     Bike,
  photography: Camera,
  reading:     BookOpen,
};

// ── Avatar ─────────────────────────────────────────────────────────────────────
function Avatar({ uri, size }: { uri?: string | null; size: number }) {
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
      backgroundColor: '#0f2030',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <CircleUserRound size={Math.round(size * 0.45)} color={C.orange} strokeWidth={1.8} />
    </View>
  );
}

// ── Skeleton bone ──────────────────────────────────────────────────────────────
function Bone({ width, height = 14, radius = 7 }: { width: any; height?: number; radius?: number }) {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1,   duration: 900, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(anim, { toValue: 0.4, duration: 900, useNativeDriver: Platform.OS !== 'web' }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={{
      width, height, borderRadius: radius,
      backgroundColor: 'rgba(255,255,255,0.06)', opacity: anim,
    }} />
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function splitAddress(address?: string | null) {
  if (!address) return '';
  const parts = address.split(',').map(p => p.trim()).filter(Boolean);
  return parts.slice(1, 3).join(', ') || address;
}

function deriveBadges(streakData: StreakData | null): Badge[] {
  if (!streakData) return [];
  const ids = new Set(streakData.badges ?? []);
  if (streakData.totalWorkouts >= 1)     ids.add('first_workout');
  if (streakData.bestStreak >= 7)        ids.add('7_day_streak');
  if (streakData.bestStreak >= 14)       ids.add('14_day_streak');
  if (streakData.totalLiveSessions >= 1) ids.add('first_live_session');
  return ALL_BADGES.filter(b => ids.has(b.id));
}

// ── Screen ─────────────────────────────────────────────────────────────────────
export function ScannedProfileScreen() {
  const navigation      = useNavigation<any>();
  const route           = useRoute<any>();
  const { supabaseUserId } = useAuth();
  const { sendRequest } = useFriend();

  const routeUid      = ((route.params?.uid      as string) ?? '').trim();
  const routeUsername = ((route.params?.username  as string) ?? '').trim();
  const routeSlug     = ((route.params?.slug      as string) ?? '').trim();

  const [targetUid,    setTargetUid]    = useState(routeUid);
  const [uidResolved,  setUidResolved]  = useState(!!routeUid || (!routeUsername && !routeSlug));
  const [user,         setUser]         = useState<User | null>(null);
  const [social,       setSocial]       = useState<SocialProfile | null>(null);
  const [streakData,   setStreakData]   = useState<StreakData | null>(null);
  const [relStatus,    setRelStatus]    = useState<RelationshipStatus>('none');
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [connectBusy,  setConnectBusy]  = useState(false);

  const toFallbackUser = useCallback((row: any, uid: string): User => ({
    uid,
    email: '',
    fullName: row?.full_name || 'Athlete',
    username: row?.username || '',
    profileImageUrl: row?.avatar_url || undefined,
    completedVideos: 0, totalVideos: 0, credits: 0,
    createdAt: new Date(), updatedAt: new Date(),
    currentStreak: 0, bestStreak: 0, lastWorkoutDate: null,
    weeklyActivity: {}, completedWorkouts: 0, watchedMinutes: 0,
    watchedSeconds: 0, todayWatchSeconds: 0, totalWatchSessions: 0,
    lastVideoWatchAt: null, totalLiveSessions: 0, hasAccess: false,
    accessType: null, stripeCustomerId: null, subscriptionId: null,
    subscriptionStatus: null,
  }), []);

  // ── Resolve slug → uid ─────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      if (routeUid) { setTargetUid(routeUid); setUidResolved(true); return; }
      if (!routeUsername && !routeSlug) { setTargetUid(''); setUidResolved(true); return; }
      try {
        const slugOrUsername = routeSlug || routeUsername;
        let { data } = await supabase.from('profiles').select('id').eq('qr_slug', slugOrUsername).maybeSingle();
        if (!data && routeUsername) {
          const r = await supabase.from('profiles').select('id').ilike('username', routeUsername).maybeSingle();
          data = r.data ?? null;
        }
        if (!data && routeSlug) {
          const r = await supabase.from('profiles').select('id').ilike('username', routeSlug).maybeSingle();
          data = r.data ?? null;
        }
        if (!cancelled) { setTargetUid(data?.id ?? ''); setUidResolved(true); }
      } catch {
        if (!cancelled) { setTargetUid(''); setUidResolved(true); }
      }
    };
    resolve();
    return () => { cancelled = true; };
  }, [routeUid, routeUsername, routeSlug]);

  // ── Load profile data ──────────────────────────────────────────────────────
  const load = useCallback(async (silent = false) => {
    if (!targetUid) { if (uidResolved) setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
      const [uRes, spRes, streakRes, fallbackRes] = await Promise.allSettled([
        UserService.getProfile(targetUid),
        SocialProfileService.get(targetUid),
        StreakService.getStreakData(targetUid),
        supabase.from('profiles').select('id, full_name, username, avatar_url').eq('id', targetUid).maybeSingle(),
      ]);
      setSocial(spRes.status === 'fulfilled' ? spRes.value : null);
      setStreakData(streakRes.status === 'fulfilled' ? streakRes.value : null);
      let nextUser: User | null = uRes.status === 'fulfilled' ? uRes.value : null;
      if (!nextUser && fallbackRes.status === 'fulfilled') {
        const row = fallbackRes.value?.data;
        if (row) nextUser = toFallbackUser(row, targetUid);
      }
      setUser(nextUser);
      if (supabaseUserId && supabaseUserId !== targetUid) {
        const status = await FriendService.getRequestStatus(supabaseUserId, targetUid);
        setRelStatus(status);
      }
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [targetUid, uidResolved, supabaseUserId, toFallbackUser]);

  useEffect(() => { load(); }, [load]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleConnect = async () => {
    if (!supabaseUserId || relStatus !== 'none' || !targetUid) return;
    setConnectBusy(true);
    try { await sendRequest(targetUid); setRelStatus('pending_sent'); } catch {}
    finally { setConnectBusy(false); }
  };

  const handleInviteWorkout = () => {
    if (!targetUid || relStatus !== 'friends') return;
    navigation.navigate('WorkoutWithFriendFlow', {
      inviteFlowState: {
        selectedFriend: {
          uid: targetUid,
          fullName: user?.fullName || '',
          username: user?.username || '',
          profileImageUrl: user?.profileImageUrl || null,
        },
      },
    });
  };

  const connectLabel = () => {
    if (connectBusy)                      return '...';
    if (relStatus === 'friends')          return 'Connected ✓';
    if (relStatus === 'pending_sent')     return 'Requested';
    if (relStatus === 'pending_received') return 'Accept';
    return 'Connect';
  };

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn}>
            <ArrowLeft size={22} color={C.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Profile</Text>
          <View style={s.iconBtn} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, alignItems: 'center' }}>
          <Bone width={110} height={110} radius={55} />
          <Bone width={180} height={20} />
          <Bone width={110} height={14} />
          <Bone width={220} height={14} />
          <Bone width="100%" height={90} radius={16} />
          <Bone width="100%" height={76} radius={16} />
          <Bone width="100%" height={76} radius={16} />
          <Bone width="100%" height={76} radius={16} />
          <Bone width="100%" height={76} radius={16} />
          <Bone width="100%" height={100} radius={16} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const displayName   = user?.fullName || 'Athlete';
  const username      = user?.username  || '';
  const bio           = social?.bio?.trim() || '';
  const whatIDo       = social?.whatIDo?.trim() || '';
  const openToConnect = social?.openToConnect !== false;

  const streak   = streakData?.currentStreak ?? 0;
  const workouts = streakData?.totalWorkouts ?? 0;
  const prs      = streakData?.bestStreak    ?? 0;

  const gymName    = social?.gymName?.trim()  || '';
  const gymAddress = splitAddress(social?.gymAddress || social?.gymArea);
  const homeName   = social?.houseName?.trim() || '';
  const homeAddress = splitAddress(social?.houseAddress);
  const parkName   = social?.parkName?.trim()  || '';
  const parkAddress = splitAddress(social?.parkAddress);

  const lookingText = (() => {
    const l = social?.lookingToMeet;
    if (l === 'social')       return 'Open to social connections & workout buddies.';
    if (l === 'professional') return 'Open to professional connections & networking.';
    return 'Open to both social & professional connections.';
  })();

  const hobbyItems = ((social?.hobbies?.length ? social.hobbies : []) as Hobby[])
    .filter(h => !!HOBBY_META[h]).slice(0, 4);

  const earnedBadges = deriveBadges(streakData);
  const visibleBadges = earnedBadges.slice(0, 4);
  const extraCount   = Math.max(0, earnedBadges.length - 4);

  const isOwnProfile  = supabaseUserId === targetUid;
  const bottomPadding = Platform.OS === 'ios' ? 110 : 90;

  // ── Not found ──────────────────────────────────────────────────────────────
  if (uidResolved && !targetUid) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn}>
            <ArrowLeft size={22} color={C.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Profile</Text>
          <View style={s.iconBtn} />
        </View>
        <View style={s.notFound}>
          <CircleUserRound size={64} color={C.muted} strokeWidth={1.5} />
          <Text style={s.notFoundTitle}>Profile not found</Text>
          <Text style={s.notFoundSub}>This QR code doesn't match an active RAW1 profile.</Text>
          <TouchableOpacity style={s.goBackBtn} onPress={() => navigation.goBack()}>
            <Text style={s.goBackBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Full profile render ────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn}>
          <ArrowLeft size={22} color={C.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Profile</Text>
        <View style={s.iconBtn} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            tintColor={C.orange}
            colors={[C.orange]}
          />
        }
        contentContainerStyle={[s.scroll, { paddingBottom: bottomPadding }]}
      >

        {/* ── HERO ──────────────────────────────────────────────────────────── */}
        <View style={s.hero}>
          <View style={s.avatarRing}>
            <Avatar uri={user?.profileImageUrl} size={100} />
          </View>
          <Text style={s.name}>{displayName}</Text>
          {!!username && <Text style={s.handle}>@{username}</Text>}
          <View style={s.connectPill}>
            <Text style={s.connectPillText}>
              {openToConnect ? 'Open to connect' : 'Connections by Request'}
            </Text>
          </View>

          {/* Basic Info List */}
          <View style={s.basicInfoContainer}>
            {/* Age */}
            <View style={s.basicInfoItem}>
              <Text style={s.basicInfoLabel}>Age</Text>
              <View style={s.basicInfoValueRow}>
                <Text style={s.basicInfoValue}>{user?.age ? `${user.age} yrs` : '—'}</Text>
              </View>
            </View>

            {/* Gender */}
            <View style={s.basicInfoItem}>
              <Text style={s.basicInfoLabel}>Gender</Text>
              <View style={s.basicInfoValueRow}>
                <Text style={s.basicInfoValue}>{user?.gender || '—'}</Text>
              </View>
            </View>

            {/* DOB */}
            <View style={s.basicInfoItem}>
              <Text style={s.basicInfoLabel}>DOB</Text>
              <View style={s.basicInfoValueRow}>
                <Text style={s.basicInfoValue}>{user?.dateOfBirth || '—'}</Text>
              </View>
            </View>

            {/* Phone */}
            <View style={s.basicInfoItem}>
              <Text style={s.basicInfoLabel}>Phone</Text>
              <View style={s.basicInfoValueRow}>
                <Text style={s.basicInfoValue}>{user?.phone || '—'}</Text>
              </View>
            </View>

            {/* Access */}
            <View style={s.basicInfoItem}>
              <Text style={s.basicInfoLabel}>Gripcuff Access</Text>
              <View style={s.basicInfoValueRow}>
                {user?.hasAccess ? (
                  <View style={s.accessPill}>
                    <Text style={s.accessPillText}>
                      {user.accessType === 'subscription' ? 'Subscription' : 'Product'}
                    </Text>
                  </View>
                ) : (
                  <Text style={s.accessInactive}>Inactive</Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* ── STATS ─────────────────────────────────────────────────────────── */}
        <StatPill streak={streak} workouts={workouts} prs={prs} />

        {/* ── ABOUT ME ──────────────────────────────────────────────────────── */}
        {!!bio && (
          <ProfileCard>
            <Text style={s.cardTitle}>About me</Text>
            <Text style={[s.bodyText, { marginTop: 8 }]}>{bio}</Text>
          </ProfileCard>
        )}

        {/* ── WHAT I DO ─────────────────────────────────────────────────────── */}
        {!!whatIDo && (
          <ProfileCard>
            <Text style={s.cardTitle}>What I do</Text>
            <View style={s.inlineRow}>
              <Dumbbell size={20} color={C.orange} strokeWidth={2.2} />
              <Text style={s.inlineText}>{whatIDo}</Text>
            </View>
          </ProfileCard>
        )}

        {/* ── LOOKING TO MEET ───────────────────────────────────────────────── */}
        <ProfileCard>
          <Text style={s.cardTitle}>Looking to meet</Text>
          <Text style={[s.bodyText, { marginTop: 6, marginBottom: 14 }]}>{lookingText}</Text>
          <View style={s.pillsRow}>
            <ChipPill icon={Users}     label="Social"       tone="orange" />
            <ChipPill icon={Briefcase} label="Professional" tone="green"  />
          </View>
        </ProfileCard>

        {/* ── LOCATIONS ─────────────────────────────────────────────────────── */}
        {!!gymName && (
          <LocationRow cardTitle="Gym I go to"  name={gymName}  address={gymAddress}  iconComponent={MapPin} />
        )}
        {!!homeName && (
          <LocationRow cardTitle="Home area"    name={homeName} address={homeAddress} iconComponent={Home}   />
        )}
        {!!parkName && (
          <LocationRow cardTitle="Local park"   name={parkName} address={parkAddress} iconComponent={Trees}  />
        )}

        {/* ── HOBBIES ───────────────────────────────────────────────────────── */}
        {hobbyItems.length > 0 && (
          <ProfileCard>
            <Text style={s.cardTitle}>Hobbies</Text>
            <View style={s.hobbiesRow}>
              {hobbyItems.map(hobby => {
                const meta = HOBBY_META[hobby];
                const Icon = HOBBY_ICONS[hobby] ?? Dumbbell;
                return <HobbyCircle key={hobby} icon={Icon} label={meta.label} />;
              })}
            </View>
          </ProfileCard>
        )}

        {/* ── COMMUNITY ─────────────────────────────────────────────────────── */}
        {!!social?.communityNote && (
          <ProfileCard>
            <Text style={s.cardTitle}>Community</Text>
            <View style={s.communityRow}>
              <View style={s.communityIconBox}>
                <HeartHandshake size={22} color={C.orange} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.communityBold}>Volunteer</Text>
                <Text style={s.communityMuted} numberOfLines={3}>{social.communityNote}</Text>
              </View>
            </View>
          </ProfileCard>
        )}

        {/* ── BADGES ────────────────────────────────────────────────────────── */}
        <ProfileCard>
          <View style={s.cardHeaderRow}>
            <Text style={s.cardTitle}>Badges</Text>
          </View>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={s.badgesScroll}
          >
            {ALL_BADGES.slice(0, 8).map((badge, i) => {
              const earnedIds = new Set(earnedBadges.map(b => b.id));
              const isEarned = earnedIds.has(badge.id);
              return (
                <View key={badge.id} style={s.badgeItemContainer}>
                  <View 
                    style={[
                      s.badgeShape, 
                      i % 2 === 1 && s.badgeShapeAlt,
                      !isEarned && s.badgeShapeLocked
                    ]}
                  >
                    <Text style={[s.badgeEmoji, !isEarned && s.badgeEmojiLocked]}>
                      {badge.emoji}
                    </Text>
                  </View>
                  <Text style={[s.badgeLabel, !isEarned && s.badgeLabelLocked]} numberOfLines={1}>
                    {badge.label}
                  </Text>
                </View>
              );
            })}
            {Math.max(0, ALL_BADGES.length - 8) > 0 && (
              <View style={s.moreBadgeContainer}>
                <View style={s.moreBadge}>
                  <Text style={s.moreBadgeText}>+{Math.max(0, ALL_BADGES.length - 8)}</Text>
                </View>
              </View>
            )}
          </ScrollView>
        </ProfileCard>

      </ScrollView>

      {/* ── BOTTOM ACTION BAR (hidden for own profile) ─────────────────────── */}
      {!isOwnProfile && (
        <View style={s.bottomBar}>
          <TouchableOpacity
            style={s.messageBtn}
            onPress={() =>
              supabaseUserId
                ? (targetUid
                    ? navigation.navigate('ChatRoom', {
                        friendUid:    targetUid,
                        friendName:   displayName,
                        friendAvatar: user?.profileImageUrl,
                      })
                    : undefined)
                : navigation.navigate('SignUp')
            }
            disabled={!!supabaseUserId && !targetUid}
            activeOpacity={0.86}
          >
            <Text style={s.messageBtnText}>
              {supabaseUserId ? 'Message' : 'Sign up'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              s.connectBtn,
              relStatus === 'pending_sent' && s.connectBtnPending,
              relStatus === 'friends'      && s.connectBtnFriend,
              connectBusy && { opacity: 0.6 },
            ]}
            onPress={
              !supabaseUserId
                ? () => navigation.navigate('Login')
                : relStatus === 'friends'
                  ? handleInviteWorkout
                  : handleConnect
            }
            disabled={
              (!!supabaseUserId && !targetUid)
              || connectBusy
              || (!!supabaseUserId && relStatus === 'pending_sent')
            }
            activeOpacity={0.86}
          >
            {connectBusy
              ? <ActivityIndicator size="small" color="#000" />
              : <Text style={[
                  s.connectBtnText,
                  relStatus === 'pending_sent' && { color: C.muted },
                  relStatus === 'friends'      && { color: C.green },
                ]}>
                  {supabaseUserId
                    ? (relStatus === 'friends' ? 'Invite Workout' : connectLabel())
                    : 'Log in'}
                </Text>
            }
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: C.text },

  scroll: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },

  // Hero
  hero: { alignItems: 'center', paddingVertical: 20 },
  avatarRing: {
    width: 116, height: 116, borderRadius: 58,
    borderWidth: 3, borderColor: C.orange,
    alignItems: 'center', justifyContent: 'center',
  },
  name:   { color: C.text, fontSize: 22, fontWeight: '800', marginTop: 12 },
  handle: { color: C.muted, fontSize: 14, marginTop: 2 },
  connectPill: {
    marginTop: 10, backgroundColor: C.orange,
    borderRadius: 100, paddingHorizontal: 16, paddingVertical: 6,
  },
  connectPillText: { color: '#000', fontSize: 12, fontWeight: '700' },

  // Cards
  cardHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardTitle:   { color: C.text, fontSize: 15, fontWeight: '700' },
  bodyText:    { color: C.muted, fontSize: 14, lineHeight: 20 },
  extraCount:  { color: C.muted, fontSize: 12, fontWeight: '600' },
  inlineRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  inlineText:  { color: C.text, fontSize: 15, fontWeight: '600' },
  pillsRow:    { flexDirection: 'row', gap: 12 },

  // Hobbies
  hobbiesRow:  { flexDirection: 'row', marginTop: 14 },

  // Community
  communityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 10 },
  communityIconBox: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: C.accentSoft,
    borderWidth: 1, borderColor: C.accentBorder,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  communityBold:  { color: C.text, fontSize: 14, fontWeight: '700' },
  communityMuted: { color: C.muted, fontSize: 13, marginTop: 2, lineHeight: 18 },

  // Basic Info
  basicInfoContainer: {
    marginTop: 20,
    width: '100%',
    paddingHorizontal: 16,
    gap: 12,
  },
  basicInfoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  basicInfoLabel: {
    color: C.muted,
    fontSize: 14,
    fontWeight: '500',
  },
  basicInfoValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  basicInfoValue: {
    color: C.text,
    fontSize: 14,
    fontWeight: '600',
  },
  accessInactive: {
    color: C.orange,
    fontWeight: '700',
    fontSize: 14,
  },
  accessPill: {
    backgroundColor: C.orange,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  accessPillText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
  },

  // Badges
  badgesScroll: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    alignItems: 'flex-start',
    paddingBottom: 4,
  },
  badgeItemContainer: {
    alignItems: 'center',
    width: 72,
    gap: 6,
  },
  badgeShape: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: 'rgba(255,122,0,0.1)',
    borderWidth: 1.5, borderColor: C.orange,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeShapeAlt: {
    backgroundColor: 'rgba(139,92,246,0.12)', borderColor: 'rgba(139,92,246,0.7)',
    transform: [{ rotate: '-4deg' }],
  },
  badgeShapeLocked: {
    backgroundColor: C.bgCard,
    borderColor: 'rgba(255,255,255,0.06)',
    opacity: 0.5,
  },
  badgeEmoji: { fontSize: 30 },
  badgeEmojiLocked: { opacity: 0.4 },
  badgeLabel: { color: C.text, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  badgeLabelLocked: { color: C.muted },
  moreBadgeContainer: {
    width: 64,
    alignItems: 'center',
    paddingTop: 6,
  },
  moreBadge: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  moreBadgeText: { color: C.muted, fontSize: 13, fontWeight: '700' },

  // Bottom bar
  bottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    backgroundColor: C.bg,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  messageBtn: {
    flex: 1, height: 50, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  messageBtnText: { color: C.text, fontSize: 15, fontWeight: '700' },
  connectBtn: {
    flex: 1, height: 50, borderRadius: 12,
    backgroundColor: C.orange,
    alignItems: 'center', justifyContent: 'center',
  },
  connectBtnPending: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: C.border,
  },
  connectBtnFriend: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)',
  },
  connectBtnText: { color: '#000', fontSize: 15, fontWeight: '800' },

  // Not found
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  notFoundTitle: { color: C.text, fontSize: 20, fontWeight: '800', marginTop: 20 },
  notFoundSub:   { color: C.muted, fontSize: 14, textAlign: 'center', marginTop: 10, lineHeight: 20 },
  goBackBtn: {
    marginTop: 24, backgroundColor: C.orange,
    borderRadius: 12, paddingVertical: 13, paddingHorizontal: 32,
  },
  goBackBtnText: { color: '#000', fontSize: 15, fontWeight: '800' },
});
