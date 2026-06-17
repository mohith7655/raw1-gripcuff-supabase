/**
 * SocialActivationModal — gates the Social tab behind a short activation flow.
 *
 * Phase 1  "Activate"  — a small popup inviting the user to activate the tab.
 * Phase 2  "Tour"      — screenshot-style walkthrough showing WHICH button to
 *                        tap and HOW to join (Challenge Lobby + Workout w/ Friend).
 *                        Each step renders a faithful in-app mock with a pulsing
 *                        highlight + callout. Drop a real screenshot into a step's
 *                        `image` field to show a photo instead of the mock.
 * Phase 3  "Rules"     — rules & regulations. After a few seconds the per-rule
 *                        "I agree" radios unlock; the user must agree to all
 *                        before the tab activates.
 *
 * Persistence (has the user activated?) is owned by the caller (FeedScreen).
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Easing,
  Image,
  ImageSourcePropType,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Zap,
  CalendarPlus,
  ChevronRight,
  ChevronLeft,
  X,
  Check,
  ShieldCheck,
  Hand,
  Users,
} from 'lucide-react-native';

const CANVAS = '#EEEEF2';
const CARD = '#F8F8FC';
const TEXT = '#211832';
const MUTED = '#7A7C90';
const INDIGO = '#4C4E78';
const ORANGE = '#F25912'; // primary-action button only
const HAIR = 'rgba(33,24,50,0.08)';

// Seconds the rules must be visible before the "I agree" radios unlock.
const RULES_UNLOCK_SECS = 5;

const RULES: { Icon: any; text: string }[] = [
  { Icon: ShieldCheck, text: 'Be respectful — no harassment, hate speech, or bullying.' },
  { Icon: Users, text: 'Keep it real — no fake profiles, spam, or impersonation.' },
  { Icon: Hand, text: 'Train safely — I’m responsible for my own warm-up and health.' },
  { Icon: ShieldCheck, text: 'Respect privacy — never share someone’s content without consent.' },
];

type Phase = 'activate' | 'tour' | 'rules';

// ── A single walkthrough step ────────────────────────────────────────────────
type TourStep = {
  step: string;
  caption: string;
  /** Optional real screenshot. When set, it replaces the in-app mock. */
  image?: ImageSourcePropType;
  /** Renders the in-app mock (used when `image` is absent). */
  Mock: React.FC;
};

// ── Pulsing highlight ring drawn around the button being pointed at ───────────
function Highlight({ children }: { children: React.ReactNode }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.9] });
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Animated.View style={[mock.highlightRing, { opacity: ringOpacity }]} pointerEvents="none" />
      {children}
    </Animated.View>
  );
}

function TapBadge({ label = 'Tap' }: { label?: string }) {
  return (
    <View style={mock.tapBadge}>
      <Hand size={13} color="#fff" strokeWidth={2.4} />
      <Text style={mock.tapBadgeText}>{label}</Text>
    </View>
  );
}

// Mock #1 — the Challenge Lobby entry card on the Social feed.
const MockLobbyCard: React.FC = () => (
  <View style={mock.phone}>
    <Highlight>
      <View style={mock.featureCard}>
        <View style={mock.featureIcon}><Zap color={ORANGE} size={18} /></View>
        <View style={{ flex: 1 }}>
          <Text style={mock.featureTitle}>Enter Challenge Lobby</Text>
          <Text style={mock.featureSub}>Compete live with anyone in the lobby</Text>
        </View>
        <ChevronRight color={ORANGE} size={18} />
      </View>
    </Highlight>
    <TapBadge />
  </View>
);

// Mock #2 — picking an opponent and tapping "Join" inside the lobby.
const MockJoinRow: React.FC = () => (
  <View style={mock.phone}>
    <Text style={mock.phoneHint}>Challenge Lobby</Text>
    <View style={mock.lobbyRow}>
      <View style={mock.lobbyAvatar} />
      <View style={{ flex: 1 }}>
        <Text style={mock.featureTitle}>Alex</Text>
        <View style={mock.readyRow}>
          <View style={mock.readyDot} />
          <Text style={mock.readyText}>Ready · Squats · 60s</Text>
        </View>
      </View>
      <Highlight>
        <View style={mock.joinBtn}><Text style={mock.joinBtnText}>Join</Text></View>
      </Highlight>
    </View>
    <View style={[mock.lobbyRow, { opacity: 0.45 }]}>
      <View style={mock.lobbyAvatar} />
      <View style={{ flex: 1 }}>
        <Text style={mock.featureTitle}>Sam</Text>
        <Text style={mock.readyText}>Waiting…</Text>
      </View>
    </View>
    <View style={{ alignSelf: 'flex-end', marginTop: 4 }}><TapBadge label="Tap Join" /></View>
  </View>
);

