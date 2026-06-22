/**
 * ProfileScreen — own-user profile.
 * Layout matches reference image exactly:
 *   Header → Hero (avatar + name + pill) → Stats (3) → About me →
 *   What I do → Looking to meet → 3 location cards → Hobbies →
 *   Community → Badges → bottom CTA bar.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated as RNAnimated,
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
import { useNavigation } from '@react-navigation/native';
import {
  ArrowLeft,
  Bike,
  BookOpen,
  Briefcase,
  Camera,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  Dumbbell,
  Eye,
  Flame,
  Globe,
  HeartHandshake,
  Home,
  Lock,
  MapPin,
  Pencil,
  QrCode,
  Settings,
  Trees,
  Users,
  Check,
  X,
  Sparkles,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { StorageService } from '../services/storage.service';
import { supabase } from '../core/config/supabase';
import { useAuth } from '../providers/AuthContext';
import { useUser } from '../providers/UserContext';
import { useFriend } from '../providers/FriendContext';
import { SocialProfileService } from '../services/socialProfile.service';
import { GalleryService, ProfilePhoto } from '../services/gallery.service';
import { generateProfileSummary } from '../services/profileSummary.service';
import { coarseLocality } from '../utils/locality';
import { StreakService, StreakData } from '../services/streak.service';
import { ALL_BADGES, Badge } from '../services/rewards.service';
import { BADGE_FAMILIES, TIER_COLORS, getTierName } from '../services/badge.types';
import { deriveBadgeStates, UserBadgeStats } from '../services/badge.service';
import { SocialProfile, HOBBY_META, CONNECTION_GOAL_META, Hobby } from '../models/SocialProfile';
import { StatPill } from '../components/profile/StatPill';
import { HobbyCircle } from '../components/profile/HobbyCircle';
import { ChipPill } from '../components/profile/ChipPill';
import { LocationRow } from '../components/profile/LocationRow';
import { LocationsMap } from '../components/profile/LocationsMap';
import { ProfileCard } from '../components/profile/ProfileCard';
import { TierAvatarRing } from '../components/profile/TierAvatarRing';
import BodyVisualizer from '../components/profile/BodyVisualizer';
import GoalVisualizer from '../components/profile/GoalVisualizer';
import { LinearGradient } from 'expo-linear-gradient';

// ── Fire glow badge wrapper (streak only) ─────────────────────────────────────
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
      width: 64, height: 64, borderRadius: 18,
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

// ── Design tokens ──────────────────────────────────────────────────────────────
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

function deriveBadges(streakData: StreakData | null): Badge[] {
  if (!streakData) return [];
  const ids = new Set(streakData.badges ?? []);
  if (streakData.totalWorkouts >= 1)     ids.add('first_workout');
  if (streakData.bestStreak >= 7)        ids.add('7_day_streak');
  if (streakData.bestStreak >= 14)       ids.add('14_day_streak');
  if (streakData.totalLiveSessions >= 1) ids.add('first_live_session');
  return ALL_BADGES.filter(b => ids.has(b.id));
}

function buildBadgeStatsFromStreak(streakData: StreakData | null): UserBadgeStats {
  return {
    bestStreak:        streakData?.bestStreak ?? 0,
    totalWorkouts:     streakData?.totalWorkouts ?? 0,
    totalLiveSessions: streakData?.totalLiveSessions ?? 0,
    totalViewers:      0,
    coachSessions:     0,
    totalWatchMinutes: Math.floor(((streakData as any)?.watchedSeconds ?? 0) / 60),
    founderTier:       0,
  };
}

// ── Screen ─────────────────────────────────────────────────────────────────────
export const ProfileScreen = () => {
  const navigation = useNavigation<any>();
  const { supabaseUserId } = useAuth();
  const { profile, updateProfile } = useUser();
  const { friends } = useFriend();

  const [social,     setSocial]     = useState<SocialProfile | null>(null);
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [photos,     setPhotos]     = useState<ProfilePhoto[]>([]);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [genningSummary, setGenningSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const pulse = useRef(new RNAnimated.Value(0.45)).current;

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async (silent = false) => {
    if (!supabaseUserId) return;
    if (!silent) setLoading(true);
    try {
      const [sp, streak, gallery] = await Promise.all([
        SocialProfileService.get(supabaseUserId),
        StreakService.getStreakData(supabaseUserId),
        GalleryService.list(supabaseUserId),
      ]);
      setSocial(sp);
      setStreakData(streak);
      setPhotos(gallery);
    } catch {}
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supabaseUserId]);

  useEffect(() => { load(); }, [load]);

  // Reload when returning to the screen (e.g. after editing hobbies/ratings),
  // otherwise the profile keeps showing stale data.
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => load());
    return unsub;
  }, [navigation, load]);

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

  const handleSetPrivacy = async (level: 'public' | 'friends_only' | 'private') => {
    if (!supabaseUserId) return;
    if (social?.privacyLevel === level) return;
    
    const prevLevel = social?.privacyLevel || 'public';
    // Optimistic update
    setSocial(prev => prev ? { ...prev, privacyLevel: level } : null);

    try {
      await SocialProfileService.update(supabaseUserId, { privacyLevel: level });
    } catch (err) {
      console.warn('Failed to update privacy level', err);
      // Revert on error
      setSocial(prev => prev ? { ...prev, privacyLevel: prevLevel } : null);
    }
  };

  // Single visibility chip — opens the 3 levels as an action sheet
  const openPrivacyMenu = () => {
    Alert.alert('Profile visibility', 'Who can see your profile?', [
      { text: 'Public', onPress: () => handleSetPrivacy('public') },
      { text: 'Only Friends', onPress: () => handleSetPrivacy('friends_only') },
      { text: 'Hidden (no commission)', onPress: () => handleSetPrivacy('private') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // ── Per-section visibility (public/private) ──
  const isSectionPrivate = (key: string) => !!social?.sectionVisibility?.[key];

  const toggleSection = async (key: string) => {
    if (!supabaseUserId) return;
    const prev = social?.sectionVisibility ?? {};
    const next = { ...prev, [key]: !prev[key] };
    // Optimistic
    setSocial(p => p ? { ...p, sectionVisibility: next } : p);
    try {
      await SocialProfileService.update(supabaseUserId, { sectionVisibility: next });
    } catch (err) {
      console.warn('Failed to update section visibility', err);
      setSocial(p => p ? { ...p, sectionVisibility: prev } : p);
    }
  };

  const [editingField, setEditingField] = useState<'age' | 'gender' | 'dateOfBirth' | 'phone' | 'username' | 'email' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const handleReplaceAvatar = async () => {
    if (!supabaseUserId) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setAvatarUploading(true);
    try {
      const url = await StorageService.uploadProfilePicture(supabaseUserId, result.assets[0].uri, () => {});
      await updateProfile(supabaseUserId, { profileImageUrl: url });
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Could not upload photo.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleDeleteAvatar = async () => {
    if (!supabaseUserId || !profile?.profileImageUrl) return;
    const confirmed = typeof window !== 'undefined'
      ? window.confirm('Remove your profile photo?')
      : true;
    if (!confirmed) return;
    setAvatarUploading(true);
    try {
      const currentUrl = profile.profileImageUrl;
      await updateProfile(supabaseUserId, { profileImageUrl: null as any });
      const marker = '/object/public/avatars/';
      const urlPath = currentUrl.includes(marker)
        ? currentUrl.split(marker)[1]
        : currentUrl.split('/avatars/').pop();
      if (urlPath) {
        await supabase.storage.from('avatars').remove([urlPath]);
      }
    } catch (e: any) {
      console.warn('[DeleteAvatar] error:', e?.message);
    } finally {
      setAvatarUploading(false);
    }
  };

  // ── Gallery ─────────────────────────────────────────────────────────────────
  const handleAddPhoto = async () => {
    if (!supabaseUserId || galleryUploading) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setGalleryUploading(true);
    try {
      const url = await StorageService.uploadGalleryPhoto(supabaseUserId, result.assets[0].uri);
      const nextOrder = photos.reduce((max, p) => Math.max(max, p.sortOrder), 0) + 1;
      const created = await GalleryService.add(supabaseUserId, url, nextOrder);
      setPhotos(prev => [...prev, created]);
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Could not upload photo.');
    } finally {
      setGalleryUploading(false);
    }
  };

  const handleDeletePhoto = async (photo: ProfilePhoto) => {
    const confirmed = typeof window !== 'undefined' ? window.confirm('Remove this photo?') : true;
    if (!confirmed) return;
    const prev = photos;
    setPhotos(p => p.filter(x => x.id !== photo.id)); // optimistic
    try {
      await GalleryService.remove(photo.id);
      await StorageService.deleteByPublicUrl(photo.url).catch(() => {});
    } catch {
      setPhotos(prev); // revert
    }
  };

  // ── Hobby ranks (inline 1–5 dot rating) ──────────────────────────────────────
  const setHobbyRank = async (hobby: Hobby, rank: number) => {
    if (!supabaseUserId) return;
    const prev = social?.hobbyRanks ?? {};
    // Tapping the current rank again clears it.
    const next = { ...prev, [hobby]: prev[hobby] === rank ? 0 : rank };
    setSocial(p => p ? { ...p, hobbyRanks: next } : p); // optimistic
    try {
      await SocialProfileService.update(supabaseUserId, { hobbyRanks: next });
    } catch {
      setSocial(p => p ? { ...p, hobbyRanks: prev } : p);
    }
  };

  const handleEditClick = (field: 'age' | 'gender' | 'dateOfBirth' | 'phone' | 'username' | 'email', initialValue: string) => {
    setEditingField(field);
    setEditValue(initialValue);
  };

  const handleSaveField = async () => {
    if (!supabaseUserId || !editingField) return;
    try {
      let finalValue: any = editValue.trim();
      if (editingField === 'age') {
         finalValue = parseInt(finalValue, 10);
         if (isNaN(finalValue)) finalValue = profile?.age || null;
      }
      if (editingField === 'email') {
        const { error } = await supabase.auth.updateUser({ email: finalValue });
        if (error) throw error;
        await updateProfile(supabaseUserId, { email: finalValue });
      } else {
        await updateProfile(supabaseUserId, { [editingField]: finalValue });
      }
    } catch (e) {
      console.warn('Failed to save', e);
    } finally {
      setEditingField(null);
    }
  };

  // ── Derived data ──────────────────────────────────────────────────────────
  const displayName = profile?.fullName  || 'User';
  const firstName   = displayName.trim().split(/\s+/)[0];
  const username    = profile?.username   || 'username';
  const email       = profile?.email      || 'email@example.com';
  const bio         = social?.bio?.trim() || 'No bio yet.';
  const whatIDoRaw  = social?.whatIDo?.trim();
  const whatIDoItems= whatIDoRaw ? whatIDoRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
  const openToConnect = social?.openToConnect !== false;

  const squats   = profile?.totalSquats       ?? 0;
  const streak   = streakData?.currentStreak  ?? profile?.currentStreak    ?? 3;
  const workouts = streakData?.totalWorkouts  ?? profile?.completedWorkouts ?? 12;
  const prs      = streakData?.bestStreak     ?? profile?.bestStreak        ?? 4;

  // Weekly · Lifetime workout-time stats (mirrors the home profile card).
  const fmtMins = (mins: number) => {
    const m = Math.round(mins);
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  };
  const weeklyMins = streakData
    ? Object.values(streakData.weeklyMinutes).reduce((a, b) => a + b, 0)
    : 0;
  const lifetimeMins = Math.round(
    profile?.watchedMinutes ??
    (profile?.workoutSeconds ? profile.workoutSeconds / 60 : 0)
  );

  // AI-curated intro blurb — generate from profile data, cache to DB.
  const handleGenerateSummary = async () => {
    if (genningSummary || !supabaseUserId) return;
    console.log('[Summary] generating…');
    setGenningSummary(true);
    setSummaryError(null);
    try {
      const hobbyLabels = (social?.hobbies ?? []).map(h => HOBBY_META[h]?.label ?? h);
      const goalLabels  = (social?.connectionGoals ?? []).map(g => CONNECTION_GOAL_META[g]?.label ?? g);
      const cityHint    = social?.city
        || coarseLocality(social?.houseAddress, social?.houseName)
        || social?.gymArea
        || null;
      const summary = await generateProfileSummary({
        name: displayName,
        whatIDo: social?.whatIDo ?? null,
        city: cityHint,
        hobbies: hobbyLabels,
        lookingToMeet: social?.lookingToMeet ?? null,
        connectionGoals: goalLabels,
        bio: social?.bio ?? null,
        streak,
        workouts,
        joinedRecently: workouts > 0 && workouts <= 15,
      });
      console.log('[Summary] result:', summary);
      if (!summary) {
        setSummaryError('Add what you do, your hobbies, or a short bio first — then generate.');
        return;
      }
      await SocialProfileService.update(supabaseUserId, { aiSummary: summary });
      setSocial(prev => (prev ? { ...prev, aiSummary: summary } : prev));
    } catch (e: any) {
      console.warn('[Summary] failed:', e);
      setSummaryError(String(e?.message ?? e));
    } finally {
      setGenningSummary(false);
    }
  };


  // Location data
  const gymName    = social?.gymName?.trim()   || '';
  const gymAddress = splitAddress(social?.gymAddress || social?.gymArea, '').sub;

  const homeName    = social?.houseName?.trim() || '';
  const homeAddress = splitAddress(social?.houseAddress, '').sub;

  const parkName    = social?.parkName?.trim() || '';
  const parkAddress = splitAddress(social?.parkAddress, '').sub;

  // Looking-to-meet text
  const lookingTextRaw = social?.lookingToMeet?.trim();
  const lookingItems = lookingTextRaw ? lookingTextRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

  // Hobbies
  const hobbyItems = ((social?.hobbies?.length
    ? social.hobbies
    : ['gym', 'cycling', 'photography', 'reading']) as Hobby[]
  ).filter(h => !!HOBBY_META[h]);

  // Top 5 hobbies, ordered by their saved rank (highest first); unranked keep
  // their original order behind ranked ones.
  const hobbyRanks = social?.hobbyRanks ?? {};
  const rankedHobbies = [...hobbyItems]
    .sort((a, b) => (hobbyRanks[b] ?? 0) - (hobbyRanks[a] ?? 0))
    .slice(0, 5);

  // Badges — new tier system, built from profile + streakData for accuracy
  const badgeStats: UserBadgeStats = {
    bestStreak:        profile?.bestStreak ?? streakData?.bestStreak ?? 0,
    totalWorkouts:     profile?.completedWorkouts ?? streakData?.totalWorkouts ?? 0,
    totalLiveSessions: profile?.totalLiveSessions ?? streakData?.totalLiveSessions ?? 0,
    totalViewers:      0,
    coachSessions:     0,
    totalWatchMinutes: Math.floor((profile?.watchedSeconds ?? 0) / 60),
    founderTier:       0,
  };
  const badgeStates   = deriveBadgeStates(badgeStats);
  const earnedFamilies = badgeStates.filter(b => b.currentTier > 0);
  // Legacy earnedIds kept for any remaining legacy references
  const earned        = deriveBadges(streakData);
  const earnedIds     = new Set(earned.map(b => b.id));

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
                  borderRadius: i === 0 ? 22 : 14,
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
            {/* Eye icon — preview profile as others see it */}
            <TouchableOpacity
              style={s.navBtn}
              onPress={() => navigation.navigate('SocialProfileScreen', {
                uid: supabaseUserId,
                previewAsOther: true,
              })}
              activeOpacity={0.76}
            >
              <Eye size={23} color={C.text} strokeWidth={1.9} />
            </TouchableOpacity>
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
              onPress={() => navigation.navigate('QRProfileScreen', {
                uid: supabaseUserId,
                username,
                displayName,
                email: profile?.email,
                age: profile?.age,
                gender: profile?.gender,
                dateOfBirth: profile?.dateOfBirth,
                phone: profile?.phone,
                hasAccess: profile?.hasAccess,
                accessType: profile?.accessType,
                earnedBadges: Array.from(earnedIds),
                avatarUrl: profile?.profileImageUrl,
                streak: streak,
                workouts: workouts,
                prs: prs,
                bio: social?.bio,
                whatIDo: social?.whatIDo,
                lookingToMeet: social?.lookingToMeet,
                connectionGoals: social?.connectionGoals,
                hobbies: social?.hobbies,
                gymName: social?.gymName,
                gymAddress: social?.gymAddress || social?.gymArea,
                houseName: social?.houseName,
                houseAddress: social?.houseAddress,
                parkName: social?.parkName,
                parkAddress: social?.parkAddress,
                openToMentor: social?.openToMentor,
                helpingBeginners: social?.helpingBeginners,
                communityNote: social?.communityNote,
              })}
              activeOpacity={0.76}
            >
              <QrCode size={21} color={C.text} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          scrollEnabled={scrollEnabled}
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
            <View style={s.heroRow}>
              <View style={s.heroAvatarCol}>
                <TierAvatarRing
                  accessType={profile?.accessType}
                  avatarSize={100}
                  avatarRadius={22}
                >
                  <View style={s.avatarRing}>
                    {avatarUploading ? (
                      <View style={{ width: 100, height: 100, borderRadius: 22, backgroundColor: '#EEEEF2', alignItems: 'center', justifyContent: 'center' }}>
                        <ActivityIndicator color={C.orange} size="large" />
                      </View>
                    ) : (
                      <View style={{ width: 100, height: 100, borderRadius: 22, overflow: 'hidden' }}>
                        <Avatar uri={profile?.profileImageUrl} size={100} />
                        <LinearGradient
                          colors={['transparent', 'rgba(0,0,0,0.72)']}
                          style={{
                            position: 'absolute',
                            bottom: 0, left: 0, right: 0,
                            height: 40,
                            justifyContent: 'flex-end',
                            alignItems: 'center',
                            paddingBottom: 5,
                          }}
                        >
                          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.4 }}>
                            {firstName}
                          </Text>
                        </LinearGradient>
                      </View>
                    )}
                    {/* Camera corner-badge — tap to change / remove (Instagram-style) */}
                    <TouchableOpacity
                      style={s.editBadge}
                      activeOpacity={0.8}
                      onPress={() => {
                        if (profile?.profileImageUrl) {
                          Alert.alert('Profile photo', undefined, [
                            { text: 'Change photo', onPress: handleReplaceAvatar },
                            { text: 'Remove photo', style: 'destructive', onPress: handleDeleteAvatar },
                            { text: 'Cancel', style: 'cancel' },
                          ]);
                        } else {
                          handleReplaceAvatar();
                        }
                      }}
                    >
                      <Camera size={14} color="#fff" strokeWidth={2.2} />
                    </TouchableOpacity>
                  </View>
                </TierAvatarRing>
              </View>

              <View style={s.heroInfoCol}>
                <View style={s.nameLine}>
                  <Text style={s.handle} numberOfLines={1}>@{username}</Text>
                  <Text style={s.name} numberOfLines={1}>{displayName}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  <TouchableOpacity onPress={() => navigation.navigate('FriendsScreen')} activeOpacity={0.7}>
                    <View style={{ backgroundColor: '#211832', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{friends.length}</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 9, fontWeight: '600', letterSpacing: 0.4 }}>CONNECTS</Text>
                    </View>
                  </TouchableOpacity>
                  {(() => {
                    const lvl = social?.privacyLevel || 'public';
                    const { label, Icon } =
                      lvl === 'private'      ? { label: 'Hidden',  Icon: Lock } :
                      lvl === 'friends_only' ? { label: 'Friends', Icon: Users } :
                                               { label: 'Public',  Icon: Globe };
                    return (
                      <TouchableOpacity onPress={openPrivacyMenu} activeOpacity={0.7} style={s.visibilityChip}>
                        <Icon size={12} color={C.muted} strokeWidth={2.2} />
                        <Text style={s.visibilityChipText}>{label}</Text>
                        <ChevronDown size={12} color={C.muted} strokeWidth={2.2} />
                      </TouchableOpacity>
                    );
                  })()}
                </View>
                {/* Weekly · Lifetime — compact, under the name */}
                <View style={s.heroTimeRow}>
                  <View style={s.heroTimeItem}>
                    <Text style={s.heroTimeValue}>{fmtMins(weeklyMins)}</Text>
                    <Text style={s.heroTimeLabel}>Weekly</Text>
                  </View>
                  <View style={s.heroTimeDivider} />
                  <View style={s.heroTimeItem}>
                    <Text style={s.heroTimeValue}>{fmtMins(lifetimeMins)}</Text>
                    <Text style={s.heroTimeLabel}>Lifetime</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Location labels below the visibility chip */}
            {(gymName || homeName || parkName) && (
              <View style={s.heroLocations}>
                {gymName ? (
                  <View style={s.heroLocationRow}>
                    <Text style={s.heroLocationLabel}>Workout Area</Text>
                    <Text style={s.heroLocationDash}> – </Text>
                    <Text style={s.heroLocationValue} numberOfLines={1}>{gymName}</Text>
                  </View>
                ) : null}
                {homeName ? (
                  <View style={s.heroLocationRow}>
                    <Text style={s.heroLocationLabel}>Home</Text>
                    <Text style={s.heroLocationDash}> – </Text>
                    <Text style={s.heroLocationValue} numberOfLines={1}>{homeName}</Text>
                  </View>
                ) : null}
                {parkName ? (
                  <View style={s.heroLocationRow}>
                    <Text style={s.heroLocationLabel}>Hangout Area</Text>
                    <Text style={s.heroLocationDash}> – </Text>
                    <Text style={s.heroLocationValue} numberOfLines={1}>{parkName}</Text>
                  </View>
                ) : null}
              </View>
            )}

          </View>

          {/* ── 3. PROFESSION — job title / what I do ────────────────────────── */}
          <ProfileCard isPrivate={isSectionPrivate('whatIDo')} onToggleVisibility={() => toggleSection('whatIDo')}>
            <View style={s.cardHeaderRow}>
              <Text style={s.cardTitle}>Profession</Text>
              <TouchableOpacity onPress={() => navigation.navigate('EditSocialProfileScreen', { section: 'whatIDo' })}>
                <Pencil size={16} color={C.muted} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <View style={s.hobbiesRow}>
              {whatIDoItems.length > 0 ? (
                whatIDoItems.map((item, idx) => (
                  <View key={`${item}-${idx}`} style={s.whatIDoCapsule}>
                    <Text style={s.whatIDoCapsuleText}>{item}</Text>
                  </View>
                ))
              ) : (
                <Text style={s.bodyText}>Add your profession or job title</Text>
              )}
            </View>
            {(social?.projectsWorkingOn || social?.needHelpWith) && (
              <View style={{ marginTop: 12, gap: 10 }}>
                {social?.projectsWorkingOn ? (
                  <View style={s.aboutQRow}>
                    <Text style={s.aboutQLabel}>🚀 Working on</Text>
                    <Text style={s.aboutQValue}>{social.projectsWorkingOn}</Text>
                  </View>
                ) : null}
                {social?.needHelpWith ? (
                  <View style={s.aboutQRow}>
                    <Text style={s.aboutQLabel}>🤝 Need help with</Text>
                    <Text style={s.aboutQValue}>{social.needHelpWith}</Text>
                  </View>
                ) : null}
              </View>
            )}
          </ProfileCard>

          {/* ── 4. FITNESS GOALS — reuses connection goals ───────────────────── */}
          <ProfileCard isPrivate={isSectionPrivate('fitnessGoals')} onToggleVisibility={() => toggleSection('fitnessGoals')}>
            <View style={s.cardHeaderRow}>
              <Text style={s.cardTitle}>Fitness Goals</Text>
              <TouchableOpacity onPress={() => navigation.navigate('EditSocialProfileScreen', { section: 'meet' })}>
                <Pencil size={16} color={C.muted} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <View style={s.hobbiesRow}>
              {(social?.connectionGoals?.length ?? 0) > 0 ? (
                social!.connectionGoals!.map((g, idx) => (
                  <View key={`${g}-${idx}`} style={s.meetCapsule}>
                    <Text style={s.meetCapsuleText}>{CONNECTION_GOAL_META[g]?.label ?? g}</Text>
                  </View>
                ))
              ) : (
                <Text style={s.bodyText}>Add your fitness goals</Text>
              )}
            </View>
          </ProfileCard>

          {/* ── 5. GALLERY — user-uploaded photos ────────────────────────────── */}
          <ProfileCard isPrivate={isSectionPrivate('gallery')} onToggleVisibility={() => toggleSection('gallery')}>
            <View style={s.cardHeaderRow}>
              <Text style={s.cardTitle}>Gallery</Text>
            </View>
            <View style={s.galleryGrid}>
              {photos.map(p => (
                <View key={p.id} style={s.galleryItem}>
                  <Image source={{ uri: p.url }} style={s.galleryImg} />
                  <TouchableOpacity
                    style={s.galleryDelete}
                    onPress={() => handleDeletePhoto(p)}
                    activeOpacity={0.8}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <X size={13} color="#211832" strokeWidth={2.6} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                style={[s.galleryItem, s.galleryAdd]}
                onPress={handleAddPhoto}
                disabled={galleryUploading}
                activeOpacity={0.8}
              >
                {galleryUploading ? (
                  <ActivityIndicator color={C.muted} />
                ) : (
                  <Camera size={22} color={C.muted} strokeWidth={2} />
                )}
              </TouchableOpacity>
            </View>
          </ProfileCard>

          {/* ── 6. ABOUT ME — short bio + projects + need help ───────────────── */}
          <ProfileCard isPrivate={isSectionPrivate('about')} onToggleVisibility={() => toggleSection('about')}>
            <View style={s.cardHeaderRow}>
              <Text style={s.cardTitle}>About me</Text>
              <TouchableOpacity onPress={() => navigation.navigate('EditSocialProfileScreen', { section: 'about' })}>
                <Pencil size={16} color={C.muted} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <Text style={s.bodyText}>
              {bio.length > 100 ? `${bio.slice(0, 100).trimEnd()}…` : bio}
            </Text>
          </ProfileCard>

          {/* ── 6b. HOW I LOOK NOW — preview opens the full-screen editor ────── */}
          <ProfileCard isPrivate={isSectionPrivate('howILookNow')} onToggleVisibility={() => toggleSection('howILookNow')}>
            <View style={s.cardHeaderRow}>
              <Text style={s.cardTitle}>How I look now</Text>
              <TouchableOpacity onPress={() => navigation.navigate('HowILookNow')}>
                <Text style={s.viewAllBtn}>Edit</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('HowILookNow')}>
              <BodyVisualizer
                name={profile?.fullName}
                gender={profile?.gender}
                heightCm={profile?.heightCm}
                weightKg={profile?.weightKg}
                age={profile?.age}
                conditions={profile?.bodyConditions}
                editable={false}
                canvasHeight={260}
              />
            </TouchableOpacity>
          </ProfileCard>

          {/* ── 6c. MY GOAL — body-transformation goal preview ───────────────── */}
          <ProfileCard isPrivate={isSectionPrivate('myGoal')} onToggleVisibility={() => toggleSection('myGoal')}>
            <View style={s.cardHeaderRow}>
              <Text style={s.cardTitle}>My Goal</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Goals')}>
                <Text style={s.viewAllBtn}>Edit</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('Goals')}>
              <GoalVisualizer
                name={profile?.fullName}
                gender={profile?.gender}
                heightCm={profile?.heightCm}
                weightKg={profile?.weightKg}
                goals={profile?.goals}
                editable={false}
                canvasHeight={260}
              />
            </TouchableOpacity>
          </ProfileCard>

          {/* ── 7. TOP HOBBIES — ranked 1–5 dots ─────────────────────────────── */}
          <ProfileCard isPrivate={isSectionPrivate('hobbies')} onToggleVisibility={() => toggleSection('hobbies')}>
            <View style={s.cardHeaderRow}>
              <Text style={s.cardTitle}>Top Hobbies</Text>
              <TouchableOpacity onPress={() => navigation.navigate('EditSocialProfileScreen', { section: 'hobbies' })}>
                <Pencil size={16} color={C.muted} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <View style={s.hobbyCircleRow}>
              {rankedHobbies.length === 0 ? (
                <Text style={s.bodyText}>Add your hobbies</Text>
              ) : (
                rankedHobbies.map((hobby, idx) => {
                  const meta = HOBBY_META[hobby];
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
                })
              )}
            </View>
          </ProfileCard>

          {/* ── 8. LOCATION MAP — moved below hobbies ────────────────────────── */}
          <ProfileCard isPrivate={isSectionPrivate('locationMap')} onToggleVisibility={() => toggleSection('locationMap')}>
            <View style={s.cardHeaderRow}>
              <Text style={s.cardTitle}>Map</Text>
              <TouchableOpacity onPress={() => navigation.navigate('EditSocialProfileScreen', { section: 'locations' })} activeOpacity={0.75}>
                <Text style={s.viewAllBtn}>Edit</Text>
              </TouchableOpacity>
            </View>
            {/* Shared interactive map highlighting every set location */}
            <LocationsMap
              points={[
                { lat: social?.gymLat ?? 0, lng: social?.gymLng ?? 0, label: 'Gym' },
                { lat: social?.houseLat ?? 0, lng: social?.houseLng ?? 0, label: 'Home' },
                { lat: social?.parkLat ?? 0, lng: social?.parkLng ?? 0, label: 'Park' },
              ]}
              onMapTouchStart={() => setScrollEnabled(false)}
              onMapTouchEnd={() => setScrollEnabled(true)}
            />
            {/* Location edit rows */}
            <View style={s.locEditList}>
              {[
                { icon: '🏠', label: 'Home', name: homeName, addr: homeAddress },
                { icon: '🏋️', label: 'Gym',  name: gymName,  addr: gymAddress },
                { icon: '🌳', label: 'Park', name: parkName, addr: parkAddress },
              ].map(({ icon, label, name, addr }) => (
                <TouchableOpacity
                  key={label}
                  style={s.locEditRow}
                  activeOpacity={0.75}
                  onPress={() => navigation.navigate('EditSocialProfileScreen', { section: 'locations' })}
                >
                  <View style={s.locEditIconWrap}>
                    <Text style={s.locEditIcon}>{icon}</Text>
                  </View>
                  <View style={s.locEditInfo}>
                    <Text style={s.locEditLabel}>{label}</Text>
                    {name || addr ? (
                      <Text style={s.locEditAddr} numberOfLines={1}>{name || addr}</Text>
                    ) : (
                      <Text style={s.locEditEmpty}>Tap to add</Text>
                    )}
                  </View>
                  <MapPin size={14} color={C.orange} />
                </TouchableOpacity>
              ))}
            </View>
          </ProfileCard>

          {/* ── AI SUMMARY — curated intro, right after locations ───────────── */}
          <ProfileCard isPrivate={isSectionPrivate('summary')} onToggleVisibility={() => toggleSection('summary')}>
            <View style={s.cardHeaderRow}>
              <Text style={s.cardTitle}>Summary</Text>
            </View>
            <Text style={s.bodyText}>
              {social?.aiSummary
                ? social.aiSummary
                : 'Let AI craft a friendly intro from your details so people want to connect.'}
            </Text>
            <TouchableOpacity
              style={s.aiBtn}
              onPress={handleGenerateSummary}
              disabled={genningSummary}
              activeOpacity={0.85}
            >
              {genningSummary ? (
                <ActivityIndicator color="#211832" size="small" />
              ) : (
                <>
                  <Sparkles size={15} color="#fff" />
                  <Text style={s.aiBtnText}>
                    {social?.aiSummary ? 'Regenerate with AI' : 'Generate with AI'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            {summaryError ? (
              <Text style={{ color: '#ff6b6b', fontSize: 12, marginTop: 8 }}>{summaryError}</Text>
            ) : null}
          </ProfileCard>

          {/* ── STATS (3 cards) ─────────────────────────────────────────────── */}
          <ProfileCard isPrivate={isSectionPrivate('stats')} onToggleVisibility={() => toggleSection('stats')}>
            <View style={s.cardHeaderRow}>
              <Text style={s.cardTitle}>Stats</Text>
            </View>
            <StatPill squats={squats} workouts={workouts} prs={prs} bare />
          </ProfileCard>

          {/* ── FRIENDS ─────────────────────────────────────────────────────── */}
          <ProfileCard isPrivate={isSectionPrivate('friends')} onToggleVisibility={() => toggleSection('friends')}>
            <View style={s.cardHeaderRow}>
              <Text style={s.cardTitle}>Friends</Text>
              <TouchableOpacity onPress={() => navigation.navigate('FriendsScreen')}>
                <Text style={s.viewAllBtn}>View all</Text>
              </TouchableOpacity>
            </View>
            <View style={s.friendsListRow}>
              {friends.length > 0 ? (
                friends.slice(0, 5).map((f, idx) => (
                  <View key={f.uid} style={[s.friendAvatarBox, { zIndex: 10 - idx }]}>
                    <Avatar uri={f.profileImageUrl} size={42} />
                  </View>
                ))
              ) : (
                <Text style={s.bodyText}>No friends yet.</Text>
              )}
            </View>
          </ProfileCard>

          {/* ── ACTIVITY TIME ────────────────────────────────────────────────── */}
          <ProfileCard isPrivate={isSectionPrivate('activity')} onToggleVisibility={() => toggleSection('activity')}>
            <View style={s.activityTimeRow}>
              <View style={s.activityTimeItem}>
                <Text style={s.activityTimeValue}>
                  {(() => {
                    const sec = profile?.watchedSeconds ?? 0;
                    if (sec < 60) return sec > 0 ? `${sec}s` : '0m';
                    const h = Math.floor(sec / 3600);
                    const m = Math.floor((sec % 3600) / 60);
                    return h > 0 ? `${h}h ${m}m` : `${m}m`;
                  })()}
                </Text>
                <Text style={s.activityTimeLabel}>Watch Time</Text>
              </View>
              <View style={s.activityTimeDivider} />
              <View style={s.activityTimeItem}>
                <Text style={s.activityTimeValue}>
                  {(() => {
                    const sec = (profile as any)?.workoutSeconds ?? 0;
                    if (sec < 60) return sec > 0 ? `${sec}s` : '0m';
                    const h = Math.floor(sec / 3600);
                    const m = Math.floor((sec % 3600) / 60);
                    return h > 0 ? `${h}h ${m}m` : `${m}m`;
                  })()}
                </Text>
                <Text style={s.activityTimeLabel}>Workout Time</Text>
              </View>
            </View>
          </ProfileCard>

          {/* ── BADGES ──────────────────────────────────────────────────────── */}
          <ProfileCard isPrivate={isSectionPrivate('badges')} onToggleVisibility={() => toggleSection('badges')}>
            <View style={s.cardHeaderRow}>
              <Text style={s.cardTitle}>Badges</Text>
              <TouchableOpacity onPress={() => navigation.navigate('BadgesScreen')}>
                <Text style={s.viewAllLink}>View all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.badgesScroll}
            >
              {[...BADGE_FAMILIES]
                .filter(family => family.key !== 'streak') // streak badge removed
                .sort((a, b) => {
                  const tA = badgeStates.find(bs => bs.familyKey === a.key)?.currentTier ?? 0;
                  const tB = badgeStates.find(bs => bs.familyKey === b.key)?.currentTier ?? 0;
                  return tB - tA;
                })
                .map(family => {
                const state = badgeStates.find(bs => bs.familyKey === family.key);
                const tier  = state?.currentTier ?? 0;
                const color = tier > 0 ? TIER_COLORS[tier - 1] : '#7A7C90';
                const locked = tier === 0;
                const isStreak = family.key === 'streak' && !locked;
                const badgeInner = (
                  <>
                    <Text style={[s.badgeEmoji, locked && s.badgeEmojiLocked]}>
                      {family.emoji}
                    </Text>
                    {!locked && (
                      <View style={[s.badgeLevelChip, { backgroundColor: color }]}>
                        <Text style={s.badgeLevelChipText}>Lv.{tier}</Text>
                      </View>
                    )}
                  </>
                );

                return (
                  <TouchableOpacity
                    key={family.key}
                    style={s.badgeItemContainer}
                    onPress={() => navigation.navigate('BadgesScreen')}
                    activeOpacity={0.8}
                  >
                    {isStreak ? (
                      <FireGlowBadge color={color}>{badgeInner}</FireGlowBadge>
                    ) : (
                      <View style={[
                        s.badgeShape,
                        { borderColor: locked ? 'rgba(33,24,50,0.12)' : color + '88',
                          backgroundColor: locked ? 'rgba(33,24,50,0.04)' : color + '22' },
                      ]}>
                        {badgeInner}
                      </View>
                    )}
                    <Text style={[s.badgeLabel, locked && s.badgeLabelLocked]} numberOfLines={1}>
                      {locked ? '—' : family.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </ProfileCard>

          {/* ── LOOKING TO MEET ─────────────────────────────────────────────── */}
          <ProfileCard isPrivate={isSectionPrivate('meet')} onToggleVisibility={() => toggleSection('meet')}>
            <TouchableOpacity
              style={s.cardHeaderRow}
              onPress={() => navigation.navigate('EditSocialProfileScreen', { section: 'meet' })}
              activeOpacity={0.8}
            >
              <Text style={s.cardTitle}>Looking to meet</Text>
              <Pencil size={16} color={C.muted} strokeWidth={2} />
            </TouchableOpacity>
            <View style={s.hobbiesRow}>
              {lookingItems.length > 0 ? (
                lookingItems.map((item, idx) => (
                  <View key={`${item}-${idx}`} style={s.meetCapsule}>
                    <Text style={s.meetCapsuleText}>{item}</Text>
                  </View>
                ))
              ) : (
                <Text style={s.bodyText}>Not specified</Text>
              )}
            </View>
          </ProfileCard>

          {/* ── PERSONAL INFO ───────────────────────────────────────────────── */}
          <ProfileCard isPrivate={isSectionPrivate('personal')} onToggleVisibility={() => toggleSection('personal')}>
            <View style={s.cardHeaderRow}>
              <Text style={s.cardTitle}>Personal Info</Text>
            </View>
            <View style={s.basicInfoContainer}>
              {/* Age */}
              <View style={s.basicInfoItem}>
                <Text style={s.basicInfoLabel}>Age</Text>
                <View style={s.basicInfoValueRow}>
                  {editingField === 'age' ? (
                    <>
                      <TextInput
                        style={s.inlineInput}
                        value={editValue}
                        onChangeText={setEditValue}
                        keyboardType="numeric"
                        autoFocus
                      />
                      <TouchableOpacity onPress={handleSaveField} style={s.inlineSaveBtn}>
                        <Check size={16} color="#000" strokeWidth={2.5} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setEditingField(null)} style={s.inlineCancelBtn}>
                        <X size={16} color="#211832" strokeWidth={2.5} />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <Text style={s.basicInfoValue}>{profile?.age ? `${profile.age} yrs` : '—'}</Text>
                      <TouchableOpacity onPress={() => handleEditClick('age', profile?.age?.toString() || '')}>
                        <Pencil size={14} color={C.muted} strokeWidth={2} />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>

              {/* Gender */}
              <View style={s.basicInfoItem}>
                <Text style={s.basicInfoLabel}>Gender</Text>
                <View style={s.basicInfoValueRow}>
                  {editingField === 'gender' ? (
                    <>
                      <TextInput
                        style={s.inlineInput}
                        value={editValue}
                        onChangeText={setEditValue}
                        autoFocus
                      />
                      <TouchableOpacity onPress={handleSaveField} style={s.inlineSaveBtn}>
                        <Check size={16} color="#000" strokeWidth={2.5} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setEditingField(null)} style={s.inlineCancelBtn}>
                        <X size={16} color="#211832" strokeWidth={2.5} />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <Text style={s.basicInfoValue}>{profile?.gender || '—'}</Text>
                      <TouchableOpacity onPress={() => handleEditClick('gender', profile?.gender || '')}>
                        <Pencil size={14} color={C.muted} strokeWidth={2} />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>

              {/* DOB */}
              <View style={s.basicInfoItem}>
                <Text style={s.basicInfoLabel}>DOB</Text>
                <View style={s.basicInfoValueRow}>
                  {editingField === 'dateOfBirth' ? (
                    <>
                      <TextInput
                        style={s.inlineInput}
                        value={editValue}
                        onChangeText={setEditValue}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={C.muted}
                        autoFocus
                      />
                      <TouchableOpacity onPress={handleSaveField} style={s.inlineSaveBtn}>
                        <Check size={16} color="#000" strokeWidth={2.5} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setEditingField(null)} style={s.inlineCancelBtn}>
                        <X size={16} color="#211832" strokeWidth={2.5} />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <Text style={s.basicInfoValue}>{profile?.dateOfBirth || '—'}</Text>
                      <TouchableOpacity onPress={() => handleEditClick('dateOfBirth', profile?.dateOfBirth || '')}>
                        <Pencil size={14} color={C.muted} strokeWidth={2} />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>

              {/* Phone */}
              <View style={s.basicInfoItem}>
                <Text style={s.basicInfoLabel}>Phone</Text>
                <View style={s.basicInfoValueRow}>
                  {editingField === 'phone' ? (
                    <>
                      <TextInput
                        style={s.inlineInput}
                        value={editValue}
                        onChangeText={setEditValue}
                        keyboardType="phone-pad"
                        autoFocus
                      />
                      <TouchableOpacity onPress={handleSaveField} style={s.inlineSaveBtn}>
                        <Check size={16} color="#000" strokeWidth={2.5} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setEditingField(null)} style={s.inlineCancelBtn}>
                        <X size={16} color="#211832" strokeWidth={2.5} />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <Text style={s.basicInfoValue}>{profile?.phone || '—'}</Text>
                      <TouchableOpacity onPress={() => handleEditClick('phone', profile?.phone || '')}>
                        <Pencil size={14} color={C.muted} strokeWidth={2} />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>

              {/* Username */}
              <View style={s.basicInfoItem}>
                <Text style={s.basicInfoLabel}>Username</Text>
                <View style={s.basicInfoValueRow}>
                  {editingField === 'username' ? (
                    <>
                      <TextInput
                        style={s.inlineInput}
                        value={editValue}
                        onChangeText={setEditValue}
                        autoCapitalize="none"
                        autoFocus
                      />
                      <TouchableOpacity onPress={handleSaveField} style={s.inlineSaveBtn}>
                        <Check size={16} color="#000" strokeWidth={2.5} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setEditingField(null)} style={s.inlineCancelBtn}>
                        <X size={16} color="#211832" strokeWidth={2.5} />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <Text style={s.basicInfoValue}>{profile?.username || '—'}</Text>
                      <TouchableOpacity onPress={() => handleEditClick('username', profile?.username || '')}>
                        <Pencil size={14} color={C.muted} strokeWidth={2} />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>

              {/* Email */}
              <View style={s.basicInfoItem}>
                <Text style={s.basicInfoLabel}>Email</Text>
                <View style={s.basicInfoValueRow}>
                  {editingField === 'email' ? (
                    <>
                      <TextInput
                        style={s.inlineInput}
                        value={editValue}
                        onChangeText={setEditValue}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoFocus
                      />
                      <TouchableOpacity onPress={handleSaveField} style={s.inlineSaveBtn}>
                        <Check size={16} color="#000" strokeWidth={2.5} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setEditingField(null)} style={s.inlineCancelBtn}>
                        <X size={16} color="#211832" strokeWidth={2.5} />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <Text style={s.basicInfoValue} numberOfLines={1}>{profile?.email || '—'}</Text>
                      <TouchableOpacity onPress={() => handleEditClick('email', profile?.email || '')}>
                        <Pencil size={14} color={C.muted} strokeWidth={2} />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>

              {/* Gripcuff Access */}
              <View style={[s.basicInfoItem, { borderBottomWidth: 0 }]}>
                <Text style={s.basicInfoLabel}>Gripcuff Access</Text>
                <View style={s.basicInfoValueRow}>
                  {profile?.hasAccess ? (
                    <View style={s.accessPill}>
                      <Text style={s.accessPillText}>
                        {profile.accessType === 'subscription' ? 'Subscription' : 'Product'}
                      </Text>
                    </View>
                  ) : (
                    <Text style={s.accessInactive}>Inactive</Text>
                  )}
                </View>
              </View>
            </View>
          </ProfileCard>

          {/* ── COMMUNITY SERVICE ───────────────────────────────────────────── */}
          <ProfileCard isPrivate={isSectionPrivate('community')} onToggleVisibility={() => toggleSection('community')}>
            <View style={s.cardHeaderRow}>
              <Text style={s.cardTitle}>Community Service</Text>
              <TouchableOpacity onPress={() => navigation.navigate('EditSocialProfileScreen', { section: 'community' })}>
                <Pencil size={16} color={C.muted} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <View style={{ gap: 12, marginTop: 4 }}>
              {social?.openToMentor && (
                <View style={s.inlineRow}>
                  <HeartHandshake size={18} color={C.orange} strokeWidth={2.2} />
                  <Text style={s.inlineText}>Open to Mentor (+55)</Text>
                </View>
              )}
              {social?.helpingBeginners && (
                <View style={s.inlineRow}>
                  <Users size={18} color={C.green} strokeWidth={2.2} />
                  <Text style={s.inlineText}>Helping Beginners</Text>
                </View>
              )}
              {!(social?.openToMentor || social?.helpingBeginners) && (
                <Text style={s.bodyText}>Not specified</Text>
              )}
            </View>
          </ProfileCard>

          {/* ── COMMUNITY NOTE ──────────────────────────────────────────────── */}
          <ProfileCard isPrivate={isSectionPrivate('communityNote')} onToggleVisibility={() => toggleSection('communityNote')}>
            <View style={s.cardHeaderRow}>
              <Text style={s.cardTitle}>Community Note</Text>
              <TouchableOpacity onPress={() => navigation.navigate('EditSocialProfileScreen', { section: 'community' })}>
                <Pencil size={16} color={C.muted} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <View style={{ gap: 12, marginTop: 4 }}>
              {social?.communityNote ? (
                <Text style={s.bodyText}>{social.communityNote}</Text>
              ) : (
                <Text style={s.bodyText}>Add a note about your community involvement.</Text>
              )}
            </View>
          </ProfileCard>



          {/* Account email */}
          <View style={{ alignItems: 'center', paddingVertical: 12 }}>
            <Text style={{ color: C.muted, fontSize: 12, fontWeight: '500' }}>{email}</Text>
          </View>

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
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  avatarRing: {
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
  nameLine: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 1,
  },
  name: {
    color: C.muted,
    fontSize: 15,
    fontWeight: '600',
  },
  handle: {
    color: C.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 0,
  },
  email: {
    color: C.muted,
    fontSize: 14,
    marginTop: 2,
  },
  heroTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  heroTimeItem: {
    alignItems: 'flex-start',
  },
  heroTimeValue: {
    color: C.text,
    fontSize: 13,
    fontWeight: '700',
  },
  heroTimeLabel: {
    color: C.muted,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 1,
  },
  heroTimeDivider: {
    width: StyleSheet.hairlineWidth,
    height: 22,
    backgroundColor: 'rgba(33,24,50,0.12)',
  },
  visibilityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 100,
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  visibilityChipText: {
    color: C.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  heroLocations: {
    gap: 4,
    marginTop: 10,
    alignSelf: 'center',
  },
  heroLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroLocationLabel: {
    color: '#7A7C90',
    fontSize: 12,
    fontWeight: '700',
    width: 96,
  },
  heroLocationDash: {
    color: '#7A7C90',
    fontSize: 12,
    marginHorizontal: 4,
  },
  heroLocationValue: {
    color: '#d1d5db',
    fontSize: 12,
    fontWeight: '500',
    maxWidth: 150,
  },
  basicInfoContainer: {
    width: '100%',
    gap: 12,
  },
  basicInfoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.cardBorder,
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
  inlineInput: {
    backgroundColor: C.cardBg,
    color: C.text,
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.orange,
    minWidth: 80,
    textAlign: 'right',
  },
  inlineSaveBtn: {
    backgroundColor: C.green,
    padding: 6,
    borderRadius: 6,
    marginLeft: 4,
  },
  inlineCancelBtn: {
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 5,
    borderRadius: 6,
    marginLeft: 4,
  },
  accessActive: {
    color: C.green,
    fontWeight: '700',
    fontSize: 14,
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
  aboutQRow: {
    gap: 2,
  },
  aboutQLabel: {
    color: C.text,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  aboutQValue: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  locItemLabel: {
    color: '#F25912',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  locItemAddr: {
    color: C.text,
    fontSize: 14,
    lineHeight: 19,
  },
  radiusNote: {
    color: C.muted,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 10,
    marginBottom: 4,
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
    position: 'relative',
  },
  galleryImg: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  galleryDelete: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryAdd: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(33,24,50,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(33,24,50,0.15)',
    borderStyle: 'dashed',
  },

  // Hobby ranking
  hobbyRankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hobbyRankLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  hobbyRankEmoji: {
    fontSize: 15,
  },
  hobbyRankLabel: {
    color: C.text,
    fontSize: 14,
    fontWeight: '600',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rankDot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: 'rgba(33,24,50,0.10)',
  },
  rankDotActive: {
    backgroundColor: C.orange,
  },
  aiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    backgroundColor: '#211832',
    borderRadius: 12,
    paddingVertical: 11,
  },
  aiBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  activityTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityTimeItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  activityTimeValue: {
    color: '#211832',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  activityTimeLabel: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activityTimeDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(33,24,50,0.08)',
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
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  hobbyCircleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 16,
    columnGap: 14,
    marginTop: 14,
  },
  hobbyCircleWrapper: {
    width: 64,
    alignItems: 'center',
    gap: 6,
  },
  hobbyCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(76,78,120,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(76,78,120,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hobbyCircleEmoji: { fontSize: 24 },
  hobbyRankDots: {
    flexDirection: 'row',
    gap: 4,
  },
  hobbyRankDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(33,24,50,0.15)',
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
  hobbyCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(76,78,120,0.25)',
    backgroundColor: 'rgba(76,78,120,0.08)',
    gap: 4,
  },
  hobbyCapsuleText: {
    color: '#4C4E78',
    fontSize: 11,
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
    color: '#7A7C90',
    fontSize: 11,
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
    color: '#7A7C90',
    fontSize: 11,
    fontWeight: '500',
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
  badgesScroll: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    alignItems: 'flex-start',
    paddingBottom: 4, // for slight scroll shadow
  },
  badgeItemContainer: {
    alignItems: 'center',
    width: 72,
    gap: 14,
  },
  badgeShape: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: 'rgba(242,89,18,0.1)',
    borderWidth: 1.5,
    borderColor: C.orange,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  badgeShapeAlt: {
    borderColor: 'rgba(139,92,246,0.7)',
    backgroundColor: 'rgba(139,92,246,0.12)',
    transform: [{ rotate: '-4deg' }],
  },
  badgeShapeLocked: {
    backgroundColor: C.cardBg,
    borderColor: C.cardBorder,
    opacity: 0.5,
  },
  badgeEmoji: {
    fontSize: 28,
  },
  badgeEmojiLocked: {
    opacity: 0.4,
  },
  badgeLevelChip: {
    position: 'absolute',
    bottom: -6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 28,
    alignItems: 'center',
  },
  badgeLevelChipText: {
    color: '#211832',
    fontSize: 9,
    fontWeight: '800',
  },
  badgeLabel: {
    color: C.text,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  badgeLabelLocked: {
    color: C.muted,
  },
  moreBadgeContainer: {
    width: 64,
    alignItems: 'center',
    paddingTop: 6, // center it vertically relative to 64px shapes
  },
  moreBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(33,24,50,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(33,24,50,0.12)',
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
    backgroundColor: 'rgba(33,24,50,0.06)',
  },
  friendsListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 4,
  },
  friendAvatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: C.bg,
    marginRight: -12,
  },
  viewAllBtn: {
    color: C.orange,
    fontSize: 13,
    fontWeight: '600',
  },

  // Location edit rows (below map)
  locEditList: {
    marginTop: 12,
    gap: 4,
  },
  locEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(33,24,50,0.08)',
  },
  locEditIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(242,89,18,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locEditIcon: {
    fontSize: 16,
  },
  locEditInfo: {
    flex: 1,
    minWidth: 0,
  },
  locEditLabel: {
    color: C.text,
    fontSize: 13,
    fontWeight: '700',
  },
  locEditAddr: {
    color: C.muted,
    fontSize: 11,
    marginTop: 1,
  },
  locEditEmpty: {
    color: C.orange,
    fontSize: 11,
    marginTop: 1,
    fontStyle: 'italic',
  },
});
