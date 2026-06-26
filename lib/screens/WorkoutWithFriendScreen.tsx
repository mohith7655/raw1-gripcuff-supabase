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
 * The hero is static (no glow/motion). The screen can be dismissed by swiping
 * down from the top (core `Animated` + PanResponder; reanimated isn't installed).
 */
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Animated,
  Easing,
  Dimensions,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useProfilePreview } from '../providers/ProfilePreviewProvider';
import { ChevronRight, ChevronDown, CircleUserRound, Users } from 'lucide-react-native';
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

const { height: SCREEN_H } = Dimensions.get('window');
const SCREEN_PAD = 16;
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

// ── Hero "team-up arena" (static) ─────────────────────────────────────────────
function TeamUpHero({
  friendCount, selfAvatarUri, partnerAvatarUri, onAvatarPress,
}: {
  friendCount: number;
  selfAvatarUri?: string | null;
  partnerAvatarUri?: string | null;
  onAvatarPress?: (side: 'left' | 'right') => void;
}) {
  return (
    <View style={s.heroShadow}>
      <View style={s.hero}>
        <LinearGradient
          colors={['#5A5C8E', '#3D3F66', '#24253E']}
          start={{ x: 0.22, y: 0.05 }}
          end={{ x: 0.78, y: 0.95 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Friend-count pill (no live dot) */}
        <View style={s.countPill}>
          <Users size={13} color="#fff" />
          <Text style={s.countText}>{friendCount} {friendCount === 1 ? 'friend' : 'friends'}</Text>
        </View>

        {/* Team-up bubbles */}
        <View style={s.arenaRow}>
          <Pressable onPress={() => onAvatarPress?.('left')}>
            <View style={s.bubble}>
              {selfAvatarUri
                ? <Image source={{ uri: selfAvatarUri }} style={s.bubbleImg} />
                : <CircleUserRound size={30} color="rgba(255,255,255,0.85)" strokeWidth={1.5} />}
            </View>
          </Pressable>

          <View style={s.handBadge}>
            <Text style={s.handEmoji}>🤝</Text>
          </View>

          <Pressable onPress={() => onAvatarPress?.('right')}>
            <View style={s.bubble}>
              {partnerAvatarUri
                ? <Image source={{ uri: partnerAvatarUri }} style={s.bubbleImg} />
                : <CircleUserRound size={30} color="rgba(255,255,255,0.85)" strokeWidth={1.5} />}
            </View>
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
  const preview = useProfilePreview();
  const [howOpen, setHowOpen] = useState(false);
  const { profile } = useUser();
  const { supabaseUserId } = useAuth();
  const { friends } = useFriend();
  const { completedSessions } = useWorkoutSession();

  // ── Swipe-down-to-go-back ──
  // Drag the screen down to pop it. Only engages when the scroll view is at the
  // top and the gesture is a downward drag, so normal scrolling is untouched.
  const dragY = useRef(new Animated.Value(0)).current;
  const scrollTopRef = useRef(0);
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        scrollTopRef.current <= 0 && g.dy > 8 && g.dy > Math.abs(g.dx) * 1.5,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) dragY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 130 || g.vy > 0.85) {
          Animated.timing(dragY, {
            toValue: SCREEN_H,
            duration: 220,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }).start(() => navigation.goBack());
        } else {
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
      },
    }),
  ).current;

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
    else if (sess.partnerUid) {
      if (preview) preview.open({ uid: sess.partnerUid, avatarUrl: sess.partnerAvatar });
      else navigation.navigate('SocialProfileScreen', { uid: sess.partnerUid });
    }
  };

  const handleSeeAll = () => {
    if (onSeeAllSessions) onSeeAllSessions();
    else navigation.navigate('UpcomingSessionsScreen');
  };

  return (
    <Animated.View
      style={[s.dragWrap, { transform: [{ translateY: dragY }] }]}
      {...pan.panHandlers}
    >
      <SafeAreaView style={s.safe} edges={['top']}>
        {/* Grab handle — drag down to go back */}
        <View style={s.handle} />
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          scrollEventThrottle={16}
          onScroll={(e) => { scrollTopRef.current = e.nativeEvent.contentOffset.y; }}
        >
          <TeamUpHero
            friendCount={displayedFriendCount}
            selfAvatarUri={heroSelfAvatar}
            partnerAvatarUri={heroPartnerAvatar}
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

        {/* How it works — collapsible */}
        <Pressable
          style={s.howHeader}
          onPress={() => setHowOpen((o) => !o)}
          hitSlop={6}
        >
          <Text style={s.howHeaderText}>How it works</Text>
          <ChevronDown
            size={18}
            color={MUTED}
            style={howOpen ? { transform: [{ rotate: '180deg' }] } : undefined}
          />
        </Pressable>
        {howOpen && (
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
        )}

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
    </Animated.View>
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
  dragWrap: { flex: 1, backgroundColor: BG },
  safe: { flex: 1, backgroundColor: BG },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: BORDER,
    marginTop: 8,
    marginBottom: 4,
  },
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
    top: 0,
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

  // ── How it works (collapsible) ──
  howHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 22,
    marginBottom: 10,
  },
  howHeaderText: { color: MUTED, fontSize: 13, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },
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
