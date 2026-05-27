import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  AppState,
} from 'react-native';
import { BookingBottomSheet, Toast } from '../features/booking/BookingBottomSheet';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import {
  PlusCircle,
  Accessibility,
  ChevronRight,
  Clock,
  Dumbbell,
  Video as VideoIcon,
  Users,
  Coins,
  TrendingUp,
  Calendar,
  UserCircle,
  CircleUserRound,
  Heart,
  Bell,
  X,
  UserPlus,
  Target,
  Star,
} from 'lucide-react-native';
import { Raw1Logo } from '../raw1_logo';
import { AccessBadge } from '../components/AccessBadge';
import { useAuth } from '../providers/AuthContext';
import { useUser } from '../providers/UserContext';
import { useLibrary } from '../providers/LibraryContext';
import { useWorkoutSession } from '../providers/WorkoutSessionContext';
import { AppTheme, CoachingTheme, FontSizes, FontWeights } from '../core/theme/app_theme';
import { LinearGradient } from 'expo-linear-gradient';
import { SCREEN_PADDING, CARD_BORDER_RADIUS, CARD_GAP } from '../constants/theme';
import { useFriend } from '../providers/FriendContext';
import { useFavorites } from '../providers/FavoritesContext';
import { ChatService, getChatId } from '../services/chat.service';
import { ChatConversation } from '../models/Chat';
import { WebSafeAvatar } from '../components/WebSafeAvatar';
import { useRecommendations } from '../hooks/useRecommendations';
import { RecommendedProgram } from '../services/recommendation.service';
import { LiveSessionService, LiveSession } from '../services/liveSession.service';
import { Ionicons } from '@expo/vector-icons';
import { getProgramByVideoId } from '../data/preRecordedPrograms';
import { TodaysChallengeCard } from '../components/TodaysChallengeCard';
import { StreakService, StreakData } from '../services/streak.service';
import { DailyActivityService } from '../services/dailyActivity.service';
import { supabase } from '../core/config/supabase';
import { UnifiedProgressLeaderboard } from '../components/UnifiedProgressLeaderboard';
import { DailyReminderCard } from '../components/DailyReminderCard';
import { msUntilMidnight, getDateKey, buildWeekDates, getLastNDayKeys } from '../utils/streakDate';
import { getResolvedTimezone } from '../utils/timezone';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

