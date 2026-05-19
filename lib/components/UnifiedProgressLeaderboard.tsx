import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  ActivityIndicator,
  Image,
} from 'react-native';
import { ChevronRight, Zap } from 'lucide-react-native';
import { collection, onSnapshot, query, orderBy, limit, getDoc, doc } from 'firebase/firestore';
import { db } from '../core/config/firebase';
import { StreakData } from '../services/streak.service';
import { LeaderboardEntry } from '../services/leaderboard.service';
import { getDateKey, buildWeekDates } from '../utils/streakDate';

const ACCENT = '#FF6B00';
const CARD_BG = '#111d2e';
const STRIP_BG = '#0a1628';
const BORDER = 'rgba(255,107,0,0.18)';
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MEDALS = ['🥇', '🥈', '🥉'];

type Tab = 'streak' | 'weekly' | 'alltime';
const TABS: Tab[] = ['streak', 'weekly', 'alltime'];
const TAB_LABELS: Record<Tab, string> = {
  streak: 'Daily Streak',
  weekly: 'Weekly',
  alltime: 'All Time',
};

// ── Helpers ────────────────────────────────────────────────────────────────

// todayWeekdayIndex / buildWeekKeys / getWeekDates are now timezone-aware.
// They receive `timezone` from StreakTab (which receives it via streakData.timezone).
// Falls back to device timezone when timezone is empty (e.g., data not yet loaded).

function motivationText(streak: number): string {
  if (streak <= 2) return 'Start your comeback';
  if (streak <= 6) return 'Building momentum';
  if (streak <= 13) return "You're on fire!";
  if (streak <= 29) return 'Unstoppable';
  return 'Elite consistency 🏆';
}

function formatScore(score: number): string {
  const h = Math.floor(score / 60);
  const m = score % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function DayDot({ active, isToday, isFuture, label, minutes }: {
  active: boolean;
  isToday: boolean;
  isFuture?: boolean;
  label: string;
  minutes: number;
}) {
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isToday) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(glowAnim, { toValue: 0, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isToday]);

  const scale = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const opacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });

  // weekMinutes already holds Math.max(watchedMinutes, legacyMinutes). Use it as displayMinutes.
  const displayMinutes = active ? Math.max(1, Number(minutes) || 0) : Number(minutes) || 0;
  const minLabel = displayMinutes >= 60
    ? `${Math.floor(displayMinutes / 60)}h`
    : displayMinutes > 0 ? `${displayMinutes}m` : '';

  return (
    <View style={s.dayCol}>
      <Animated.View
        style={[
          s.dayDot,
          isFuture && s.dayDotFuture,
          !isFuture && isToday && s.dayDotToday,
          !isFuture && active && s.dayDotActive,
          !isFuture && isToday && { transform: [{ scale }], opacity },
        ]}
      >
        {minLabel && !isFuture ? (
          <Text style={[s.dayDotMin, active && s.dayDotMinActive]}>{minLabel}</Text>
        ) : null}
      </Animated.View>
      <Text style={[s.dayLabel, !isFuture && (active || isToday) && s.dayLabelActive]}>{label}</Text>
    </View>
  );
}

function ChallengesBar({ completed }: { completed: number }) {
  const TOTAL = 7;
  const widthAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const ratio = Math.min(completed / TOTAL, 1);

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: ratio,
      duration: 700,
      useNativeDriver: false,
      easing: Easing.out(Easing.cubic),
    }).start();
  }, [ratio]);

  useEffect(() => {
    if (completed <= 0) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1200, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 1200, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [completed > 0]);

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });

  return (
    <View style={s.challengesSection}>
      <View style={s.challengesDivider} />
      <View style={s.challengesRow}>
        <View style={s.challengesLeft}>
          <Zap color={ACCENT} size={11} />
          <Text style={s.challengesLabel}>Daily Challenges</Text>
        </View>
        <Text style={s.challengesCount}>
          {completed}/{TOTAL}{' '}
          <Text style={s.challengesCountSuffix}>this week</Text>
        </Text>
      </View>
      <View style={s.challengesBarTrack}>
        <Animated.View
          style={[
            s.challengesBarFill,
            {
              width: widthAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              opacity: completed > 0 ? glowOpacity : 1,
            },
          ]}
        />
      </View>
    </View>
  );
}

