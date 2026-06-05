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
  ChevronRight,
  CircleUserRound,
  Dumbbell,
  Eye,
  Flame,
  HeartHandshake,
  Home,
  MapPin,
  Pencil,
  QrCode,
  Settings,
  Trees,
  Users,
  Check,
  X,
  Trash2,
  RefreshCw,
  Sparkles,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { StorageService } from '../services/storage.service';
import { supabase } from '../core/config/supabase';
import { useAuth } from '../providers/AuthContext';
import { useUser } from '../providers/UserContext';
import { useFriend } from '../providers/FriendContext';
import { SocialProfileService } from '../services/socialProfile.service';
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
  orange:       '#ff7a00',
  green:        '#22c55e',
  greenSoft:    'rgba(34,197,94,0.12)',
  greenBorder:  'rgba(34,197,94,0.28)',
  bg:           '#0d1520',
  cardBg:       'rgba(255,255,255,0.04)',
  cardBorder:   'rgba(255,255,255,0.06)',
  text:         '#ffffff',
  muted:        '#9ca3af',
  accentSoft:   'rgba(255,122,0,0.12)',
  accentBorder: 'rgba(255,122,0,0.28)',
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
      backgroundColor: '#0f2030',
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

  const [editingField, setEditingField] = useState<'age' | 'gender' | 'dateOfBirth' | 'phone' | null>(null);
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

  const handleEditClick = (field: 'age' | 'gender' | 'dateOfBirth' | 'phone', initialValue: string) => {
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
      await updateProfile(supabaseUserId, { [editingField]: finalValue });
    } catch (e) {
      console.warn('Failed to save', e);
    } finally {
      setEditingField(null);
    }
  };

  // ── Derived data ──────────────────────────────────────────────────────────
  const displayName = profile?.fullName  || 'User';
  const username    = profile?.username   || 'username';
  const email       = profile?.email      || 'email@example.com';
  const bio         = social?.bio?.trim() || 'No bio yet.';
  const whatIDoRaw  = social?.whatIDo?.trim();
  const whatIDoItems= whatIDoRaw ? whatIDoRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
  const openToConnect = social?.openToConnect !== false;

  const streak   = streakData?.currentStreak  ?? profile?.currentStreak    ?? 3;
  const workouts = streakData?.totalWorkouts  ?? profile?.completedWorkouts ?? 12;
  const prs      = streakData?.bestStreak     ?? profile?.bestStreak        ?? 4;

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
                      <View style={{ width: 100, height: 100, borderRadius: 22, backgroundColor: '#0f2030', alignItems: 'center', justifyContent: 'center' }}>
                        <ActivityIndicator color={C.orange} size="large" />
                      </View>
                    ) : (
                      <Avatar uri={profile?.profileImageUrl} size={100} />
                    )}
                  </View>
                </TierAvatarRing>

                {/* Avatar action icons — below picture, always visible */}
                <View style={s.avatarActions}>
                  {profile?.profileImageUrl ? (
                    <>
                      <TouchableOpacity style={s.avatarActionBtn} onPress={handleReplaceAvatar} activeOpacity={0.75}>
                        <RefreshCw size={15} color="#fff" strokeWidth={2.2} />
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.avatarActionBtn, s.avatarActionDelete]} onPress={handleDeleteAvatar} activeOpacity={0.75}>
                        <Trash2 size={15} color="#fff" strokeWidth={2.2} />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity style={s.avatarUploadBtn} onPress={handleReplaceAvatar} activeOpacity={0.75}>
                      <Camera size={15} color="#fff" strokeWidth={2.2} />
                      <Text style={s.avatarUploadBtnText}>Upload Photo</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={s.heroInfoCol}>
                <Text style={s.handle} numberOfLines={1}>@{username}</Text>
                <Text style={s.name} numberOfLines={1}>{displayName}</Text>
                <Text style={s.email} numberOfLines={1}>{email}</Text>
              </View>
            </View>

            {/* Privacy Controls */}
            <View style={s.privacyRow}>
              {[
                { id: 'public', label: 'Public' },
                { id: 'friends_only', label: 'Only Friends' },
                { id: 'private', label: 'Hidden (no commission)' },
              ].map(opt => {
                const isActive = (social?.privacyLevel || 'public') === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[s.privacyPill, isActive && s.privacyPillActive]}
                    onPress={() => handleSetPrivacy(opt.id as any)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.privacyPillText, isActive && s.privacyPillTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Location labels below privacy pills */}
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

          {/* ── AI SUMMARY — curated intro, right after locations ───────────── */}
          <ProfileCard>
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
                <ActivityIndicator color="#fff" size="small" />
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
          <StatPill streak={streak} workouts={workouts} prs={prs} />

          {/* ── FRIENDS ─────────────────────────────────────────────────────── */}
          <ProfileCard>
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

          {/* ── ABOUT ME ────────────────────────────────────────────────────── */}
          <ProfileCard>
            <View style={s.cardHeaderRow}>
              <Text style={s.cardTitle}>About me</Text>
              <TouchableOpacity onPress={() => navigation.navigate('EditSocialProfileScreen', { section: 'about' })}>
                <Pencil size={16} color={C.muted} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <Text style={s.bodyText}>{bio}</Text>
          </ProfileCard>

          {/* ── ACTIVITY TIME ────────────────────────────────────────────────── */}
          <ProfileCard>
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
          <ProfileCard>
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
                .sort((a, b) => {
                  const tA = badgeStates.find(bs => bs.familyKey === a.key)?.currentTier ?? 0;
                  const tB = badgeStates.find(bs => bs.familyKey === b.key)?.currentTier ?? 0;
                  return tB - tA;
                })
                .map(family => {
                const state = badgeStates.find(bs => bs.familyKey === family.key);
                const tier  = state?.currentTier ?? 0;
                const color = tier > 0 ? TIER_COLORS[tier - 1] : '#9CA3AF';
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
                        { borderColor: locked ? 'rgba(255,255,255,0.1)' : color + '88',
                          backgroundColor: locked ? 'rgba(255,255,255,0.04)' : color + '22' },
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

          {/* ── WHAT I DO ───────────────────────────────────────────────────── */}
          <ProfileCard>
            <View style={s.cardHeaderRow}>
              <Text style={s.cardTitle}>What I do</Text>
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
                <Text style={s.bodyText}>Add what you do</Text>
              )}
            </View>
          </ProfileCard>

          {/* ── HOBBIES ─────────────────────────────────────────────────────── */}
          <ProfileCard>
            <View style={s.cardHeaderRow}>
              <Text style={s.cardTitle}>Hobbies</Text>
              <TouchableOpacity onPress={() => navigation.navigate('EditSocialProfileScreen', { section: 'hobbies' })}>
                <Pencil size={16} color={C.muted} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <View style={s.hobbiesRow}>
              {hobbyItems.map(hobby => {
                const meta = HOBBY_META[hobby];
                const Icon = HOBBY_ICONS[hobby] ?? Dumbbell;
                return (
                  <View key={hobby} style={s.hobbyCapsule}>
                    <Icon size={14} color={C.orange} strokeWidth={2.2} />
                    <Text style={s.hobbyCapsuleText}>{meta.label}</Text>
                  </View>
                );
              })}
            </View>
          </ProfileCard>

          {/* ── LOOKING TO MEET ─────────────────────────────────────────────── */}
          <ProfileCard>
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
          <ProfileCard>
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
                        <X size={16} color="#fff" strokeWidth={2.5} />
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
                        <X size={16} color="#fff" strokeWidth={2.5} />
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
                        <X size={16} color="#fff" strokeWidth={2.5} />
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
                        <X size={16} color="#fff" strokeWidth={2.5} />
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

          {/* ── LOCATIONS ───────────────────────────────────────────────────── */}
          <ProfileCard>
            <View style={s.cardHeaderRow}>
              <Text style={s.cardTitle}>Locations</Text>
              <TouchableOpacity onPress={() => navigation.navigate('EditSocialProfileScreen', { section: 'locations' })}>
                <Pencil size={16} color={C.muted} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            {(() => {
              // Self view → full address. Compact: just label + address text.
              const items = [
                { label: 'Workout Area', address: social?.gymAddress || social?.gymArea || '' },
                { label: 'Home area',    address: social?.houseAddress || '' },
                { label: 'Hangout Area', address: social?.parkAddress || '' },
              ].filter(it => it.address.trim());

              if (items.length === 0) {
                return <Text style={s.bodyText}>Add your favorite locations</Text>;
              }
              return (
                <View style={{ gap: 12, marginTop: 4 }}>
                  {items.map(it => (
                    <View key={it.label}>
                      <Text style={s.locItemLabel}>{it.label}</Text>
                      <Text style={s.locItemAddr}>{it.address}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}
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
          </ProfileCard>

          {/* ── COMMUNITY SERVICE ───────────────────────────────────────────── */}
          <ProfileCard>
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
          <ProfileCard>
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
  avatarActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    marginBottom: 4,
  },
  avatarActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,122,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarActionDelete: {
    backgroundColor: 'rgba(239,68,68,0.85)',
  },
  avatarUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.orange,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  avatarUploadBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
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
  name: {
    color: C.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
  },
  handle: {
    color: C.muted,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 0,
  },
  email: {
    color: C.muted,
    fontSize: 14,
    marginTop: 2,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  privacyPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  privacyPillActive: {
    backgroundColor: '#E89951',
    borderColor: '#E89951',
  },
  privacyPillText: {
    color: C.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  privacyPillTextActive: {
    color: '#000000',
    fontWeight: '800',
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
    color: '#E89951',
    fontSize: 12,
    fontWeight: '700',
    width: 96,
  },
  heroLocationDash: {
    color: '#6b7280',
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
  locItemLabel: {
    color: '#E89951',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  locItemAddr: {
    color: C.text,
    fontSize: 14,
    lineHeight: 19,
  },
  aiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    backgroundColor: '#FF6B00',
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
    color: '#fff',
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
    backgroundColor: 'rgba(255,255,255,0.08)',
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
  hobbyCapsuleText: {
    color: C.orange,
    fontSize: 14,
    fontWeight: '600',
  },
  meetCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: C.blueBorder,
    backgroundColor: C.blueSoft,
  },
  meetCapsuleText: {
    color: C.blue,
    fontSize: 14,
    fontWeight: '600',
  },
  whatIDoCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: C.greenBorder,
    backgroundColor: C.greenSoft,
  },
  whatIDoCapsuleText: {
    color: C.green,
    fontSize: 14,
    fontWeight: '600',
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
    backgroundColor: 'rgba(255,122,0,0.1)',
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
    color: '#fff',
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
});