// ── Recommendation card row ────────────────────────────────────────────────────
function RecommendationSection({
  title,
  items,
  navigation,
}: {
  title: string;
  items: RecommendedProgram[];
  navigation: any;
}) {
  return (
    <View style={{ marginTop: 8, marginBottom: 8, backgroundColor: '#131f2e', borderRadius: 12, paddingVertical: 14 }}>
      <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', paddingHorizontal: 16, marginBottom: 12 }}>
        {title}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
      >
        {items.map((item) => (
          <TouchableOpacity
            key={item.programId}
            onPress={() =>
              navigation.navigate('VideoPlayer', {
                videoId: item.firstVideoId,
                title: item.title,
                videoUrl: item.firstVideoUrl,
                category: item.categoryLabel,
                workoutTitle: item.title,
              })
            }
            style={{
              width: 155,
              borderRadius: 12,
              overflow: 'hidden',
              backgroundColor: AppTheme.cardColor,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.07)',
            }}
            activeOpacity={0.85}
          >
            {/* Category colour cover */}
            <View
              style={{
                width: '100%',
                height: 82,
                backgroundColor: item.categoryColor,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 34 }}>{item.categoryEmoji}</Text>
              {/* difficulty badge */}
              <View
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  backgroundColor: 'rgba(0,0,0,0.55)',
                  borderRadius: 6,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>{item.level.toUpperCase()}</Text>
              </View>
              {/* video count badge */}
              <View
                style={{
                  position: 'absolute',
                  bottom: 6,
                  left: 6,
                  backgroundColor: 'rgba(0,0,0,0.55)',
                  borderRadius: 6,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 9, fontWeight: '600' }}>{item.totalVideos} videos</Text>
              </View>
            </View>
            <View style={{ padding: 9 }}>
              <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.45)', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>
                {item.categoryLabel}
              </Text>
              <Text numberOfLines={2} style={{ color: '#fff', fontSize: 12, fontWeight: '700', lineHeight: 16 }}>
                {item.title}
              </Text>
              <Text numberOfLines={1} style={{ color: AppTheme.primaryColor, fontSize: 10, marginTop: 4 }}>
                {item.reason}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const HomeScreenInner = () => {
  const navigation = useNavigation<any>();
  const { supabaseUserId, email, logout, user: authUser } = useAuth();
  const { profile, loading: userLoading, appMode, setAppMode } = useUser();
  const { setSubTab, setIsGripCuffActive } = useLibrary();
  const { pendingInvites, pendingOutgoing, completedSessions, upcomingSessions } = useWorkoutSession();
  const { incomingRequests, friends, acceptRequest, declineRequest } = useFriend();
  const { favorites } = useFavorites();

  // Watch history for resume section
  const [watchHistory, setWatchHistory] = useState<any[]>([]);


  // Personalized recommendations
  const { sections: recSections, loading: recLoading } = useRecommendations(supabaseUserId);

  // Unread chat messages count + conversations
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [chatConversations, setChatConversations] = useState<ChatConversation[]>([]);
  useEffect(() => {
    if (!authUser?.uid) return;
    const unsub = ChatService.subscribeToConversations(authUser.uid, (convos: ChatConversation[]) => {
      const total = convos.reduce((sum, c) => sum + (c.unreadCount?.[authUser.uid] ?? 0), 0);
      setUnreadChatCount(total);
      setChatConversations(convos);
    });
    return unsub;
  }, [authUser?.uid]);

  // Live sessions (stranger calls currently active)
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [pendingJoin, setPendingJoin] = useState<{ sessionId: string; requestId: string } | null>(null);
  const [joinStatus, setJoinStatus] = useState<'waiting' | 'allowed' | 'denied' | null>(null);

  useEffect(() => {
    return LiveSessionService.subscribeLiveSessions(setLiveSessions);
  }, []);

  useEffect(() => {
    if (!pendingJoin) return;
    const unsub = LiveSessionService.subscribeMyJoinRequest(
      pendingJoin.sessionId,
      pendingJoin.requestId,
      (status) => {
        if (status === 'allowed') {
          setJoinStatus('allowed');
          const session = liveSessions.find(s => s.id === pendingJoin.sessionId);
          if (session) {
            navigation.navigate('SyncedVideoPlayer', {
              sessionId: session.id,
              videoId: session.videoId,
              videoTitle: session.videoTitle,
              friendName: session.hostName,
            });
          }
          setPendingJoin(null);
          setJoinStatus(null);
        } else if (status === 'denied') {
          setJoinStatus('denied');
          setTimeout(() => {
            setPendingJoin(null);
            setJoinStatus(null);
          }, 3000);
        }
      }
    );
    return unsub;
  }, [pendingJoin?.requestId]);

  // Notification Center State
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const totalNotificationsBadge = pendingInvites.length + incomingRequests.length + unreadChatCount;

  // ── Streak data ─────────────────────────────────────────────────────────
  // Derived directly from `profile` (UserContext), which already has a
  // realtime Supabase subscription. When Supabase writes current_streak /
  // weekly_activity, UserContext re-fetches the profile and this effect
  // rebuilds streakData — no separate StreakService fetch needed.
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  // Today's watched_minutes fetched fresh from user_daily_activity after each flush.
  const [todayDbMinutes, setTodayDbMinutes] = useState(0);

  // Serialize weeklyActivity to a string so React sees a primitive dep,
  // not an object reference that is brand-new every render.
  const weeklyActivityJson = JSON.stringify(profile?.weeklyActivity ?? null);

  // Fetch today's watched_minutes from user_daily_activity after each flush.
  // Re-runs whenever lastVideoWatchAt changes (set by increment_watch_time after each tick).
  useEffect(() => {
    if (!supabaseUserId) { setTodayDbMinutes(0); return; }
    const tz = getResolvedTimezone();
    const today = getDateKey(tz);
    supabase
      .from('user_daily_activity')
      .select('watched_minutes')
      .eq('user_id', supabaseUserId)
      .eq('activity_date', today)
      .maybeSingle()
      .then(({ data: row }) => setTodayDbMinutes(Number(row?.watched_minutes || 0)));
  }, [supabaseUserId, profile?.lastVideoWatchAt]);

  useEffect(() => {
    if (!profile) return;
    const tz = getResolvedTimezone();
    const weeklyActivityRaw: Record<string, boolean> =
      (profile.weeklyActivity && typeof profile.weeklyActivity === 'object')
        ? profile.weeklyActivity as Record<string, boolean>
        : {};

    const todayKey = getDateKey(tz);

    // Guard: only show DB minutes for today if the last watch was on the current UTC day.
    // today_watch_seconds resets at UTC midnight; user_daily_activity uses local dates.
    // Mixed comparison (UTC last-watch date vs local todayKey) prevents stale boot-sync
    // data from showing when UTC day < local day (e.g. IST +5:30 early morning).
    const lastWatchDateUtc = profile.lastVideoWatchAt
      ? new Date(profile.lastVideoWatchAt).toISOString().split('T')[0]
      : null;
    const todayUtcKey = new Date().toISOString().split('T')[0];
    const todayMinutes = lastWatchDateUtc === todayUtcKey ? todayDbMinutes : 0;

    const calendarWeek = buildWeekDates(tz, 0);
    const rollingDays = getLastNDayKeys(tz, 7);
    const allDays = Array.from(new Set([...calendarWeek, ...rollingDays]));
    const weeklyActivity: Record<string, boolean> = {};
    const weeklyMinutes: Record<string, number> = {};
    allDays.forEach(d => {
      weeklyActivity[d] = !!weeklyActivityRaw[d];
      weeklyMinutes[d] = d === todayKey ? todayMinutes : 0;
    });

    const currentStreak = profile.currentStreak ?? 0;
    const completedWorkouts = profile.completedWorkouts ?? 0;
    const totalLiveSessions = profile.totalLiveSessions ?? 0;

    const nextData: StreakData = {
      currentStreak,
      bestStreak: profile.bestStreak ?? 0,
      lastWorkoutDate: profile.lastWorkoutDate ?? null,
      weeklyActivity,
      weeklyMinutes,
      weeklyChallengesCompleted: 0,
      timezone: tz,
      totalWorkouts: completedWorkouts,
      totalLiveSessions,
      credits: profile.credits ?? 0,
      badges: [],
      leaderboardScore: currentStreak * 5 + completedWorkouts * 3 + totalLiveSessions * 8,
    };

    // Only update state when values actually changed (prevents downstream cascades).
    // weeklyMinutes MUST be compared — todayWatchSeconds changes it without touching weeklyActivity.
    setStreakData(prev => {
      if (
        prev?.currentStreak === nextData.currentStreak &&
        prev?.bestStreak === nextData.bestStreak &&
        prev?.lastWorkoutDate === nextData.lastWorkoutDate &&
        prev?.credits === nextData.credits &&
        prev?.totalWorkouts === nextData.totalWorkouts &&
        JSON.stringify(prev?.weeklyActivity) === JSON.stringify(nextData.weeklyActivity) &&
        prev?.weeklyMinutes?.[todayKey] === nextData.weeklyMinutes?.[todayKey]
      ) {
        return prev;
      }
      return nextData;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    profile?.currentStreak,
    profile?.bestStreak,
    profile?.lastWorkoutDate,
    weeklyActivityJson,       // serialized — stable primitive
    profile?.completedWorkouts,
    profile?.watchedSeconds,
    profile?.lastVideoWatchAt,
    profile?.credits,
    todayDbMinutes,           // re-run when fresh DB minutes arrive after each flush
  ]);

  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  console.log(`[Home] render #${renderCountRef.current}`);

  useEffect(() => {
    console.log('[Home] mounted');
    return () => { console.log('[Home] unmounted'); };
  }, []);

  // ── Refresh guard: prevents concurrent + rapid-fire profile fetches ─────
  // fetchProfile itself has a 3 s cooldown; this adds a HomeScreen-level
  // concurrent guard so we don't even queue calls on top of each other.
  const isRefreshingRef = useRef(false);
  const lastRefreshRef = useRef(0);
  const { fetchProfile } = useUser();

  const doRefresh = useCallback((uid: string) => {
    const now = Date.now();
    if (isRefreshingRef.current) {
      console.log('[Home] doRefresh skipped — in-flight');
      return;
    }
    if (now - lastRefreshRef.current < 5000) {
      console.log('[Home] doRefresh skipped — cooldown');
      return;
    }
    isRefreshingRef.current = true;
    lastRefreshRef.current = now;
    fetchProfile(uid)
      .catch(() => {})
      .finally(() => { isRefreshingRef.current = false; });
    StreakService.checkAndBreakStreak(uid).catch(() => {});
    DailyActivityService.recalculateUserStreak(uid).catch(() => {});
  }, [fetchProfile]); // fetchProfile is stable (useCallback with no deps)

  // ── ONE useFocusEffect — fires when tab is focused ───────────────────────
  useFocusEffect(useCallback(() => {
    if (!supabaseUserId) return;
    doRefresh(supabaseUserId);
  }, [supabaseUserId, doRefresh]));

  // ── ONE AppState listener — fires on foreground resume ───────────────────
  useEffect(() => {
    if (!supabaseUserId) return;
    const uid = supabaseUserId;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') doRefresh(uid);
    });
    return () => sub.remove();
  }, [supabaseUserId, doRefresh]);

  // ── ONE midnight timer — captures timezone once, never recreated ─────────
  // Stable ref holds current timezone so the timer effect itself has no
  // object deps that change on every render.
  const timezoneRef = useRef(getResolvedTimezone());
  useEffect(() => {
    if (!supabaseUserId) return;
    const uid = supabaseUserId;
    const tz = timezoneRef.current;

    let timer: ReturnType<typeof setTimeout>;
    const scheduleNextMidnight = () => {
      const ms = msUntilMidnight(tz, 500);
      timer = setTimeout(() => {
        console.log('[Streak] midnight rollover — refreshing profile');
        doRefresh(uid);
        scheduleNextMidnight();
      }, ms);
    };
    scheduleNextMidnight();
    return () => clearTimeout(timer);
  }, [supabaseUserId, doRefresh]); // doRefresh is stable, supabaseUserId only changes on login

  // Booking modal state
  const [bookingVisible, setBookingVisible] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showTiersModal, setShowTiersModal] = useState(false);

  const theme = appMode === 'coaching' ? CoachingTheme : AppTheme;
  const isCoaching = appMode === 'coaching';

  const displayName = profile?.fullName || email?.split('@')[0] || 'Guest';

  // Animation for toggle indicator
  const toggleAnim = useRef(new Animated.Value(0)).current;
  const screenWidth = Dimensions.get('window').width;
  const toggleWidth = screenWidth - (SCREEN_PADDING * 2) - 8; // container width minus padding
  const halfToggle = toggleWidth / 2;

  useEffect(() => {
    Animated.timing(toggleAnim, {
      toValue: appMode === 'ai' ? 0 : 1,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [appMode]);

  const indicatorLeft = toggleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, halfToggle],
  });


  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Raw1Logo fontSize={24} />
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <AccessBadge />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => navigation.navigate('ProfileScreen')}
              activeOpacity={0.8}
            >
              <WebSafeAvatar
                uri={profile?.profileImageUrl}
                size={40}
                fallback={<CircleUserRound color={AppTheme.primaryColor} size={32} />}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => setNotificationModalVisible(true)}
              activeOpacity={0.8}
            >
              <View>
                <Bell color={AppTheme.primaryColor} size={26} />
                {totalNotificationsBadge > 0 && (
                  <View style={styles.bellBadge}>
                    <Text style={styles.bellBadgeText}>
                      {totalNotificationsBadge > 99 ? '99+' : totalNotificationsBadge}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Mode Toggle ── */}
        {false && (
          <>
        <View style={[
          styles.toggleContainer,
          isCoaching ? {
            backgroundColor: CoachingTheme.cardColor,
            borderWidth: 1,
            borderColor: CoachingTheme.primaryGlow
          } : { backgroundColor: AppTheme.cardColor }
        ]}>
          <Animated.View
            style={[
              styles.toggleIndicator,
              {
                width: halfToggle,
                transform: [{ translateX: indicatorLeft }],
                backgroundColor: '#000000',
                borderBottomColor: isCoaching ? CoachingTheme.primaryColor : '#FF6B00',
              },
            ]}
          />
          <TouchableOpacity
            style={[styles.toggleButton, isCoaching ? { backgroundColor: 'transparent' } : {}]}
            onPress={() => setAppMode('ai')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.toggleText,
                appMode === 'ai' && styles.toggleTextActive,
                isCoaching && { color: CoachingTheme.textGrey }
              ]}
            >
              Self Training
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, { backgroundColor: 'transparent' }]}
            activeOpacity={1}
          >
            <Text style={[styles.toggleText, { color: '#888888' }]}>
              Personal Coaching
            </Text>
            <Text style={{ fontSize: 12, marginLeft: 5 }}>🔒</Text>
          </TouchableOpacity>
        </View>

        {/* Coming Soon banner — shown directly below tab bar */}
        {appMode !== 'ai' ? null : null}
        <View style={{ backgroundColor: 'rgba(255,107,0,0.07)', borderRadius: 10, marginHorizontal: 16, marginTop: 10, marginBottom: 2, paddingVertical: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 14 }}>🔒</Text>
          <Text style={{ color: '#888', fontSize: 13, fontWeight: '500' }}>Personal Coaching — Coming Soon</Text>
        </View>

          </>
        )}
        <View style={styles.content}>
          {userLoading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={theme.primaryColor} />
            </View>
          ) : appMode === 'ai' ? (
            /* ── Mode 1: AI Personal Trainer ── */
            <>
              <View style={styles.welcomeBlock}>
                <Text style={styles.welcomeText}>
                  Welcome back, {displayName}!
                </Text>
                <Text style={styles.subtitleText}>
                  Continue your fitness journey
                </Text>
              </View>

              {/* Quick Stats */}
              <View style={styles.compactStatsCard}>
                <TouchableOpacity
                  style={styles.compactStatCell}
                  onPress={() => navigation.navigate('CreditsScreen')}
                  activeOpacity={0.7}
                >
                  <Coins color={theme.primaryColor} size={18} />
                  <View style={{ marginLeft: 8 }}>
                    <Text style={styles.compactStatValue}>{profile?.credits?.toString() ?? "5"}</Text>
                    <Text style={styles.compactStatLabel}>Credits</Text>
                    <TouchableOpacity
                      onPress={() => navigation.navigate('EarnCreditsScreen')}
                      activeOpacity={0.7}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Text style={styles.compactEarnText}>+ Earn credits</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>

                <View style={styles.compactDivider} />

                <TouchableOpacity
                  style={styles.compactStatCell}
                  onPress={() => navigation.navigate('UpcomingSessionsScreen')}
                  activeOpacity={0.7}
                >
                  <Dumbbell color={theme.primaryColor} size={18} />
                  <View style={{ marginLeft: 8 }}>
                    <Text style={styles.compactStatValue}>{(completedSessions.length + upcomingSessions.length).toString()}</Text>
                    <Text style={styles.compactStatLabel}>Workouts</Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.compactDivider} />

                <TouchableOpacity
                  style={styles.compactStatCell}
                  onPress={() => {
                    setIsGripCuffActive(false);
                    setSubTab('favorites');
                    navigation.navigate('LibraryTab');
                  }}
                  activeOpacity={0.7}
                >
                  <Heart color={theme.primaryColor} size={18} />
                  <View style={{ marginLeft: 8 }}>
                    <Text style={styles.compactStatValue}>{favorites.length.toString()}</Text>
                    <Text style={styles.compactStatLabel}>Favorites</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Unified streak + leaderboard */}
              <UnifiedProgressLeaderboard
                streakData={streakData}
                currentUserId={supabaseUserId ?? undefined}
                onViewAll={() => navigation.navigate('LeaderboardScreen')}
              />

              {/* Daily Reminder Scheduler */}
              <DailyReminderCard userId={supabaseUserId ?? undefined} />




              {/* GripCuff Training Progress Card */}
              <View style={styles.gripCuffCard}>
                <View style={styles.gripCuffLeft}>
                  <Text style={styles.gripCuffTitle}>GripCuff Training</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <View style={{ backgroundColor: '#1E3A5F', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 }}>
                      <Text style={{ color: '#4FC3F7', fontSize: 11, fontWeight: '700' }}>STARTER</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setShowTiersModal(true)}
                      style={{ backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6 }}
                      activeOpacity={0.8}
                    >
                      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600' }}>Upgrade</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.gripCuffRight}>
                  <TouchableOpacity
                    style={styles.gripCuffBtn}
                    onPress={() => navigation.navigate('GripCuffVideos')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.gripCuffBtnText}>Get Started</Text>
                  </TouchableOpacity>
                  <Text style={{ color: '#607a94', fontSize: 12, fontWeight: '600', marginTop: 6, marginRight: 8 }}>Level 1 / 4</Text>
                </View>
              </View>


              {/* Today's Challenge */}
              <View style={{ marginTop: 20, paddingHorizontal: 16 }}>
                <TodaysChallengeCard timezone={streakData?.timezone} />
              </View>


              {/* ── Recommendation Sections ── */}
              {recSections?.hasData && (
                <>
                  {/* 🔥 Recommended For You */}
                  {recSections.forYou.length > 0 && (
                    <RecommendationSection
                      title="🔥 Recommended For You"
                      items={recSections.forYou}
                      navigation={navigation}
                    />
                  )}

                  {/* 💪 Because You Liked [Category] */}
                  {recSections.becauseLiked && recSections.becauseLiked.items.length > 0 && (
                    <RecommendationSection
                      title={`💪 Because You Liked ${recSections.becauseLiked.label}`}
                      items={recSections.becauseLiked.items}
                      navigation={navigation}
                    />
                  )}

                  {/* ⚡ Based On What You Want To Try */}
                  {recSections.wantToTry && recSections.wantToTry.length > 0 && (
                    <RecommendationSection
                      title="⚡ Based On What You Want To Try"
                      items={recSections.wantToTry}
                      navigation={navigation}
                    />
                  )}

                  {/* 📈 Popular In [Category] */}
                  {recSections.trendingInCategory && recSections.trendingInCategory.items.length > 0 && (
                    <RecommendationSection
                      title={`📈 ${recSections.trendingInCategory.label}`}
                      items={recSections.trendingInCategory.items}
                      navigation={navigation}
                    />
                  )}
                </>
              )}

              {/* Resume */}
              {watchHistory.length > 0 && (
                <View style={{ marginTop: 20, marginBottom: 20, backgroundColor: '#131f2e', borderRadius: 12, paddingVertical: 14 }}>
                  <Text style={{
                    color: '#fff', fontSize: 18, fontWeight: '700',
                    paddingHorizontal: 16, marginBottom: 12,
                  }}>
                    Resume
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
                  >
                    {watchHistory.map((item: any) => (
                      (() => {
                        const inferredProgram = getProgramByVideoId(item.videoId ?? '');
                        const routeWorkoutTitle =
                          item.workoutTitle ||
                          item.programName ||
                          inferredProgram?.title ||
                          item.category ||
                          null;
                        const routeWorkoutId =
                          item.workoutId ||
                          inferredProgram?.id ||
                          null;
                        return (
                      <TouchableOpacity
                        key={item.videoId}
                        onPress={() => navigation.navigate('VideoPlayer', {
                          videoId: item.videoId,
                          title: item.title,
                          videoUrl: item.videoUrl || undefined,
                          youtubeId: item.youtubeId || undefined,
                          workoutId: routeWorkoutId || undefined,
                          workoutTitle: routeWorkoutTitle || undefined,
                          programName: routeWorkoutTitle || undefined,
                          category: item.category || undefined,
                          allowInvite: item.allowInvite === true,
                          videoType: item.allowInvite === true ? 'premade_workout' : 'exercise_library',
                        })}
                        style={{
                          width: 160, borderRadius: 12, overflow: 'hidden',
                          backgroundColor: AppTheme.cardColor,
                        }}
                      >
                        <View style={{
                          width: '100%', height: 95, backgroundColor: '#222',
                          justifyContent: 'center', alignItems: 'center',
                        }}>
                          {item.thumbnail ? (
                            <Image
                              source={{ uri: item.thumbnail }}
                              style={{ width: '100%', height: '100%' }}
                              resizeMode="cover"
                            />
                          ) : (
                            <Ionicons name="play-circle" size={36} color={AppTheme.primaryColor} />
                          )}
                        </View>
                        <View style={{ padding: 8 }}>
                          {(() => {
                            const label = item.programName
                              ?? item.category
                              ?? getProgramByVideoId(item.videoId ?? '')?.title
                              ?? null;
                            return label ? (
                              <Text
                                numberOfLines={1}
                                style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}
                              >
                                {label}
                              </Text>
                            ) : null;
                          })()}
                          <Text
                            numberOfLines={2}
                            style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}
                          >
                            {item.title}
                          </Text>
                          <Text style={{ color: AppTheme.primaryColor, fontSize: 10, marginTop: 3 }}>
                            Continue watching →
                          </Text>
                        </View>
                      </TouchableOpacity>
                        );
                      })()
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Live Now — active stranger calls */}
              {(() => {
                const visibleSessions = liveSessions.filter(
                  s => s.hostUid !== supabaseUserId && s.guestUid !== supabaseUserId
                );
                if (visibleSessions.length === 0) return null;
                return (
                  <View style={{ marginTop: 20, marginBottom: 20 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, marginBottom: 12, gap: 8 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#00ff88' }} />
                      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>Live Now</Text>
                    </View>
                    {visibleSessions.slice(0, 5).map((session) => {
                      const isPendingThis = pendingJoin?.sessionId === session.id;
                      return (
                        <View
                          key={session.id}
                          style={{
                            backgroundColor: AppTheme.cardColor,
                            borderRadius: 14,
                            padding: 14,
                            marginBottom: 10,
                            borderWidth: 1,
                            borderColor: 'rgba(0,255,136,0.2)',
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 }}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#00ff88' }} />
                            <Text style={{ color: '#00ff88', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              Live
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }} numberOfLines={1}>
                                {session.hostName} &amp; {session.guestName}
                              </Text>
                              <Text style={{ color: AppTheme.textGrey, fontSize: 12, marginTop: 4 }} numberOfLines={1}>
                                {session.videoTitle}
                              </Text>
                            </View>
                            {isPendingThis ? (
                              <View style={{ paddingHorizontal: 14, paddingVertical: 8 }}>
                                {joinStatus === 'denied' ? (
                                  <Text style={{ color: '#ff4444', fontSize: 12, fontWeight: '600' }}>Denied</Text>
                                ) : (
                                  <Text style={{ color: AppTheme.textGrey, fontSize: 12 }}>Waiting...</Text>
                                )}
                              </View>
                            ) : (
                              <TouchableOpacity
                                style={{
                                  backgroundColor: 'rgba(0,255,136,0.12)',
                                  borderRadius: 8,
                                  paddingHorizontal: 14,
                                  paddingVertical: 8,
                                  borderWidth: 1,
                                  borderColor: 'rgba(0,255,136,0.4)',
                                }}
                                activeOpacity={0.7}
                                onPress={async () => {
                                  if (!supabaseUserId || !profile) return;
                                  const name = profile.fullName || profile.username || email?.split('@')[0] || 'Someone';
                                  const requestId = await LiveSessionService.requestToJoin(session.id, {
                                    uid: supabaseUserId,
                                    name,
                                    avatarUrl: profile.profileImageUrl ?? null,
                                  });
                                  setPendingJoin({ sessionId: session.id, requestId });
                                  setJoinStatus('waiting');
                                }}
                              >
                                <Text style={{ color: '#00ff88', fontWeight: '700', fontSize: 13 }}>Join</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })()}

              {/* Upcoming Sessions — awaiting response + join now only */}
              {(() => {
                const now = Date.now();
                const oneHourAgo = now - 60 * 60 * 1000;
                const acceptedSessions = upcomingSessions.filter(s => s.status === 'accepted' && (s.scheduledAt instanceof Date ? s.scheduledAt.getTime() : (s.scheduledAt as any)?.toMillis?.() ?? 0) > oneHourAgo);
                const upcomingItems = [...pendingInvites, ...pendingOutgoing, ...acceptedSessions];
                if (upcomingItems.length === 0) return null;
                return (
                  <View style={{ marginTop: 20, marginBottom: 20 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, marginBottom: 12 }}>
                      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>Upcoming</Text>
                      <TouchableOpacity onPress={() => navigation.navigate('UpcomingSessionsScreen')}>
                        <Text style={{ color: AppTheme.primaryColor, fontSize: 13, fontWeight: '600' }}>View All →</Text>
                      </TouchableOpacity>
                    </View>
                    {upcomingItems.slice(0, 3).map((session) => {
                      const isInvite = session.status === 'pending' && session.hostUid !== supabaseUserId;
                      const isOutgoing = session.status === 'pending' && session.hostUid === supabaseUserId;
                      const isAccepted = session.status === 'accepted';
                      const isHost = session.hostUid === supabaseUserId;
                      const partnerName = isHost ? session.guestName : session.hostName;
                      const scheduledDate = session.scheduledAt instanceof Date
                        ? session.scheduledAt
                        : (session.scheduledAt as any)?.toDate?.() ?? null;
                      const dateStr = scheduledDate
                        ? scheduledDate.toDateString() === new Date().toDateString()
                          ? 'Today'
                          : scheduledDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                        : '';
                      const timeStr = scheduledDate
                        ? scheduledDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                        : '';
                      const label = isAccepted ? 'Workout with Friend' : 'Awaiting Response';

                      return (
                        <TouchableOpacity
                          key={session.id}
                          style={{
                            backgroundColor: AppTheme.cardColor,
                            borderRadius: 14,
                            padding: 14,
                            marginBottom: 10,
                            borderWidth: 1,
                            borderColor: isAccepted ? 'rgba(16,185,129,0.3)' : 'rgba(249,115,22,0.2)',
                          }}
                          activeOpacity={0.8}
                          onPress={() => navigation.navigate('UpcomingSessionsScreen')}
                        >
                          <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8 }}>
                            {label}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }} numberOfLines={1}>
                                {isInvite ? `${session.hostName} invited you` : isOutgoing ? `Invited ${session.guestName}` : `You & ${partnerName}`}
                              </Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  <Calendar color={AppTheme.textGrey} size={12} />
                                  <Text style={{ color: AppTheme.textGrey, fontSize: 12 }}>{dateStr}</Text>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  <Clock color={AppTheme.textGrey} size={12} />
                                  <Text style={{ color: AppTheme.textGrey, fontSize: 12 }}>{timeStr}</Text>
                                </View>
                              </View>
                            </View>
                            {isAccepted ? (
                              <View style={{ backgroundColor: AppTheme.primaryColor, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 }}>
                                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Join</Text>
                              </View>
                            ) : (
                              <ChevronRight color={AppTheme.textGrey} size={16} />
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })()}


            </>
          ) : (
            /* ── Mode 2: Personal Coaching ── */
            <>
              <View style={styles.welcomeBlock}>
                <Text style={[styles.welcomeText, { color: CoachingTheme.textWhite }]}>
                  Your Coach is Ready!
                </Text>
                <Text style={[styles.subtitleText, { color: CoachingTheme.textGrey }]}>
                  Stay on track with your program
                </Text>
              </View>

              {/* Coaching Stats */}
              <View style={styles.compactStatsCard}>
                <TouchableOpacity
                  style={styles.compactStatCell}
                  onPress={() => navigation.navigate('CreditsScreen')}
                  activeOpacity={0.7}
                >
                  <Coins color={theme.primaryColor} size={18} />
                  <View style={{ marginLeft: 8 }}>
                    <Text style={styles.compactStatValue}>{profile?.credits?.toString() ?? "5"}</Text>
                    <Text style={styles.compactStatLabel}>Credits</Text>
                    <TouchableOpacity
                      onPress={() => navigation.navigate('EarnCreditsScreen')}
                      activeOpacity={0.7}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Text style={[styles.compactEarnText, { color: CoachingTheme.primaryColor }]}>+ Earn credits</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>

                <View style={styles.compactDivider} />

                <View style={styles.compactStatCell}>
                  <Calendar color={theme.primaryColor} size={18} />
                  <View style={{ marginLeft: 8 }}>
                    <Text style={styles.compactStatValue}>12</Text>
                    <Text style={styles.compactStatLabel}>Sessions</Text>
                  </View>
                </View>

                <View style={styles.compactDivider} />

                <TouchableOpacity
                  style={styles.compactStatCell}
                  onPress={() => navigation.navigate('LibraryTab')}
                  activeOpacity={0.7}
                >
                  <Star color={theme.primaryColor} size={18} />
                  <View style={{ marginLeft: 8 }}>
                    <Text style={styles.compactStatValue}>0</Text>
                    <Text style={styles.compactStatLabel}>Coaches</Text>
                  </View>
                </TouchableOpacity>
              </View>

              <View style={{ height: 16 }} />

              {/* Book Session Button */}
              <TouchableOpacity
                style={[styles.aiButtonContainer, {
                  marginBottom: 32,
                  boxShadow: '0px 4px 10px rgba(0,0,0,0.2)',
                  elevation: 4,
                  borderWidth: 1,
                  borderColor: CoachingTheme.borderStrong
                }]}
                onPress={() => setBookingVisible(true)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#0284C7', CoachingTheme.primaryColor]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.aiButtonGradient, { borderRadius: 30 }]}
                >
                  <PlusCircle color={CoachingTheme.textWhite} size={24} style={{ marginRight: 12 }} />
                  <Text style={[styles.aiButtonText, { color: CoachingTheme.textWhite }]}>Talk to Coach Now</Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Coach Quick Links */}
              <View style={styles.quickActionsContainer}>
                <TouchableOpacity
                  style={[styles.exerciseCard, { backgroundColor: CoachingTheme.cardColor, borderColor: CoachingTheme.border }]}
                  onPress={() => navigation.navigate('LibraryTab')}
                  activeOpacity={0.8}
                >
                  <View style={[styles.exerciseIconContainer, { backgroundColor: CoachingTheme.primaryGlow }]}>
                    <Star color={CoachingTheme.primaryColor} size={28} />
                  </View>
                  <View style={styles.exerciseInfoContainer}>
                    <Text style={[styles.exerciseTitle, { color: CoachingTheme.textWhite }]}>Top rated coaches</Text>
                    <Text style={[styles.exerciseSubtitle, { color: CoachingTheme.textGrey }]}>
                      Highest quality trainers
                    </Text>
                  </View>
                  <ChevronRight color={CoachingTheme.primaryColor} size={16} />
                </TouchableOpacity>

              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Booking Bottom Sheet */}
      <BookingBottomSheet
        visible={bookingVisible}
        onClose={() => setBookingVisible(false)}
        userCredits={profile?.credits ?? 5}
        onBookingComplete={(coachName) => {
          setToastMessage(`✅ Session booked with ${coachName}!`);
          setToastVisible(true);
        }}
      />

      {/* ── Notification Center Modal ── */}
      <Modal
        visible={notificationModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setNotificationModalVisible(false)}
      >
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setNotificationModalVisible(false)}>
          <View style={styles.notificationModalContent} onStartShouldSetResponder={() => true}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Notifications</Text>
              <TouchableOpacity onPress={() => setNotificationModalVisible(false)} style={styles.closeModalBtn}>
                <X color={AppTheme.textGrey} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* ── Chat Inbox ── */}
              <View style={styles.notifSection}>
                <View style={styles.notifSectionHeader}>
                  <View style={[styles.notifSectionDot, { backgroundColor: '#4FC3F7' }]} />
                  <Text style={styles.notifSectionTitle}>Chat Inbox</Text>
                  {unreadChatCount > 0 && (
                    <View style={[styles.countBadge, { backgroundColor: '#4FC3F7', marginLeft: 8 }]}>
                      <Text style={styles.countBadgeText}>{unreadChatCount}</Text>
                    </View>
                  )}
                </View>
                {friends.length === 0 ? (
                  <Text style={styles.notifEmptyText}>No friends yet. Add friends to start chatting.</Text>
                ) : (
                  [...friends]
                    .sort((a: any, b: any) => {
                      const aConvo = chatConversations.find((c) => c.id === getChatId(authUser!.uid, a.uid));
                      const bConvo = chatConversations.find((c) => c.id === getChatId(authUser!.uid, b.uid));
                      return ((bConvo?.lastMessageAt instanceof Date ? bConvo.lastMessageAt.getTime() : (bConvo?.lastMessageAt as any)?.toMillis?.() ?? 0)) - ((aConvo?.lastMessageAt instanceof Date ? aConvo.lastMessageAt.getTime() : (aConvo?.lastMessageAt as any)?.toMillis?.() ?? 0));
                    })
                    .slice(0, 2)
                    .map((friend: any) => {
                      const chatId = getChatId(authUser!.uid, friend.uid);
                      const convo = chatConversations.find((c) => c.id === chatId);
                      const unread = convo?.unreadCount?.[authUser!.uid] ?? 0;
                      return (
                        <TouchableOpacity
                          key={friend.uid}
                          style={styles.notifRow}
                          activeOpacity={0.7}
                          onPress={() => {
                            setNotificationModalVisible(false);
                            navigation.navigate('ChatRoom', {
                              friendUid: friend.uid,
                              friendName: friend.fullName || friend.username,
                              friendAvatar: friend.profileImageUrl,
                            });
                          }}
                        >
                          <WebSafeAvatar
                            uri={friend.profileImageUrl}
                            size={36}
                            fallback={
                              <View style={{ flex: 1, backgroundColor: 'rgba(79,195,247,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                                <CircleUserRound color="#4FC3F7" size={18} />
                              </View>
                            }
                          />
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={styles.notifRowName} numberOfLines={1}>{friend.fullName || friend.username}</Text>
                            <Text style={styles.notifRowSub} numberOfLines={1}>{convo?.lastMessage || 'Say hi!'}</Text>
                          </View>
                          {unread > 0 && (
                            <View style={[styles.countBadge, { backgroundColor: '#4FC3F7' }]}>
                              <Text style={styles.countBadgeText}>{unread}</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })
                )}
                <TouchableOpacity
                  style={styles.notifViewAll}
                  onPress={() => { setNotificationModalVisible(false); navigation.navigate('FriendsScreen'); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.notifViewAllText, { color: '#4FC3F7' }]}>View all messages &gt;</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.notifDivider} />

              {/* ── Workout Invites ── */}
              <View style={styles.notifSection}>
                <View style={styles.notifSectionHeader}>
                  <View style={[styles.notifSectionDot, { backgroundColor: '#FF6B00' }]} />
                  <Text style={styles.notifSectionTitle}>Workout Invites</Text>
                  {pendingInvites.length > 0 && (
                    <View style={[styles.countBadge, { backgroundColor: '#FF6B00', marginLeft: 8 }]}>
                      <Text style={styles.countBadgeText}>{pendingInvites.length}</Text>
                    </View>
                  )}
                </View>
                {pendingInvites.length === 0 ? (
                  <Text style={styles.notifEmptyText}>No pending invites.</Text>
                ) : (
                  pendingInvites.slice(0, 2).map((invite: any) => (
                    <TouchableOpacity
                      key={invite.id}
                      style={styles.notifRow}
                      activeOpacity={0.7}
                      onPress={() => { setNotificationModalVisible(false); navigation.navigate('UpcomingSessionsScreen'); }}
                    >
                      <WebSafeAvatar
                        uri={invite.hostAvatarUrl}
                        size={36}
                        fallback={
                          <View style={{ flex: 1, backgroundColor: 'rgba(255,107,0,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                            <VideoIcon color="#FF6B00" size={18} />
                          </View>
                        }
                      />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.notifRowName} numberOfLines={1}>{invite.hostName || 'Friend'}</Text>
                        <Text style={styles.notifRowSub} numberOfLines={1}>{invite.videoTitle || 'Workout invite'}</Text>
                      </View>
                      <View style={[styles.countBadge, { backgroundColor: '#FF6B00' }]}>
                        <Text style={styles.countBadgeText}>View</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
                <TouchableOpacity
                  style={styles.notifViewAll}
                  onPress={() => { setNotificationModalVisible(false); navigation.navigate('UpcomingSessionsScreen'); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.notifViewAllText, { color: '#FF6B00' }]}>View all invites &gt;</Text>
                </TouchableOpacity>
              </View>

            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* GripCuff Tiers Modal */}
      <Modal
        visible={showTiersModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTiersModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#12122A', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, maxHeight: '85%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>GripCuff Memberships</Text>
              <TouchableOpacity onPress={() => setShowTiersModal(false)}>
                <Ionicons name="close-circle" size={28} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.tierCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <View style={[styles.tierBadge, { backgroundColor: '#1E3A5F' }]}><Text style={styles.tierBadgeText}>STARTER</Text></View>
                  <Text style={styles.tierPrice}>Free</Text>
                </View>
                <Text style={styles.tierDesc}>Get started with GripCuff basics. Access the first introductory video, track your progress, and explore the app.</Text>
                <Text style={styles.tierFeatures}>{'✓ Access to 1 free video\n✓ Progress tracking\n✓ Community access\n✗ Locked advanced content'}</Text>
              </View>
              <View style={styles.tierCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <View style={[styles.tierBadge, { backgroundColor: '#7C3AED' }]}><Text style={styles.tierBadgeText}>LIFTER</Text></View>
                </View>
                <Text style={styles.tierDesc}>Unlock the full GripCuff training library. Follow structured programs and track strength gains.</Text>
                <Text style={styles.tierFeatures}>{'✓ Full video library access\n✓ Structured training programs\n✓ Progress analytics\n✓ Live workout sessions\n✗ Upload access'}</Text>
              </View>
              <View style={styles.tierCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <View style={[styles.tierBadge, { backgroundColor: '#F97316' }]}><Text style={styles.tierBadgeText}>TRAINER</Text></View>
                </View>
                <Text style={styles.tierDesc}>Everything in Lifter, plus upload your own workout videos and build your personal brand.</Text>
                <Text style={styles.tierFeatures}>{'✓ Everything in Lifter\n✓ Upload custom videos\n✓ Client management tools\n✓ Trainer profile badge\n✓ Revenue sharing on content'}</Text>
              </View>
              <View style={styles.tierCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <View style={[styles.tierBadge, { backgroundColor: '#D4AF37' }]}><Text style={styles.tierBadgeText}>INFLUENCER</Text></View>
                </View>
                <Text style={styles.tierDesc}>The ultimate GripCuff tier. Get featured, access exclusive partnerships, and earn commission on referred members.</Text>
                <Text style={styles.tierFeatures}>{'✓ Everything in Trainer\n✓ Featured homepage placement\n✓ Affiliate commission program\n✓ Priority support\n✓ Brand partnership access\n✓ Custom profile banner'}</Text>
              </View>
            </ScrollView>
            <TouchableOpacity
              onPress={() => setShowTiersModal(false)}
              style={{ backgroundColor: '#F97316', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Got It</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Toast */}
      <Toast
        message={toastMessage}
        visible={toastVisible}
        onDismiss={() => setToastVisible(false)}
      />
    </SafeAreaView>
  );
};

export const HomeScreen = React.memo(HomeScreenInner);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AppTheme.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    marginBottom: 20,
    backgroundColor: 'transparent',
  },
  logoContainer: {
    paddingLeft: 4,
  },
  profileButton: {
    padding: 4,
  },
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: AppTheme.primaryColor,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  bellBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  avatarWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarUploadingOverlay: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: 40,
  },

  /* ── Toggle ── */
  toggleContainer: {
    flexDirection: 'row',
    marginBottom: 28,
    backgroundColor: AppTheme.cardColor,
    borderRadius: 14,
    padding: 4,
    position: 'relative',
  },
  toggleIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    backgroundColor: '#000000',
    borderRadius: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#FF6B00',
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  toggleText: {
    fontSize: FontSizes.small,
    fontWeight: FontWeights.semibold as any,
    color: '#888888',
  },
  toggleTextActive: {
    color: AppTheme.textWhite,
  },

  /* ── Content ── */
  content: {
    paddingTop: 0,
  },
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  welcomeBlock: {
    marginBottom: 24,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: FontWeights.bold as any,
    color: AppTheme.textWhite,
  },
  subtitleText: {
    fontSize: 8,
    color: AppTheme.textGrey,
    marginTop: 8,
  },
  compactStatsCard: {
    flexDirection: 'row',
    backgroundColor: '#131f2e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 24,
    overflow: 'hidden',
  },
  compactStatCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  compactDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginVertical: 10,
  },
  compactStatValue: {
    fontSize: 16,
    fontWeight: 'bold' as any,
    color: AppTheme.textWhite,
    lineHeight: 20,
  },
  compactStatLabel: {
    fontSize: 10,
    color: AppTheme.textGrey,
  },
  compactEarnText: {
    color: '#D4622A',
    fontSize: 9,
    fontWeight: '700' as any,
    marginTop: 2,
  },
  aiButtonContainer: {
    borderRadius: 16,
    // Base shadow left untouched for regular AI mode button if needed, 
    // although this is typically overwritten by inline styles!
    boxShadow: '0px 4px 10px rgba(0,0,0,0.2)',
    elevation: 8,
  },
  aiButtonGradient: {
    flexDirection: 'row',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiButtonText: {
    color: AppTheme.textWhite,
    fontSize: FontSizes.body,
    fontWeight: FontWeights.bold as any,
  },
  quickActionsContainer: {
    gap: CARD_GAP,
  },
  gripCuffCard: {
    backgroundColor: '#131f2e',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: CARD_GAP,
  },
  gripCuffLeft: {
    flex: 1,
    paddingRight: 10,
  },
  gripCuffTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  gripCuffSubtitle: {
    color: '#607a94',
    fontSize: 12,
  },
  gripCuffRight: {
    alignItems: 'flex-end',
    width: '40%',
  },
  gripCuffRightTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 8,
    width: '100%',
  },
  gripCuffBtn: {
    backgroundColor: '#D4622A',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  gripCuffBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  gripCuffProgressText: {
    color: '#607a94',
    fontSize: 12,
  },
  gripCuffProgressBarBg: {
    height: 6,
    backgroundColor: '#1c2e42',
    borderRadius: 3,
    width: '85%',
  },
  gripCuffProgressBarFill: {
    height: '100%',
    backgroundColor: '#D4622A',
    borderRadius: 3,
  },
  exerciseCard: {
    flexDirection: 'row',
    backgroundColor: AppTheme.cardColor,
    borderRadius: CARD_BORDER_RADIUS,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  exerciseIconContainer: {
    backgroundColor: 'rgba(228, 102, 0, 0.2)',
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  exerciseInfoContainer: {
    flex: 1,
    marginLeft: 16,
  },
  exerciseTitle: {
    fontSize: FontSizes.body,
    fontWeight: FontWeights.bold as any,
    color: AppTheme.textWhite,
    marginBottom: 4,
  },
  exerciseSubtitle: {
    fontSize: FontSizes.body,
    color: AppTheme.textGrey,
  },
  sectionTitle: {
    fontSize: FontSizes.h3,
    fontWeight: FontWeights.bold as any,
    color: AppTheme.textWhite,
    marginBottom: 16,
  },
  userInfoCard: {
    backgroundColor: AppTheme.cardColor,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(228, 102, 0, 0.3)',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(228, 102, 0, 0.2)',
  },
  infoLabel: {
    fontSize: FontSizes.body,
    color: AppTheme.textGrey,
    fontWeight: FontWeights.semibold as any,
  },
  infoValue: {
    fontSize: FontSizes.body,
    color: AppTheme.textWhite,
    fontWeight: FontWeights.semibold as any,
  },
  joinNowButton: {
    backgroundColor: '#000000',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF6B00',
  },
  joinNowText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  notificationModalContent: {
    maxHeight: '85%',
    backgroundColor: AppTheme.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: SCREEN_PADDING,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 8,
  },
  modalTitle: {
    fontSize: FontSizes.h3,
    fontWeight: FontWeights.bold as any,
    color: AppTheme.textWhite,
  },
  closeModalBtn: {
    padding: 4,
  },
  notificationScroll: {
    flex: 1,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppTheme.cardColor,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  actionableNotificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppTheme.cardColor,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,107,0,0.3)',
  },
  notificationIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationTextContainer: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: FontSizes.body,
    fontWeight: FontWeights.bold as any,
    color: AppTheme.textWhite,
    marginBottom: 2,
  },
  notificationSubtitle: {
    fontSize: FontSizes.small,
    color: AppTheme.textGrey,
  },
  notificationSection: {
    marginTop: 12,
  },
  notificationSectionTitle: {
    fontSize: FontSizes.small,
    color: AppTheme.textGrey,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 12,
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  acceptBtn: {
    backgroundColor: '#2ecc71',
    padding: 8,
    borderRadius: 8,
  },
  declineBtn: {
    backgroundColor: 'rgba(255,82,82,0.15)',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,82,82,0.3)',
  },
  emptyNotifications: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyNotificationsText: {
    color: AppTheme.textGrey,
    marginTop: 12,
    fontSize: FontSizes.body,
  },
  notificationRowActive: {
    borderColor: 'rgba(255,107,0,0.3)',
  },
  notificationRowFriend: {
    borderColor: 'rgba(46,204,113,0.3)',
  },
  countBadge: {
    backgroundColor: AppTheme.primaryColor,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    marginRight: 4,
  },
  countBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  notifSection: {
    paddingTop: 16,
    paddingBottom: 4,
  },
  notifSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  notifSectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  notifSectionTitle: {
    color: AppTheme.textWhite,
    fontSize: 14,
    fontWeight: '700',
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  notifAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  notifRowName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  notifRowSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  notifEmptyText: {
    color: '#607a94',
    fontSize: 13,
    paddingVertical: 8,
  },
  notifViewAll: {
    paddingVertical: 12,
    alignItems: 'flex-end',
  },
  notifViewAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
  notifDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 0,
  },
  notifActionBtn: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifActionBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  tierCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tierBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 10,
  },
  tierBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  tierPrice: {
    color: '#4FC3F7',
    fontSize: 14,
    fontWeight: '700',
  },
  tierDesc: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  tierFeatures: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 20,
  },


});