function StreakTab({ data, uid, timezone }: { data: StreakData | null; uid?: string; timezone: string }) {
  const flameAnim = useRef(new Animated.Value(1)).current;
  const streak = data?.currentStreak ?? 0;
  const best = data?.bestStreak ?? 0;

  const [weekOffset, setWeekOffset] = useState(0);
  const [fetchedActivity, setFetchedActivity] = useState<Record<string, boolean>>({});
  const [fetchedMinutes, setFetchedMinutes] = useState<Record<string, number>>({});
  const touchStartX = useRef(0);

  // For current week use the already-loaded data prop; for other weeks fetch separately
  const weekDates = useMemo(() => buildWeekDates(timezone, weekOffset), [timezone, weekOffset]);
  const todayKey = getDateKey(timezone);

  const weekActivity = weekOffset === 0 ? (data?.weeklyActivity ?? {}) : fetchedActivity;
  const weekMinutes  = weekOffset === 0 ? (data?.weeklyMinutes  ?? {}) : fetchedMinutes;

  const weekLabel = useMemo(() => {
    if (weekOffset === 0) return 'This Week';
    if (weekOffset === -1) return 'Last Week';
    const fmt = (iso: string) => {
      // Parse YYYY-MM-DD and use UTC noon to avoid device-timezone DST shifts.
      const [y, m, d] = iso.split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, d, 12))
        .toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };
    return `${fmt(weekDates[0])} – ${fmt(weekDates[6])}`;
  }, [weekOffset, weekDates]);

  // Fetch activity docs for non-current weeks
  useEffect(() => {
    if (weekOffset === 0 || !uid) return;
    Promise.all(
      weekDates.map(date =>
        getDoc(doc(db, 'users', uid, 'activity', date))
          .then(snap => ({
            date,
            completed: snap.exists() && !!(
              snap.data()?.challengeCompleted ||
              snap.data()?.workoutCompleted ||
              snap.data()?.liveSessionCompleted
            ),
            minutes: snap.exists()
              ? Math.max(
                  (snap.data()?.watchedMinutes as number) ?? 0,
                  (snap.data()?.minutes        as number) ?? 0,
                )
              : 0,
          }))
          .catch(() => ({ date, completed: false, minutes: 0 }))
      )
    ).then(results => {
      const actMap: Record<string, boolean> = {};
      const minMap: Record<string, number> = {};
      results.forEach(r => { actMap[r.date] = r.completed; minMap[r.date] = r.minutes; });
      setFetchedActivity(actMap);
      setFetchedMinutes(minMap);
    });
  }, [uid, weekOffset]); // weekDates derives from weekOffset — no need to list both

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flameAnim, { toValue: 1.15, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(flameAnim, { toValue: 1, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const handleTouchStart = (e: any) => {
    touchStartX.current = e.nativeEvent.touches[0].pageX;
  };
  const handleTouchEnd = (e: any) => {
    const diff = touchStartX.current - e.nativeEvent.changedTouches[0].pageX;
    if (diff > 50)  setWeekOffset(w => Math.max(w - 1, -52));
    if (diff < -50) setWeekOffset(w => Math.min(w + 1, 0));
  };

  return (
    <View>
      {/* Top row: flame + streak number + motivation + best */}
      <View style={s.streakTopRow}>
        <Animated.Text style={[s.flameEmoji, { transform: [{ scale: flameAnim }] }]}>🔥</Animated.Text>
        <View style={s.streakCenter}>
          <View style={s.streakNumRow}>
            <Text style={s.streakNumber}>{streak}</Text>
            <Text style={s.streakDayLabel}>Day{streak !== 1 ? 's' : ''}</Text>
          </View>
          <Text style={s.motivationText}>{motivationText(streak)}</Text>
        </View>
        <View style={s.streakRight}>
          <Text style={s.bestLabel}>BEST</Text>
          <Text style={s.bestValue}>{best}d</Text>
        </View>
      </View>

      {/* Week navigation */}
      <View style={s.weekNavRow}>
        <TouchableOpacity
          onPress={() => setWeekOffset(w => Math.max(w - 1, -52))}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={s.weekNavArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.weekLabel}>{weekLabel}</Text>
        <TouchableOpacity
          onPress={() => setWeekOffset(w => Math.min(w + 1, 0))}
          disabled={weekOffset === 0}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[s.weekNavArrow, weekOffset === 0 && s.weekNavArrowDisabled]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Full-width 7-day dots (swipeable) */}
      <View
        style={s.dotsRow}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {weekDates.map((dateKey, i) => {
          const isFuture = dateKey > todayKey;
          return (
            <DayDot
              key={dateKey}
              label={DAY_LABELS[i]}
              active={!isFuture && !!weekActivity[dateKey]}
              isToday={dateKey === todayKey}
              isFuture={isFuture}
              minutes={weekMinutes[dateKey] ?? 0}
            />
          );
        })}
      </View>

      {/* Daily Challenges progress — current week only */}
      {weekOffset === 0 && (
        <ChallengesBar completed={data?.weeklyChallengesCompleted ?? 0} />
      )}
    </View>
  );
}

function LeaderboardTab({ period, currentUserId }: { period: 'weekly' | 'alltime'; currentUserId?: string }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const col = collection(db, 'leaderboards', period, 'users');
    const q = query(col, orderBy('score', 'desc'), limit(3));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setEntries(snap.docs.map(d => ({ uid: d.id, ...d.data() } as LeaderboardEntry)));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [period]);

  if (loading) {
    return <ActivityIndicator color={ACCENT} size="small" style={{ marginVertical: 20 }} />;
  }

  if (entries.length === 0) {
    return <Text style={s.emptyText}>No entries yet. Be the first!</Text>;
  }

  return (
    <View>
      {entries.map((entry, index) => {
        const isMe = entry.uid === currentUserId;
        return (
          <View key={entry.uid} style={[s.lbRow, isMe && s.lbRowMe]}>
            <View style={s.lbAvatarWrap}>
              {entry.photoURL ? (
                <>
                  <Image source={{ uri: entry.photoURL }} style={s.lbAvatar} />
                  <Text style={s.lbMedal}>{MEDALS[index] ?? ''}</Text>
                </>
              ) : (
                <Text style={s.lbRankEmoji}>{MEDALS[index] ?? `#${index + 1}`}</Text>
              )}
            </View>
            <Text style={s.lbName} numberOfLines={1}>{entry.displayName ?? 'Unknown'}</Text>
            <Text style={[s.lbScore, (!entry.score || entry.score === 0) && s.lbScoreZero]}>
              {formatScore(entry.score ?? 0)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

interface Props {
  streakData: StreakData | null;
  currentUserId?: string;
  onViewAll?: () => void;
  timezone?: string;
}

export function UnifiedProgressLeaderboard({ streakData, currentUserId, onViewAll, timezone }: Props) {
  // Prefer explicitly passed timezone, then the one embedded in streakData, then device fallback
  const effectiveTimezone = timezone || streakData?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [activeTab, setActiveTab] = useState<Tab>('streak');
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [visibleTab, setVisibleTab] = useState<Tab>('streak');

  const switchTab = useCallback((tab: Tab) => {
    if (tab === activeTab) return;
    Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setVisibleTab(tab);
      setActiveTab(tab);
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
  }, [activeTab, fadeAnim]);

  return (
    <View style={s.card}>
      {/* Tab strip */}
      <View style={s.tabStrip}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[s.tabBtn, activeTab === tab && s.tabBtnActive]}
            onPress={() => switchTab(tab)}
            activeOpacity={0.75}
          >
            <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
              {TAB_LABELS[tab]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <Animated.View style={{ opacity: fadeAnim }}>
        {visibleTab === 'streak' && <StreakTab data={streakData} uid={currentUserId} timezone={effectiveTimezone} />}

        {visibleTab !== 'streak' && (
          <>
            <LeaderboardTab
              period={visibleTab}
              currentUserId={currentUserId}
            />
            {onViewAll && (
              <TouchableOpacity style={s.viewAllRow} onPress={onViewAll} activeOpacity={0.7}>
                <Text style={s.viewAllText}>View full leaderboard</Text>
                <ChevronRight color={ACCENT} size={14} />
              </TouchableOpacity>
            )}
          </>
        )}
      </Animated.View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginHorizontal: 4,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 14,
  },

  // Tab strip
  tabStrip: {
    flexDirection: 'row',
    backgroundColor: STRIP_BG,
    borderRadius: 10,
    padding: 3,
    marginBottom: 14,
    gap: 3,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: '#1c2e42',
  },
  tabText: {
    color: '#4a6480',
    fontSize: 11,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },

  // Streak tab
  streakTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  streakCenter: {
    flex: 1,
  },
  streakNumRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  flameEmoji: {
    fontSize: 26,
    lineHeight: 30,
  },
  streakNumber: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 32,
  },
  streakDayLabel: {
    color: ACCENT,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  motivationText: {
    color: '#4a6480',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dayCol: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  dayDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDotActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
    borderWidth: 2,
  },
  dayDotToday: {
    borderColor: ACCENT,
    borderWidth: 2,
  },
  dayDotFuture: {
    opacity: 0.25,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  dayDotMin: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.75)',
  },
  dayDotMinActive: {
    color: '#fff',
  },
  dayLabel: {
    color: '#3a5470',
    fontSize: 9,
    fontWeight: '600',
  },
  dayLabelActive: {
    color: ACCENT,
  },
  weekNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  weekLabel: {
    flex: 1,
    color: '#8aaccc',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  weekNavArrow: {
    color: ACCENT,
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 24,
    paddingHorizontal: 4,
  },
  weekNavArrowDisabled: {
    color: '#2a3d54',
  },
  streakRight: {
    alignItems: 'center',
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.08)',
  },
  bestLabel: {
    color: '#3a5470',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  bestValue: {
    color: '#8aaccc',
    fontSize: 16,
    fontWeight: '800',
  },

  // Challenges progress bar
  challengesSection: {
    marginTop: 12,
  },
  challengesDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: 9,
  },
  challengesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  challengesLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  challengesLabel: {
    color: '#8aaccc',
    fontSize: 11,
    fontWeight: '600',
  },
  challengesCount: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: '700',
  },
  challengesCountSuffix: {
    color: '#4a6480',
    fontSize: 10,
    fontWeight: '500',
  },
  challengesBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  challengesBarFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: ACCENT,
  },

  // Leaderboard tab
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginBottom: 4,
    gap: 10,
  },
  lbRowMe: {
    backgroundColor: 'rgba(255,107,0,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,0,0.3)',
  },
  lbAvatarWrap: {
    width: 32,
    height: 32,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lbAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,107,0,0.4)',
  },
  lbMedal: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    fontSize: 10,
  },
  lbRankEmoji: {
    fontSize: 16,
    width: 28,
    textAlign: 'center',
  },
  lbName: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  lbScore: {
    color: ACCENT,
    fontSize: 13,
    fontWeight: '700',
  },
  lbScoreZero: {
    color: '#445566',
  },
  emptyText: {
    color: '#4a6480',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16,
  },
  viewAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 2,
  },
  viewAllText: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: '600',
  },
});
