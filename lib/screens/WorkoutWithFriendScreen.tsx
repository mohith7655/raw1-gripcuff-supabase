/**
 * WorkoutWithFriendScreen — the cooperative counterpart to the Challenge Lobby.
 * Tapping "Workout with Friend" on the Social feed lands here; it explains the
 * mode and entry-points the scheduler (WorkoutWithFriendFlow).
 *
 * This mode SPENDS credits but never earns or pays out — there is deliberately
 * no "win"/"earn"/"payout" language anywhere on this screen.
 *
 * Everything that varies is data-driven:
 *   • the "N friends" pill comes from the user's real friend list,
 *   • the Recent Sessions list comes from completed workout sessions,
 *   • the "how it works" steps are props with sensible defaults.
 *
 * Animations use core `Animated` on the native driver (reanimated isn't
 * installed in this project — same convention as ChallengeLobbyScreen) and pause
 * whenever the screen loses focus.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { ChevronLeft, ChevronRight, CircleUserRound, Users } from 'lucide-react-native';
import { useUser } from '../providers/UserContext';
import { useAuth } from '../providers/AuthContext';
import { useFriend } from '../providers/FriendContext';
import { useWorkoutSession } from '../providers/WorkoutSessionContext';
import { WorkoutSession } from '../models/WorkoutSession';

// ── Palette (Ash & Midnight) ──────────────────────────────────────────────────
const BG = '#EEEEF2';
const CARD = '#F8F8FC';
const TEXT = '#211832';
const MUTED = '#7A7C90';
const BORDER = '#D8D8E4';
const INDIGO = '#4C4E78';

// Soft indigo tints reused for the credits note and DONE pill.
const INDIGO_TINT_BG = 'rgba(76,78,120,0.08)';
const INDIGO_TINT_BORDER = 'rgba(76,78,120,0.2)';
const DONE_BG = 'rgba(76,78,120,0.1)';

const { width: SCREEN_W } = Dimensions.get('window');
const SCREEN_PAD = 16;
const CONTENT_W = SCREEN_W - SCREEN_PAD * 2;
const HERO_H = 230;

// ── Data model ────────────────────────────────────────────────────────────────
export interface HowItWorksStep {
  n: number;
  label: string;
  tail: string;
}

export interface FriendSession {
  id: string;
  /** partner handle/name shown after "with " (already includes any "@") */
  partner: string;
  partnerUid?: string;
  partnerAvatar?: string | null;
  workoutName: string;
  /** muted secondary line, e.g. "2h ago · 24 min" */
  meta: string;
}

export interface WorkoutWithFriendScreenProps {
  /** Override the "N friends" pill count; defaults to the real friend list. */
  friendCount?: number;
  steps?: HowItWorksStep[];
  /** Override the session list; when omitted, completed sessions are loaded. */
  sessions?: FriendSession[];
  /** Credits spent to schedule a session. */
  costPerSession?: number;
  /** avatar shown in the left hero bubble (defaults to the signed-in user) */
  selfAvatarUri?: string | null;
  /** avatar shown in the right hero bubble (defaults to the first friend) */
  partnerAvatarUri?: string | null;
  onSchedule?: () => void;
  onAvatarPress?: (side: 'left' | 'right') => void;
  onPressSession?: (session: FriendSession) => void;
  onSeeAllSessions?: () => void;
}

const DEFAULT_STEPS: HowItWorksStep[] = [
  { n: 1, label: 'Invite a friend', tail: 'a partner keeps you both showing up.' },
  { n: 2, label: 'Pick a workout', tail: 'sync up and start in perfect rhythm.' },
  { n: 3, label: 'Train side by side', tail: 'cheer each other through every rep.' },
];

const DEFAULT_COST = 50;

// Compact relative time, e.g. "just now", "3h ago", "2d ago".
function timeAgo(date: Date): string {
  const then = date.getTime();
  if (!Number.isFinite(then)) return '';
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return date.toLocaleDateString();
}

