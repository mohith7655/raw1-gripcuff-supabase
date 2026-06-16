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
  Alert,
} from 'react-native';
import * as Linking from 'expo-linking';
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
  Calendar,
  UserCircle,
  CircleUserRound,
  Heart,
  Bell,
  X,
  UserPlus,
  Target,
  Star,
  Swords,
  Play,
} from 'lucide-react-native';
import { Raw1Logo } from '../raw1_logo';
import { AccessBadge } from '../components/AccessBadge';
import { useAuth } from '../providers/AuthContext';
import { useUser } from '../providers/UserContext';
import { useTabBarVisibility } from '../providers/TabBarVisibilityContext';
import { formatDifficulty } from '../core/difficulty';
import { useWorkoutSession } from '../providers/WorkoutSessionContext';
import { AppTheme, CoachingTheme, FontSizes, FontWeights } from '../core/theme/app_theme';
import { LinearGradient } from 'expo-linear-gradient';
import { SCREEN_PADDING, CARD_BORDER_RADIUS, CARD_GAP } from '../constants/theme';
import { useFriend } from '../providers/FriendContext';
import { useFavouritedVideos } from '../hooks/useFavouritedVideos';
import { ChatService, getChatId } from '../services/chat.service';
import { ChatConversation } from '../models/Chat';
import { WebSafeAvatar } from '../components/WebSafeAvatar';
import { TierBars } from '../components/profile/TierBars';
import { TierAvatar } from '../components/profile/TierAvatar';
import BodyVisualizer from '../components/profile/BodyVisualizer';
import GoalVisualizer from '../components/profile/GoalVisualizer';
import { tierLevel } from '../components/profile/TierBars';
import { useRecommendations } from '../hooks/useRecommendations';
import { RecommendedProgram } from '../services/recommendation.service';
import { LiveSessionService, LiveSession } from '../services/liveSession.service';
import { Ionicons } from '@expo/vector-icons';
import { getProgramByVideoId } from '../data/preRecordedPrograms';
import { StreakService, StreakData } from '../services/streak.service';
import { DailyActivityService } from '../services/dailyActivity.service';
import { supabase } from '../core/config/supabase';
import { UnifiedProgressLeaderboard } from '../components/UnifiedProgressLeaderboard';
import { DailyReminderCard } from '../components/DailyReminderCard';
import { ChallengeSessionService, PreviousChallenge } from '../services/challengeSession.service';
import { MoveReminderService, MoveReminder, AlarmConfig, formatMoveTime12h } from '../services/moveReminder.service';
import { AlarmPillSheet } from '../components/AlarmPillSheet';
import { AlarmListRow } from '../components/AlarmListRow';
import { msUntilMidnight, getDateKey, buildWeekDates, getLastNDayKeys } from '../utils/streakDate';
import { getResolvedTimezone } from '../utils/timezone';
import { BuyCreditsModal } from '../components/credits/BuyCreditsModal';
import { useAccess } from '../providers/AccessContext';
import { useLibrary } from '../providers/LibraryContext';
import { deriveBadgeStates } from '../services/badge.service';
import { BADGE_FAMILIES, getTierName } from '../services/badge.types';
import { getAllPrograms } from '../data/preRecordedPrograms';
import { useRecentlyWatched } from '../hooks/useRecentlyWatched';
import { getUserRank } from '../services/leaderboard.service';
import { SocialProfileService } from '../services/socialProfile.service';
import { SocialProfile, HOBBY_META, CONNECTION_GOAL_META } from '../models/SocialProfile';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

// Single emoji-prefixed row used by the sectioned profile summary card.
function StatRow({ emoji, text, onPress }: { emoji: string; text: string; onPress?: () => void }) {
  const Wrap: any = onPress ? TouchableOpacity : View;
  return (
    <Wrap style={styles.statRow} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.statRowEmoji}>{emoji}</Text>
      <Text style={styles.statRowText}>{text}</Text>
    </Wrap>
  );
}

