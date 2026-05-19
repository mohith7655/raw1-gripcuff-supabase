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
  Vibration,
} from 'react-native';
import { X } from 'lucide-react-native';
import { doc, updateDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db } from '../core/config/firebase';

const ACCENT = '#f97316';
const { width } = Dimensions.get('window');

export interface ScheduledWorkoutData {
  id: string;
  workoutName: string;
  videoTitle?: string;
  thumbnail?: string | null;
  scheduledFor?: Timestamp | Date;
  scheduledAt?: Timestamp | Date;
  videoId?: string;
  recurrenceLabel?: string;
  source?: 'scheduledWorkout' | 'recurringReminder' | 'dailyReminder';
  // true  = exact workout start time popup → sound + vibration + "Workout starts now!"
  // false = early reminder popup → silent, shows "Reminder: starts at HH:MM"
  isStartTime?: boolean;
}

interface Props {
  visible: boolean;
  workout: ScheduledWorkoutData | null;
  onDismiss: () => void;
  onStartNow?: (workout: ScheduledWorkoutData) => void;
}

const playBeep = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    [0, 0.3, 0.6].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + delay + 0.2,
      );
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.2);
    });
    console.log('[ReminderAlarm] sound started');
  } catch (e) {
    console.log('[ReminderAlarm] Web Audio API not available:', e);
  }
};

const startWebVibration = () => {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  navigator.vibrate([400, 250, 400, 250, 400]);
};