// scheduledAt may arrive as a JS Date or an ISO string — normalise both.
function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

// ── Looping-animation helper (focus-aware) ────────────────────────────────────
// Builds a 0-driver loop that only runs while `active` is true, and tears it
// down (resetting to 0) when inactive. Keeps every animation on the native
// driver and paused when the screen is unfocused.
function useLoop(
  builder: (v: Animated.Value) => Animated.CompositeAnimation,
  active: boolean,
) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) return;
    const anim = builder(v);
    anim.start();
    return () => {
      anim.stop();
      v.setValue(0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  return v;
}

// Ease-in-out swing 0→1→0 forever.
const pingPong = (v: Animated.Value, dur: number) =>
  Animated.loop(
    Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]),
  );

// A small twinkling spark dot, started after `delay`.
function SparkDot({
  top, left, size, delay, active,
}: { top: number; left: number; size: number; delay: number; active: boolean }) {
  const v = useLoop(
    (x) => Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(x, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(x, { toValue: 0, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ),
    active,
  );
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.9] });
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.3] });
  return (
    <Animated.View
      pointerEvents="none"
      style={[s.spark, { top, left, width: size, height: size, borderRadius: size / 2, opacity, transform: [{ scale }] }]}
    />
  );
}

// Diagonal light bar sweeping across `width` every ~`period` ms.
function Shimmer({ width, height, period, active }: { width: number; height: number; period: number; active: boolean }) {
  const sweep = Math.max(period - 1100, 0);
  const v = useLoop(
    (x) => Animated.loop(
      Animated.sequence([
        Animated.timing(x, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(sweep),
        Animated.timing(x, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    ),
    active,
  );
  const translateX = v.interpolate({ inputRange: [0, 1], outputRange: [-width * 0.7, width * 1.2] });
  return (
    <Animated.View pointerEvents="none" style={[s.shimmer, { height, transform: [{ translateX }, { rotate: '20deg' }] }]}>
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.3)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

const HERO_SPARKS = [
  { top: 34, left: 40, size: 5, delay: 0 },
  { top: 70, left: SCREEN_W - 88, size: 4, delay: 560 },
  { top: 128, left: 56, size: 3, delay: 1180 },
];

// ── Hero "team-up arena" ──────────────────────────────────────────────────────
function TeamUpHero({
  friendCount, selfAvatarUri, partnerAvatarUri, active, onBack, onAvatarPress,
}: {
  friendCount: number;
  selfAvatarUri?: string | null;
  partnerAvatarUri?: string | null;
  active: boolean;
  onBack: () => void;
  onAvatarPress?: (side: 'left' | 'right') => void;
}) {
  const bob = useLoop((v) => pingPong(v, 1600), active);
  const twinkle = useLoop((v) => pingPong(v, 900), active);

  // Avatars bob vertically, out of phase.
  const leftBob = { transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [-5, 5] }) }] };
  const rightBob = { transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [5, -5] }) }] };
  // 🤝 twinkles (opacity + scale).
  const handTwinkle = {
    opacity: twinkle.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }),
    transform: [{ scale: twinkle.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.14] }) }],
  };

  return (
    <View style={s.heroShadow}>
      <View style={s.hero}>
        <LinearGradient
          colors={['#5A5C8E', '#3D3F66', '#24253E']}
          start={{ x: 0.22, y: 0.05 }}
          end={{ x: 0.78, y: 0.95 }}
          style={StyleSheet.absoluteFill}
        />

        {HERO_SPARKS.map((sp, i) => <SparkDot key={i} {...sp} active={active} />)}
        <Shimmer width={CONTENT_W} height={HERO_H + 48} period={3400} active={active} />

        {/* Back chevron */}
        <Pressable onPress={onBack} hitSlop={10} style={s.heroBack}>
          <ChevronLeft size={22} color="#fff" />
        </Pressable>

        {/* Friend-count pill (no live dot) */}
        <View style={s.countPill}>
          <Users size={13} color="#fff" />
          <Text style={s.countText}>{friendCount} {friendCount === 1 ? 'friend' : 'friends'}</Text>
        </View>

        {/* Team-up bubbles */}
        <View style={s.arenaRow}>
          <Pressable onPress={() => onAvatarPress?.('left')}>
            <Animated.View style={[s.bubble, leftBob]}>
              {selfAvatarUri
                ? <Image source={{ uri: selfAvatarUri }} style={s.bubbleImg} />
                : <CircleUserRound size={30} color="rgba(255,255,255,0.85)" strokeWidth={1.5} />}
            </Animated.View>
          </Pressable>

          <Animated.View style={[s.handBadge, handTwinkle]}>
            <Text style={s.handEmoji}>🤝</Text>
          </Animated.View>

          <Pressable onPress={() => onAvatarPress?.('right')}>
            <Animated.View style={[s.bubble, rightBob]}>
              {partnerAvatarUri
                ? <Image source={{ uri: partnerAvatarUri }} style={s.bubbleImg} />
                : <CircleUserRound size={30} color="rgba(255,255,255,0.85)" strokeWidth={1.5} />}
            </Animated.View>
          </Pressable>
        </View>

        {/* Title block */}
        <View style={s.heroTitleBlock}>
          <Text style={s.heroTitle}>Workout with Friend</Text>
          <Text style={s.heroSub}>Train together. Stay accountable. Push further.</Text>
        </View>
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export function WorkoutWithFriendScreen({
  friendCount,
  steps = DEFAULT_STEPS,
  sessions,
  costPerSession = DEFAULT_COST,
  selfAvatarUri,
  partnerAvatarUri,
  onSchedule,
  onAvatarPress,
  onPressSession,
  onSeeAllSessions,
}: WorkoutWithFriendScreenProps) {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const { profile } = useUser();
  const { supabaseUserId } = useAuth();
  const { friends } = useFriend();
  const { completedSessions } = useWorkoutSession();

  // Friend count: real friend list unless explicitly overridden.
  const displayedFriendCount = friendCount ?? friends.length;

  const heroSelfAvatar = selfAvatarUri ?? profile?.profileImageUrl ?? null;
  const heroPartnerAvatar = partnerAvatarUri ?? friends[0]?.profileImageUrl ?? null;

  // ── Recent sessions ──
  // Driven from real completed friend sessions (the "completed" notifications),
  // newest first. An explicit `sessions` prop overrides (e.g. tests). Self-only
  // sessions and non-completed states (declined/cancelled/expired) are excluded.
  const derivedSessions: FriendSession[] = React.useMemo(() => {
    if (sessions) return sessions;
    return completedSessions
      .filter((sx) => sx.status === 'completed' && sx.sessionType !== 'self')
      .map((sx) => toFriendSession(sx, supabaseUserId, friends))
      .sort((a, b) => b.sortKey - a.sortKey)
      .map(({ sortKey, ...rest }) => rest);
  }, [sessions, completedSessions, supabaseUserId, friends]);

  const handleSchedule = () => {
    if (onSchedule) onSchedule();
    else navigation.navigate('WorkoutWithFriendFlow');
  };

  const handlePressSession = (sess: FriendSession) => {
    if (onPressSession) onPressSession(sess);
    else if (sess.partnerUid) navigation.navigate('SocialProfileScreen', { uid: sess.partnerUid });
  };

  const handleSeeAll = () => {
    if (onSeeAllSessions) onSeeAllSessions();
    else navigation.navigate('UpcomingSessionsScreen');
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        <TeamUpHero
          friendCount={displayedFriendCount}
          selfAvatarUri={heroSelfAvatar}
          partnerAvatarUri={heroPartnerAvatar}
          active={isFocused}
          onBack={() => navigation.goBack()}
          onAvatarPress={onAvatarPress}
        />

        {/* Schedule CTA */}
        <Pressable
          onPress={handleSchedule}
          style={({ pressed }) => [s.ctaShadow, pressed && { opacity: 0.92 }]}
        >
          <View style={s.cta}>
            <LinearGradient
              colors={['#5A5C8E', '#3D3F66', '#24253E']}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Shimmer width={CONTENT_W} height={64} period={3400} active={isFocused} />
            <Text style={s.ctaText}>📅  Schedule a Session</Text>
          </View>
        </Pressable>

        {/* Credits note (spend-only) */}
        <View style={s.creditsNote}>
          <Text style={s.creditsIcon}>🪙</Text>
          <Text style={s.creditsText}>
            <Text style={s.creditsBold}>Costs {costPerSession} credits per session.</Text>
            <Text style={s.creditsTail}>{'  '}Show up for each other and push further, together.</Text>
          </Text>
        </View>

        {/* How it works */}
        <Text style={s.sectionTitle}>How it works</Text>
        <View style={s.howCard}>
          {steps.map((step, i) => (
            <View key={step.n} style={[s.howRow, i > 0 && s.howRowDivider]}>
              <View style={s.howNum}>
                <Text style={s.howNumText}>{step.n}</Text>
              </View>
              <Text style={s.howText}>
                <Text style={s.howLabel}>{step.label}</Text>
                <Text style={s.howTail}> — {step.tail}</Text>
              </Text>
            </View>
          ))}
        </View>

        {/* Recent Sessions */}
        <View style={s.recentHead}>
          <Text style={s.sectionTitle}>Recent Sessions</Text>
          {derivedSessions.length > 0 && (
            <Pressable onPress={handleSeeAll} hitSlop={8} style={s.seeAllBtn}>
              <Text style={s.seeAll}>See all</Text>
              <ChevronRight size={15} color={MUTED} />
            </Pressable>
          )}
        </View>

        {derivedSessions.length === 0 ? (
          <View style={s.recentEmpty}>
            <Text style={s.recentEmptyTitle}>No sessions yet</Text>
            <Text style={s.recentEmptySub}>
              Schedule a session with a friend — it’ll show up here once you’ve trained together.
            </Text>
          </View>
        ) : (
          <View style={s.recentList}>
            {derivedSessions.map((sess) => (
              <Pressable
                key={sess.id}
                onPress={() => handlePressSession(sess)}
                style={({ pressed }) => [s.sessionCard, pressed && { opacity: 0.85 }]}
              >
                {sess.partnerAvatar
                  ? <Image source={{ uri: sess.partnerAvatar }} style={s.sessionAvatar} />
                  : (
                    <View style={[s.sessionAvatar, s.sessionAvatarFallback]}>
                      <CircleUserRound size={22} color={MUTED} strokeWidth={1.5} />
                    </View>
                  )}

                <View style={s.sessionInfo}>
                  <Text style={s.sessionTitle} numberOfLines={1}>
                    with {sess.partner} · {sess.workoutName}
                  </Text>
                  <Text style={s.sessionMeta} numberOfLines={1}>{sess.meta}</Text>
                </View>

                <View style={s.donePill}>
                  <Text style={s.doneText}>DONE</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

// Map a completed workout session into the row shape this screen renders. The
// partner is whichever side isn't the signed-in user; we prefer the friend's
// @username (from the friend list) over the cached display name. A `sortKey`
// (session time) rides along so the caller can order newest-first.
function toFriendSession(
  sx: WorkoutSession,
  selfUid: string | null,
  friends: { uid: string; username?: string }[],
): FriendSession & { sortKey: number } {
  const isHost = sx.hostUid === selfUid;
  const partnerUid = isHost ? sx.guestUid : sx.hostUid;
  const partnerName = isHost ? sx.guestName : sx.hostName;
  const partnerAvatar = isHost ? sx.guestAvatarUrl : sx.hostAvatarUrl;
  const friend = friends.find((f) => f.uid === partnerUid);
  const handle = friend?.username ? `@${friend.username}` : (partnerName || 'a friend');
  const when = asDate(sx.scheduledAt);
  return {
    id: sx.id,
    partner: handle,
    partnerUid,
    partnerAvatar: partnerAvatar ?? null,
    workoutName: sx.videoTitle,
    meta: timeAgo(when),
    sortKey: when.getTime(),
  };
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  scroll: { paddingHorizontal: SCREEN_PAD, paddingTop: 8, paddingBottom: 40 },

  // ── Hero ──
  heroShadow: {
    borderRadius: 24,
    shadowColor: INDIGO,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    shadowOpacity: 0.35,
    elevation: 10,
  },
  hero: {
    height: HERO_H,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#24253E',
  },
  heroBack: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    zIndex: 3,
  },
  countPill: {
    position: 'absolute',
    top: 16,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.22)',
    zIndex: 3,
  },
  countText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  arenaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 52,
    marginTop: 64,
  },
  bubble: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    overflow: 'hidden',
  },
  bubbleImg: { width: '100%', height: '100%' },
  handBadge: {
    position: 'absolute',
    top: 64,
    left: 0,
    right: 0,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  handEmoji: {
    fontSize: 30,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  heroTitleBlock: { position: 'absolute', left: 16, right: 16, bottom: 20, alignItems: 'center' },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 12.5, fontWeight: '500', marginTop: 4 },

  spark: { position: 'absolute', backgroundColor: '#fff', zIndex: 1 },
  shimmer: { position: 'absolute', top: -24, left: 0, width: 56 },

  // ── CTA ──
  ctaShadow: {
    marginTop: 14,
    borderRadius: 16,
    shadowColor: INDIGO,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    shadowOpacity: 0.3,
    elevation: 6,
  },
  cta: {
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3D3F66',
  },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  // ── Credits note ──
  creditsNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: INDIGO_TINT_BG,
    borderWidth: 1,
    borderColor: INDIGO_TINT_BORDER,
  },
  creditsIcon: { fontSize: 18 },
  creditsText: { flex: 1, fontSize: 13, lineHeight: 18 },
  creditsBold: { color: TEXT, fontWeight: '700' },
  creditsTail: { color: MUTED, fontWeight: '500' },

  // ── Sections ──
  sectionTitle: { color: TEXT, fontSize: 18, fontWeight: '800', marginTop: 26, marginBottom: 12 },

  // ── How it works ──
  howCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
  },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  howRowDivider: { borderTopWidth: 1, borderTopColor: BORDER },
  howNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: INDIGO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howNumText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  howText: { flex: 1, fontSize: 14, lineHeight: 20 },
  howLabel: { color: TEXT, fontWeight: '700' },
  howTail: { color: MUTED, fontWeight: '500' },

  // ── Recent sessions ──
  recentHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 14 },
  seeAll: { color: MUTED, fontSize: 13, fontWeight: '600' },
  recentList: { gap: 10 },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
  },
  sessionAvatar: { width: 40, height: 40, borderRadius: 10 },
  sessionAvatarFallback: {
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionInfo: { flex: 1, minWidth: 0 },
  sessionTitle: { color: TEXT, fontSize: 14, fontWeight: '700' },
  sessionMeta: { color: MUTED, fontSize: 12, marginTop: 2 },
  donePill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: DONE_BG },
  doneText: { color: INDIGO, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },

  recentEmpty: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 6,
  },
  recentEmptyTitle: { color: TEXT, fontSize: 14, fontWeight: '700' },
  recentEmptySub: { color: MUTED, fontSize: 12.5, textAlign: 'center', lineHeight: 18 },
});

export default WorkoutWithFriendScreen;
