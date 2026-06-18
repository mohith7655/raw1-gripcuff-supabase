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
  PanResponder,
  Platform,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { ChevronRight, Zap, Clock } from 'lucide-react-native';
import { TimeArrowPicker } from './TimeArrowPicker';
import { TierAvatar } from './profile/TierAvatar';
import { useNavigation } from '@react-navigation/native';
import { useInvite } from '../hooks/useInvite';
import { BADGE_FAMILIES, TIER_COLORS, computeTier } from '../services/badge.types';
import { supabase } from '../core/config/supabase';
import { StreakData } from '../services/streak.service';
import { LeaderboardEntry, LeaderboardService } from '../services/leaderboard.service';
import { getDateKey, buildWeekDates } from '../utils/streakDate';

const ACCENT = '#F25912';
const CARD_BG = '#F8F8FC';
const STRIP_BG = '#EEEEF2';
const BORDER = '#D8D8E4';
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MEDALS = ['🥇', '🥈', '🥉'];

type Tab = 'streak' | 'weekly' | 'alltime';
const TABS: Tab[] = ['streak', 'weekly', 'alltime'];
const TAB_LABELS: Record<Tab, string> = {
  streak: 'Streak',
  weekly: 'Weekly',
  alltime: 'Challenge',
};

// ── Helpers ────────────────────────────────────────────────────────────────

// todayWeekdayIndex / buildWeekKeys / getWeekDates are now timezone-aware.
// They receive `timezone` from StreakTab (which receives it via streakData.timezone).
// Falls back to device timezone when timezone is empty (e.g., data not yet loaded).

function getEntryBadgePip(entry: LeaderboardEntry): { emoji: string; color: string; name: string } | null {
  const checks = [
    { family: BADGE_FAMILIES.find(f => f.key === 'streak')!,         value: entry.bestStreak || 0 },
    { family: BADGE_FAMILIES.find(f => f.key === 'consistency')!,    value: entry.workouts || 0 },
    { family: BADGE_FAMILIES.find(f => f.key === 'transformation')!, value: Math.floor((entry.totalMinutes || 0)) },
    { family: BADGE_FAMILIES.find(f => f.key === 'social')!,         value: entry.liveSessions || 0 },
  ].filter(c => c.family);
  let best: { tier: number; emoji: string; color: string; name: string } | null = null;
  for (const { family, value } of checks) {
    const tier = computeTier(family, value);
    if (tier > 0 && (!best || tier > best.tier)) {
      best = { tier, emoji: family.emoji, color: TIER_COLORS[tier - 1], name: family.tiers[tier - 1].name };
    }
  }
  return best;
}

function motivationText(streak: number): string {
  if (streak <= 2) return 'Start your comeback';
  if (streak <= 6) return 'Building momentum';
  if (streak <= 13) return "You're on fire!";
  if (streak <= 29) return 'Unstoppable';
  return 'Elite consistency 🏆';
}

function formatWatchTime(seconds: number): string {
  const secs = Number(seconds) || 0;
  if (secs < 60) return `${Math.round(secs)}s`;
  if (secs < 3600) return `${(secs / 60).toFixed(1)}m`;
  return `${(secs / 3600).toFixed(1)}h`;
}