// Mock #3 — the "Workout with Friend" card on the Social feed.
const MockFriendCard: React.FC = () => (
  <View style={mock.phone}>
    <Highlight>
      <View style={mock.featureCard}>
        <View style={mock.featureIcon}><CalendarPlus color={ORANGE} size={18} /></View>
        <View style={{ flex: 1 }}>
          <Text style={mock.featureTitle}>Workout with Friend</Text>
          <Text style={mock.featureSub}>Pick a workout & schedule it together</Text>
        </View>
        <ChevronRight color={ORANGE} size={18} />
      </View>
    </Highlight>
    <TapBadge />
  </View>
);

const TOUR: TourStep[] = [
  {
    step: 'Step 1',
    caption: 'Tap “Enter Challenge Lobby” on the Social tab to get matched with someone live.',
    Mock: MockLobbyCard,
    // image: require('../../assets/media/social_lobby.png'),
  },
  {
    step: 'Step 2',
    caption: 'Pick anyone who’s Ready and tap “Join” — you both race through the same workout in real time.',
    Mock: MockJoinRow,
    // image: require('../../assets/media/social_join.png'),
  },
  {
    step: 'Step 3',
    caption: 'Want to train with a buddy? Tap “Workout with Friend”, choose a friend and a time — you both get a reminder.',
    Mock: MockFriendCard,
    // image: require('../../assets/media/social_friend.png'),
  },
];

interface Props {
  visible: boolean;
  /** All rules agreed → activate the tab permanently. */
  onActivated: () => void;
  /** Dismiss without activating (shows again on the next visit). */
  onDismiss: () => void;
}

