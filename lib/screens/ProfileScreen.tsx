/**
 * ProfileScreen — own-user profile.
 * Layout matches reference image exactly:
 *   Header → Hero (avatar + name + pill) → Stats (3) → About me →
 *   What I do → Looking to meet → 3 location cards → Hobbies →
 *   Community → Badges → bottom CTA bar.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated as RNAnimated,
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
import { useNavigation } from '@react-navigation/native';
import {
  ArrowLeft,
  Bike,
  BookOpen,
  Briefcase,
  Camera,
  ChevronRight,
  CircleUserRound,
  Dumbbell,
  Flame,
  HeartHandshake,
  Home,
  MapPin,
  Pencil,
  QrCode,
  Settings,
  Trees,
  Trophy,
  Users,
} from 'lucide-react-native';
import { useAuth } from '../providers/AuthContext';
import { useUser } from '../providers/UserContext';
import { SocialProfileService } from '../services/socialProfile.service';
import { StreakService, StreakData } from '../services/streak.service';
import { ALL_BADGES, Badge } from '../services/rewards.service';
import { SocialProfile, HOBBY_META, Hobby } from '../models/SocialProfile';
import { StatPill } from '../components/profile/StatPill';
import { HobbyCircle } from '../components/profile/HobbyCircle';
import { ChipPill } from '../components/profile/ChipPill';
import { LocationRow } from '../components/profile/LocationRow';
import { ProfileCard } from '../components/profile/ProfileCard';

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  orange:       '#ff7a00',
  green:        '#22c55e',
  bg:           '#0d1520',
  cardBg:       'rgba(255,255,255,0.04)',
  cardBorder:   'rgba(255,255,255,0.06)',
  text:         '#ffffff',
  muted:        '#9ca3af',
  accentSoft:   'rgba(255,122,0,0.12)',
  accentBorder: 'rgba(255,122,0,0.28)',
};

type IconComp = React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;

const HOBBY_ICONS: Partial<Record<Hobby, IconComp>> = {
  gym:          Dumbbell,
  cycling:      Bike,
  photography:  Camera,
  reading:      BookOpen,
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

// ── Helpers ────────────────────────────────────────────────────────────────────
function splitAddress(address?: string | null, fallbackSub = '') {
  if (!address) return { sub: fallbackSub };
  const parts = address.split(',').map(p => p.trim()).filter(Boolean);
  return { sub: parts.slice(1, 3).join(', ') || address };
}

function deriveBadges(streakData: StreakData | null): Badge[] {
  if (!streakData) return [];
  const ids = new Set(streakData.badges ?? []);
  if (streakData.totalWorkouts >= 1)    ids.add('first_workout');
  if (streakData.bestStreak >= 7)       ids.add('7_day_streak');
  if (streakData.bestStreak >= 14)      ids.add('14_day_streak');
  if (streakData.totalLiveSessions >= 1) ids.add('first_live_session');
  return ALL_BADGES.filter(b => ids.has(b.id));
}

// ── Screen ─────────────────────────────────────────────────────────────────────
export const ProfileScreen = () => {
  const navigation = useNavigation<any>();
  const { supabaseUserId } = useAuth();
  const { profile } = useUser();

  const [social,     setSocial]     = useState<SocialProfile | null>(null);
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const pulse = useRef(new RNAnimated.Value(0.45)).current;

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async (silent = false) => {
    if (!supabaseUserId) return;
    if (!silent) setLoading(true);
    try {
      const [sp, streak] = await Promise.all([
        SocialProfileService.get(supabaseUserId),
        StreakService.getStreakData(supabaseUserId),
      ]);
      setSocial(sp);
      setStreakData(streak);
    } catch {}
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supabaseUserId]);

  useEffect(() => { load(); }, [load]);

  // Skeleton pulse animation
  useEffect(() => {
    if (!loading) return;
    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulse, { toValue: 1,    duration: 850, useNativeDriver: Platform.OS !== 'web' }),
        RNAnimated.timing(pulse, { toValue: 0.45, duration: 850, useNativeDriver: Platform.OS !== 'web' }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [loading, pulse]);

  // ── Derived data ──────────────────────────────────────────────────────────
  const displayName = profile?.fullName  || 'Mohith Kumar';
  const username    = profile?.username   || 's.mohithkumar';
  const bio         = social?.bio?.trim() || 'Gym lover & fitness enthusiast. Always pushing for progress.';
  const whatIDo     = social?.whatIDo?.trim() || 'Gym & Fitness';
  const openToConnect = social?.openToConnect !== false;

  const streak   = streakData?.currentStreak  ?? profile?.currentStreak    ?? 3;
  const workouts = streakData?.totalWorkouts  ?? profile?.completedWorkouts ?? 12;
  const prs      = streakData?.bestStreak     ?? profile?.bestStreak        ?? 4;

  // Location data
  const gymName    = social?.gymName?.trim()   || 'PowerHouse Gym';
  const gymAddress = splitAddress(social?.gymAddress || social?.gymArea, 'Koramangala, Bengaluru').sub;

  const homeName    = social?.houseName?.trim() || 'HSR Layout';
  const homeAddress = splitAddress(social?.houseAddress, 'Bengaluru').sub;

  const parkName    = social?.parkName?.trim() || 'Lalbagh Botanical Garden';
  const parkAddress = splitAddress(social?.parkAddress, 'Mavalli, Bengaluru').sub;

  // Looking-to-meet text
  const lookingText = (() => {
    const l = social?.lookingToMeet;
    if (l === 'social')       return 'Open to social connections & workout buddies.';
    if (l === 'professional') return 'Open to professional connections & networking.';
    return 'Open to both social & professional connections.';
  })();

  // Hobbies
  const hobbyItems = ((social?.hobbies?.length
    ? social.hobbies
    : ['gym', 'cycling', 'photography', 'reading']) as Hobby[]
  ).filter(h => !!HOBBY_META[h]).slice(0, 4);

  // Badges
  const earned       = deriveBadges(streakData);
  const badgeList    = earned.length > 0 ? earned : ALL_BADGES;
  const visibleBadges = badgeList.slice(0, 4);
  const extraCount   = Math.max(0, badgeList.length - 4);

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.root}>
        <SafeAreaView style={s.safe} edges={['top']}>
          <View style={s.skeleton_shell}>
            {[140, 22, 16, 40, 88, 92, 80, 80, 80, 80].map((h, i) => (
              <RNAnimated.View
                key={i}
                style={[s.skeleton_bone, {
                  opacity: pulse,
                  height: h,
                  width: i === 0 ? 140 : i < 3 ? 200 - i * 30 : '100%',
                  borderRadius: i === 0 ? 70 : 14,
                }]}
              />
            ))}
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <SafeAreaView style={s.safe} edges={['top']}>

        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <View style={s.topBar}>
          <TouchableOpacity
            style={s.navBtn}
            onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('HomeTabs')}
            activeOpacity={0.76}
          >
            <ArrowLeft size={24} color={C.text} strokeWidth={2} />
          </TouchableOpacity>

          <View style={s.topRight}>
            <TouchableOpacity
              style={s.navBtn}
              onPress={() => navigation.navigate('AccountSettingsScreen')}
              activeOpacity={0.76}
            >
              <Settings size={24} color={C.text} strokeWidth={1.9} />
            </TouchableOpacity>
            {/* QR icon — orange 2px border rounded rect */}
            <TouchableOpacity
              style={s.qrBtn}
              onPress={() => navigation.navigate('QRProfileScreen', { uid: supabaseUserId, username, displayName })}
              activeOpacity={0.76}
            >
              <QrCode size={21} color={C.text} strokeWidth={2} />
            </TouchableOpacity>
          </View>
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
          contentContainerStyle={s.scroll}
        >

          {/* ── HERO ───────────────────────────────────────────────────────── */}
          <View style={s.hero}>
            {/* Avatar with orange ring */}
            <View style={s.avatarRing}>
              <Avatar uri={profile?.profileImageUrl} size={134} />
              {/* Edit pencil badge */}
              <TouchableOpacity
                style={s.editBadge}
                onPress={() => navigation.navigate('EditSocialProfileScreen')}
                activeOpacity={0.82}
              >
                <Pencil size={13} color="#fff" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>

            <Text style={s.name} numberOfLines={1}>{displayName}</Text>
            <Text style={s.handle}>@{username}</Text>

            {/* "Open to connect" pill */}
            <View style={s.connectPill}>
              <Text style={s.connectPillText}>
                {openToConnect ? 'Open to connect' : 'Connections by Request'}
              </Text>
            </View>
          </View>

          {/* ── STATS (3 cards) ─────────────────────────────────────────────── */}
          <StatPill streak={streak} workouts={workouts} prs={prs} />

          {/* ── ABOUT ME ────────────────────────────────────────────────────── */}
          <ProfileCard>
            <View style={s.cardHeaderRow}>
              <Text style={s.cardTitle}>About me</Text>
              <TouchableOpacity onPress={() => navigation.navigate('EditSocialProfileScreen')}>
                <Pencil size={16} color={C.muted} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <Text style={s.bodyText}>{bio}</Text>
          </ProfileCard>

          {/* ── WHAT I DO ───────────────────────────────────────────────────── */}
          <ProfileCard>
            <Text style={s.cardTitle}>What I do</Text>
            <View style={s.inlineRow}>
              <Dumbbell size={20} color={C.orange} strokeWidth={2.2} />
              <Text style={s.inlineText}>{whatIDo}</Text>
            </View>
          </ProfileCard>

          {/* ── LOOKING TO MEET ─────────────────────────────────────────────── */}
          <ProfileCard>
            <TouchableOpacity
              style={s.cardHeaderRow}
              onPress={() => navigation.navigate('LookingToMeetEditScreen')}
              activeOpacity={0.8}
            >
              <Text style={s.cardTitle}>Looking to meet</Text>
              <Pencil size={16} color={C.muted} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={[s.bodyText, { marginBottom: 14 }]}>{lookingText}</Text>
            <View style={s.pillsRow}>
              <ChipPill icon={Users}    label="Social"       tone="orange" />
              <ChipPill icon={Briefcase} label="Professional" tone="green"  />
            </View>
          </ProfileCard>

          {/* ── 3 LOCATION CARDS ────────────────────────────────────────────── */}
          <LocationRow
            cardTitle="Gym I go to"
            name={gymName}
            address={gymAddress}
            iconComponent={MapPin}
          />
          <LocationRow
            cardTitle="Home area"
            name={homeName}
            address={homeAddress}
            iconComponent={Home}
          />
          <LocationRow
            cardTitle="Local park"
            name={parkName}
            address={parkAddress}
            iconComponent={Trees}
          />

          {/* ── HOBBIES ─────────────────────────────────────────────────────── */}
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

          {/* ── COMMUNITY ───────────────────────────────────────────────────── */}
          <ProfileCard>
            <Text style={s.cardTitle}>Community</Text>
            <TouchableOpacity
              style={s.communityRow}
              onPress={() => navigation.navigate('CommunityScreen')}
              activeOpacity={0.8}
            >
              <View style={s.communityIconBox}>
                <HeartHandshake size={22} color={C.orange} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.communityBold}>Volunteer</Text>
                <Text style={s.communityMuted} numberOfLines={1}>
                  {social?.communityNote || 'Helping at local fitness events'}
                </Text>
              </View>
              <ChevronRight size={20} color={C.orange} strokeWidth={2} />
            </TouchableOpacity>
          </ProfileCard>

          {/* ── BADGES ──────────────────────────────────────────────────────── */}
          <ProfileCard>
            <View style={s.cardHeaderRow}>
              <Text style={s.cardTitle}>Badges</Text>
              <TouchableOpacity onPress={() => navigation.navigate('BadgesScreen')}>
                <Text style={s.viewAllLink}>View all</Text>
              </TouchableOpacity>
            </View>
            <View style={s.badgesRow}>
              {visibleBadges.map((badge, i) => (
                <View key={badge.id} style={[s.badgeShape, i % 2 === 1 && s.badgeShapeAlt]}>
                  <Text style={s.badgeEmoji}>{badge.emoji}</Text>
                </View>
              ))}
              {extraCount > 0 && (
                <View style={s.moreBadge}>
                  <Text style={s.moreBadgeText}>+{extraCount}</Text>
                </View>
              )}
            </View>
          </ProfileCard>

          {/* Bottom spacer */}
          <View style={{ height: 24 }} />
        </ScrollView>

      </SafeAreaView>
    </View>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },

  // Header
  topBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qrBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: C.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Scroll
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 12,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  avatarRing: {
    width: 146,
    height: 146,
    borderRadius: 73,
    borderWidth: 3,
    borderColor: C.orange,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  editBadge: {
    position: 'absolute',
    right: 4,
    bottom: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.orange,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: C.bg,
  },
  name: {
    color: C.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 12,
  },
  handle: {
    color: C.muted,
    fontSize: 14,
    marginTop: 2,
  },
  connectPill: {
    marginTop: 10,
    backgroundColor: C.orange,
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  connectPillText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
  },

  // Card header
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardTitle: {
    color: C.text,
    fontSize: 15,
    fontWeight: '700',
  },
  bodyText: {
    color: C.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  viewAllLink: {
    color: C.orange,
    fontSize: 13,
    fontWeight: '600',
  },

  // What I do
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  inlineText: {
    color: C.text,
    fontSize: 15,
    fontWeight: '600',
  },

  // Looking to meet pills
  pillsRow: {
    flexDirection: 'row',
    gap: 12,
  },

  // Hobbies
  hobbiesRow: {
    flexDirection: 'row',
    marginTop: 14,
  },

  // Community
  communityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  communityIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.accentSoft,
    borderWidth: 1,
    borderColor: C.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  communityBold: {
    color: C.text,
    fontSize: 14,
    fontWeight: '700',
  },
  communityMuted: {
    color: C.muted,
    fontSize: 13,
    marginTop: 2,
  },

  // Badges
  badgesRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    alignItems: 'center',
  },
  badgeShape: {
    width: 52,
    height: 52,
    borderRadius: 13,
    backgroundColor: 'rgba(255,122,0,0.1)',
    borderWidth: 1.5,
    borderColor: C.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeShapeAlt: {
    borderColor: 'rgba(139,92,246,0.7)',
    backgroundColor: 'rgba(139,92,246,0.12)',
  },
  badgeEmoji: { fontSize: 22 },
  moreBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreBadgeText: {
    color: C.muted,
    fontSize: 13,
    fontWeight: '700',
  },

  // Loading skeleton
  skeleton_shell: {
    paddingHorizontal: 18,
    paddingTop: 60,
    alignItems: 'center',
    gap: 14,
  },
  skeleton_bone: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});
