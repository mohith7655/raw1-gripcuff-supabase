/**
 * SocialIntroModal — full-screen, multi-step explainer shown when the user lands
 * on the Social screen. Walks through the Challenge Lobby and "Invite a Friend to
 * Workout" features with a Next button, then ends with two choices:
 *   • Remind me in 7 days
 *   • Skip forever
 *
 * Persistence is handled by the caller (FeedScreen) via AsyncStorage.
 */
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Zap, CalendarPlus, Users, X, ChevronRight, ChevronLeft, Clock } from 'lucide-react-native';

const CANVAS = '#EEEEF2';
const TEXT = '#211832';
const MUTED = '#7A7C90';
const INDIGO = '#4C4E78';
const ORANGE = '#F25912'; // primary-action button only

type Slide = {
  Icon: any;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    Icon: Zap,
    title: 'Enter the Challenge Lobby',
    body: 'Compete live with anyone in the lobby. Tap the card, get matched, and race through the same workout in real time — your reps and time go head-to-head.',
  },
  {
    Icon: CalendarPlus,
    title: 'Workout with a Friend',
    body: 'Pick a workout and schedule it together. You both get a reminder, then train side-by-side — see each other’s camera and stay accountable.',
  },
  {
    Icon: Users,
    title: 'Connect with your people',
    body: 'Your friends and suggested people appear right here. Tap anyone to view their profile, message them, or challenge them. Add new friends with one tap.',
  },
];

interface Props {
  visible: boolean;
  onRemindLater: () => void;
  onSkipForever: () => void;
  /** Close for now — shows again on the next visit. */
  onSkipOnce: () => void;
}

export function SocialIntroModal({ visible, onRemindLater, onSkipForever, onSkipOnce }: Props) {
  const [step, setStep] = useState(0);
  const isLast = step === SLIDES.length - 1;
  const slide = SLIDES[step];
  const { Icon } = slide;

  // Restart at the first slide each time it opens.
  useEffect(() => { if (visible) setStep(0); }, [visible]);

  const handleClose = () => {
    setStep(0);
    onSkipOnce();
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={handleClose}>
      <SafeAreaView style={s.canvas} edges={['top', 'bottom']}>
        {/* Top bar: progress dots + close-for-now */}
        <View style={s.topBar}>
          <View style={s.dotsRow}>
            {SLIDES.map((_, i) => (
              <View key={i} style={[s.dot, i === step && s.dotActive]} />
            ))}
          </View>
          <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={22} color={MUTED} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        {/* Centered content */}
        <View style={s.content}>
          <View style={s.iconWrap}>
            <Icon size={40} color={INDIGO} strokeWidth={2} />
          </View>
          <Text style={s.title}>{slide.title}</Text>
          <Text style={s.body}>{slide.body}</Text>
        </View>

        {/* Bottom actions */}
        <View style={s.footer}>
          {!isLast ? (
            <View style={s.navRow}>
              {step > 0 ? (
                <TouchableOpacity style={s.backBtn} onPress={() => setStep(step - 1)} activeOpacity={0.85}>
                  <ChevronLeft size={18} color={TEXT} strokeWidth={2.4} />
                  <Text style={s.backBtnText}>Back</Text>
                </TouchableOpacity>
              ) : (
                <View style={s.backSpacer} />
              )}
              <TouchableOpacity style={[s.nextBtn, s.navNext]} onPress={() => setStep(step + 1)} activeOpacity={0.85}>
                <Text style={s.nextBtnText}>Next</Text>
                <ChevronRight size={18} color="#fff" strokeWidth={2.4} />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity style={s.nextBtn} onPress={onRemindLater} activeOpacity={0.85}>
                <Clock size={17} color="#fff" strokeWidth={2.2} />
                <Text style={s.nextBtnText}>Remind me in 7 days</Text>
              </TouchableOpacity>
              <View style={s.navRow}>
                <TouchableOpacity style={[s.skipBtn, s.navNext]} onPress={onSkipOnce} activeOpacity={0.85}>
                  <Text style={s.skipBtnText}>Skip for now</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.skipBtn, s.navNext]} onPress={onSkipForever} activeOpacity={0.85}>
                  <Text style={s.skipBtnText}>Never show again</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={s.backLink} onPress={() => setStep(step - 1)} activeOpacity={0.7}>
                <ChevronLeft size={16} color={MUTED} strokeWidth={2.4} />
                <Text style={s.backLinkText}>Back</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: CANVAS },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  dotsRow: { flexDirection: 'row', gap: 6 },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(33,24,50,0.18)',
  },
  dotActive: { backgroundColor: INDIGO, width: 20 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: 'rgba(76,78,120,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(76,78,120,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  title: {
    color: TEXT,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 14,
  },
  body: {
    color: MUTED,
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 12,
    gap: 10,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  navNext: { flex: 1 },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: 16,
    backgroundColor: ORANGE,
  },
  nextBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 54,
    borderRadius: 16,
    paddingHorizontal: 22,
    backgroundColor: 'rgba(33,24,50,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(33,24,50,0.1)',
  },
  backBtnText: {
    color: TEXT,
    fontSize: 16,
    fontWeight: '800',
  },
  backSpacer: { width: 0 },
  skipBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    borderRadius: 16,
    backgroundColor: 'rgba(33,24,50,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(33,24,50,0.1)',
  },
  skipBtnText: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '700',
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    height: 40,
  },
  backLinkText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '700',
  },
});
