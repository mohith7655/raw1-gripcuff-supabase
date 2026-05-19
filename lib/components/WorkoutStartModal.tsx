import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  Dimensions,
} from 'react-native';
import { X } from 'lucide-react-native';

const ACCENT = '#FF6B35';
const { width, height } = Dimensions.get('window');

interface Props {
  visible: boolean;
  workoutTitle: string;
  thumbnail?: string | null;
  onDismiss: () => void;
  onStartNow?: () => void;
}

const playBeep = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    // Play three quick beeps
    [0, 0.2, 0.4].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 440; // A4 note
      gain.gain.setValueAtTime(0.3, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + 0.15);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.15);
    });
  } catch (e) {
    console.log('[WorkoutStartModal] Web Audio API not available:', e);
  }
};

export function WorkoutStartModal({
  visible,
  workoutTitle,
  thumbnail,
  onDismiss,
  onStartNow,
}: Props) {
  const [countdownSeconds, setCountdownSeconds] = useState(10);
  const [canDismiss, setCanDismiss] = useState(false);

  useEffect(() => {
    if (!visible) return;

    // Play beep on modal open
    playBeep();

    // Countdown from 10 seconds
    setCountdownSeconds(10);
    setCanDismiss(false);

    const interval = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          setCanDismiss(true);
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [visible]);

  const handleStartNow = () => {
    if (!canDismiss) return;
    onStartNow?.();
    onDismiss();
  };

  const handleDismiss = () => {
    if (!canDismiss) return;
    onDismiss();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <SafeAreaView style={s.overlay}>
        {/* Dark overlay */}
        <View style={s.backdrop} />

        {/* Modal card */}
        <View style={s.card}>
          {/* Close button (visible after countdown) */}
          {canDismiss && (
            <TouchableOpacity style={s.closeBtn} onPress={handleDismiss}>
              <X color="#666" size={24} />
            </TouchableOpacity>
          )}

          {/* Thumbnail */}
          {thumbnail ? (
            <Image
              source={{ uri: thumbnail }}
              style={s.thumbnail}
              resizeMode="cover"
            />
          ) : (
            <View style={[s.thumbnail, { backgroundColor: '#2a2a2a' }]} />
          )}

          {/* Content */}
          <View style={s.content}>
            <Text style={s.title}>{workoutTitle}</Text>
            <Text style={s.subtitle}>Ready to start?</Text>

            {/* Countdown / action buttons */}
            {!canDismiss ? (
              <View style={s.countdownContainer}>
                <Text style={s.countdownLabel}>Starting in</Text>
                <Text style={s.countdown}>{countdownSeconds}s</Text>
              </View>
            ) : (
              <View style={s.buttonsContainer}>
                <TouchableOpacity
                  style={s.startBtn}
                  onPress={handleStartNow}
                  activeOpacity={0.8}
                >
                  <Text style={s.startBtnText}>Start Workout Now</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.laterBtn}
                  onPress={handleDismiss}
                  activeOpacity={0.8}
                >
                  <Text style={s.laterBtnText}>Later</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: Math.min(width - 32, 400),
    borderRadius: 16,
    backgroundColor: '#1a1f2e',
    overflow: 'hidden',
    paddingBottom: 24,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 8,
  },
  thumbnail: {
    width: '100%',
    height: 200,
    backgroundColor: '#2a2a2a',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#999',
    marginBottom: 24,
  },
  countdownContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: `${ACCENT}15`,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${ACCENT}30`,
  },
  countdownLabel: {
    fontSize: 12,
    color: '#aaa',
    marginBottom: 6,
    fontWeight: '600',
  },
  countdown: {
    fontSize: 48,
    fontWeight: '900',
    color: ACCENT,
  },
  buttonsContainer: {
    gap: 12,
  },
  startBtn: {
    backgroundColor: ACCENT,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  laterBtn: {
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: `${ACCENT}40`,
  },
  laterBtnText: {
    color: ACCENT,
    fontSize: 16,
    fontWeight: '600',
  },
});