// Pulsing fire-glow border pill for the streak badge
function FireGlowPill({ children, style }: { children: React.ReactNode; style?: any }) {
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 900, useNativeDriver: false }),
        Animated.timing(glow, { toValue: 0, duration: 900, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const borderColor = glow.interpolate({ inputRange: [0, 1], outputRange: ['rgba(242,89,18,0.7)', 'rgba(255,160,0,1)'] });
  const shadowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.0] });
  const shadowRadius = glow.interpolate({ inputRange: [0, 1], outputRange: [6, 20] });
  return (
    <Animated.View style={[style, {
      borderWidth: 2,
      borderColor,
      shadowColor: '#FF8C00',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: shadowOpacity as any,
      shadowRadius: shadowRadius as any,
      elevation: 10,
    }]}>
      {children}
    </Animated.View>
  );
}

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
    <View style={{ marginTop: 8, marginBottom: 8, backgroundColor: '#F8F8FC', borderRadius: 12, paddingVertical: 14 }}>
      <Text style={{ color: '#211832', fontSize: 15, fontWeight: '700', paddingHorizontal: 16, marginBottom: 12 }}>
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
              borderColor: '#D8D8E4',
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
              {/* RAW1 logo watermark */}
              <View style={{ position: 'absolute', top: 6, left: 6 }}>
                <Raw1Logo fontSize={12} transparent />
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
              <Text numberOfLines={1} style={{ color: 'rgba(33,24,50,0.45)', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>
                {item.categoryLabel}
              </Text>
              <Text numberOfLines={2} style={{ color: '#211832', fontSize: 12, fontWeight: '700', lineHeight: 16 }}>
                {item.title}
              </Text>
              {!!formatDifficulty(item.level) && (
                <Text numberOfLines={1} style={{ color: '#7A7C90', fontSize: 10, fontWeight: '600', marginTop: 3 }}>
                  {formatDifficulty(item.level)}
                </Text>
              )}
              <Text numberOfLines={1} style={{ color: '#211832', fontSize: 10, marginTop: 4 }}>
                {item.reason}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// Compact relative date for challenge history rows (e.g. "Today", "3d ago", "Apr 12").
function formatChallengeDate(iso: string): string {
  const then = new Date(iso);
  if (isNaN(then.getTime())) return '';
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.floor((now.getTime() - then.getTime()) / dayMs);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const HomeScreenInner = () => {
  const navigation = useNavigation<any>();
  const tabBar = useTabBarVisibility();
  const { supabaseUserId, email, logout, user: authUser } = useAuth();
  const { profile, loading: userLoading, appMode, setAppMode } = useUser();
  const { accessType } = useAccess();
  const { completedCount, totalGripCuff, allVideos, gripCuffVideos, trainerVideos, bodyPartVideos } = useLibrary();
  const { pendingInvites, pendingOutgoing, completedSessions, upcomingSessions } = useWorkoutSession();
  const { incomingRequests, friends, acceptRequest, declineRequest } = useFriend();
  const { exerciseIds: favExerciseIds, workoutIds: favWorkoutIds } = useFavouritedVideos();
  const exerciseCatalog = [...allVideos, ...gripCuffVideos, ...trainerVideos, ...bodyPartVideos];
  const matchedExercises = exerciseCatalog.filter(v => favExerciseIds.has(v.id)).length;
  const allPrograms = getAllPrograms();
  const matchedWorkouts = Array.from(new Map(
    allPrograms
      .filter(p => favWorkoutIds.has(p.id) || p.videos.some(v => favWorkoutIds.has(v.id)))
      .map(p => [p.id, p])
  ).values()).length;
  const totalFavouritesCount = matchedExercises + matchedWorkouts;

  const [buyCreditsVisible, setBuyCreditsVisible] = useState(false);

  // Daily credits countdown — "expires in Xhr Ym"
  const [dailyCreditsExpiry, setDailyCreditsExpiry] = useState('');
  useEffect(() => {
    const computeExpiry = () => {
      const tz = getResolvedTimezone();
      const now = new Date();
      // Next 12:00 in the user's local timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const parts = formatter.formatToParts(now);
      const get = (t: string) => Number(parts.find(p => p.type === t)?.value ?? 0);
      const localH = get('hour');
      const localM = get('minute');
      const localS = now.getSeconds();
      // Seconds elapsed since last 12:00
      let elapsedSecs: number;
      if (localH >= 12) {
        elapsedSecs = (localH - 12) * 3600 + localM * 60 + localS;
      } else {
        elapsedSecs = (localH + 12) * 3600 + localM * 60 + localS;
      }
      const remainingSecs = 86400 - elapsedSecs;
      const h = Math.floor(remainingSecs / 3600);
      const m = Math.floor((remainingSecs % 3600) / 60);
      setDailyCreditsExpiry(`${h}h ${m}m`);
    };
    computeExpiry();
    const interval = setInterval(computeExpiry, 60000);
    return () => clearInterval(interval);
  }, []);

  // Social profile (city, goals, hobbies) — powers the sectioned summary card
  const [socialProfile, setSocialProfile] = useState<SocialProfile | null>(null);
  useEffect(() => {
    if (!supabaseUserId) return;
    SocialProfileService.get(supabaseUserId).then(setSocialProfile).catch(() => {});
  }, [supabaseUserId]);

  // Club memberships for notification sections
  const [myClubs, setMyClubs] = useState<Array<{ id: string; name: string; avatar_url: string | null; unread: number }>>([]);
  const [pendingClubInvites, setPendingClubInvites] = useState<Array<{ club_id: string; clubs: { name: string; avatar_url: string | null } | null }>>([]);

  useEffect(() => {
    if (!supabaseUserId) return;
    // Fetch clubs the user is a member of
    supabase
      .from('club_members')
      .select('club_id, role, clubs:club_id (id, name, avatar_url)')
      .eq('user_id', supabaseUserId)
      .then(({ data }) => {
        if (!data) return;
        setMyClubs(
          data
            .filter((r: any) => r.clubs)
            .map((r: any) => ({ id: r.clubs.id, name: r.clubs.name, avatar_url: r.clubs.avatar_url, unread: 0 }))
        );
      });
    // Fetch pending club invites (invited but not yet accepted — role = 'invited')
    supabase
      .from('club_members')
      .select('club_id, clubs:club_id (name, avatar_url)')
      .eq('user_id', supabaseUserId)
      .eq('role', 'invited')
      .then(({ data }) => setPendingClubInvites((data ?? []) as any));
  }, [supabaseUserId]);

  // Handle return from Stripe hosted checkout — grant credits if webhook was missed
  useEffect(() => {
    async function handlePaymentReturn() {
      const url = await Linking.getInitialURL();
      if (!url) return;

      const { queryParams } = Linking.parse(url);
      if (queryParams?.payment !== 'success' || !queryParams?.credits) return;

      const creditsToAdd = Number(queryParams.credits);
      if (!creditsToAdd) return;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const res = await fetch(
          '/.netlify/functions/verify-and-grant-credits',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              userId: session.user.id,
              expectedCredits: creditsToAdd,
            }),
          }
        );

        const result = await res.json();
        if (result.granted) {
          Alert.alert('Credits added!', `${creditsToAdd} credits have been added to your account.`);
        }
      } catch (e) {
        console.error('[HomeScreen] handlePaymentReturn error:', e);
      }
    }

    handlePaymentReturn();
  }, []);

  // Recently watched videos
  const { videos: recentlyWatched } = useRecentlyWatched(10);


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
  const reopenNotificationModalRef = useRef(false);
  const totalNotificationsBadge = pendingInvites.length + incomingRequests.length + unreadChatCount;
  const [moveReminder, setMoveReminder] = useState<MoveReminder | null>(null);
  const [alarmSheetVisible, setAlarmSheetVisible] = useState(false);
  const [selectedAlarm, setSelectedAlarm] = useState<any>(null);
  const [challengeHistory, setChallengeHistory] = useState<PreviousChallenge[]>([]);

  useEffect(() => {
    if (!notificationModalVisible || !supabaseUserId) return;
    MoveReminderService.loadDefault(supabaseUserId).then(setMoveReminder).catch(() => {});
    ChallengeSessionService.loadPreviousForUser(supabaseUserId).then(setChallengeHistory).catch(() => {});
  }, [notificationModalVisible, supabaseUserId]);

  const saveAlarmConfigsFromPanel = async (configs: any[]) => {
    if (!supabaseUserId || !moveReminder) return;
    try {
      const saved = await MoveReminderService.save(supabaseUserId, {
        ...moveReminder,
        alarmConfigs: configs,
        generatedTimes: configs.map((c: any) => c.time),
      });
      setMoveReminder(saved);
      reminderWatcherService.invalidateMoveCache();
    } catch {}
  };

  // Re-open the notification modal when returning from a screen launched from it
  useFocusEffect(
    useCallback(() => {
      if (reopenNotificationModalRef.current) {
        reopenNotificationModalRef.current = false;
        setNotificationModalVisible(true);
      }
    }, [])
  );

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
    // ensureTodayActivity CREATES today's row (app-open = active day) and then
    // recalculates the streak. Using it here — not just recalculateUserStreak —
    // means the day is logged on every focus/resume/midnight rollover, not only on
    // cold boot. Fixes days missed when the app is left open across midnight (e.g.
    // a weekend Sat→Sun) where no fresh boot fires.
    DailyActivityService.ensureTodayActivity(uid).catch(() => {});
  }, [fetchProfile]); // fetchProfile is stable (useCallback with no deps)

  // ── ONE useFocusEffect — fires when tab is focused ───────────────────────
  useFocusEffect(useCallback(() => {
    tabBar?.show(); // reveal the bottom bar whenever this tab regains focus
    if (!supabaseUserId) return;
    doRefresh(supabaseUserId);
    getUserRank(supabaseUserId).then(setGlobalRank).catch(() => {});
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
  const [earnedBadges, setEarnedBadges] = useState<{ emoji: string; name: string; level: number; label: string }[]>([]);
  const [globalRank, setGlobalRank] = useState<number | null>(null);

  const theme = appMode === 'coaching' ? CoachingTheme : AppTheme;
  const isCoaching = appMode === 'coaching';

  const displayName = profile?.fullName || email?.split('@')[0] || 'Guest';

  // ── Sectioned profile summary (Header / Identity / Social Proof) ─────────
  const locationText = socialProfile?.city
    ? [socialProfile.city, socialProfile.country].filter(Boolean).join(', ')
    : (profile?.locations?.gym?.placeName || socialProfile?.gymArea || '');
  const lastActiveRaw = profile?.lastActiveAt || profile?.lastVideoWatchAt || null;
  const lastActive = lastActiveRaw ? new Date(lastActiveRaw) : null;
  const minsSinceActive = lastActive ? (Date.now() - lastActive.getTime()) / 60000 : Infinity;
  const isOnline = minsSinceActive < 5;
  const isActiveToday = !!lastActive && lastActive.toDateString() === new Date().toDateString();
  const activeText = isOnline
    ? 'Active now'
    : isActiveToday
      ? 'Active today'
      : lastActive ? `Active ${formatChallengeDate(lastActiveRaw!)}` : 'New here';
  const firstGoal = socialProfile?.connectionGoals?.[0];
  const goalText = firstGoal ? CONNECTION_GOAL_META[firstGoal]?.label : (socialProfile?.lookingToMeet || '');
  const firstHobby = socialProfile?.hobbies?.[0];
  const styleText = firstHobby ? HOBBY_META[firstHobby]?.label : (socialProfile?.whatIDo || '');
  const completedWorkoutsCount = profile?.completedWorkouts ?? 0;
  const currentStreakCount = profile?.currentStreak ?? 0;
  const fitnessLevel = completedWorkoutsCount >= 50 ? 'Advanced'
    : completedWorkoutsCount >= 10 ? 'Intermediate' : 'Beginner';
  const trainedHours = Math.round((profile?.watchedSeconds ?? 0) / 3600);
  const hasIdentity = !!goalText || !!styleText;

  const gripCuffLevel = completedCount === 0 ? 1
    : completedCount <= 3 ? 2
    : completedCount <= 6 ? 3
    : 4;
  // Level shown in the avatar dots: the membership tier (the number that used to
  // sit in the avatar's corner badge), falling back to the workout level.
  const levelDots = tierLevel(accessType) ?? gripCuffLevel;

  useEffect(() => {
    if (!supabaseUserId || !profile) return;
    const states = deriveBadgeStates({
      bestStreak: profile.bestStreak ?? 0,
      totalWorkouts: profile.completedWorkouts ?? 0,
      totalLiveSessions: profile.totalLiveSessions ?? 0,
      totalViewers: 0,
      coachSessions: 0,
      totalWatchMinutes: 0,
      founderTier: 0,
    });
    const earned = states
      .filter(s => s.currentTier > 0)
      .map(s => {
        const family = BADGE_FAMILIES.find(f => f.key === s.familyKey)!;
        return { emoji: family.emoji, name: getTierName(family, s.currentTier), level: s.currentTier, label: family.label };
      });
    setEarnedBadges(earned);
  }, [supabaseUserId, profile?.bestStreak, profile?.completedWorkouts, profile?.totalLiveSessions]);

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
        onScroll={tabBar?.onScroll}
        scrollEventThrottle={16}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Raw1Logo fontSize={24} />
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <AccessBadge />
          </View>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => setNotificationModalVisible(true)}
            activeOpacity={0.8}
          >
            <View>
              <Bell color="#4C4E78" size={26} />
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
                borderBottomColor: isCoaching ? CoachingTheme.primaryColor : '#F25912',
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
            <Text style={[styles.toggleText, { color: '#7A7C90' }]}>
              Personal Coaching
            </Text>
            <Text style={{ fontSize: 12, marginLeft: 5 }}>🔒</Text>
          </TouchableOpacity>
        </View>

        {/* Coming Soon banner — shown directly below tab bar */}
        {appMode !== 'ai' ? null : null}
        <View style={{ backgroundColor: 'rgba(242,89,18,0.07)', borderRadius: 10, marginHorizontal: 16, marginTop: 10, marginBottom: 2, paddingVertical: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
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
              {/* Quick Stats — Profile | Credits | Favourites (stacked vertically, centered) */}
              <View style={styles.compactStatsCard}>
                {/* Profile row — opens the public "as others see it" view by default */}
                <TouchableOpacity
                  style={[styles.compactStatRow, { flexDirection: 'row', paddingVertical: 18, alignItems: 'center', gap: 16 }]}
                  onPress={() => navigation.navigate('SocialProfileScreen')}
                  activeOpacity={0.85}
                >
                  <View style={{ alignItems: 'center', gap: 8 }}>
                    {/* Same tier treatment as the profile screen: 4 dots + numbered corner badge */}
                    <TierAvatar
                      uri={profile?.profileImageUrl}
                      size={72}
                      accessType={accessType}
                      name={profile?.fullName}
                      radius={16}
                      badgeBorderColor="#F8F8FC"
                      fallback={<Text style={{ color: '#F25912', fontSize: 9, fontWeight: '700', textAlign: 'center', lineHeight: 13 }}>{'Profile\nPicture'}</Text>}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                  <View style={{ alignItems: 'flex-start', gap: 1 }}>
                    {!!profile?.username && (
                      <Text style={{ color: AppTheme.textWhite, fontSize: 16, fontWeight: '800' }} numberOfLines={1}>@{profile.username}</Text>
                    )}
                    <Text style={[styles.compactStatRowLabel, { fontSize: 13, color: '#7A7C90', fontWeight: '500' }]} numberOfLines={1}>{displayName}</Text>
                  </View>
                  <TouchableOpacity onPress={() => navigation.navigate('FriendsScreen')} activeOpacity={0.7} style={{ marginTop: 6, alignSelf: 'flex-start' }}>
                    <View style={{ backgroundColor: '#211832', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{friends.length}</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 9, fontWeight: '600', letterSpacing: 0.4 }}>CONNECTS</Text>
                    </View>
                  </TouchableOpacity>
                  {/* Badge pills — global Squats total (always shown) + earned badges */}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    {/* Squats — global running total, shows even at 0 */}
                    <View style={styles.profileStatPill}>
                      <Text style={styles.profileStatPillText}>🏋️ {profile?.totalSquats ?? 0} Squats</Text>
                    </View>
                    {/* Earned badges (streak removed); no "no badges" placeholder */}
                    {earnedBadges
                      .filter(b => b.label !== 'Streak')
                      .map((b, i) => (
                        <View key={i} style={styles.profileStatPill}>
                          <Text style={styles.profileStatPillText}>{b.emoji} {b.label} Lv.{b.level}</Text>
                        </View>
                      ))}
                  </View>
                  {/* Workout time — Weekly · Lifetime */}
                  {(() => {
                    const fmt = (mins: number) => {
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
                    const Divider = () => (
                      <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: '#D8D8E4' }} />
                    );
                    const Stat = ({ value, label }: { value: string; label: string }) => (
                      <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={{ color: '#211832', fontSize: 14, fontWeight: '700' }}>{value}</Text>
                        <Text style={{ color: '#7A7C90', fontSize: 10, fontWeight: '600', letterSpacing: 0.5, marginTop: 2 }}>{label}</Text>
                      </View>
                    );
                    return (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                        <Stat value={fmt(weeklyMins)} label="WEEKLY" />
                        <Divider />
                        <Stat value={fmt(lifetimeMins)} label="LIFETIME" />
                      </View>
                    );
                  })()}
                  </View>
                </TouchableOpacity>

                <View style={styles.compactHorizontalDivider} />

                {/* Credits row */}
                <TouchableOpacity
                  style={[styles.compactStatRow, { gap: 0 }]}
                  onPress={() => navigation.navigate('CreditsScreen')}
                  activeOpacity={0.7}
                >
                  {/* Left: permanent credits */}
                  <View style={{ flex: 1, alignItems: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: 'rgba(33,24,50,0.12)', paddingRight: 12 }}>
                    <Text style={styles.compactStatValue}>{profile?.credits?.toString() ?? "0"} Credits</Text>
                    <TouchableOpacity
                      onPress={() => setBuyCreditsVisible(true)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Text style={styles.compactEarnText}>+ Earn credits</Text>
                    </TouchableOpacity>
                  </View>
                  {/* Right: daily credits */}
                  <View style={{ flex: 1, alignItems: 'center', paddingLeft: 12 }}>
                    <Text style={styles.compactStatValue}>{profile?.dailyCredits?.toString() ?? "109"} Daily</Text>
                    <Text style={styles.compactEarnText}>Expires in {dailyCreditsExpiry}</Text>
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

              {/* ── Recently Watched + Favourites (stacked) ── */}
              {(recentlyWatched.length > 0 || totalFavouritesCount > 0) && (() => {
                const allVids = [...allVideos, ...gripCuffVideos, ...trainerVideos, ...bodyPartVideos];
                const allProgs = getAllPrograms();
                const COLORS = [
                  ['#8B7355', '#6B5B45'],
                  ['#4A5568', '#2D3748'],
                  ['#2A2A3E', '#1A1A2E'],
                  ['#0D2137', '#1A3A5C'],
                  ['#6B4226', '#4A2E1A'],
                  ['#7A8A8A', '#5A6A6A'],
                  ['#3B1F0B', '#5C3319'],
                  ['#C4B8A8', '#A09488'],
                ];
                const favItems = [
                  ...allVids.filter(v => favExerciseIds.has(v.id)).map(v => ({ id: v.id, title: v.title, videoUrl: v.videoUrl, thumbnail: (v as any).thumbnail })),
                  ...allProgs
                    .filter(p => favWorkoutIds.has(p.id) || p.videos.some(v => favWorkoutIds.has(v.id)))
                    .map(p => ({ id: p.videos.find(v => favWorkoutIds.has(v.id))?.id ?? p.id, title: p.title, videoUrl: p.videos?.[0]?.videoUrl, thumbnail: (p as any).thumbnail })),
                ];
                return (
                  <View style={{ marginBottom: 16, backgroundColor: '#F8F8FC', borderRadius: 12, paddingVertical: 14 }}>
                    {recentlyWatched.length > 0 && (
                      <>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 }}>
                          <Text style={{ color: '#211832', fontSize: 15, fontWeight: '700' }}>Recently Watched</Text>
                          <TouchableOpacity onPress={() => navigation.navigate('AllRecentlyWatched')} activeOpacity={0.75}>
                            <Text style={{ color: '#F25912', fontSize: 12, fontWeight: '600' }}>View all →</Text>
                          </TouchableOpacity>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
                          {[...new Map(recentlyWatched.map(item => [item.videoId, item])).values()]
                            .slice(0, 10)
                            .map((item, idx) => {
                            const localVideo = allVids.find(v => v.id === item.videoId);
                            const program = allProgs.find(p => p.id === item.videoId || p.videos.some(v => v.id === item.videoId));
                            const title = localVideo?.title ?? program?.title ?? item.videoId;
                            const difficulty = (localVideo as any)?.difficulty ?? (program as any)?.level;
                            const gradPair = COLORS[idx % COLORS.length];
                            return (
                              <TouchableOpacity
                                key={`rw-${item.videoId}`}
                                style={{ width: 130, borderRadius: 12, overflow: 'hidden', backgroundColor: AppTheme.cardColor }}
                                activeOpacity={0.85}
                                onPress={() => navigation.navigate('VideoPlayer', {
                                  videoId: item.videoId,
                                  title,
                                  videoUrl: localVideo?.videoUrl ?? program?.videos?.[0]?.videoUrl,
                                  videoType: item.videoType,
                                })}
                              >
                                <LinearGradient
                                  colors={[gradPair[0], gradPair[1]]}
                                  start={{ x: 0, y: 0 }}
                                  end={{ x: 1, y: 1 }}
                                  style={{ width: '100%', height: 80, justifyContent: 'center', alignItems: 'center' }}
                                >
                                  <View style={{ position: 'absolute', top: 6, left: 6 }}>
                                    <Raw1Logo fontSize={12} transparent />
                                  </View>
                                  <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                                    <Play color="rgba(255,255,255,0.12)" size={28} fill="rgba(255,255,255,0.12)" />
                                  </View>
                                </LinearGradient>
                                <View style={{ padding: 8 }}>
                                  <Text numberOfLines={2} style={{ color: '#211832', fontSize: 11, fontWeight: '600', lineHeight: 15 }}>{title}</Text>
                                  {!!formatDifficulty(difficulty) && (
                                    <Text style={{ color: '#7A7C90', fontSize: 10, fontWeight: '600', marginTop: 3 }}>{formatDifficulty(difficulty)}</Text>
                                  )}
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </>
                    )}

                    {favItems.length > 0 && (
                      <>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: recentlyWatched.length > 0 ? 16 : 0, marginBottom: 12 }}>
                          <Text style={{ color: '#211832', fontSize: 15, fontWeight: '700' }}>Favorites</Text>
                          <TouchableOpacity onPress={() => navigation.navigate('AllFavourites', { type: 'all' })} activeOpacity={0.75}>
                            <Text style={{ color: '#F25912', fontSize: 12, fontWeight: '600' }}>View all →</Text>
                          </TouchableOpacity>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
                          {favItems.slice(0, 10).map((item, idx) => (
                            <TouchableOpacity
                              key={item.id}
                              style={{ width: 130, borderRadius: 12, overflow: 'hidden', backgroundColor: AppTheme.cardColor }}
                              activeOpacity={0.85}
                              onPress={() => navigation.navigate('VideoPlayer', {
                                videoId: item.id,
                                title: item.title,
                                videoUrl: item.videoUrl,
                              })}
                            >
                              {item.thumbnail ? (
                                <Image source={{ uri: item.thumbnail }} style={{ width: '100%', height: 80 }} resizeMode="cover" />
                              ) : (
                                <LinearGradient
                                  colors={[COLORS[idx % COLORS.length][0], COLORS[idx % COLORS.length][1]]}
                                  start={{ x: 0, y: 0 }}
                                  end={{ x: 1, y: 1 }}
                                  style={{ width: '100%', height: 80, justifyContent: 'center', alignItems: 'center' }}
                                >
                                  <View style={{ position: 'absolute', top: 6, left: 6 }}>
                                    <Raw1Logo fontSize={12} transparent />
                                  </View>
                                  <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                                    <Play color="rgba(255,255,255,0.12)" size={28} fill="rgba(255,255,255,0.12)" />
                                  </View>
                                </LinearGradient>
                              )}
                              <View style={{ padding: 8 }}>
                                <Text numberOfLines={2} style={{ color: '#211832', fontSize: 11, fontWeight: '600', lineHeight: 15 }}>{item.title}</Text>
                                {!!formatDifficulty(item.difficulty) && (
                                  <Text style={{ color: '#7A7C90', fontSize: 10, fontWeight: '600', marginTop: 3 }}>{formatDifficulty(item.difficulty)}</Text>
                                )}
                              </View>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </>
                    )}
                  </View>
                );
              })()}

              {/* Gripcuff Training Progress Card */}
              <View style={styles.gripCuffCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  {/* Left: title + badge + buttons */}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <Text style={styles.gripCuffTitle}>Gripcuff Training</Text>
                      <View style={{ backgroundColor: 'rgba(76,78,120,0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5 }}>
                        <Text style={{ color: '#4C4E78', fontSize: 10, fontWeight: '700' }}>
                          {accessType ? accessType.replace(/_access$/, '').toUpperCase() : 'STARTER'}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => setShowTiersModal(true)}
                        style={{ backgroundColor: '#F25912', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 }}
                        activeOpacity={0.8}
                      >
                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Upgrade</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ borderWidth: 1, borderColor: 'rgba(33,24,50,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}
                        onPress={() => navigation.navigate('GripCuffVideos')}
                        activeOpacity={0.8}
                      >
                        <Text style={{ color: '#7A7C90', fontSize: 11, fontWeight: '600' }}>Get Started</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Right: compact bar chart — fills up to current gripCuffLevel */}
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 5 }}>
                    {[1, 2, 3, 4].map((lvl) => {
                      const isCurrent = lvl === gripCuffLevel;
                      const isFilled  = lvl <= gripCuffLevel;
                      const barHeight = lvl * 8 + 8;
                      return (
                        <View key={lvl} style={{ alignItems: 'center', gap: 3 }}>
                          <View
                            style={{
                              width: 20,
                              height: barHeight,
                              borderRadius: 4,
                              backgroundColor: isFilled ? '#F25912' : 'rgba(33,24,50,0.1)',
                              opacity: isCurrent ? 1 : isFilled ? 0.55 : 1,
                            }}
                          />
                          <Text style={{ color: isCurrent ? '#F25912' : isFilled ? 'rgba(242,89,18,0.5)' : '#D8D8E4', fontSize: 9, fontWeight: isCurrent ? '700' : '500' }}>
                            {lvl}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
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
                      <Text style={{ color: '#211832', fontSize: 18, fontWeight: '700' }}>Live Now</Text>
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
                              <Text style={{ color: '#211832', fontSize: 15, fontWeight: '600' }} numberOfLines={1}>
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
                      <Text style={{ color: '#211832', fontSize: 18, fontWeight: '700' }}>Upcoming</Text>
                      <TouchableOpacity onPress={() => navigation.navigate('UpcomingSessionsScreen')}>
                        <Text style={{ color: '#7A7C90', fontSize: 13, fontWeight: '600' }}>View All →</Text>
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
                            borderColor: isAccepted ? 'rgba(16,185,129,0.3)' : 'rgba(242,89,18,0.2)',
                          }}
                          activeOpacity={0.8}
                          onPress={() => navigation.navigate('UpcomingSessionsScreen')}
                        >
                          <Text style={{ color: 'rgba(33,24,50,0.35)', fontSize: 10, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8 }}>
                            {label}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: '#211832', fontSize: 15, fontWeight: '600' }} numberOfLines={1}>
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
                                <Text style={{ color: '#211832', fontSize: 12, fontWeight: '700' }}>Join</Text>
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
                  <View style={styles.rBadge}><Text style={styles.rBadgeText}>R</Text></View>
                  <View style={{ marginLeft: 8 }}>
                    <Text style={styles.compactStatValue}>{profile?.credits?.toString() ?? "0"}</Text>
                    <Text style={styles.compactStatLabel}>Credits</Text>
                    <TouchableOpacity
                      onPress={() => setBuyCreditsVisible(true)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Text style={styles.compactEarnText}>+ Earn credits</Text>
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

          {/* ── How I look now + My Goals — previews at the very bottom ─────── */}
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigation.navigate('HowILookNow')}
            style={styles.bottomPreviewCard}
          >
            <View style={styles.bottomPreviewHeader}>
              <Text style={styles.bottomPreviewTitle}>How I look now</Text>
              <Text style={styles.bottomPreviewEdit}>Edit</Text>
            </View>
            <BodyVisualizer
              name={profile?.fullName}
              gender={profile?.gender}
              heightCm={profile?.heightCm}
              weightKg={profile?.weightKg}
              age={profile?.age}
              editable={false}
              canvasHeight={240}
            />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigation.navigate('Goals')}
            style={styles.bottomPreviewCard}
          >
            <View style={styles.bottomPreviewHeader}>
              <Text style={styles.bottomPreviewTitle}>My Goals</Text>
              <Text style={styles.bottomPreviewEdit}>Edit</Text>
            </View>
            <GoalVisualizer
              name={profile?.fullName}
              gender={profile?.gender}
              heightCm={profile?.heightCm}
              weightKg={profile?.weightKg}
              goals={profile?.goals}
              editable={false}
              canvasHeight={240}
            />
          </TouchableOpacity>
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
                            reopenNotificationModalRef.current = true;
                            setNotificationModalVisible(false);
                            navigation.navigate('ChatRoom', {
                              friendUid: friend.uid,
                              friendName: friend.fullName || friend.username,
                              friendAvatar: friend.profileImageUrl,
                            });
                          }}
                        >
                          <TierAvatar
                            uri={friend.profileImageUrl}
                            size={36}
                            uid={friend.uid}
                            name={friend.fullName || friend.username}
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
                  onPress={() => { reopenNotificationModalRef.current = true; setNotificationModalVisible(false); navigation.navigate('FriendsScreen'); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.notifViewAllText, { color: '#4FC3F7' }]}>View all messages &gt;</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.notifDivider} />

              {/* ── Workout Invites ── */}
              <View style={styles.notifSection}>
                <View style={styles.notifSectionHeader}>
                  <View style={[styles.notifSectionDot, { backgroundColor: '#F25912' }]} />
                  <Text style={styles.notifSectionTitle}>Workout Invites</Text>
                  {pendingInvites.length > 0 && (
                    <View style={[styles.countBadge, { backgroundColor: '#F25912', marginLeft: 8 }]}>
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
                      onPress={() => { reopenNotificationModalRef.current = true; setNotificationModalVisible(false); navigation.navigate('UpcomingSessionsScreen'); }}
                    >
                      <TierAvatar
                        uri={invite.hostAvatarUrl}
                        size={36}
                        uid={invite.hostUid}
                        name={invite.hostName}
                        fallback={
                          <View style={{ flex: 1, backgroundColor: 'rgba(242,89,18,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                            <VideoIcon color="#F25912" size={18} />
                          </View>
                        }
                      />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.notifRowName} numberOfLines={1}>{invite.hostName || 'Friend'}</Text>
                        <Text style={styles.notifRowSub} numberOfLines={1}>{invite.videoTitle || 'Workout invite'}</Text>
                      </View>
                      <View style={[styles.countBadge, { backgroundColor: '#F25912' }]}>
                        <Text style={styles.countBadgeText}>View</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
                <TouchableOpacity
                  style={styles.notifViewAll}
                  onPress={() => { reopenNotificationModalRef.current = true; setNotificationModalVisible(false); navigation.navigate('UpcomingSessionsScreen'); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.notifViewAllText, { color: '#F25912' }]}>View all invites &gt;</Text>
                </TouchableOpacity>
              </View>


              <View style={styles.notifDivider} />

              {/* ── Club Invites ── */}
              <View style={styles.notifSection}>
                <View style={styles.notifSectionHeader}>
                  <View style={[styles.notifSectionDot, { backgroundColor: '#a78bfa' }]} />
                  <Text style={styles.notifSectionTitle}>Club Invites</Text>
                  {pendingClubInvites.length > 0 && (
                    <View style={[styles.countBadge, { backgroundColor: '#a78bfa', marginLeft: 8 }]}>
                      <Text style={styles.countBadgeText}>{pendingClubInvites.length}</Text>
                    </View>
                  )}
                </View>
                {pendingClubInvites.length === 0 ? (
                  <Text style={styles.notifEmptyText}>No pending club invites.</Text>
                ) : (
                  pendingClubInvites.slice(0, 3).map((invite: any) => {
                    const club = invite.clubs;
                    if (!club) return null;
                    return (
                      <TouchableOpacity
                        key={invite.club_id}
                        style={styles.notifRow}
                        activeOpacity={0.7}
                        onPress={() => {
                          setNotificationModalVisible(false);
                          navigation.navigate('ClubsScreen');
                        }}
                      >
                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#a78bfa33', alignItems: 'center', justifyContent: 'center' }}>
                          {club.avatar_url
                            ? <Image source={{ uri: club.avatar_url }} style={{ width: 36, height: 36, borderRadius: 8 }} />
                            : <Text style={{ color: '#a78bfa', fontWeight: '800', fontSize: 16 }}>{club.name?.charAt(0)?.toUpperCase()}</Text>
                          }
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={styles.notifRowName} numberOfLines={1}>{club.name}</Text>
                          <Text style={styles.notifRowSub}>You've been invited to join</Text>
                        </View>
                        <View style={[styles.countBadge, { backgroundColor: '#a78bfa' }]}>
                          <Text style={styles.countBadgeText}>View</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>

              <View style={styles.notifDivider} />

              {/* ── Club Chat ── */}
              <View style={styles.notifSection}>
                <View style={styles.notifSectionHeader}>
                  <View style={[styles.notifSectionDot, { backgroundColor: '#34d399' }]} />
                  <Text style={styles.notifSectionTitle}>Club Chat</Text>
                </View>
                {myClubs.length === 0 ? (
                  <Text style={styles.notifEmptyText}>Join a club to start chatting.</Text>
                ) : (
                  myClubs.slice(0, 3).map(club => (
                    <TouchableOpacity
                      key={club.id}
                      style={styles.notifRow}
                      activeOpacity={0.7}
                      onPress={() => {
                        setNotificationModalVisible(false);
                        navigation.navigate('ClubChatScreen', { clubId: club.id, clubName: club.name });
                      }}
                    >
                      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#34d39933', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {club.avatar_url
                          ? <Image source={{ uri: club.avatar_url }} style={{ width: 36, height: 36, borderRadius: 8 }} />
                          : <Text style={{ color: '#34d399', fontWeight: '800', fontSize: 16 }}>{club.name?.charAt(0)?.toUpperCase()}</Text>
                        }
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.notifRowName} numberOfLines={1}>{club.name}</Text>
                        <Text style={styles.notifRowSub}>Tap to open club chat</Text>
                      </View>
                      <View style={[styles.countBadge, { backgroundColor: '#34d399' }]}>
                        <Text style={styles.countBadgeText}>Chat</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
                <TouchableOpacity
                  style={styles.notifViewAll}
                  onPress={() => { setNotificationModalVisible(false); navigation.navigate('ClubsScreen'); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.notifViewAllText, { color: '#34d399' }]}>View all clubs &gt;</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.notifDivider} />

              {/* ── Challenges ── */}
              <View style={styles.notifSection}>
                <View style={styles.notifSectionHeader}>
                  <View style={[styles.notifSectionDot, { backgroundColor: '#F25912' }]} />
                  <Text style={styles.notifSectionTitle}>Challenges</Text>
                  {challengeHistory.length > 0 && (
                    <View style={[styles.countBadge, { backgroundColor: '#F25912', marginLeft: 8 }]}>
                      <Text style={styles.countBadgeText}>{challengeHistory.length}</Text>
                    </View>
                  )}
                </View>
                {challengeHistory.length === 0 ? (
                  <Text style={styles.notifEmptyText}>No challenges yet. Challenge a friend to get started.</Text>
                ) : (
                  challengeHistory.slice(0, 4).map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={styles.notifRow}
                      activeOpacity={0.7}
                      onPress={() => { reopenNotificationModalRef.current = true; setNotificationModalVisible(false); navigation.navigate('UpcomingSessionsScreen'); }}
                    >
                      <TierAvatar
                        uri={c.opponentAvatar}
                        size={36}
                        uid={c.opponentUid}
                        name={c.opponentName}
                        fallback={
                          <View style={{ flex: 1, backgroundColor: 'rgba(242,89,18,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                            <Swords color="#F25912" size={18} />
                          </View>
                        }
                      />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.notifRowName} numberOfLines={1}>
                          {(profile?.fullName || 'You')} vs {c.opponentName}
                        </Text>
                        <Text style={styles.notifRowSub} numberOfLines={1}>
                          {c.exerciseName} · {Math.max(1, Math.round(c.durationSeconds / 60))} min · {formatChallengeDate(c.createdAt)}
                        </Text>
                      </View>
                      <View style={[styles.countBadge, { backgroundColor: c.status === 'completed' ? '#F25912' : '#F25912' }]}>
                        <Text style={styles.countBadgeText}>{c.status === 'completed' ? 'Done' : 'Played'}</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
                <TouchableOpacity
                  style={styles.notifViewAll}
                  onPress={() => { reopenNotificationModalRef.current = true; setNotificationModalVisible(false); navigation.navigate('UpcomingSessionsScreen'); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.notifViewAllText, { color: '#F25912' }]}>View all challenges &gt;</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.notifDivider} />

              {/* ── Move Reminders ── */}
              <View style={styles.notifSection}>
                <View style={styles.notifSectionHeader}>
                  <View style={[styles.notifSectionDot, { backgroundColor: '#F25912' }]} />
                  <Text style={styles.notifSectionTitle}>Move Reminders</Text>
                  {moveReminder?.enabled && (moveReminder.generatedTimes?.length ?? 0) > 0 && (
                    <View style={[styles.countBadge, { backgroundColor: '#F25912', marginLeft: 8 }]}>
                      <Text style={styles.countBadgeText}>{moveReminder.generatedTimes.length}</Text>
                    </View>
                  )}
                </View>
                {!moveReminder || (moveReminder.generatedTimes?.length ?? 0) === 0 ? (
                  <Text style={styles.notifEmptyText}>No reminders set up yet. Tap the bell icon on the home screen to configure.</Text>
                ) : (
                  <>
                    <Text style={[styles.notifEmptyText, { marginBottom: 10 }]}>
                      {moveReminder.enabled
                        ? `Active · ${moveReminder.generatedTimes.length} reminders scheduled`
                        : `Paused · ${moveReminder.generatedTimes.length} reminders`}
                    </Text>
                    {(moveReminder.alarmConfigs?.length
                      ? moveReminder.alarmConfigs
                      : moveReminder.generatedTimes.map((t: string) => ({ time: t, enabled: true }))
                    ).map((cfg: AlarmConfig, i: number, arr: AlarmConfig[]) => (
                      <AlarmListRow
                        key={cfg.time}
                        alarm={cfg}
                        isLast={i === arr.length - 1}
                        compact
                        onPress={() => { setSelectedAlarm(cfg); setAlarmSheetVisible(true); }}
                        onToggle={(val: boolean) => {
                          const next = arr.map((c: AlarmConfig) =>
                            c.time === cfg.time ? { ...c, enabled: val } : c
                          );
                          saveAlarmConfigsFromPanel(next);
                        }}
                      />
                    ))}
                  </>
                )}
              </View>

            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Alarm detail sheet — opened from notification panel pills */}
      <AlarmPillSheet
        visible={alarmSheetVisible}
        alarm={selectedAlarm}
        reminderId={moveReminder?.id ?? 'default'}
        onClose={() => setAlarmSheetVisible(false)}
        onUpdate={(updated: AlarmConfig) => {
          if (!moveReminder) return;
          const next = (moveReminder.alarmConfigs?.length
            ? moveReminder.alarmConfigs
            : moveReminder.generatedTimes.map((t: string) => ({ time: t, enabled: true }))
          ).map((c: AlarmConfig) => c.time === selectedAlarm?.time ? updated : c);
          saveAlarmConfigsFromPanel(next);
        }}
        onDelete={() => {
          if (!moveReminder) return;
          const next = (moveReminder.alarmConfigs?.length
            ? moveReminder.alarmConfigs
            : moveReminder.generatedTimes.map((t: string) => ({ time: t, enabled: true }))
          ).filter((c: AlarmConfig) => c.time !== selectedAlarm?.time);
          saveAlarmConfigsFromPanel(next);
        }}
      />

      {/* Gripcuff Tiers Modal */}
      <Modal
        visible={showTiersModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTiersModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#EEEEF2', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20, paddingBottom: 36, maxHeight: '88%' }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, paddingHorizontal: 20 }}>
              <View>
                <Text style={{ color: '#211832', fontSize: 20, fontWeight: '800' }}>Gripcuff Memberships</Text>
                <Text style={{ color: '#7A7C90', fontSize: 12, marginTop: 2 }}>Scroll to compare tiers →</Text>
              </View>
              <TouchableOpacity onPress={() => setShowTiersModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={28} color="#444" />
              </TouchableOpacity>
            </View>

            {/* Horizontal tier cards */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={272}
              decelerationRate="fast"
              contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, gap: 12 }}
            >
              {[
                {
                  name: 'STARTER', color: '#7dd3fc', price: 'Free',
                  desc: 'Get started with Gripcuff basics.',
                  inherited: [],
                  newFeatures: ['1 free intro video', 'Progress tracking', 'Community access'],
                  locked: ['Full video library', 'Live sessions', 'Upload videos'],
                },
                {
                  name: 'LIFTER', color: '#1d4ed8', price: 'Paid',
                  desc: 'Unlock the full training library.',
                  inherited: ['Progress tracking', 'Community access'],
                  newFeatures: ['Full video library', 'Structured programs', 'Progress analytics', 'Live workout sessions'],
                  locked: ['Upload videos', 'Client tools', 'Revenue sharing'],
                },
                {
                  name: 'TRAINER', color: '#F25912', price: 'Paid',
                  desc: 'Build your brand and upload content.',
                  inherited: ['Full video library', 'Live sessions', 'Analytics'],
                  newFeatures: ['Upload custom videos', 'Client management', 'Trainer profile badge', 'Revenue sharing'],
                  locked: ['Featured placement', 'Affiliate commission', 'Brand partnerships'],
                },
                {
                  name: 'INFLUENCER', color: '#F25912', price: 'Paid',
                  desc: 'The ultimate tier for creators.',
                  inherited: ['Upload videos', 'Client tools', 'Revenue sharing'],
                  newFeatures: ['Featured homepage placement', 'Affiliate commission', 'Priority support', 'Brand partnerships', 'Custom profile banner'],
                  locked: [],
                },
              ].map((tier, idx) => (
                <View key={tier.name} style={{
                  width: 260,
                  backgroundColor: '#F8F8FC',
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: tier.color + '44',
                  overflow: 'hidden',
                }}>
                  {/* Colored header strip */}
                  <View style={{ backgroundColor: tier.color + '22', borderBottomWidth: 1, borderBottomColor: tier.color + '44', paddingHorizontal: 16, paddingVertical: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <View style={{ backgroundColor: tier.color, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 }}>{tier.name}</Text>
                      </View>
                      <View style={{ backgroundColor: tier.color + '33', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 }}>
                        <Text style={{ color: tier.color, fontSize: 12, fontWeight: '700' }}>{tier.price}</Text>
                      </View>
                    </View>
                    <Text style={{ color: '#7A7C90', fontSize: 12, lineHeight: 17 }}>{tier.desc}</Text>
                  </View>

                  {/* Features */}
                  <View style={{ padding: 14, gap: 0 }}>
                    {/* Inherited from previous */}
                    {tier.inherited.length > 0 && (
                      <>
                        <Text style={{ color: '#7A7C90', fontSize: 10, fontWeight: '700', letterSpacing: 0.6, marginBottom: 6, textTransform: 'uppercase' }}>Included from before</Text>
                        {tier.inherited.map(f => (
                          <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                            <Text style={{ color: 'rgba(33,24,50,0.35)', fontSize: 13 }}>✓</Text>
                            <Text style={{ color: 'rgba(33,24,50,0.45)', fontSize: 12, fontWeight: '500' }}>{f}</Text>
                          </View>
                        ))}
                        <View style={{ height: 1, backgroundColor: tier.color + '22', marginVertical: 8 }} />
                      </>
                    )}

                    {/* New in this tier */}
                    <Text style={{ color: tier.color, fontSize: 10, fontWeight: '800', letterSpacing: 0.6, marginBottom: 6, textTransform: 'uppercase' }}>
                      {idx === 0 ? 'What you get' : `New in ${tier.name}`}
                    </Text>
                    {tier.newFeatures.map(f => (
                      <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                        <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: tier.color + '33', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: tier.color, fontSize: 10, fontWeight: '800' }}>✓</Text>
                        </View>
                        <Text style={{ color: '#211832', fontSize: 12, fontWeight: '600', flex: 1 }}>{f}</Text>
                      </View>
                    ))}

                    {/* Locked in this tier */}
                    {tier.locked.length > 0 && (
                      <>
                        <View style={{ height: 1, backgroundColor: '#D8D8E4', marginVertical: 8 }} />
                        {tier.locked.map(f => (
                          <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                            <Text style={{ color: 'rgba(200,60,60,0.5)', fontSize: 13 }}>✗</Text>
                            <Text style={{ color: 'rgba(33,24,50,0.35)', fontSize: 12, fontWeight: '500' }}>{f}</Text>
                          </View>
                        ))}
                      </>
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>

            {/* Dot indicators */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 4, marginBottom: 14 }}>
              {['#7dd3fc','#1d4ed8','#F25912','#F25912'].map((c, i) => (
                <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c + '88' }} />
              ))}
            </View>

            <TouchableOpacity
              onPress={() => setShowTiersModal(false)}
              style={{ backgroundColor: '#F25912', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginHorizontal: 20 }}
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

      <BuyCreditsModal
        visible={buyCreditsVisible}
        onClose={() => setBuyCreditsVisible(false)}
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
    backgroundColor: '#F25912',
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
    borderBottomColor: '#F25912',
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
    color: '#7A7C90',
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
  greetingRow: {
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: 8,
  },
  profileAvatarRing: {
    width: 54,
    height: 54,
    borderRadius: 27,
    padding: 2,
  },
  profileAvatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#F8F8FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarRingLarge: {
    width: 84,
    height: 84,
    borderRadius: 20,
    padding: 2,
  },
  profileAvatarInnerLarge: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#F8F8FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    color: AppTheme.textWhite,
    fontSize: 22,
    fontWeight: '700' as any,
    letterSpacing: 0.3,
  },
  profileSubtitle: {
    color: AppTheme.textGrey,
    fontSize: 13,
    marginTop: 4,
  },
  compactStatsCard: {
    flexDirection: 'column',
    backgroundColor: '#F8F8FC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D8D8E4',
    marginBottom: 24,
    overflow: 'hidden',
  },

  // ── Sectioned profile summary card ──
  profileCard: {
    backgroundColor: '#F8F8FC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D8D8E4',
    padding: 18,
    marginBottom: 24,
  },
  sectionLabel: {
    color: '#211832',
    fontSize: 15,
    fontWeight: '800' as any,
    marginBottom: 8,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  profileName: {
    color: AppTheme.textWhite,
    fontSize: 17,
    fontWeight: '700' as any,
    marginBottom: 2,
  },
  profileDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#D8D8E4',
    marginVertical: 16,
  },
  sectionColumns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  sectionCol: {
    flex: 1,
  },
  sectionColDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: '#D8D8E4',
    marginHorizontal: 14,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  statRowEmoji: {
    fontSize: 15,
    width: 20,
    textAlign: 'center',
  },
  statRowText: {
    color: '#211832',
    fontSize: 14,
    fontWeight: '500' as any,
    flex: 1,
  },
  compactStatCell: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 8,
    gap: 5,
  },
  compactStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  compactStatRowLabel: {
    fontSize: 14,
    color: AppTheme.textGrey,
    fontWeight: '500' as any,
  },
  profileStatPill: {
    backgroundColor: 'rgba(242,89,18,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(242,89,18,0.3)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  bottomPreviewCard: {
    marginTop: 12,
    backgroundColor: '#F8F8FC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(33,24,50,0.06)',
    padding: 14,
  },
  bottomPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  bottomPreviewTitle: { color: '#211832', fontSize: 16, fontWeight: '800' },
  bottomPreviewEdit: { color: '#F25912', fontSize: 13, fontWeight: '700' },
  profileStatPillText: {
    color: AppTheme.textWhite,
    fontSize: 11,
    fontWeight: '600' as any,
  },
  compactDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: '#D8D8E4',
    marginVertical: 10,
  },
  compactHorizontalDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#D8D8E4',
    marginHorizontal: 16,
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
    color: '#7A7C90',
    fontSize: 9,
    fontWeight: '600' as any,
    marginTop: 2,
  },
  rBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F25912',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
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
    backgroundColor: '#F8F8FC',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: CARD_GAP,
  },
  gripCuffLeft: {
    flex: 1,
    paddingRight: 10,
  },
  gripCuffTitle: {
    color: '#211832',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  gripCuffSubtitle: {
    color: '#7A7C90',
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
    backgroundColor: '#F25912',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  gripCuffBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  gripCuffProgressText: {
    color: '#7A7C90',
    fontSize: 12,
  },
  gripCuffProgressBarBg: {
    height: 6,
    backgroundColor: '#F8F8FC',
    borderRadius: 3,
    width: '85%',
  },
  gripCuffProgressBarFill: {
    height: '100%',
    backgroundColor: '#F25912',
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
    borderColor: '#D8D8E4',
  },
  exerciseIconContainer: {
    backgroundColor: 'rgba(242,89,18, 0.2)',
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
    borderColor: 'rgba(242,89,18, 0.3)',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(242,89,18, 0.2)',
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
    borderColor: '#F25912',
  },
  joinNowText: {
    color: '#fff',
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
    borderTopColor: 'rgba(33,24,50,0.1)',
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
    borderColor: 'rgba(33,24,50,0.05)',
  },
  actionableNotificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppTheme.cardColor,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(242,89,18,0.3)',
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
    borderColor: 'rgba(242,89,18,0.3)',
  },
  notificationRowFriend: {
    borderColor: 'rgba(46,204,113,0.3)',
  },
  countBadge: {
    backgroundColor: '#F25912',
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
    color: '#211832',
    fontSize: 14,
    fontWeight: '600',
  },
  notifRowSub: {
    color: '#7A7C90',
    fontSize: 12,
    marginTop: 2,
  },
  notifEmptyText: {
    color: '#7A7C90',
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
    backgroundColor: '#D8D8E4',
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
    color: '#211832',
    fontSize: 12,
    fontWeight: '700',
  },
  tierCard: {
    backgroundColor: '#F8F8FC',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(33,24,50,0.08)',
  },
  tierBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 10,
  },
  tierBadgeText: {
    color: '#211832',
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
    color: '#7A7C90',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  tierFeatures: {
    color: '#7A7C90',
    fontSize: 12,
    lineHeight: 20,
  },


});