function formatMinutes(value?: number): string {
  const safe = Number(value || 0);
  if (safe <= 0) return '';
  if (safe >= 60) return `${Math.floor(safe / 60)}h`;
  const rounded = Math.round(safe * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}m` : `${rounded.toFixed(1)}m`;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function DayDot({ active, isToday, isFuture, label, minutes, dateKey }: {
  active: boolean;
  isToday: boolean;
  isFuture?: boolean;
  label: string;
  minutes: number;
  dateKey: string;
}) {
  const rawMinutes = Number(minutes) || 0;
  // A day counts as active if the user opened the app that day (a user_daily_activity
  // row exists → `active` prop), watched anything, or it's today. App-open days with
  // no watch time stay filled and show "0m" — they never go blank.
  const isActive = !isFuture && (isToday || active || rawMinutes > 0);
  // A past day the app was never opened (no activity row) = a missed day → black dot.
  const isMissed = !isFuture && !isActive;
  const minLabel = isActive && rawMinutes <= 0 ? '0m' : formatMinutes(rawMinutes);

  const [, mm, dd] = dateKey.split('-');
  const dateLabel = `${parseInt(mm)}/${parseInt(dd)}`;

  if (isToday || rawMinutes > 0) {
    console.log('[Circle]', {
      dateKey,
      raw: minutes,
      coerced: rawMinutes,
      isActive,
      formattedMinutes: minLabel,
      type: typeof minutes,
    });
  }

  return (
    <View style={s.dayCol}>
      <Text style={s.dayDate}>{dateLabel}</Text>
      <View
        style={[
          s.dayDot,
          isFuture && s.dayDotFuture,
          isMissed && s.dayDotMissed,
          isActive && s.dayDotActive,
        ]}
      >
        {minLabel && !isFuture ? (
          <Text
            style={[s.dayDotMin, isActive && s.dayDotMinActive]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >{minLabel}</Text>
        ) : null}
      </View>
      <Text style={[s.dayLabel, isActive && s.dayLabelActive]}>{label}</Text>
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
        Animated.timing(glowAnim, { toValue: 1, duration: 1200, useNativeDriver: Platform.OS !== 'web', easing: Easing.inOut(Easing.ease) }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 1200, useNativeDriver: Platform.OS !== 'web', easing: Easing.inOut(Easing.ease) }),
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

function getISOWeekNumber(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  const thu = new Date(date);
  thu.setUTCDate(date.getUTCDate() + 3 - ((date.getUTCDay() + 6) % 7));
  const jan4 = new Date(Date.UTC(thu.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((thu.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
}

function StreakTab({ data, uid, timezone }: { data: StreakData | null; uid?: string; timezone: string }) {
  const flameAnim = useRef(new Animated.Value(1)).current;
  const streak = Math.max(1, data?.currentStreak ?? 0);
  const best = Math.max(streak, data?.bestStreak ?? 0);

  const [weekOffset, setWeekOffset] = useState(0);
  const [fetchedActivity, setFetchedActivity] = useState<Record<string, boolean>>({});
  const [fetchedMinutes, setFetchedMinutes] = useState<Record<string, number>>({});
  // DB minutes fetched directly from user_daily_activity for the displayed week.
  // Keyed by activity_date (YYYY-MM-DD). Today's live value from the prop takes priority.
  const [dbMinutes, setDbMinutes] = useState<Record<string, number>>({});
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 8 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -50) setWeekOffset(w => w + 1);
        if (gs.dx > 50)  setWeekOffset(w => w - 1);
      },
    })
  ).current;

  // For current week use the already-loaded data prop; for other weeks fetch separately
  const weekDates = useMemo(() => buildWeekDates(timezone, weekOffset), [timezone, weekOffset]);
  const todayKey = getDateKey(timezone);

  const weekActivity = weekOffset === 0 ? (data?.weeklyActivity ?? {}) : fetchedActivity;
  const weekMinutes  = weekOffset === 0 ? (data?.weeklyMinutes  ?? {}) : fetchedMinutes;

  const weekLabel = useMemo(() => {
    if (weekOffset === 0) return 'This Week';
    return `Week ${getISOWeekNumber(weekDates[0])}`;
  }, [weekOffset, weekDates]);

  // Fetch activity docs for non-current weeks (no Firestore — return empty)
  useEffect(() => {
    if (weekOffset === 0 || !uid) return;
    setFetchedActivity({});
    setFetchedMinutes({});
  }, [uid, weekOffset]);

  // Fetch watched_minutes from user_daily_activity for every displayed week.
  // Runs whenever the uid or displayed week changes.
  useEffect(() => {
    if (!uid || weekDates.length === 0) return;
    const from = weekDates[0];
    const to   = weekDates[weekDates.length - 1];
    supabase
      .from('user_daily_activity')
      .select('activity_date, watched_minutes')
      .eq('user_id', uid)
      .gte('activity_date', from)
      .lte('activity_date', to)
      .then(({ data: rows, error }) => {
        if (error) {
          console.warn('[StreakTab] user_daily_activity fetch failed:', error.message);
          return;
        }
        const map: Record<string, number> = {};
        for (const r of rows ?? []) {
          // Normalize to a YYYY-MM-DD key in case activity_date ever carries a time part,
          // so day lookups (incl. the last column, Sunday) always match.
          const key = String(r.activity_date).slice(0, 10);
          map[key] = Number(r.watched_minutes || 0);
        }
        setDbMinutes(map);
      });
  }, [uid, weekDates[0]]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flameAnim, { toValue: 1.15, duration: 700, useNativeDriver: Platform.OS !== 'web', easing: Easing.inOut(Easing.ease) }),
        Animated.timing(flameAnim, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== 'web', easing: Easing.inOut(Easing.ease) }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

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

      <View {...panResponder.panHandlers}>
        {/* Week navigation */}
        <View style={s.weekNavRow}>
          <TouchableOpacity
            onPress={() => setWeekOffset(w => w - 1)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={s.weekNavArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={s.weekLabel}>{weekLabel}</Text>
          <TouchableOpacity
            onPress={() => setWeekOffset(w => w + 1)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={s.weekNavArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Full-width 7-day dots */}
        <View style={s.dotsRow}>
          {weekDates.map((dateKey, i) => {
            const isFuture = weekOffset === 0 && dateKey > todayKey;
            // Today: weekMinutes comes from HomeScreen, which fetches user_daily_activity
            // after each flush and applies a UTC date guard to block stale boot-sync data.
            // Past days: DB is authoritative.
            const minutes = dateKey === todayKey
              ? (weekMinutes[dateKey] ?? 0)
              : (dbMinutes[dateKey] ?? weekMinutes[dateKey] ?? 0);
            return (
              <DayDot
                key={dateKey}
                dateKey={dateKey}
                label={DAY_LABELS[i]}
                active={!isFuture && (dateKey in dbMinutes || !!weekActivity[dateKey])}
                isToday={dateKey === todayKey}
                isFuture={isFuture}
                minutes={minutes}
              />
            );
          })}
        </View>

        {/* Daily Challenges progress — current week only */}
        {weekOffset === 0 && (
          <ChallengesBar completed={data?.weeklyChallengesCompleted ?? 0} />
        )}
      </View>
    </View>
  );
}

// ── Challenge Invite Modal ──────────────────────────────────────────────────
function getLocalNow() {
  const now = new Date();
  const h24 = now.getHours();
  const rawMin = now.getMinutes();
  const minute = Math.round(rawMin / 5) * 5 % 60;
  const period: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
  const hour12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return { displayHour: hour12, amPm: period, selectedMinute: minute };
}

function buildDates(count = 14): Date[] {
  const result: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    result.push(d);
  }
  return result;
}

interface ChallengeInviteModalProps {
  visible: boolean;
  targetName: string;
  targetUid: string;
  currentUserId: string;
  onClose: () => void;
}

function ChallengeInviteModal({ visible, targetName, targetUid, currentUserId, onClose }: ChallengeInviteModalProps) {
  const navigation = useNavigation<any>();
  const { sendInvite, loading } = useInvite();
  const now = getLocalNow();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [displayHour, setDisplayHour] = useState(now.displayHour);
  const [amPm, setAmPm] = useState<'AM' | 'PM'>(now.amPm);
  const [selectedMinute, setSelectedMinute] = useState(now.selectedMinute);
  const dates = useMemo(() => buildDates(14), []);

  const fmtPickerTime = `${displayHour}:${String(selectedMinute).padStart(2, '0')} ${amPm}`;
  const dateLabel = (d: Date, i: number) =>
    i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });

  const buildScheduledAt = () => {
    const h24 = amPm === 'AM'
      ? (displayHour === 12 ? 0 : displayHour)
      : (displayHour === 12 ? 12 : displayHour + 12);
    const d = new Date(selectedDate);
    d.setHours(h24, selectedMinute, 0, 0);
    return d;
  };

  const handleStartNow = async () => {
    const result = await sendInvite({
      toUid: targetUid,
      toName: targetName,
      videoId: 'challenge',
      videoTitle: '🔥 Live Challenge',
      scheduledAt: new Date(),
      inviteType: 'instant',
      category: 'Challenge',
    });
    if (result.success) {
      onClose();
      const channelName = `challenge_${[currentUserId, targetUid].sort().join('_')}`;
      navigation.navigate('ChallengeVideoRoom', {
        channelName,
        opponentName: targetName,
        opponentUid: targetUid,
      });
    } else {
      Alert.alert('Error', result.error ?? 'Failed to send challenge.');
    }
  };

  const handleSendChallenge = async () => {
    const scheduledAt = buildScheduledAt();
    const result = await sendInvite({
      toUid: targetUid,
      toName: targetName,
      videoId: 'challenge',
      videoTitle: '🔥 Challenge',
      scheduledAt,
      inviteType: 'scheduled',
      category: 'Challenge',
    });
    if (result.success) {
      Alert.alert('Challenge Sent! 🔥', `${targetName} has been challenged.`);
      onClose();
    } else {
      Alert.alert('Error', result.error ?? 'Failed to send challenge.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={{ backgroundColor: '#EEEEF2', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ color: '#211832', fontSize: 20, fontWeight: '800' }}>🔥 Challenge {targetName}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ color: '#7A7C90', fontSize: 20, fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Start Now */}
          <TouchableOpacity
            onPress={handleStartNow}
            disabled={loading}
            style={{ backgroundColor: loading ? '#F25912' : '#F25912', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 20 }}
            activeOpacity={0.85}
          >
            <Text style={{ color: '#211832', fontSize: 16, fontWeight: '800' }}>
              {loading ? 'Sending…' : '⚡ Start Now'}
            </Text>
          </TouchableOpacity>

          <Text style={{ color: '#7A7C90', textAlign: 'center', marginBottom: 20, fontSize: 13 }}>— or schedule —</Text>

          {/* Date */}
          <Text style={{ color: '#211832', fontSize: 15, fontWeight: '600', marginBottom: 10 }}>Date</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
            {dates.map((d, i) => {
              const isSelected = selectedDate.toDateString() === d.toDateString();
              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => setSelectedDate(d)}
                  style={{ paddingHorizontal: 18, paddingVertical: 10, backgroundColor: isSelected ? '#F25912' : '#F8F8FC', borderRadius: 22, marginRight: 10, borderWidth: 1, borderColor: isSelected ? '#F25912' : 'rgba(255,255,255,0.06)' }}
                >
                  <Text style={{ color: isSelected ? '#fff' : '#7A7C90', fontWeight: isSelected ? '700' : '500', fontSize: 13 }}>{dateLabel(d, i)}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Time */}
          <Text style={{ color: '#211832', fontSize: 15, fontWeight: '600', marginBottom: 10 }}>Time</Text>
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <TimeArrowPicker
              hour={displayHour}
              minute={selectedMinute}
              amPm={amPm}
              onHourChange={setDisplayHour}
              onMinuteChange={setSelectedMinute}
              onAmPmChange={setAmPm}
              minuteStep={5}
            />
          </View>

          {/* Summary */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8F8FC', borderRadius: 10, padding: 12, marginBottom: 20 }}>
            <Clock color="#F25912" size={14} />
            <Text style={{ color: '#F25912', fontSize: 14, fontWeight: '600' }}>
              {dateLabel(selectedDate, dates.findIndex(d => d.toDateString() === selectedDate.toDateString()))} at {fmtPickerTime}
            </Text>
          </View>

          {/* Send Challenge */}
          <TouchableOpacity
            onPress={handleSendChallenge}
            disabled={loading}
            style={{ backgroundColor: '#F8F8FC', borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: loading ? '#F25912' : '#F25912' }}
            activeOpacity={0.85}
          >
            <Text style={{ color: loading ? '#F25912' : '#F25912', fontSize: 15, fontWeight: '700' }}>
              {loading ? 'Sending…' : '🔥 Send Challenge'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function LeaderboardTab({ period, currentUserId }: { period: 'weekly' | 'alltime'; currentUserId?: string }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [challengeTarget, setChallengeTarget] = useState<LeaderboardEntry | null>(null);

  useEffect(() => {
    setLoading(true);

    const subscribe = period === 'alltime'
      ? LeaderboardService.subscribeAllTimeLeaderboard
      : LeaderboardService.subscribeWeeklyLeaderboard;

    const unsub = subscribe(
      currentUserId || '',
      (data) => {
        setEntries(data);
        setLoading(false);
      },
      (err) => {
        console.error('[LeaderboardTab]', period, err);
        setLoading(false);
      }
    );

    return unsub;
  }, [period, currentUserId]);

  if (loading) {
    return <ActivityIndicator color={ACCENT} size="small" style={{ marginVertical: 20 }} />;
  }

  if (entries.length === 0) {
    return <Text style={s.emptyText}>No users yet</Text>;
  }

  return (
    <View>
      {entries.map((entry, index) => {
        const isMe = entry.uid === currentUserId;
        return (
          <View key={entry.uid} style={[s.lbRow, isMe && s.lbRowMe]}>
            <View style={s.lbAvatarWrap}>
              <TierAvatar uri={entry.photoURL} size={32} uid={entry.uid} name={entry.fullName || entry.displayName} radius={7} showNameOverlay />
              <Text style={s.lbMedal}>{MEDALS[index] ?? ''}</Text>
            </View>
            <View style={s.lbNameRow}>
              <Text style={[s.lbName, isMe && s.lbNameMe]} numberOfLines={1}>{entry.displayName ?? 'Unknown'}</Text>
              {isMe && <View style={s.lbYouBadge}><Text style={s.lbYouBadgeText}>YOU</Text></View>}
              {(() => {
                const pip = getEntryBadgePip(entry);
                if (!pip) return null;
                return (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: pip.color + '22', borderRadius: 5, borderWidth: 1, borderColor: pip.color + '55', paddingHorizontal: 4, paddingVertical: 1 }}>
                    <Text style={{ fontSize: 8 }}>{pip.emoji}</Text>
                    <Text style={{ color: pip.color, fontSize: 8, fontWeight: '700' }}>{pip.name}</Text>
                  </View>
                );
              })()}
              {/* Squats — shown for every user, even at 0 */}
              <View style={s.lbSquatPill}>
                <Text style={s.lbSquatText}>🏋️ {entry.totalSquats ?? 0}</Text>
              </View>
            </View>
            {!isMe && period === 'alltime' ? (
              <TouchableOpacity
                onPress={() => setChallengeTarget(entry)}
                style={{ backgroundColor: 'rgba(242,89,18,0.12)', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(242,89,18,0.3)', flexDirection: 'row', alignItems: 'center', gap: 4 }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 12 }}>🔥</Text>
                <Text style={{ color: '#F25912', fontSize: 11, fontWeight: '700' }}>Challenge</Text>
              </TouchableOpacity>
            ) : (
              <Text style={[s.lbScore, (!entry.score || entry.score === 0) && s.lbScoreZero]}>
                {formatWatchTime(entry.score ?? 0)}
              </Text>
            )}
          </View>
        );
      })}
      {challengeTarget && (
        <ChallengeInviteModal
          visible={!!challengeTarget}
          targetName={challengeTarget.displayName ?? 'User'}
          targetUid={challengeTarget.uid}
          currentUserId={currentUserId ?? ''}
          onClose={() => setChallengeTarget(null)}
        />
      )}
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
    Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: Platform.OS !== 'web' }).start(() => {
      setVisibleTab(tab);
      setActiveTab(tab);
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: Platform.OS !== 'web' }).start();
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
              period={visibleTab as 'weekly' | 'alltime'}
              currentUserId={currentUserId}
            />
            {onViewAll && visibleTab === 'weekly' && (
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
  // Matches the Library Exercises/Workouts capsule toggle
  tabStrip: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: '#EEEEF2',
    borderRadius: 100,
    padding: 2,
    borderWidth: 1,
    borderColor: '#D8D8E4',
    marginBottom: 14,
  },
  tabBtn: {
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnActive: {
    backgroundColor: '#211832',
  },
  tabText: {
    color: '#7A7C90',
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
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
    color: '#211832',
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 32,
  },
  streakDayLabel: {
    color: '#211832',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  motivationText: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: '600',
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#D8D8E4',
    borderWidth: 0,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDotActive: {
    backgroundColor: '#7A7C90',
    borderColor: '#7A7C90',
    borderWidth: 0,
  },
  dayDotMissed: {
    backgroundColor: '#211832',
    borderWidth: 0,
  },
  dayDotFuture: {
    opacity: 0.5,
    borderColor: 'transparent',
  },
  dayDotMin: {
    fontSize: 9,
    fontWeight: '700',
    color: '#7A7C90',
  },
  dayDotMinActive: {
    color: '#fff',
  },
  dayDate: {
    color: '#7A7C90',
    fontSize: 9,
    fontWeight: '500',
  },
  dayLabel: {
    color: '#7A7C90',
    fontSize: 9,
    fontWeight: '600',
  },
  dayLabelActive: {
    color: '#211832',
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
    color: '#7A7C90',
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
    color: '#F8F8FC',
  },
  streakRight: {
    alignItems: 'center',
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(33,24,50,0.08)',
  },
  bestLabel: {
    color: '#7A7C90',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  bestValue: {
    color: '#211832',
    fontSize: 16,
    fontWeight: '800',
  },

  // Challenges progress bar
  challengesSection: {
    marginTop: 12,
  },
  challengesDivider: {
    height: 1,
    backgroundColor: '#D8D8E4',
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
    color: '#7A7C90',
    fontSize: 11,
    fontWeight: '600',
  },
  challengesCount: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: '700',
  },
  challengesCountSuffix: {
    color: '#7A7C90',
    fontSize: 10,
    fontWeight: '500',
  },
  challengesBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D8D8E4',
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
    backgroundColor: 'rgba(242,89,18,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(242,89,18,0.15)',
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
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(242,89,18,0.4)',
  },
  lbAvatarMe: {
    borderWidth: 2,
    borderColor: '#F25912',
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
  lbNameRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lbName: {
    color: '#211832',
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  lbNameMe: {
    color: '#F25912',
  },
  lbYouBadge: {
    backgroundColor: '#F25912',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  lbYouBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  lbSquatPill: {
    backgroundColor: 'rgba(242,89,18,0.10)',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(242,89,18,0.30)',
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  lbSquatText: {
    color: ACCENT,
    fontSize: 8,
    fontWeight: '700',
  },
  lbScore: {
    color: '#211832',
    fontSize: 13,
    fontWeight: '700',
  },
  lbScoreZero: {
    color: '#D8D8E4',
  },
  emptyText: {
    color: '#7A7C90',
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