export function SocialActivationModal({ visible, onActivated, onDismiss }: Props) {
  const [phase, setPhase] = useState<Phase>('activate');
  const [tourStep, setTourStep] = useState(0);
  const [agreed, setAgreed] = useState<boolean[]>(() => RULES.map(() => false));
  const [rulesUnlocked, setRulesUnlocked] = useState(false);
  const [countdown, setCountdown] = useState(RULES_UNLOCK_SECS);

  // Reset to the start whenever the modal re-opens.
  useEffect(() => {
    if (visible) {
      setPhase('activate');
      setTourStep(0);
      setAgreed(RULES.map(() => false));
      setRulesUnlocked(false);
      setCountdown(RULES_UNLOCK_SECS);
    }
  }, [visible]);

  // Rules phase: tick a countdown, then unlock the agree radios.
  useEffect(() => {
    if (phase !== 'rules') return;
    setRulesUnlocked(false);
    setCountdown(RULES_UNLOCK_SECS);
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(id);
          setRulesUnlocked(true);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  const allAgreed = agreed.every(Boolean);
  const toggleAgree = (i: number) =>
    setAgreed((prev) => prev.map((v, idx) => (idx === i ? !v : v)));

  // ── Phase 1: small activate popup ──────────────────────────────────────────
  if (phase === 'activate') {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
        <View style={s.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onDismiss} />
          <View style={s.popup}>
            <TouchableOpacity style={s.popupClose} onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={MUTED} strokeWidth={2.2} />
            </TouchableOpacity>
            <View style={s.popupIcon}>
              <Users size={30} color={INDIGO} strokeWidth={2} />
            </View>
            <Text style={s.popupTitle}>Activate the Social Tab</Text>
            <Text style={s.popupBody}>
              Take a quick 30-second tour, agree to the house rules, and you’re in.
            </Text>
            <TouchableOpacity style={s.cta} onPress={() => setPhase('tour')} activeOpacity={0.9}>
              <Text style={s.ctaText}>Activate</Text>
              <ChevronRight size={18} color="#fff" strokeWidth={2.4} />
            </TouchableOpacity>
            <TouchableOpacity style={s.popupLater} onPress={onDismiss} activeOpacity={0.7}>
              <Text style={s.popupLaterText}>Maybe later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // ── Phases 2 & 3: full-screen ──────────────────────────────────────────────
  const isTour = phase === 'tour';
  const step = TOUR[tourStep];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onDismiss}>
      <SafeAreaView style={s.canvas} edges={['top', 'bottom']}>
        {/* Top bar: progress + close */}
        <View style={s.topBar}>
          <View style={s.dotsRow}>
            {TOUR.map((_, i) => (
              <View key={i} style={[s.dot, isTour && i === tourStep && s.dotActive]} />
            ))}
            <View style={[s.dot, s.dotWide, !isTour && s.dotActive]} />
          </View>
          <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={22} color={MUTED} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        {isTour ? (
          <>
            <ScrollView contentContainerStyle={s.tourScroll} showsVerticalScrollIndicator={false}>
              <Text style={s.stepKicker}>{step.step}</Text>
              <Text style={s.tourHeading}>How to use the Social tab</Text>

              <View style={s.shotWrap}>
                {step.image ? (
                  <Image source={step.image} style={s.shotImage} resizeMode="contain" />
                ) : (
                  <step.Mock />
                )}
              </View>

              <Text style={s.tourCaption}>{step.caption}</Text>
            </ScrollView>

            <View style={s.footer}>
              <View style={s.navRow}>
                {tourStep > 0 ? (
                  <TouchableOpacity style={s.backBtn} onPress={() => setTourStep(tourStep - 1)} activeOpacity={0.85}>
                    <ChevronLeft size={18} color={TEXT} strokeWidth={2.4} />
                    <Text style={s.backBtnText}>Back</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={s.backSpacer} />
                )}
                <TouchableOpacity
                  style={[s.cta, s.navFlex]}
                  onPress={() => (tourStep < TOUR.length - 1 ? setTourStep(tourStep + 1) : setPhase('rules'))}
                  activeOpacity={0.9}
                >
                  <Text style={s.ctaText}>{tourStep < TOUR.length - 1 ? 'Next' : 'Continue'}</Text>
                  <ChevronRight size={18} color="#fff" strokeWidth={2.4} />
                </TouchableOpacity>
              </View>
            </View>
          </>
        ) : (
          <>
            <ScrollView contentContainerStyle={s.rulesScroll} showsVerticalScrollIndicator={false}>
              <View style={s.rulesIcon}>
                <ShieldCheck size={30} color={INDIGO} strokeWidth={2} />
              </View>
              <Text style={s.tourHeading}>Rules & Regulations</Text>
              <Text style={s.rulesIntro}>
                The Social tab is a shared, live space. Please read and agree to keep it safe for everyone.
              </Text>

              {RULES.map((rule, i) => {
                const RIcon = rule.Icon;
                const checked = agreed[i];
                return (
                  <TouchableOpacity
                    key={i}
                    style={[s.ruleRow, !rulesUnlocked && s.ruleRowLocked]}
                    activeOpacity={rulesUnlocked ? 0.8 : 1}
                    disabled={!rulesUnlocked}
                    onPress={() => toggleAgree(i)}
                  >
                    <View style={s.ruleIcon}><RIcon size={16} color={INDIGO} strokeWidth={2} /></View>
                    <Text style={s.ruleText}>{rule.text}</Text>
                    <View style={[s.radio, checked && s.radioOn]}>
                      {checked && <Check size={13} color="#fff" strokeWidth={3} />}
                    </View>
                  </TouchableOpacity>
                );
              })}

              {!rulesUnlocked && (
                <Text style={s.unlockHint}>
                  Please take a moment to read… you can agree in {countdown}s
                </Text>
              )}
            </ScrollView>

            <View style={s.footer}>
              <TouchableOpacity
                style={[s.cta, (!rulesUnlocked || !allAgreed) && s.ctaDisabled]}
                disabled={!rulesUnlocked || !allAgreed}
                onPress={onActivated}
                activeOpacity={0.9}
              >
                <Check size={18} color="#fff" strokeWidth={2.6} />
                <Text style={s.ctaText}>
                  {allAgreed ? 'Activate Social Tab' : `Agree to all (${agreed.filter(Boolean).length}/${RULES.length})`}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  // Phase 1 popup
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  popup: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: CARD,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 18,
    alignItems: 'center',
  },
  popupClose: { position: 'absolute', top: 14, right: 14, zIndex: 5 },
  popupIcon: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: 'rgba(76,78,120,0.12)',
    borderWidth: 1, borderColor: 'rgba(76,78,120,0.22)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  popupTitle: { color: TEXT, fontSize: 21, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  popupBody: { color: MUTED, fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 20 },
  popupLater: { height: 40, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  popupLaterText: { color: MUTED, fontSize: 14, fontWeight: '700' },

  // Full screen
  canvas: { flex: 1, backgroundColor: CANVAS },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4,
  },
  dotsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(33,24,50,0.18)' },
  dotWide: { width: 7 },
  dotActive: { backgroundColor: INDIGO, width: 20 },

  tourScroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16, alignItems: 'center' },
  stepKicker: { color: ORANGE, fontSize: 13, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 },
  tourHeading: { color: TEXT, fontSize: 23, fontWeight: '800', textAlign: 'center', marginBottom: 22 },
  shotWrap: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 22,
  },
  shotImage: { width: '100%', height: 320, borderRadius: 20 },
  tourCaption: { color: TEXT, fontSize: 15, lineHeight: 23, textAlign: 'center', fontWeight: '500' },

  // Rules
  rulesScroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16, alignItems: 'center' },
  rulesIcon: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: 'rgba(76,78,120,0.12)',
    borderWidth: 1, borderColor: 'rgba(76,78,120,0.22)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  rulesIntro: { color: MUTED, fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 20 },
  ruleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    width: '100%',
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1, borderColor: HAIR,
    paddingHorizontal: 14, paddingVertical: 14,
    marginBottom: 10,
  },
  ruleRowLocked: { opacity: 0.55 },
  ruleIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(76,78,120,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  ruleText: { flex: 1, color: TEXT, fontSize: 13, lineHeight: 19, fontWeight: '500' },
  radio: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: 'rgba(33,24,50,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  radioOn: { backgroundColor: INDIGO, borderColor: INDIGO },
  unlockHint: { color: MUTED, fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 6 },

  // Footer / buttons
  footer: { paddingHorizontal: 24, paddingBottom: 12, paddingTop: 8, gap: 10 },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navFlex: { flex: 1 },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 54, borderRadius: 16, backgroundColor: ORANGE, paddingHorizontal: 20,
    width: '100%',
  },
  ctaDisabled: { backgroundColor: 'rgba(33,24,50,0.18)' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    height: 54, borderRadius: 16, paddingHorizontal: 22,
    backgroundColor: 'rgba(33,24,50,0.06)', borderWidth: 1, borderColor: 'rgba(33,24,50,0.1)',
  },
  backBtnText: { color: TEXT, fontSize: 16, fontWeight: '800' },
  backSpacer: { width: 0 },
});

// ── Mock-screenshot visuals (resemble the real Social cards) ──────────────────
const mock = StyleSheet.create({
  phone: {
    width: '100%',
    backgroundColor: CANVAS,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: HAIR,
    paddingHorizontal: 14,
    paddingVertical: 18,
    gap: 10,
  },
  phoneHint: {
    color: MUTED, fontSize: 12, fontWeight: '800',
    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2,
  },
  featureCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: HAIR,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  featureIcon: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: 'rgba(242,89,18,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  featureTitle: { color: TEXT, fontSize: 15, fontWeight: '800' },
  featureSub: { color: MUTED, fontSize: 12, marginTop: 2 },
  highlightRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: ORANGE,
    margin: -4,
  },
  tapBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'center',
    backgroundColor: ORANGE, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  tapBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  lobbyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: HAIR,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  lobbyAvatar: {
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: 'rgba(76,78,120,0.18)',
  },
  readyRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  readyDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E' },
  readyText: { color: MUTED, fontSize: 12 },
  joinBtn: {
    backgroundColor: ORANGE, borderRadius: 12,
    paddingHorizontal: 18, paddingVertical: 9,
  },
  joinBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
