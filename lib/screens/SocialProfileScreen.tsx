/**
 * SocialProfileScreen — read-only profile, mirrors the owner ProfileScreen
 * layout/components exactly (hero + time stats, Profession, Fitness Goals,
 * Gallery, About, Top Hobbies, Map, Summary, Stats, Badges, Looking to meet,
 * Community). No edit affordances. Two modes:
 *   • Other user  → Message + Connect CTA at the bottom
 *   • Preview     → "this is how others see you" banner + Exit Preview
 *
 * Sections the owner marked private (sectionVisibility) are hidden from viewers.
 * Empty sections are hidden too (viewers never see "add …" placeholders).
 *
 * Route params: { uid: string; previewAsOther?: boolean }
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated as RNAnimated,
  Dimensions,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import {
  ArrowLeft,
  Briefcase,
  Dumbbell,
  Edit2,
  Eye,
  Flame,
  MapPin,
  MessageCircle,
  Snowflake,
  Sun,
  Swords,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react-native';
import { useAuth } from '../providers/AuthContext';
import { useFriend } from '../providers/FriendContext';
import { UserService } from '../services/user.service';
import { SocialProfileService } from '../services/socialProfile.service';
import { StreakService, StreakData } from '../services/streak.service';
import { GalleryService, ProfilePhoto } from '../services/gallery.service';
import { FriendService } from '../services/friend.service';
import { BADGE_FAMILIES, TIER_COLORS } from '../services/badge.types';
import { deriveBadgeStates, UserBadgeStats } from '../services/badge.service';
import { User } from '../models/User';
import { SocialProfile, HOBBY_META, CONNECTION_GOAL_META, CHALLENGE_EXERCISE_META } from '../models/SocialProfile';
import { RelationshipStatus } from '../models/Friend';
import { ProfileCard } from '../components/profile/ProfileCard';
import { ProfilePreviewSheet, PreviewUser } from '../components/social/ProfilePreviewSheet';
import { genderMeta as genderMetaOf, appActiveLabel, computeHeats, ActivityHeats, HeatLevel, isInactiveSince } from '../utils/activityHeat';
import { loadActivityMap } from '../services/activityMap.service';
import { ActivityMap } from '../components/profile/ActivityMap';
import { LocationsMap } from '../components/profile/LocationsMap';
import { TierAvatarRing } from '../components/profile/TierAvatarRing';
import { ScheduleChallengeModal } from '../components/ScheduleChallengeModal';
import { LinearGradient } from 'expo-linear-gradient';

// ── Design tokens (light theme, dark text — matches ProfileScreen) ─────────────
const C = {
  orange:       '#F25912',
  green:        '#22c55e',
  greenSoft:    'rgba(34,197,94,0.12)',
  greenBorder:  'rgba(34,197,94,0.28)',
  bg:           '#EEEEF2',
  cardBg:       '#F8F8FC',
  cardBorder:   'rgba(33,24,50,0.06)',
  text:         '#211832',
  muted:        '#7A7C90',
  accentSoft:   'rgba(242,89,18,0.12)',
  accentBorder: 'rgba(242,89,18,0.28)',
  blue:         '#3b82f6',
  blueSoft:     'rgba(59,130,246,0.12)',
  blueBorder:   'rgba(59,130,246,0.28)',
};

// ── Fire glow badge wrapper (streak only) — mirrors ProfileScreen ──────────────
function FireGlowBadge({ color, children }: { color: string; children: React.ReactNode }) {
  const glow = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(glow, { toValue: 1, duration: 900, useNativeDriver: false }),
        RNAnimated.timing(glow, { toValue: 0, duration: 900, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const borderColor = glow.interpolate({ inputRange: [0, 1], outputRange: [color + '55', color + 'ff'] });
  const bgColor = glow.interpolate({ inputRange: [0, 1], outputRange: [color + '15', color + '35'] });
  const shadowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.0] });
  const shadowRadius = glow.interpolate({ inputRange: [0, 1], outputRange: [4, 18] });

  return (
    <RNAnimated.View style={{
      width: 44, height: 44, borderRadius: 12,
      borderWidth: 2,
      borderColor,
      backgroundColor: bgColor,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'visible',
      shadowColor: color,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: shadowOpacity as any,
      shadowRadius: shadowRadius as any,
      elevation: 8,
    }}>
      {children}
    </RNAnimated.View>
  );
}

// ── Avatar (rounded-square, matches ProfileScreen) ─────────────────────────────
function Avatar({ uri, size, grayscale }: { uri?: string | null; size: number; grayscale?: boolean }) {
  const [err, setErr] = useState(false);
  if (uri && !err) {
    return (
      <Image
        source={{ uri }}
        style={[
          { width: size, height: size, borderRadius: Math.round(size * 0.22) },
          // Black & white for inactive users — web only (RN-web maps `filter`).
          grayscale && Platform.OS === 'web' ? ({ filter: 'grayscale(1)' } as any) : null,
        ]}
        onError={() => setErr(true)}
      />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: Math.round(size * 0.22),
      backgroundColor: '#EEEEF2',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: C.orange, fontSize: size * 0.12, fontWeight: '700', textAlign: 'center', lineHeight: size * 0.15 }}>
        Profile{'\n'}Picture
      </Text>
    </View>
  );
}

// ── Heat icon — replaces the "Hot/Warm/Cool/Cold" word on heat pills ───────────
// ❄️ cold/cool · ☀️ warm · 🔥 hot — colour comes from the heat level itself.
function HeatIcon({ level, color, size = 13 }: { level: HeatLevel; color: string; size?: number }) {
  const Icon = level === 'hot' ? Flame : level === 'warm' ? Sun : Snowflake;
  return <Icon size={size} color={color} strokeWidth={2.4} />;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function splitAddress(address?: string | null, fallbackSub = '') {
  if (!address) return { sub: fallbackSub };
  const parts = address.split(',').map(p => p.trim()).filter(Boolean);
  return { sub: parts.slice(1, 3).join(', ') || address };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDistance(km: number): string {
  const miles = km * 0.621371;
  if (miles < 0.1) return `< 0.1 mi away`;
  return `${miles.toFixed(1)} mi away`;
}

const fmtMins = (mins: number) => {
  const m = Math.round(mins);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
};

// ── Activity / responsiveness hint ──────────────────────────────────────────────
// "Last online" comes from last_active_at (stamped on every app open). The reply
// line comes from avg_reply_minutes (median reply latency from the messages
// table) once there's a reliable sample.
function fmtDuration(mins: number): string {
  if (mins < 1) return 'under a minute';
  if (mins < 60) return `~${Math.round(mins)}m`;
  const h = mins / 60;
  if (h < 24) return `~${Math.round(h)}h`;
  return `~${Math.round(h / 24)}d`;
}

function lastSeenText(lastActiveAt?: string | null): { text: string; color: string } | null {
  const t = lastActiveAt ? new Date(lastActiveAt).getTime() : NaN;
  if (!Number.isFinite(t)) return null;
  const mins = (Date.now() - t) / 60_000;
  const GREEN = '#16a34a', AMBER = '#d4a600', GRAY = '#7A7C90';
  if (mins < 5)  return { text: 'Active now', color: GREEN };
  if (mins < 60) return { text: `Active ${Math.round(mins)}m ago`, color: GREEN };
  const hrs = mins / 60;
  if (hrs < 24)  return { text: `Active ${Math.round(hrs)}h ago`, color: GREEN };
  const days = hrs / 24;
  if (days < 7)  return { text: `Active ${Math.round(days)}d ago`, color: AMBER };
  return { text: `Last online ${new Date(t).toLocaleDateString()}`, color: GRAY };
}

// ── Screen ─────────────────────────────────────────────────────────────────────
export function SocialProfileScreen() {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const { supabaseUserId } = useAuth();
  const { sendRequest } = useFriend();

  const uid       = (route.params?.uid as string) ?? supabaseUserId ?? '';
  const isPreview = route.params?.previewAsOther === true && uid === supabaseUserId;
  const isOwn     = uid === supabaseUserId && !isPreview;
  // Can schedule a challenge only against a real other person (never yourself / preview).
  const canChallenge = !!uid && uid !== supabaseUserId;

  // Local copy of section visibility so preview toggles update instantly.
  const [localSectionVis, setLocalSectionVis] = useState<Record<string, boolean>>({});
  const [selectedLocTab, setSelectedLocTab] = useState<'home' | 'gym' | 'park'>('home');

  // A section is shown to a viewer unless its owner marked it private.
  // Preview / owner always sees every section (so they can toggle visibility).
  const showSection = (key: string) => isOwn || isPreview || !localSectionVis[key];

  const [user,       setUser]       = useState<User | null>(null);
  const [social,     setSocial]     = useState<SocialProfile | null>(null);
  // Exercise (human label) the viewer tapped to schedule a challenge on, or null.
  const [challengeExercise, setChallengeExercise] = useState<string | null>(null);
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [photos,     setPhotos]     = useState<ProfilePhoto[]>([]);
  const [relStatus,  setRelStatus]  = useState<RelationshipStatus>('none');
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connectBusy, setConnectBusy] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [viewerHome, setViewerHome] = useState<{ lat: number; lng: number } | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [fullscreenIdx, setFullscreenIdx] = useState<number | null>(null);
  const [connections, setConnections] = useState<User[]>([]);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [connPreview, setConnPreview] = useState<PreviewUser | null>(null);
  const [heats, setHeats] = useState<ActivityHeats | null>(null);
  // Per-connection social/workout heat, loaded lazily when the list opens.
  const [connHeats, setConnHeats] = useState<Record<string, ActivityHeats>>({});

  // Hide bottom CTA bar while scrolling, reveal when idle
  const ctaAnim = useRef(new RNAnimated.Value(1)).current;
  const scrollIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleScroll = () => {
    RNAnimated.timing(ctaAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start();
    if (scrollIdleTimer.current) clearTimeout(scrollIdleTimer.current);
    scrollIdleTimer.current = setTimeout(() => {
      RNAnimated.timing(ctaAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }, 500);
  };

  const load = useCallback(async (silent = false) => {
    if (!uid) {
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);

    // Safety: never stay stuck in loading longer than 12 s
    const safetyTimer = setTimeout(() => {
      setLoading(false);
      setRefreshing(false);
    }, 12000);

    try {
      const [u, sp, streak, gallery] = await Promise.all([
        UserService.getProfile(uid),
        SocialProfileService.get(uid),
        StreakService.getStreakData(uid),
        GalleryService.list(uid),
      ]);
      setUser(u);
      setSocial(sp);
      setStreakData(streak);
      setPhotos(gallery);

      if (!isOwn && supabaseUserId && uid !== supabaseUserId) {
        const status = await FriendService.getRequestStatus(supabaseUserId, uid);
        setRelStatus(status);
      }
    } catch (e) {
      console.warn('[SocialProfileScreen] load error:', e);
    } finally {
      clearTimeout(safetyTimer);
      setLoading(false);
      setRefreshing(false);
    }
  }, [uid, isOwn, supabaseUserId]);

  useFocusEffect(useCallback(() => { load(true); }, [load]));

  // Load this profile's connections (friends) for the count + list.
  useEffect(() => {
    if (!uid) { setConnections([]); return; }
    FriendService.getFriends(uid).then(setConnections).catch(() => {});
  }, [uid]);

  // When the connections list opens, lazily compute each connection's hot/cold
  // heat (activity-map derived) so every row shows its social + workout heat.
  useEffect(() => {
    if (!connectionsOpen || connections.length === 0) return;
    let alive = true;
    connections.forEach((c) => {
      if (!c.uid || connHeats[c.uid]) return; // skip already-loaded
      loadActivityMap(c.uid)
        .then((d) => { if (alive) setConnHeats((p) => ({ ...p, [c.uid]: computeHeats(d) })); })
        .catch(() => {});
    });
    return () => { alive = false; };
  }, [connectionsOpen, connections]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recent (last 30d) social / workout heat — the hot↔cold pills.
  useEffect(() => {
    if (!uid) { setHeats(null); return; }
    let alive = true;
    setHeats(null);
    loadActivityMap(uid)
      .then((d) => { if (alive) setHeats(computeHeats(d)); })
      .catch(() => { if (alive) setHeats(null); });
    return () => { alive = false; };
  }, [uid]);

  // Load viewer's own home coords (used to compute distance to profile user)
  useEffect(() => {
    if (isOwn || isPreview || !supabaseUserId) return;
    SocialProfileService.get(supabaseUserId).then(sp => {
      if (sp?.houseLat && sp?.houseLng) {
        setViewerHome({ lat: sp.houseLat, lng: sp.houseLng });
      }
    }).catch(() => {});
  }, [isOwn, isPreview, supabaseUserId]);

  // Sync localSectionVis from loaded social profile
  useEffect(() => {
    setLocalSectionVis(social?.sectionVisibility ?? {});
  }, [social?.sectionVisibility]);

  // Toggle a section's visibility (preview mode only)
  const toggleSection = async (key: string) => {
    const next = { ...localSectionVis, [key]: !localSectionVis[key] };
    setLocalSectionVis(next);
    try {
      await SocialProfileService.update(uid, { sectionVisibility: next } as any);
    } catch {}
  };

  const onRefresh = () => { setRefreshing(true); load(true); };

  const handleConnect = async () => {
    if (!supabaseUserId || relStatus !== 'none') return;
    setConnectBusy(true);
    try {
      await sendRequest(uid);
      setRelStatus('pending_sent');
    } catch {}
    finally { setConnectBusy(false); }
  };

  const connectLabel = () => {
    if (connectBusy) return '...';
    switch (relStatus) {
      case 'friends':          return 'Connected ✓';
      case 'pending_sent':     return 'Requested';
      case 'pending_received': return 'Accept';
      default:                 return 'Connect';
    }
  };

  // ── Loading skeleton (mirrors ProfileScreen) ────────────────────────────────
  const pulse = useRef(new RNAnimated.Value(0.45)).current;
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

  if (loading) {
    return (
      <View style={s.root}>
        <SafeAreaView style={s.safe} edges={['top']}>
          <View style={s.skeletonShell}>
            {[140, 22, 16, 40, 88, 92, 80, 80, 80].map((h, i) => (
              <RNAnimated.View
                key={i}
                style={[s.skeletonBone, {
                  opacity: pulse,
                  height: h,
                  width: i === 0 ? 140 : i < 3 ? 200 - i * 30 : '100%',
                  borderRadius: i === 0 ? 22 : 14,
                }]}
              />
            ))}
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ── Derived data ────────────────────────────────────────────────────────────
  const displayName = user?.fullName || 'Athlete';
  const username    = user?.username || '';
  const bio         = social?.bio?.trim() || '';

  // Gender icon shown before the connects pill.
  const genderKey = (user?.gender || '').toLowerCase();
  const genderMeta =
    genderKey === 'male'
      ? { icon: '♂', color: '#2563eb', bg: 'rgba(37,99,235,0.12)', border: 'rgba(37,99,235,0.30)' }
    : genderKey === 'female'
      ? { icon: '♀', color: '#db2777', bg: 'rgba(219,39,119,0.12)', border: 'rgba(219,39,119,0.30)' }
    : null;

  const whatIDoItems = (social?.whatIDo?.trim() || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  const lookingItems = (social?.lookingToMeet?.trim() || '')
    .split(',').map(s => s.trim()).filter(Boolean);

  const streak   = streakData?.currentStreak ?? user?.currentStreak    ?? 0;
  const workouts = streakData?.totalWorkouts ?? user?.completedWorkouts ?? 0;
  const prs      = streakData?.bestStreak    ?? user?.bestStreak        ?? 0;
  // Videos watched — every workout video play increments total_watch_sessions
  // (WatchTrackingService.startSession), so this climbs with each watch, not once
  // per day like completed workouts.
  const videosWatched = user?.totalWatchSessions ?? 0;

  // Weekly · Lifetime time stats
  const weeklyMins = streakData
    ? Object.values(streakData.weeklyMinutes).reduce((a, b) => a + b, 0)
    : 0;
  const lifetimeMins = Math.round(
    user?.watchedMinutes ?? (user?.workoutSeconds ? user.workoutSeconds / 60 : 0)
  );

  // Activity hint — last online + reply time. Shown to viewers (not on your own
  // non-preview profile) and respects the user's privacy opt-out.
  const activityVisible = (!isOwn || isPreview) && user?.showActivityStatus !== false;
  const lastSeen = activityVisible
    ? lastSeenText(user?.lastActiveAt ?? user?.lastVideoWatchAt ?? user?.lastWorkoutDate ?? null)
    : null;
  const replyText = (lastSeen && user?.avgReplyMinutes != null && (user?.replySampleCount ?? 0) >= 3)
    ? `usually replies in ${fmtDuration(user.avgReplyMinutes)}`
    : null;

  // Location data
  const homeName = social?.houseName?.trim() || '';
  const parkName = social?.parkName?.trim()  || '';
  // Home → city name only (never street-level)
  const displayCity = (() => {
    const addr = social?.houseAddress;
    if (addr) {
      const parts = addr.split(',').map(p => p.trim()).filter(Boolean);
      // skip parts[0] (street), take city (parts[1]) or state (parts[2]) as fallback
      return parts[1] || parts[2] || parts[0];
    }
    return homeName;
  })();

  // Distance from viewer's home → profile user's home (for location line)
  const homeDistanceText = (() => {
    if (!viewerHome || !social?.houseLat || !social?.houseLng) return '';
    return fmtDistance(haversineKm(viewerHome.lat, viewerHome.lng, social.houseLat, social.houseLng));
  })();

  const hasLocation = !!(
    social?.houseLat || social?.houseLng ||
    social?.parkLat || social?.parkLng ||
    homeName || parkName
  );

  // Hobbies — top 5 by saved rank
  const hobbyItems = (social?.hobbies ?? []).filter(h => !!HOBBY_META[h]);
  const hobbyRanks = social?.hobbyRanks ?? {};
  const rankedHobbies = [...hobbyItems]
    .sort((a, b) => (hobbyRanks[b] ?? 0) - (hobbyRanks[a] ?? 0))
    .slice(0, 4);

  // Badges — same tier system as ProfileScreen
  const badgeStats: UserBadgeStats = {
    bestStreak:        user?.bestStreak ?? streakData?.bestStreak ?? 0,
    totalWorkouts:     user?.completedWorkouts ?? streakData?.totalWorkouts ?? 0,
    totalLiveSessions: (user as any)?.totalLiveSessions ?? streakData?.totalLiveSessions ?? 0,
    totalViewers:      0,
    coachSessions:     0,
    totalWatchMinutes: Math.floor((user?.watchedSeconds ?? 0) / 60),
    founderTier:       0,
  };
  const badgeStates    = deriveBadgeStates(badgeStats);
  const hasEarnedBadge = badgeStates.some(b => b.currentTier > 0);

  const hasCommunity = !!(social?.openToMentor || social?.helpingBeginners);

  // ── Inline VisPill: Public/Private toggle used inside card headers ─────────
  const VisPill = ({ sectionKey }: { sectionKey: string }) => {
    if (!isPreview) return null;
    const priv = localSectionVis[sectionKey] ?? false;
    return (
      <View style={s.visPillRow}>
        <TouchableOpacity
          style={[s.visPill, !priv && s.visPillActive]}
          onPress={() => { if (priv) toggleSection(sectionKey); }}
          activeOpacity={0.8}
        >
          <Text style={[s.visPillText, !priv ? s.visPillTextActive : s.visPillTextInactive]}>Public</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.visPill, priv && s.visPillPrivate]}
          onPress={() => { if (!priv) toggleSection(sectionKey); }}
          activeOpacity={0.8}
        >
          <Text style={[s.visPillText, priv ? s.visPillTextActive : s.visPillTextInactive]}>Private</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Determine initial location tab based on what data exists
  const locTabs = [
    ...(homeName ? [{ key: 'home' as const, label: 'Home', name: homeName, address: social?.houseAddress, lat: social?.houseLat, lng: social?.houseLng }] : []),
    ...(parkName ? [{ key: 'park' as const, label: 'Park', name: parkName, address: social?.parkArea,     lat: social?.parkLat,  lng: social?.parkLng  }] : []),
  ];
  const activeTab = locTabs.find(t => t.key === selectedLocTab) ?? locTabs[0];

  // ── Render ──────────────────────────────────────────────────────────────────
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
        </View>

        {isPreview && (
          <View style={s.previewBanner}>
            <Eye size={14} color={C.orange} />
            <Text style={s.previewBannerText}>Preview — this is how others see your profile</Text>
          </View>
        )}

        <ScrollView
          showsVerticalScrollIndicator={false}
          scrollEnabled={scrollEnabled}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={C.orange}
              colors={[C.orange]}
            />
          }
          contentContainerStyle={[s.scroll, { paddingBottom: isOwn ? 32 : 120 }]}
        >

          {/* ── HERO ───────────────────────────────────────────────────────── */}
          <View style={s.hero}>
            {/* Avatar + Name/Location/Profession row */}
            <View style={s.heroRow}>
              <View style={s.heroAvatarCol}>
                <TierAvatarRing
                  accessType={user?.accessType}
                  avatarSize={90}
                  avatarRadius={20}
                >
                  <View style={{ width: 90, height: 90, borderRadius: 20, overflow: 'hidden' }}>
                    <Avatar uri={user?.profileImageUrl} size={90} grayscale={isInactiveSince(user?.lastActiveAt)} />
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.72)']}
                      style={{
                        position: 'absolute',
                        bottom: 0, left: 0, right: 0,
                        height: 38,
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                        paddingBottom: 5,
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.4 }}>
                        {displayName.split(' ')[0]}
                      </Text>
                    </LinearGradient>
                  </View>
                </TierAvatarRing>
              </View>

              <View style={s.heroInfoCol}>
                <View style={s.nameLine}>
                  <Text style={s.name} numberOfLines={1}>{displayName}</Text>
                  {username ? <Text style={s.handle} numberOfLines={1}>@{username}</Text> : null}
                </View>
                {/* Gender · Connects · Squats — same row */}
                <View style={s.connectsRow}>
                  {genderMeta && (
                    <View style={[s.genderPill, { backgroundColor: genderMeta.bg, borderColor: genderMeta.border }]}>
                      <Text style={[s.genderPillText, { color: genderMeta.color }]}>{genderMeta.icon}</Text>
                    </View>
                  )}
                  {/* Connects — original indigo pill; the border colour reflects
                      social heat (hot → orange … cold → grey), signalling how
                      active they are with others. */}
                  <TouchableOpacity
                    style={s.connectsPill}
                    onPress={() => setConnectionsOpen(true)}
                    activeOpacity={0.75}
                    disabled={connections.length === 0}
                  >
                    <Text style={s.connectsCount}>{connections.length}</Text>
                    <Text style={s.connectsLabel}>CONNECTS</Text>
                    {heats && <HeatIcon level={heats.social.level} color={heats.social.color} size={12} />}
                  </TouchableOpacity>
                  {/* Workout pill — dumbbell + total workout count + hot/cold label.
                      The border colour reflects workout heat (hot → orange · warm →
                      amber · cool → blue · cold → grey), mirroring the Connects pill so
                      the count and the temperature both read at a glance. */}
                  {heats && (
                    <View style={[s.workoutPill, { backgroundColor: heats.workout.soft }]}>
                      <Dumbbell size={13} color={heats.workout.color} strokeWidth={2.4} />
                      <Text style={[s.workoutPillCount, { color: heats.workout.color }]}>{videosWatched}</Text>
                      <Text style={[s.workoutPillText, { color: heats.workout.color }]}>WORKOUTS</Text>
                      <HeatIcon level={heats.workout.level} color={heats.workout.color} size={14} />
                    </View>
                  )}
                </View>
                {showSection('locationMap') && (displayCity || homeDistanceText) ? (
                  <View style={s.heroMetaRow}>
                    <MapPin size={13} color={C.muted} />
                    <Text style={s.heroMetaText} numberOfLines={1}>
                      {[displayCity, homeDistanceText].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                ) : null}
                {showSection('whatIDo') && whatIDoItems.length > 0 ? (
                  <View style={s.heroMetaRow}>
                    <Briefcase size={13} color={C.muted} />
                    <Text style={s.heroMetaText} numberOfLines={2}>
                      {whatIDoItems.join(' · ')}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

          </View>

          {/* ── OPEN TO CHALLENGE — directly above the time stats ────────────── */}
          {/* Own profile: tap the stripe to edit. Other profiles: tap a chip to
              schedule a head-to-head challenge with this person on that exercise. */}
          {(isOwn || (showSection('openToChallenge') && (social?.openToChallenge?.length ?? 0) > 0)) && (() => {
            const inner = (
              <>
                <Swords size={14} color={C.orange} strokeWidth={2.2} />
                <Text style={s.challengeLabel}>Open to Challenge</Text>
                {(social?.openToChallenge?.length ?? 0) > 0 ? (
                  <View style={s.challengeChips}>
                    {social!.openToChallenge!.map((ex, idx) => {
                      const meta = CHALLENGE_EXERCISE_META[ex];
                      const label = meta ? `${meta.emoji} ${meta.label}` : ex;
                      return canChallenge ? (
                        <TouchableOpacity
                          key={`${ex}-${idx}`}
                          style={[s.challengeChip, s.challengeChipTappable]}
                          activeOpacity={0.7}
                          onPress={() => setChallengeExercise(meta ? meta.label : ex)}
                        >
                          <Text style={s.challengeChipText}>{label}</Text>
                        </TouchableOpacity>
                      ) : (
                        <View key={`${ex}-${idx}`} style={s.challengeChip}>
                          <Text style={s.challengeChipText}>{label}</Text>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={s.challengePrompt}>— add exercises</Text>
                )}
              </>
            );
            return isOwn ? (
              <TouchableOpacity
                style={s.challengeStripe}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('EditSocialProfileScreen', { section: 'challenge' })}
              >
                {inner}
              </TouchableOpacity>
            ) : (
              <View style={s.challengeStripe}>{inner}</View>
            );
          })()}

          {/* ── STANDALONE TIME STATS ────────────────────────────────────────── */}
          <View style={s.timeStatsRow}>
            <View style={s.timeStatItem}>
              <Text style={s.timeStatValue}>{fmtMins(weeklyMins)}</Text>
              <Text style={s.timeStatLabel}>WEEKLY</Text>
            </View>
            <View style={s.timeStatDivider} />
            <View style={s.timeStatItem}>
              <Text style={s.timeStatValue}>{fmtMins(lifetimeMins)}</Text>
              <Text style={s.timeStatLabel}>LIFETIME</Text>
            </View>
          </View>

          {/* ── ACTIVITY HINT (last online · usually replies in …) ──────────── */}
          {lastSeen && (
            <View style={s.activityHint}>
              <View style={[s.activityDot, { backgroundColor: lastSeen.color }]} />
              <Text style={s.activityHintText}>
                {lastSeen.text}{replyText ? ` · ${replyText}` : ''}
              </Text>
            </View>
          )}

          {/* ── ABOUT ME ─────────────────────────────────────────────────────── */}
          {showSection('about') && (bio.length > 0 || social?.projectsWorkingOn || social?.needHelpWith) && (
            <ProfileCard>
              <View style={s.cardHeaderRow}>
                <View style={s.aboutTitleGroup}>
                  <Text style={s.cardTitle}>About Me</Text>
                  {isPreview && (
                    <TouchableOpacity style={s.editBtn} activeOpacity={0.7}>
                      <Edit2 size={11} color={C.muted} />
                      <Text style={s.editBtnText}>Edit</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              {bio.length > 0 && <Text style={[s.bodyText, s.bodyTextOrange]}>{bio}</Text>}
              {(social?.projectsWorkingOn || social?.needHelpWith) && (
                <View style={{ marginTop: bio.length > 0 ? 12 : 0, gap: 10 }}>
                  {social?.projectsWorkingOn ? (
                    <View style={{ gap: 2 }}>
                      <Text style={{ color: C.text, fontSize: 12, fontWeight: '700', letterSpacing: 0.2 }}>🚀 Working on</Text>
                      <Text style={{ color: C.muted, fontSize: 13, lineHeight: 18 }}>{social.projectsWorkingOn}</Text>
                    </View>
                  ) : null}
                  {social?.needHelpWith ? (
                    <View style={{ gap: 2 }}>
                      <Text style={{ color: C.text, fontSize: 12, fontWeight: '700', letterSpacing: 0.2 }}>🤝 Need help with</Text>
                      <Text style={{ color: C.muted, fontSize: 13, lineHeight: 18 }}>{social.needHelpWith}</Text>
                    </View>
                  ) : null}
                </View>
              )}
            </ProfileCard>
          )}

          {/* ── ACTIVITY MAP — GitHub-style heatmap of workouts / co-workouts /
                challenges, with days since last workout ───────────────────── */}
          {!!uid && (
            <ProfileCard>
              <ActivityMap uid={uid} lastWorkoutDate={streakData?.lastWorkoutDate} />
            </ProfileCard>
          )}

          {/* ── EDIT PROFILE (own profile only) ──────────────────────────────── */}
          {isOwn && (
            <View style={s.ownActionRow}>
              <TouchableOpacity
                style={s.editProfileBtn}
                onPress={() => navigation.navigate('ProfileScreen')}
                activeOpacity={0.85}
              >
                <Edit2 size={15} color={C.text} />
                <Text style={s.editProfileBtnText}>Edit Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.previewIconBtn}
                onPress={() => (navigation as any).push('SocialProfileScreen', { uid: supabaseUserId, previewAsOther: true })}
                activeOpacity={0.85}
              >
                <Eye size={16} color={C.text} />
              </TouchableOpacity>
            </View>
          )}

          {/* ── PHOTOS ───────────────────────────────────────────────────────── */}
          {(isPreview || (showSection('gallery') && photos.length > 0)) && (
            <ProfileCard>
              <View style={s.cardHeaderRow}>
                <Text style={s.cardTitle}>Photos</Text>

              </View>
              <View style={s.photosContent}>
                {/* 3 thumbnails — grey placeholder when no photo */}
                <View style={s.photosThumbRow}>
                  {[0, 1, 2].map(i => (
                    <TouchableOpacity
                      key={i}
                      style={s.photoThumb}
                      activeOpacity={0.85}
                      onPress={() => { setFullscreenIdx(i); setGalleryOpen(true); }}
                      disabled={!photos[i]}
                    >
                      {photos[i] ? (
                        <Image source={{ uri: photos[i].url }} style={s.photoThumbImg} />
                      ) : null}
                    </TouchableOpacity>
                  ))}
                </View>
                {/* Count + View all */}
                <TouchableOpacity style={s.photosCountBlock} onPress={() => setGalleryOpen(true)} activeOpacity={0.75}>
                  <View style={s.photosCountRow}>
                    <Text style={s.photosCount}>{photos.length}</Text>
                    <Text style={s.photosViewAll}>View{'\n'}all</Text>
                  </View>
                  <Text style={s.photosLabel}>Photos</Text>
                  <Text style={s.photosTapHint}>Tap to view all</Text>
                </TouchableOpacity>
              </View>
            </ProfileCard>
          )}

          {/* ── TOP HOBBIES ──────────────────────────────────────────────────── */}
          {showSection('hobbies') && rankedHobbies.length > 0 && (
            <ProfileCard>
              <View style={s.cardHeaderRow}>
                <Text style={s.cardTitle}>Top Hobbies</Text>

              </View>
              <View style={s.hobbyCircleRow}>
                {rankedHobbies.map((hobby, idx) => {
                  const meta = HOBBY_META[hobby];
                  // Use the explicit 1–5 rating when set; otherwise fall back to position.
                  const rating = hobbyRanks[hobby] ?? 0;
                  const activeDots = rating > 0 ? Math.min(5, rating) : Math.max(1, 5 - idx);
                  return (
                    <View key={hobby} style={s.hobbyCircleWrapper}>
                      <View style={s.hobbyCircle}>
                        <Text style={s.hobbyCircleEmoji}>{meta.emoji}</Text>
                      </View>
                      <View style={s.hobbyRankDots}>
                        {[0, 1, 2, 3, 4].map(d => (
                          <View key={d} style={[s.hobbyRankDot, d < activeDots && s.hobbyRankDotActive]} />
                        ))}
                      </View>
                      <Text style={s.hobbyCircleLabel} numberOfLines={1}>{meta.label}</Text>
                    </View>
                  );
                })}
              </View>
            </ProfileCard>
          )}

          {/* ── LOCATION ─────────────────────────────────────────────────────── */}
          {showSection('locationMap') && hasLocation && locTabs.length > 0 && (
            <ProfileCard>
              <View style={s.cardHeaderRow}>
                <Text style={s.cardTitle}>Location</Text>

              </View>
              {/* Tab selector */}
              {locTabs.length > 1 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.locTabRow}
                >
                  {locTabs.map(tab => (
                    <TouchableOpacity
                      key={tab.key}
                      style={[s.locTab, (activeTab?.key ?? locTabs[0].key) === tab.key && s.locTabActive]}
                      onPress={() => setSelectedLocTab(tab.key)}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.locTabText, (activeTab?.key ?? locTabs[0].key) === tab.key && s.locTabTextActive]}>
                        {tab.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              {/* Map */}
              {activeTab && (activeTab.lat || activeTab.lng) ? (
                <LocationsMap
                  points={[{ lat: activeTab.lat ?? 0, lng: activeTab.lng ?? 0, label: activeTab.label }]}
                  onMapTouchStart={() => setScrollEnabled(false)}
                  onMapTouchEnd={() => setScrollEnabled(true)}
                />
              ) : null}
              {/* Detail row */}
              {activeTab && (
                <View style={s.locDetail}>
                  <Text style={s.locDetailName}>{activeTab.name}</Text>
                  {activeTab.address ? (
                    <Text style={s.locDetailAddr}>{activeTab.address}</Text>
                  ) : null}
                </View>
              )}
            </ProfileCard>
          )}

          {/* ── SUMMARY ──────────────────────────────────────────────────────── */}
          {showSection('summary') && !!social?.aiSummary && (
            <ProfileCard>
              <View style={s.cardHeaderRow}>
                <Text style={s.cardTitle}>Summary</Text>

              </View>
              <Text style={s.bodyText}>{social.aiSummary}</Text>
            </ProfileCard>
          )}

          {/* ── STATS ────────────────────────────────────────────────────────── */}
          {showSection('stats') && (
          <ProfileCard>
            <View style={s.cardHeaderRow}>
              <Text style={s.cardTitle}>Stats</Text>

            </View>
            <View style={s.statsRow}>
              <View style={s.statsItem}>
                <View style={s.statsIcon}><Flame size={15} color={C.orange} /></View>
                <Text style={s.statsValue}>{streak}</Text>
                <Text style={s.statsLabel}>Streak</Text>
              </View>
              <View style={s.statsItemDivider} />
              <View style={s.statsItem}>
                <View style={s.statsIcon}><Dumbbell size={15} color={C.orange} /></View>
                <Text style={s.statsValue}>{workouts}</Text>
                <Text style={s.statsLabel}>Workouts</Text>
              </View>
              <View style={s.statsItemDivider} />
              <View style={s.statsItem}>
                <View style={s.statsIcon}><Trophy size={15} color={C.orange} /></View>
                <Text style={s.statsValue}>{prs}</Text>
                <Text style={s.statsLabel}>Best Streak</Text>
              </View>
            </View>
          </ProfileCard>
          )}

          {/* ── BADGES ───────────────────────────────────────────────────────── */}
          {showSection('badges') && hasEarnedBadge && (
            <ProfileCard>
              <View style={s.cardHeaderRow}>
                <Text style={s.cardTitle}>Badges</Text>

              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.badgesScroll}
              >
                {[...BADGE_FAMILIES]
                  .sort((a, b) => {
                    const tA = badgeStates.find(bs => bs.familyKey === a.key)?.currentTier ?? 0;
                    const tB = badgeStates.find(bs => bs.familyKey === b.key)?.currentTier ?? 0;
                    return tB - tA;
                  })
                  .filter(family => (badgeStates.find(bs => bs.familyKey === family.key)?.currentTier ?? 0) > 0)
                  .map(family => {
                    const state = badgeStates.find(bs => bs.familyKey === family.key);
                    const tier  = state?.currentTier ?? 0;
                    const color = TIER_COLORS[tier - 1];
                    const isStreak = family.key === 'streak';
                    const badgeInner = (
                      <>
                        <Text style={s.badgeEmoji}>{family.emoji}</Text>
                        <View style={[s.badgeLevelChip, { backgroundColor: color }]}>
                          <Text style={s.badgeLevelChipText}>Lv.{tier}</Text>
                        </View>
                      </>
                    );
                    return (
                      <View key={family.key} style={s.badgeItemContainer}>
                        {isStreak ? (
                          <FireGlowBadge color={color}>{badgeInner}</FireGlowBadge>
                        ) : (
                          <View style={[s.badgeShape, { borderColor: color + '88', backgroundColor: color + '22' }]}>
                            {badgeInner}
                          </View>
                        )}
                        <Text style={s.badgeLabel} numberOfLines={1}>{family.label}</Text>
                      </View>
                    );
                  })}
              </ScrollView>
            </ProfileCard>
          )}

          {/* ── LOOKING TO MEET ──────────────────────────────────────────────── */}
          {showSection('meet') && lookingItems.length > 0 && (
            <ProfileCard>
              <View style={s.cardHeaderRow}>
                <Text style={s.cardTitle}>Looking to meet</Text>
              </View>
              <View style={s.capsuleRow}>
                {lookingItems.map((item, idx) => (
                  <View key={`${item}-${idx}`} style={s.meetCapsule}>
                    <Text style={s.meetCapsuleText}>{item}</Text>
                  </View>
                ))}
              </View>
            </ProfileCard>
          )}

          {/* ── COMMUNITY ────────────────────────────────────────────────────── */}
          {showSection('community') && (hasCommunity || !!social?.communityNote) && (
            <ProfileCard>
              <View style={s.cardHeaderRow}>
                <Text style={s.cardTitle}>Community</Text>
              </View>
              <View style={{ gap: 10, marginTop: 4 }}>
                {social?.communityNote ? (
                  <Text style={s.bodyText}>{social.communityNote}</Text>
                ) : null}
                {social?.openToMentor && (
                  <View style={s.capsuleRow}>
                    <View style={s.whatIDoCapsule}>
                      <Text style={s.whatIDoCapsuleText}>Open to Mentor</Text>
                    </View>
                  </View>
                )}
                {social?.helpingBeginners && (
                  <View style={s.capsuleRow}>
                    <View style={s.meetCapsule}>
                      <Text style={s.meetCapsuleText}>Helping Beginners</Text>
                    </View>
                  </View>
                )}
              </View>
            </ProfileCard>
          )}

          <View style={{ height: 16 }} />
        </ScrollView>

        {/* ── BOTTOM CTA ─────────────────────────────────────────────────── */}
        {isPreview && (
          <RNAnimated.View style={[s.bottomCta, { opacity: ctaAnim }]}>
            <TouchableOpacity
              style={[s.ctaConnect, { flex: 1 }]}
              onPress={() => navigation.goBack()}
              activeOpacity={0.85}
            >
              <Eye size={18} color="#211832" />
              <Text style={s.ctaConnectText}>Exit Preview</Text>
            </TouchableOpacity>
          </RNAnimated.View>
        )}

        {!isOwn && !isPreview && (
          <RNAnimated.View style={[s.bottomCta, { opacity: ctaAnim }]}>
            <TouchableOpacity
              style={s.ctaMessage}
              onPress={() => navigation.navigate('ChatRoom', {
                friendUid: uid,
                friendName: displayName,
                friendAvatar: user?.profileImageUrl,
              })}
              activeOpacity={0.85}
            >
              <MessageCircle size={18} color={C.text} />
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
                ? <ActivityIndicator size="small" color="#211832" />
                : relStatus === 'friends'
                  ? <UserCheck size={18} color={C.green} />
                  : <UserPlus size={18} color={relStatus === 'pending_sent' ? C.muted : '#211832'} />
              }
              <Text style={[
                s.ctaConnectText,
                relStatus === 'friends'      && { color: C.green },
                relStatus === 'pending_sent' && { color: C.muted },
              ]}>
                {connectLabel()}
              </Text>
            </TouchableOpacity>
          </RNAnimated.View>
        )}
      </SafeAreaView>

      {/* ── Photo Gallery Modal ─────────────────────────────────────────── */}
      <Modal
        visible={galleryOpen}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => {
          if (fullscreenIdx !== null) setFullscreenIdx(null);
          else setGalleryOpen(false);
        }}
      >
        <View style={s.galleryModal}>
          <StatusBar barStyle="light-content" backgroundColor="#000" />

          {/* Header */}
          <View style={s.galleryHeader}>
            <TouchableOpacity
              style={s.galleryHeaderBtn}
              onPress={() => {
                if (fullscreenIdx !== null) setFullscreenIdx(null);
                else setGalleryOpen(false);
              }}
              activeOpacity={0.75}
            >
              <Text style={s.galleryHeaderBtnText}>
                {fullscreenIdx !== null ? '‹ Back' : '✕'}
              </Text>
            </TouchableOpacity>
            <Text style={s.galleryHeaderTitle}>
              {fullscreenIdx !== null
                ? `${fullscreenIdx + 1} / ${photos.length}`
                : `Photos (${photos.length})`}
            </Text>
            <View style={s.galleryHeaderBtn} />
          </View>

          {fullscreenIdx !== null ? (
            /* ── Full-screen viewer ── */
            <View style={s.fullscreenBg}>
              <Image
                source={{ uri: photos[fullscreenIdx]?.url }}
                style={s.fullscreenImg}
                resizeMode="contain"
              />
              {/* Prev / Next */}
              <View style={s.fullscreenNavRow}>
                <TouchableOpacity
                  style={[s.fullscreenNavBtn, fullscreenIdx === 0 && s.fullscreenNavBtnDisabled]}
                  onPress={() => fullscreenIdx > 0 && setFullscreenIdx(fullscreenIdx - 1)}
                  activeOpacity={0.75}
                >
                  <Text style={s.fullscreenNavText}>‹</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.fullscreenNavBtn, fullscreenIdx === photos.length - 1 && s.fullscreenNavBtnDisabled]}
                  onPress={() => fullscreenIdx < photos.length - 1 && setFullscreenIdx(fullscreenIdx + 1)}
                  activeOpacity={0.75}
                >
                  <Text style={s.fullscreenNavText}>›</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* ── Grid view ── */
            <ScrollView
              contentContainerStyle={s.galleryGrid}
              showsVerticalScrollIndicator={false}
            >
              {photos.map((photo, idx) => (
                <TouchableOpacity
                  key={photo.id ?? idx}
                  style={s.galleryThumb}
                  activeOpacity={0.85}
                  onPress={() => setFullscreenIdx(idx)}
                >
                  <Image source={{ uri: photo.url }} style={s.galleryThumbImg} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* ── Connections list ─────────────────────────────────────────────── */}
      <Modal
        visible={connectionsOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setConnectionsOpen(false)}
      >
        <View style={s.connOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setConnectionsOpen(false)} />
          <View style={s.connSheet}>
            <View style={s.connHeader}>
              <Text style={s.connTitle}>Connections · {connections.length}</Text>
              <TouchableOpacity onPress={() => setConnectionsOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={20} color={C.muted} strokeWidth={2.2} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
              {connections.length === 0 ? (
                <Text style={s.connEmpty}>No connections yet.</Text>
              ) : connections.map(c => (
                <TouchableOpacity
                  key={c.uid}
                  style={s.connRow}
                  activeOpacity={0.8}
                  onPress={() => {
                    setConnectionsOpen(false);
                    (navigation as any).push('SocialProfileScreen', { uid: c.uid });
                  }}
                >
                  <Avatar uri={c.profileImageUrl} size={44} grayscale={isInactiveSince(c.lastActiveAt)} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={s.connNameRow}>
                      <Text style={s.connName} numberOfLines={1}>{c.fullName || c.username || 'Athlete'}</Text>
                      {(() => {
                        const gm = genderMetaOf(c.gender);
                        return gm ? (
                          <View style={[s.connGenderPill, { backgroundColor: gm.bg, borderColor: gm.border }]}>
                            <Text style={[s.connGenderIcon, { color: gm.color }]}>{gm.icon}</Text>
                          </View>
                        ) : null;
                      })()}
                    </View>
                    {c.username ? <Text style={s.connSub} numberOfLines={1}>@{c.username}</Text> : null}
                    {(() => {
                      const a = appActiveLabel(c.lastActiveAt);
                      return (
                        <View style={s.connActivityRow}>
                          <View style={[s.connDot, { backgroundColor: a.color }]} />
                          <Text style={[s.connActivityText, { color: a.color }]}>{a.text}</Text>
                        </View>
                      );
                    })()}
                    {/* Hot/cold heat — social + workout, loaded per connection */}
                    {connHeats[c.uid] && (
                      <View style={s.connHeatRow}>
                        <View style={[s.connHeatChip, { backgroundColor: connHeats[c.uid].social.soft }]}>
                          <Users size={11} color={connHeats[c.uid].social.color} strokeWidth={2.4} />
                          <HeatIcon level={connHeats[c.uid].social.level} color={connHeats[c.uid].social.color} size={11} />
                        </View>
                        <View style={[s.connHeatChip, { backgroundColor: connHeats[c.uid].workout.soft }]}>
                          <Dumbbell size={11} color={connHeats[c.uid].workout.color} strokeWidth={2.4} />
                          <HeatIcon level={connHeats[c.uid].workout.level} color={connHeats[c.uid].workout.color} size={11} />
                        </View>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Connection short-profile preview ─────────────────────────────────── */}
      <ProfilePreviewSheet
        user={connPreview}
        visible={!!connPreview}
        onClose={() => setConnPreview(null)}
        onViewProfile={(u) => { setConnPreview(null); (navigation as any).push('SocialProfileScreen', { uid: u }); }}
        onMessage={(u) => {
          setConnPreview(null);
          navigation.navigate('ChatRoom', {
            friendUid: u.uid,
            friendName: u.fullName || u.username,
            friendAvatar: u.avatarUrl,
          });
        }}
      />

      {/* ── Schedule a challenge with this person on a tapped exercise ────────── */}
      {canChallenge && (
        <ScheduleChallengeModal
          visible={!!challengeExercise}
          opponentUid={uid}
          opponentName={displayName}
          opponentAvatar={user?.profileImageUrl}
          exerciseName={challengeExercise ?? ''}
          onClose={() => setChallengeExercise(null)}
        />
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },

  // Header
  topBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  navBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  previewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(242,89,18,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(242,89,18,0.3)',
  },
  previewBannerText: {
    color: C.orange,
    fontSize: 12,
    fontWeight: '700',
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
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    alignSelf: 'stretch',
  },
  heroAvatarCol: {
    alignItems: 'center',
  },
  heroInfoCol: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
  },
  nameLine: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 1,
  },
  name: {
    color: C.text,
    fontSize: 22,
    fontWeight: '800',
  },
  handle: {
    color: C.muted,
    fontSize: 15,
    fontWeight: '600',
  },
  connectsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  genderPill: {
    width: 26,
    height: 26,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  genderPillText: { fontSize: 15, fontWeight: '900', lineHeight: 18 },
  connectsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#4C4E78',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  connectsCount: { color: '#fff', fontSize: 13, fontWeight: '700' },
  connectsLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 9, fontWeight: '600', letterSpacing: 0.4 },
  workoutPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  workoutPillCount: { fontSize: 13, fontWeight: '800' },
  workoutPillText: { fontSize: 9, fontWeight: '600', letterSpacing: 0.4 },
  connOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  connSheet: {
    maxHeight: '75%',
    backgroundColor: C.bg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  connHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  connTitle: { color: C.text, fontSize: 17, fontWeight: '800' },
  connEmpty: { color: C.muted, fontSize: 14, textAlign: 'center', paddingVertical: 24 },
  connRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.cardBg,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  connNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  connName: { color: C.text, fontSize: 14, fontWeight: '700', flexShrink: 1 },
  connSub: { color: C.muted, fontSize: 12, marginTop: 2 },
  connGenderPill: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  connGenderIcon: { fontSize: 11, fontWeight: '900', lineHeight: 13 },
  connActivityRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  connDot: { width: 7, height: 7, borderRadius: 3.5 },
  connActivityText: { fontSize: 11, fontWeight: '700' },
  connHeatRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  connHeatChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 100,
  },
  openBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    backgroundColor: C.accentSoft,
    borderWidth: 1, borderColor: C.accentBorder,
    borderRadius: 13,
    paddingHorizontal: 9, paddingVertical: 3,
    marginTop: 8,
  },
  openDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: C.orange,
  },
  openText: {
    color: C.orange,
    fontSize: 11,
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

  // Capsules (Profession / Goals / Hobbies / Looking to meet)
  capsuleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  hobbyCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: C.accentBorder,
    backgroundColor: C.accentSoft,
    gap: 6,
  },
  hobbyRankEmoji: {
    fontSize: 15,
  },
  hobbyCapsuleText: {
    color: C.orange,
    fontSize: 14,
    fontWeight: '600',
  },
  meetCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(33,24,50,0.12)',
    backgroundColor: 'rgba(33,24,50,0.05)',
  },
  meetCapsuleText: {
    color: C.muted,
    fontSize: 12,
    fontWeight: '500',
  },
  whatIDoCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(33,24,50,0.12)',
    backgroundColor: 'rgba(33,24,50,0.05)',
  },
  whatIDoCapsuleText: {
    color: C.muted,
    fontSize: 12,
    fontWeight: '500',
  },

  // Gallery
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  galleryItem: {
    width: 92,
    height: 92,
    borderRadius: 12,
    overflow: 'hidden',
  },
  galleryImg: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },

  // Badges
  badgesScroll: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
    alignItems: 'flex-start',
    paddingBottom: 4,
  },
  badgeItemContainer: {
    alignItems: 'center',
    width: 52,
    gap: 10,
  },
  badgeShape: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  badgeEmoji: {
    fontSize: 20,
  },
  badgeLevelChip: {
    position: 'absolute',
    bottom: -5,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    minWidth: 22,
    alignItems: 'center',
  },
  badgeLevelChipText: {
    color: '#211832',
    fontSize: 8,
    fontWeight: '800',
  },
  badgeLabel: {
    color: C.text,
    fontSize: 10,
    fontWeight: '600',
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
    backgroundColor: C.bg,
    borderTopWidth: 1,
    borderTopColor: C.cardBorder,
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
    borderWidth: 1, borderColor: 'rgba(33,24,50,0.18)',
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
    backgroundColor: C.orange,
    borderRadius: 22,
    paddingVertical: 15,
    minHeight: 52,
  },
  ctaConnectDone: {
    backgroundColor: C.greenSoft,
    borderWidth: 1, borderColor: C.greenBorder,
  },
  ctaConnectPending: {
    backgroundColor: C.cardBg,
    borderWidth: 1, borderColor: C.cardBorder,
  },
  ctaConnectText: {
    color: '#211832',
    fontWeight: '700',
    fontSize: 15,
  },

  // Hero inline meta (location + profession)
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    marginTop: 5,
  },
  heroMetaText: {
    color: C.muted,
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
    lineHeight: 17,
  },

  // Interest pills (inside hero, below avatar row)
  interestPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
    alignSelf: 'stretch',
  },
  interestPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(33,24,50,0.12)',
    backgroundColor: 'rgba(33,24,50,0.05)',
  },
  interestPillText: {
    color: '#7A7C90',
    fontSize: 10,
    fontWeight: '500',
  },

  // Hero Public/Private toggle
  heroVisRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    alignSelf: 'stretch',
  },
  heroVisPill: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(33,24,50,0.14)',
    backgroundColor: 'transparent',
  },
  heroVisPillActive: {
    backgroundColor: C.text,
    borderColor: C.text,
  },
  heroVisPillPrivate: {
    borderColor: 'rgba(33,24,50,0.14)',
    backgroundColor: 'transparent',
  },
  heroVisPillText: {
    fontSize: 15,
    fontWeight: '700',
  },
  heroVisPillTextActive: {
    color: '#fff',
  },
  heroVisPillTextInactive: {
    color: C.muted,
  },

  challengeStripe: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 2,
  },
  challengeLabel: {
    color: C.text,
    fontSize: 12.5,
    fontWeight: '700',
  },
  challengeChips: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  challengeChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(242,89,18,0.28)',
    backgroundColor: 'rgba(242,89,18,0.10)',
  },
  // Stronger fill signals these chips are tappable (schedule a challenge).
  challengeChipTappable: {
    borderColor: 'rgba(242,89,18,0.5)',
    backgroundColor: 'rgba(242,89,18,0.16)',
  },
  challengeChipText: {
    color: C.orange,
    fontSize: 11.5,
    fontWeight: '700',
  },
  challengePrompt: {
    color: C.muted,
    fontSize: 12.5,
    fontWeight: '600',
  },
  timeStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  timeStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  timeStatValue: {
    color: C.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  timeStatLabel: {
    color: C.muted,
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  timeStatDivider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
    backgroundColor: 'rgba(33,24,50,0.14)',
  },

  // Likely-to-connect hint
  activityHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginHorizontal: 16,
    marginTop: 2,
    marginBottom: 4,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  activityDot: { width: 7, height: 7, borderRadius: 4 },
  activityHintText: { color: C.text, fontSize: 12, fontWeight: '600' },
  ownActionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  editProfileBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  editProfileBtnText: {
    color: C.text,
    fontSize: 14,
    fontWeight: '800',
  },
  previewIconBtn: {
    width: 46,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },

  // VisPill (inline Public/Private in card headers)
  visPillRow: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  visPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(33,24,50,0.14)',
    backgroundColor: 'transparent',
  },
  visPillActive: {
    backgroundColor: C.text,
    borderColor: C.text,
  },
  visPillPrivate: {
    borderColor: 'rgba(33,24,50,0.14)',
    backgroundColor: 'transparent',
  },
  visPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  visPillTextActive: {
    color: '#fff',
  },
  visPillTextInactive: {
    color: C.muted,
  },

  // Photos card content layout
  photosContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  photosThumbRow: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
  },
  photoThumb: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(33,24,50,0.06)',
  },
  photoThumbImg: {
    width: '100%',
    height: '100%',
  },
  photosCountBlock: {
    alignItems: 'flex-start',
    width: 72,
  },
  photosCountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  photosCount: {
    color: C.text,
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 36,
  },
  photosViewAll: {
    color: C.orange,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  photosLabel: {
    color: C.muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  photosTapHint: {
    color: C.muted,
    fontSize: 10,
    fontWeight: '400',
    marginTop: 4,
  },

  // About Me card header group + edit link
  aboutTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editBtnText: {
    color: C.muted,
    fontSize: 12,
    fontWeight: '500',
  },
  bodyTextOrange: {
    color: C.orange,
  },

  // Card subtitle count
  cardSubCount: {
    color: C.muted,
    fontSize: 12,
    fontWeight: '500',
  },

  // Stats card
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 4,
  },
  statsItem: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  statsItemDivider: {
    width: StyleSheet.hairlineWidth,
    height: 36,
    backgroundColor: 'rgba(33,24,50,0.08)',
  },
  statsIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsValue: {
    color: C.text,
    fontSize: 16,
    fontWeight: '800',
  },
  statsLabel: {
    color: C.muted,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },

  // Hobby circles
  hobbyCircleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 8,
  },
  hobbyCircleWrapper: {
    alignItems: 'center',
    gap: 6,
    width: 64,
  },
  hobbyCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(76,78,120,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(76,78,120,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hobbyCircleEmoji: {
    fontSize: 26,
  },
  hobbyRankDots: {
    flexDirection: 'row',
    gap: 3,
  },
  hobbyRankDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(33,24,50,0.12)',
  },
  hobbyRankDotActive: {
    backgroundColor: '#4C4E78',
  },
  hobbyCircleLabel: {
    color: C.text,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Location tabs
  locTabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  locTab: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(33,24,50,0.10)',
    backgroundColor: 'transparent',
  },
  locTabActive: {
    backgroundColor: '#4C4E78',
    borderColor: '#4C4E78',
  },
  locTabText: {
    color: C.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  locTabTextActive: {
    color: '#fff',
  },
  locDetail: {
    marginTop: 10,
  },
  locDetailName: {
    color: C.text,
    fontSize: 14,
    fontWeight: '700',
  },
  locDetailAddr: {
    color: C.muted,
    fontSize: 12,
    marginTop: 3,
  },

  // Skeleton
  skeletonShell: {
    paddingHorizontal: 18,
    paddingTop: 20,
    alignItems: 'center',
    gap: 14,
  },
  skeletonBone: {
    backgroundColor: 'rgba(33,24,50,0.06)',
  },

  // Gallery modal
  galleryModal: {
    flex: 1,
    backgroundColor: '#111',
  },
  galleryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#000',
  },
  galleryHeaderBtn: {
    width: 48,
    alignItems: 'center',
  },
  galleryHeaderBtnText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '600',
  },
  galleryHeaderTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 6,
  },
  galleryThumb: {
    width: (Dimensions.get('window').width - 36) / 3,
    height: (Dimensions.get('window').width - 36) / 3,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  galleryThumbImg: {
    width: '100%',
    height: '100%',
  },

  // Full-screen viewer
  fullscreenBg: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImg: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height * 0.75,
  },
  fullscreenNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'absolute',
    bottom: 40,
    left: 24,
    right: 24,
  },
  fullscreenNavBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenNavBtnDisabled: {
    opacity: 0.3,
  },
  fullscreenNavText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 32,
  },
});