export function WorkoutReminderModal({
  visible,
  workout,
  onDismiss,
  onStartNow,
}: Props) {
  const [countdownSeconds, setCountdownSeconds] = useState(10);
  const [canDismiss, setCanDismiss] = useState(false);

  // true = exact start time popup (loud); false = early reminder (silent)
  const isStartTime = workout?.isStartTime !== false;
  const isRecurring = workout?.source === 'recurringReminder';
  const isDailyReminder = workout?.source === 'dailyReminder';

  useEffect(() => {
    if (!visible || !workout) return;

    console.log('[ReminderAlarm] popup opened', {
      reminderId: workout.id,
      isStartTime,
      isRecurring,
    });

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

    // Sound + vibration only for exact workout start popup
    let soundInterval: ReturnType<typeof setInterval> | null = null;
    let webVibrationInterval: ReturnType<typeof setInterval> | null = null;

    if (isStartTime) {
      playBeep();
      soundInterval = setInterval(() => {
        playBeep();
      }, 1200);

      Vibration.vibrate([0, 800, 350], true);
      startWebVibration();
      webVibrationInterval = setInterval(() => {
        startWebVibration();
      }, 1300);
      console.log('[ReminderAlarm] vibration started');
    } else {
      console.log('[ReminderAlarm] silent early reminder — no sound/vibration');
    }

    return () => {
      clearInterval(interval);
      if (soundInterval) clearInterval(soundInterval);
      if (webVibrationInterval) clearInterval(webVibrationInterval);
      Vibration.cancel();
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(0);
      }
    };
  }, [visible, workout]);

  const handleStartNow = async () => {
    if (!workout) return;
    try {
      if (!isRecurring && !isDailyReminder) {
        await updateDoc(doc(db, 'scheduledWorkouts', workout.id), {
          status: 'triggered',
          startPopupShown: true,
          reminderSent: true,
          notificationSent: true,
          triggeredAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      console.error('[WorkoutReminderModal] Failed to update status on start:', err);
    }
    onStartNow?.(workout);
    onDismiss();
  };

  const handleSnooze = async () => {
    if (!workout) return;
    // Daily reminders are purely in-memory — just dismiss, they re-fire tomorrow
    if (isDailyReminder) { onDismiss(); return; }
    try {
      const snoozedTime = new Date(Date.now() + 5 * 60 * 1000);
      if (isRecurring) {
        await updateDoc(doc(db, 'reminders', workout.id), {
          nextTriggerAt: Timestamp.fromDate(snoozedTime),
          updatedAt: serverTimestamp(),
        });
        console.log('[Reminder] recurring snoozed', { id: workout.id, snoozedTo: snoozedTime.toISOString() });
      } else {
        // Push workout to snoozed time; clear both dedup flags so both triggers
        // can re-evaluate at the new time. Set reminderScheduledFor = snoozedTime
        // so early-reminder check stays accurate (no lead on a snoozed workout).
        await updateDoc(doc(db, 'scheduledWorkouts', workout.id), {
          scheduledAt: Timestamp.fromDate(snoozedTime),
          scheduledFor: Timestamp.fromDate(snoozedTime),
          reminderScheduledFor: Timestamp.fromDate(snoozedTime),
          reminderSent: false,
          startPopupShown: false,
          status: 'scheduled',
          notificationSent: false,
          updatedAt: serverTimestamp(),
        });
        console.log('[Reminder] scheduled snoozed', { id: workout.id, snoozedTo: snoozedTime.toISOString() });
      }
    } catch (err) {
      console.error('[WorkoutReminderModal] Failed to snooze:', err);
    }
    onDismiss();
  };

  const handleDismiss = async () => {
    if (!canDismiss) return;
    // Daily reminders are purely in-memory — just close
    if (isDailyReminder) { onDismiss(); return; }
    try {
      if (isRecurring) {
        await updateDoc(doc(db, 'reminders', workout?.id || ''), {
          updatedAt: serverTimestamp(),
        });
      } else {
        // For early reminder dismiss: just mark reminderSent so it doesn't re-fire,
        // but keep status='scheduled' so the exact-start popup still fires at workout time.
        // For start-time dismiss: mark fully triggered.
        if (isStartTime) {
          await updateDoc(doc(db, 'scheduledWorkouts', workout?.id || ''), {
            status: 'dismissed',
            startPopupShown: true,
            reminderSent: true,
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(doc(db, 'scheduledWorkouts', workout?.id || ''), {
            reminderSent: true,
            updatedAt: serverTimestamp(),
          });
        }
      }
    } catch (err) {
      console.error('[WorkoutReminderModal] Failed to dismiss:', err);
    }
    onDismiss();
  };

  const workoutName = workout?.videoTitle || workout?.workoutName || 'Workout';
  const scheduledAtDate =
    (workout?.scheduledAt as any)?.toDate?.() ||
    (workout?.scheduledAt instanceof Date ? workout.scheduledAt : null);
  const scheduledForDate =
    (workout?.scheduledFor as any)?.toDate?.() ||
    (workout?.scheduledFor instanceof Date ? workout.scheduledFor : null);
  const scheduledTime = scheduledAtDate ?? scheduledForDate ?? new Date();
  const timeStr = scheduledTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const subtitleText = isDailyReminder
    ? 'Time to work out!'
    : isStartTime
      ? 'Workout starts now!'
      : `Reminder: starts at ${timeStr}`;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <SafeAreaView style={s.overlay}>
        <View style={s.backdrop} />

        <View style={s.card}>
          {canDismiss && (
            <TouchableOpacity style={s.closeBtn} onPress={handleDismiss}>
              <X color="#666" size={24} />
            </TouchableOpacity>
          )}

          {workout?.thumbnail ? (
            <Image
              source={{ uri: workout.thumbnail }}
              style={s.thumbnail}
              resizeMode="cover"
            />
          ) : (
            <View style={[s.thumbnail, { backgroundColor: '#222' }]} />
          )}

          <View style={s.content}>
            <Text style={s.title}>{workoutName}</Text>
            <Text style={[s.subtitleText, isStartTime && s.subtitleNow]}>
              {subtitleText}
            </Text>
            {!!workout?.recurrenceLabel && (
              <Text style={s.recurringInfo}>{workout.recurrenceLabel}</Text>
            )}

            <View style={s.countdownContainer}>
              <Text style={s.countdownLabel}>
                {canDismiss ? 'Alarm active' : 'Dismiss available in'}
              </Text>
              <Text style={s.countdown}>{canDismiss ? 'Now' : `${countdownSeconds}s`}</Text>
            </View>

            <View style={s.buttonsContainer}>
              <TouchableOpacity
                style={s.startBtn}
                onPress={handleStartNow}
                activeOpacity={0.8}
              >
                <Text style={s.startBtnText}>{isDailyReminder ? 'LET\'S GO!' : 'START WORKOUT'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.snoozeBtn}
                onPress={handleSnooze}
                activeOpacity={0.8}
              >
                <Text style={s.snoozeBtnText}>SNOOZE 5 MIN</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.dismissBtnLarge, !canDismiss && s.dismissBtnDisabled]}
                onPress={handleDismiss}
                activeOpacity={canDismiss ? 0.8 : 1}
                disabled={!canDismiss}
              >
                <Text style={s.dismissBtnLargeText}>
                  {canDismiss ? 'DISMISS' : `DISMISS IN ${countdownSeconds}s`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: Math.min(width - 32, 400),
    borderRadius: 16,
    backgroundColor: '#1a1a1a',
    overflow: 'hidden',
    paddingBottom: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
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
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  subtitleText: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
  },
  subtitleNow: {
    color: ACCENT,
    fontWeight: '600',
    fontSize: 15,
  },
  recurringInfo: {
    fontSize: 12,
    color: '#f59e0b',
    marginBottom: 16,
  },
  countdownContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${ACCENT}20`,
  },
  countdownLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  countdown: {
    fontSize: 36,
    fontWeight: '800',
    color: ACCENT,
  },
  buttonsContainer: {
    gap: 12,
    marginTop: 14,
  },
  startBtn: {
    backgroundColor: ACCENT,
    paddingVertical: 14,
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
  snoozeBtn: {
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: `${ACCENT}40`,
  },
  snoozeBtnText: {
    color: ACCENT,
    fontSize: 16,
    fontWeight: '600',
  },
  dismissBtnLarge: {
    backgroundColor: '#2a2a2a',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#555',
  },
  dismissBtnDisabled: {
    opacity: 0.55,
  },
  dismissBtnLargeText: {
    color: '#ddd',
    fontSize: 14,
    fontWeight: '600',
  },
});
