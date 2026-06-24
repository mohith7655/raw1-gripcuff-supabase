/**
 * ChallengeLobbyScreen — the explainer / entry-point for the head-to-head
 * challenge feature. Tapping "Challenge Lobby" on the Social feed lands here;
 * the "Enter Lobby" CTA opens the live presence lobby (ChallengeLobbyModal).
 *
 * Everything that varies — the live count, the "how it works" steps, and the
 * match history — is data-driven (props with sensible defaults), so there's no
 * hardcoded JSX repetition. Avatars, the CTA, and history rows are pressable
 * via callback props.
 *
 * Animations use core `Animated` on the native driver (reanimated isn't
 * installed in this project — same convention as FeedScreen) and pause whenever
 * the screen loses focus.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Animated,
  Easing,
  Dimensions,
  ActivityIndicator,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useIsFocused, useFocusEffect } from '@react-navigation/native';
import { ChevronRight, ChevronDown, CircleUserRound } from 'lucide-react-native';
import { useUser } from '../providers/UserContext';
import { useAuth } from '../providers/AuthContext';
import { supabase } from '../core/config/supabase';
import { ChallengeSessionService, PreviousChallenge } from '../services/challengeSession.service';
import { ChallengeLobbyModal, LOBBY_CHANNEL } from '../components/ChallengeLobbyModal';

// ── Palette (Ash & Midnight) ──────────────────────────────────────────────────
const BG = '#EEEEF2';
const CARD = '#F8F8FC';
const TEXT = '#211832';
const MUTED = '#7A7C90';
const BORDER = '#D8D8E4';
const CTA = '#F25912';
const INDIGO = '#4C4E78';

const WON_FG = '#16a34a';
const WON_BG = 'rgba(34,197,94,0.12)';
const LOST_FG = '#b91c1c';
const LOST_BG = 'rgba(122,38,38,0.1)';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const SCREEN_PAD = 16;
const CONTENT_W = SCREEN_W - SCREEN_PAD * 2;
const HERO_H = 230;

// ── Data model ────────────────────────────────────────────────────────────────
export interface HowItWorksStep {
  n: number;
  label: string;
  tail: string;
}

export interface ChallengeMatch {
  id: string;
  /** opponent handle/name shown after "vs " (already includes any "@") */
  opponent: string;
  opponentUid?: string;
  opponentAvatar?: string | null;
  workoutName: string;
  /** muted secondary line, e.g. "2h ago · 1 min" */
  meta: string;
  result: 'won' | 'lost' | 'pending';
}

export interface ChallengeLobbyScreenProps {
  liveCount?: number;
  steps?: HowItWorksStep[];
  /** Pass to override; when omitted, real history is loaded from the database. */
  history?: ChallengeMatch[];
  /** avatar shown in the left hero bubble (defaults to the signed-in user) */
  selfAvatarUri?: string | null;
  onEnterLobby?: () => void;
  onAvatarPress?: (side: 'left' | 'right') => void;
  onPressMatch?: (match: ChallengeMatch) => void;
  onSeeAllHistory?: () => void;
}

const DEFAULT_STEPS: HowItWorksStep[] = [
  { n: 1, label: 'Enter the lobby', tail: 'see who’s live.' },
  { n: 2, label: 'Challenge anyone', tail: 'pick a workout, go head-to-head.' },
  { n: 3, label: 'Win the match', tail: 'beat their reps or time.' },
];

// Compact relative time, e.g. "just now", "3h ago", "2d ago".
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
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
  return new Date(then).toLocaleDateString();
}

