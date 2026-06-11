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
  Trophy,
  UserCheck,
  UserPlus,
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
import { SocialProfile, HOBBY_META, CONNECTION_GOAL_META } from '../models/SocialProfile';
import { RelationshipStatus } from '../models/Friend';
import { ProfileCard } from '../components/profile/ProfileCard';
import { LocationsMap } from '../components/profile/LocationsMap';
import { TierAvatarRing } from '../components/profile/TierAvatarRing';

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
function Avatar({ uri, size }: { uri?: string | null; size: number }) {
  const [err, setErr] = useState(false);
  if (uri && !err) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: Math.round(size * 0.22) }}
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
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  return `${km.toFixed(1)} km away`;
}

const fmtMins = (mins: number) => {
  const m = Math.round(mins);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
};

// ── Screen ─────────────────────────────────────────────────────────────────────
export function SocialProfileScreen() {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const { supabaseUserId } = useAuth();
  const { sendRequest } = useFriend();

  const uid       = (route.params?.uid as string) ?? supabaseUserId ?? '';
  const isPreview = route.params?.previewAsOther === true && uid === supabaseUserId;
  const isOwn     = uid === supabaseUserId && !isPreview;

  // Local copy of section visibility so preview toggles update instantly.
  const [localSectionVis, setLocalSectionVis] = useState<Record<string, boolean>>({});
  const [selectedLocTab, setSelectedLocTab] = useState<'home' | 'gym' | 'park'>('home');

  // A section is shown to a viewer unless its owner marked it private.
  // Preview / owner always sees every section (so they can toggle visibility).
  const showSection = (key: string) => isOwn || isPreview || !localSectionVis[key];

  const [user,       setUser]       = useState<User | null>(null);
  const [social,     setSocial]     = useState<SocialProfile | null>(null);
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

  const whatIDoItems = (social?.whatIDo?.trim() || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  const lookingItems = (social?.lookingToMeet?.trim() || '')
    .split(',').map(s => s.trim()).filter(Boolean);

  const streak   = streakData?.currentStreak ?? user?.currentStreak    ?? 0;
  const workouts = streakData?.totalWorkouts ?? user?.completedWorkouts ?? 0;
  const prs      = streakData?.bestStreak    ?? user?.bestStreak        ?? 0;

  // Weekly · Avg · Lifetime time stats
  const weeklyMins = streakData
    ? Object.values(streakData.weeklyMinutes).reduce((a, b) => a + b, 0)
    : 0;
  const lifetimeMins = Math.round(
    user?.watchedMinutes ?? (user?.workoutSeconds ? user.workoutSeconds / 60 : 0)
  );
  const avgMins = workouts > 0 ? Math.round(lifetimeMins / workouts) : 0;

  // Location data
  const gymName  = social?.gymName?.trim()   || '';
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

  // Gym → area/neighbourhood only (never street-level)
  const gymArea = (() => {
    const addr = social?.gymAddress;
    if (addr) {
      const parts = addr.split(',').map(p => p.trim()).filter(Boolean);
      return parts[1] || parts[2] || parts[0];
    }
    return gymName;
  })();

  // Distance from viewer's home → profile user's home (for location line)
  const homeDistanceText = (() => {
    if (!viewerHome || !social?.houseLat || !social?.houseLng) return '';
    return fmtDistance(haversineKm(viewerHome.lat, viewerHome.lng, social.houseLat, social.houseLng));
  })();

  // Distance from viewer's home → profile user's gym (for profession line)
  const gymDistanceText = (() => {
    if (!viewerHome || !social?.gymLat || !social?.gymLng) return '';
    return fmtDistance(haversineKm(viewerHome.lat, viewerHome.lng, social.gymLat, social.gymLng));
  })();
  const hasLocation = !!(
    social?.gymLat || social?.gymLng ||
    social?.houseLat || social?.houseLng ||
    social?.parkLat || social?.parkLng ||
    gymName || homeName || parkName
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
    ...(gymName  ? [{ key: 'gym'  as const, label: 'Gym',  name: gymName,  address: social?.gymAddress,   lat: social?.gymLat,   lng: social?.gymLng   }] : []),
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
                  <Avatar uri={user?.profileImageUrl} size={90} />
                </TierAvatarRing>
              </View>

              <View style={s.heroInfoCol}>
                <View style={s.nameLine}>
                  <Text style={s.name} numberOfLines={1}>{displayName}</Text>
                  {username ? <Text style={s.handle} numberOfLines={1}> @{username}</Text> : null}
                </View>
                {(displayCity || homeDistanceText) ? (
                  <View style={s.heroMetaRow}>
                    <MapPin size={13} color={C.muted} />
                    <Text style={s.heroMetaText} numberOfLines={1}>
                      {[displayCity, homeDistanceText].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                ) : null}
                {(whatIDoItems.length > 0 || gymArea) ? (
                  <View style={s.heroMetaRow}>
                    <Briefcase size={13} color={C.muted} />
                    <Text style={s.heroMetaText} numberOfLines={2}>
                      {[...whatIDoItems, gymArea, gymDistanceText].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

          </View>

          {/* ── STANDALONE TIME STATS ────────────────────────────────────────── */}
          <View style={s.timeStatsRow}>
            <View style={s.timeStatItem}>
              <Text style={s.timeStatValue}>{fmtMins(weeklyMins)}</Text>
              <Text style={s.timeStatLabel}>WEEKLY</Text>
            </View>
            <View style={s.timeStatDivider} />
            <View style={s.timeStatItem}>
              <Text style={s.timeStatValue}>{fmtMins(avgMins)}</Text>
              <Text style={s.timeStatLabel}>AVG</Text>
            </View>
            <View style={s.timeStatDivider} />
            <View style={s.timeStatItem}>
              <Text style={s.timeStatValue}>{fmtMins(lifetimeMins)}</Text>
              <Text style={s.timeStatLabel}>LIFETIME</Text>
            </View>
          </View>

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

          {/* ── ABOUT ME ─────────────────────────────────────────────────────── */}
          {showSection('about') && bio.length > 0 && (
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
              <Text style={[s.bodyText, s.bodyTextOrange]}>{bio}</Text>
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
                  const activeDots = Math.max(0, 5 - idx);
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
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 8,
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

  // Standalone time stats row (below hero, above cards)
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
    backgroundColor: C.accentSoft,
    borderWidth: 1.5,
    borderColor: C.accentBorder,
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
    backgroundColor: C.orange,
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
    backgroundColor: C.orange,
    borderColor: C.orange,
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