// Map a database challenge record into the row shape this screen renders. The
// WON/LOST result is derived from the user's own recorded winner; sessions the
// user never rated show as "pending".
function toMatch(c: PreviousChallenge, selfUid: string): ChallengeMatch {
  const mins = Math.round(c.durationSeconds / 60) || 1;
  const winnerId = c.feedback?.winnerId ?? null;
  const result: ChallengeMatch['result'] =
    winnerId == null ? 'pending' : winnerId === selfUid ? 'won' : 'lost';
  return {
    id: c.id,
    opponent: c.opponentUsername ? `@${c.opponentUsername}` : c.opponentName,
    opponentUid: c.opponentUid,
    opponentAvatar: c.opponentAvatar,
    workoutName: c.exerciseName,
    meta: `${timeAgo(c.createdAt)} · ${mins} min`,
    result,
  };
}

// ── Live lobby count ──────────────────────────────────────────────────────────
// Observes the shared 'challenge-lobby' presence channel and returns how many
// athletes are currently in the live lobby. Read-only: we subscribe and count
// but never `track()`, so opening this explainer doesn't make *you* show up as
// live to people actually in the lobby. Only runs while `active` (screen focused).
function useLobbyLiveCount(active: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) return;
    const channel = supabase.channel(LOBBY_CHANNEL);
    const sync = () => setCount(Object.keys(channel.presenceState()).length);
    channel
      .on('presence', { event: 'sync' }, sync)
      .on('presence', { event: 'join' }, sync)
      .on('presence', { event: 'leave' }, sync)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      setCount(0);
    };
  }, [active]);
  return count;
}

// ── Hero "VS arena" (static) ──────────────────────────────────────────────────
function VsArena({
  liveCount, selfAvatarUri, onAvatarPress,
}: {
  liveCount: number;
  selfAvatarUri?: string | null;
  onAvatarPress?: (side: 'left' | 'right') => void;
}) {
  return (
    <View style={s.heroShadow}>
      <View style={s.hero}>
        <LinearGradient
          colors={['#F25912', '#C7400A', '#7A2604']}
          start={{ x: 0.15, y: 0.05 }}
          end={{ x: 0.85, y: 0.95 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Live pill */}
        <View style={s.livePill}>
          <View style={s.liveDot} />
          <Text style={s.liveText}>{liveCount} live</Text>
        </View>

        {/* VS bubbles */}
        <View style={s.arenaRow}>
          <Pressable onPress={() => onAvatarPress?.('left')}>
            <View style={s.bubble}>
              {selfAvatarUri
                ? <Image source={{ uri: selfAvatarUri }} style={s.bubbleImg} />
                : <CircleUserRound size={30} color="rgba(255,255,255,0.85)" strokeWidth={1.5} />}
            </View>
          </Pressable>

          <View style={s.vsBadge}>
            <Text style={s.vsText}>VS</Text>
          </View>

          <Pressable onPress={() => onAvatarPress?.('right')}>
            <View style={s.bubble}>
              <CircleUserRound size={30} color="rgba(255,255,255,0.85)" strokeWidth={1.5} />
            </View>
          </Pressable>
        </View>

        {/* Title block */}
        <View style={s.heroTitleBlock}>
          <Text style={s.heroTitle}>Challenge Lobby</Text>
          <Text style={s.heroSub}>Compete live. Win credits. Climb the ranks.</Text>
        </View>
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export function ChallengeLobbyScreen({
  liveCount,
  steps = DEFAULT_STEPS,
  history,
  selfAvatarUri,
  onEnterLobby,
  onAvatarPress,
  onPressMatch,
  onSeeAllHistory,
}: ChallengeLobbyScreenProps) {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const { profile } = useUser();
  const { supabaseUserId } = useAuth();
  const [lobbyVisible, setLobbyVisible] = useState(false);
  const [howOpen, setHowOpen] = useState(false);

  // Live count comes from the lobby's presence channel; `liveCount` can override.
  // Pause the read-only observer while the modal is open: it shares the
  // 'challenge-lobby' topic, and supabase.channel() reuses an existing channel
  // by topic — so leaving it subscribed makes the modal inherit this already-
  // subscribed channel and crash when it adds presence callbacks.
  const presenceCount = useLobbyLiveCount(isFocused && !lobbyVisible);
  const displayedLiveCount = liveCount ?? presenceCount;

  const heroAvatar = selfAvatarUri ?? profile?.profileImageUrl ?? null;

  // ── Swipe-down-to-dismiss ──
  // Drag the screen down to close it (replaces the back button). Only engages
  // when the scroll view is at the top and the gesture is a downward drag, so
  // normal vertical scrolling is untouched.
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
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
      },
    }),
  ).current;

  // ── Real challenge history from the database ──
  // Skipped entirely when an explicit `history` prop is supplied (e.g. tests).
  const [loadedHistory, setLoadedHistory] = useState<ChallengeMatch[] | null>(null);
  const [historyError, setHistoryError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (history || !supabaseUserId) return;
      let alive = true;
      setHistoryError(false);
      ChallengeSessionService.loadPreviousForUser(supabaseUserId)
        .then((rows) => { if (alive) setLoadedHistory(rows.map((r) => toMatch(r, supabaseUserId))); })
        .catch(() => { if (alive) { setLoadedHistory([]); setHistoryError(true); } });
      return () => { alive = false; };
    }, [history, supabaseUserId]),
  );

  const matches = history ?? loadedHistory;
  const historyLoading = matches === null;

  const handleEnterLobby = () => {
    if (onEnterLobby) onEnterLobby();
    else setLobbyVisible(true);
  };

  const handlePressMatch = (m: ChallengeMatch) => {
    if (onPressMatch) onPressMatch(m);
    else if (m.opponentUid) navigation.navigate('SocialProfileScreen', { uid: m.opponentUid });
  };

  const handleSeeAll = () => {
    if (onSeeAllHistory) onSeeAllHistory();
    else navigation.navigate('UpcomingSessionsScreen');
  };

  return (
    <Animated.View
      style={[s.dragWrap, { transform: [{ translateY: dragY }] }]}
      {...pan.panHandlers}
    >
      <SafeAreaView style={s.safe} edges={['top']}>
        {/* Grab handle — drag down to close */}
        <View style={s.handle} />
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          scrollEventThrottle={16}
          onScroll={(e) => { scrollTopRef.current = e.nativeEvent.contentOffset.y; }}
        >
          <VsArena
            liveCount={displayedLiveCount}
            selfAvatarUri={heroAvatar}
            onAvatarPress={onAvatarPress}
          />

        {/* Enter Lobby CTA */}
        <Pressable
          onPress={handleEnterLobby}
          style={({ pressed }) => [s.ctaShadow, pressed && { opacity: 0.92 }]}
        >
          <View style={s.cta}>
            <LinearGradient
              colors={['#F25912', '#C7400A', '#8F2D05']}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={s.ctaText}>⚔️  Enter Lobby</Text>
          </View>
        </Pressable>

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

        {/* Challenge History */}
        <View style={s.historyHead}>
          <Text style={s.sectionTitle}>Challenge History</Text>
          {!!(matches && matches.length > 0) && (
            <Pressable onPress={handleSeeAll} hitSlop={8} style={s.seeAllBtn}>
              <Text style={s.seeAll}>See all</Text>
              <ChevronRight size={15} color={MUTED} />
            </Pressable>
          )}
        </View>

        {historyLoading ? (
          <View style={s.historyStatus}>
            <ActivityIndicator color={CTA} />
          </View>
        ) : matches.length === 0 ? (
          <View style={s.historyEmpty}>
            <Text style={s.historyEmptyTitle}>
              {historyError ? 'Couldn’t load your history' : 'No challenges yet'}
            </Text>
            <Text style={s.historyEmptySub}>
              {historyError
                ? 'Pull back here once you’re online.'
                : 'Enter the lobby and win your first match — it’ll show up here.'}
            </Text>
          </View>
        ) : (
          <View style={s.historyList}>
            {matches.map((m) => {
              const isWon = m.result === 'won';
              const isLost = m.result === 'lost';
              return (
                <Pressable
                  key={m.id}
                  onPress={() => handlePressMatch(m)}
                  style={({ pressed }) => [s.matchCard, pressed && { opacity: 0.85 }]}
                >
                  {m.opponentAvatar
                    ? <Image source={{ uri: m.opponentAvatar }} style={s.matchAvatar} />
                    : (
                      <View style={[s.matchAvatar, s.matchAvatarFallback]}>
                        <CircleUserRound size={22} color={MUTED} strokeWidth={1.5} />
                      </View>
                    )}

                  <View style={s.matchInfo}>
                    <Text style={s.matchTitle} numberOfLines={1}>
                      vs {m.opponent} · {m.workoutName}
                    </Text>
                    <Text style={s.matchMeta} numberOfLines={1}>{m.meta}</Text>
                  </View>

                  <View style={[s.resultPill, isWon ? s.wonPill : isLost ? s.lostPill : s.pendingPill]}>
                    <Text style={[s.resultText, { color: isWon ? WON_FG : isLost ? LOST_FG : MUTED }]}>
                      {isWon ? 'WON' : isLost ? 'LOST' : 'PLAYED'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </Animated.ScrollView>

      {/* Live presence lobby */}
      <ChallengeLobbyModal
        visible={lobbyVisible}
        exerciseName="Squats"
        workoutDurationSecs={60}
        onClose={() => setLobbyVisible(false)}
        onChallengeStarted={(params) => {
          setLobbyVisible(false);
          navigation.navigate('ChallengeVideoRoom', params);
        }}
      />
      </SafeAreaView>
    </Animated.View>
  );
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
    shadowColor: CTA,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    shadowOpacity: 0.35,
    elevation: 10,
  },
  hero: {
    height: HERO_H,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#7A2604',
  },
  livePill: {
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
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#34d399' },
  liveText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  arenaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 56,
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
  vsBadge: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  vsText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    fontStyle: 'italic',
    textShadowColor: 'rgba(255,255,255,0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  heroTitleBlock: { position: 'absolute', left: 16, right: 16, bottom: 20, alignItems: 'center' },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 12.5, fontWeight: '500', marginTop: 4 },

  // ── CTA ──
  ctaShadow: {
    marginTop: 14,
    borderRadius: 16,
    shadowColor: CTA,
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
    backgroundColor: '#C7400A',
  },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  // ── Sections ──
  sectionTitle: { color: TEXT, fontSize: 18, fontWeight: '800', marginTop: 26, marginBottom: 12 },

  // ── How it works (collapsible) ──
  howHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    backgroundColor: CTA,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howNumText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  howText: { flex: 1, fontSize: 14, lineHeight: 20 },
  howLabel: { color: TEXT, fontWeight: '700' },
  howTail: { color: MUTED, fontWeight: '500' },

  // ── History ──
  historyHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 14 },
  seeAll: { color: MUTED, fontSize: 13, fontWeight: '600' },
  historyList: { gap: 10 },
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
  },
  matchAvatar: { width: 40, height: 40, borderRadius: 10 },
  matchAvatarFallback: {
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchInfo: { flex: 1, minWidth: 0 },
  matchTitle: { color: TEXT, fontSize: 14, fontWeight: '700' },
  matchMeta: { color: MUTED, fontSize: 12, marginTop: 2 },
  resultPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  wonPill: { backgroundColor: WON_BG },
  lostPill: { backgroundColor: LOST_BG },
  pendingPill: { backgroundColor: 'rgba(122,124,144,0.12)' },
  resultText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },

  historyStatus: { paddingVertical: 28, alignItems: 'center' },
  historyEmpty: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 6,
  },
  historyEmptyTitle: { color: TEXT, fontSize: 14, fontWeight: '700' },
  historyEmptySub: { color: MUTED, fontSize: 12.5, textAlign: 'center', lineHeight: 18 },
});

export default ChallengeLobbyScreen;
