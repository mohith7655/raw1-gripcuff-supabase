import { useState, useEffect, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { collection, query, where, Timestamp, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../core/config/firebase';
import { useAuth } from '../providers/AuthContext';

export interface ReminderBannerState {
    visible: boolean;
    videoId: string;
    videoTitle: string;
    countdown: string;
}

const EMPTY: ReminderBannerState = {
    visible: false,
    videoId: '',
    videoTitle: '',
    countdown: '',
};

function playReminderSound() {
    try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();

        const playTone = (freq: number, startTime: number, duration: number) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, startTime);
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.45, startTime + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
            osc.start(startTime);
            osc.stop(startTime + duration);
        };

        const t = ctx.currentTime;
        // C-E-G major chime, played twice
        playTone(523.25, t,        0.45);
        playTone(659.25, t + 0.18, 0.45);
        playTone(783.99, t + 0.36, 0.70);
        playTone(523.25, t + 1.0,  0.45);
        playTone(659.25, t + 1.18, 0.45);
        playTone(783.99, t + 1.36, 0.70);
    } catch (e) {
        console.warn('[ReminderSound] Web Audio API error:', e);
    }
}

export function useWorkoutReminders() {
    const [banner, setBanner] = useState<ReminderBannerState>(EMPTY);
    const { firebaseUser } = useAuth();

    // Native: listen for foreground expo-notifications
    useEffect(() => {
        if (Platform.OS === 'web') return;

        const sub = Notifications.addNotificationReceivedListener((notification) => {
            const data = notification.request.content.data as Record<string, any> | null;
            if (!data || data.type !== 'workout_reminder') return;
            console.log('[Reminder] reminder triggered', data);

            const body = notification.request.content.body ?? '';
            const dashIdx = body.indexOf(' — ');
            const title = dashIdx > -1 ? body.slice(0, dashIdx) : (data.videoTitle as string) ?? '';
            const countdown = dashIdx > -1 ? body.slice(dashIdx + 3) : '';

            setBanner({
                visible: true,
                videoId: (data.videoId as string) ?? '',
                videoTitle: title || ((data.videoTitle as string) ?? ''),
                countdown,
            });
        });

        return () => sub.remove();
    }, []);

    // Web: exact-time timeouts + 30-second poll fallback
    useEffect(() => {
        if (Platform.OS !== 'web') return;
        const uid = firebaseUser?.uid;
        if (!uid) return;

        const exactTimers: ReturnType<typeof setTimeout>[] = [];

        const fireBanner = (videoId: string, videoTitle: string) => {
            playReminderSound();
            setBanner({
                visible: true,
                videoId,
                videoTitle,
                countdown: "It's time to work out!",
            });
        };

        // Mark a list of scheduledWorkout docs as completed and show the banner
        const triggerDue = async (docIds: string[], videoId: string, videoTitle: string) => {
            try {
                const batch = writeBatch(db);
                docIds.forEach(id => {
                    batch.update(doc(db, 'scheduledWorkouts', id), {
                        status: 'triggered',
                        notificationSent: true,
                        updatedAt: Timestamp.now(),
                    });
                });
                await batch.commit();
                console.log('[Reminder] reminder triggered', { ids: docIds, title: videoTitle });
            } catch (err) {
                console.warn('[useWorkoutReminders] batch update failed:', err);
            }
            fireBanner(videoId, videoTitle);
        };

        // Check for already-due reminders (tab was closed during the scheduled time)
        const checkDue = async () => {
            try {
                const q = query(
                    collection(db, 'scheduledWorkouts'),
                    where('userId',       '==', uid),
                    where('status', 'in', ['scheduled', 'active']),
                );
                const snap = await getDocs(q);
                if (snap.empty) return;
                const dueDocs = snap.docs.filter((d) => {
                    const x: any = d.data();
                    const due =
                        x.scheduledAt?.toDate?.() ||
                        x.scheduledFor?.toDate?.() ||
                        x.triggerTime?.toDate?.() ||
                        x.reminderTime?.toDate?.();
                    return !!due && due.getTime() <= Date.now();
                });
                if (!dueDocs.length) return;

                const first = dueDocs[0].data() as any;
                await triggerDue(
                    dueDocs.map(d => d.id),
                    first.videoId ?? '',
                    first.videoTitle ?? first.workoutName ?? 'Workout',
                );
            } catch (err) {
                console.warn('[useWorkoutReminders] poll failed:', err);
            }
        };

        // Schedule precise timeouts for future reminders
        const scheduleExact = async () => {
            try {
                const q = query(
                    collection(db, 'scheduledWorkouts'),
                    where('userId',       '==', uid),
                    where('status', 'in', ['scheduled', 'active']),
                );
                const snap = await getDocs(q);
                snap.docs.forEach(d => {
                    const data = d.data();
                    const fireAt: Timestamp = data.scheduledAt ?? data.scheduledFor ?? data.triggerTime ?? data.reminderTime;
                    if (!fireAt) return;
                    const msFromNow = fireAt.toMillis() - Date.now();
                    if (msFromNow <= 0) return; // will be caught by checkDue
                    const timer = setTimeout(() => {
                        triggerDue(
                            [d.id],
                            data.videoId ?? '',
                            data.videoTitle ?? data.workoutName ?? 'Workout',
                        );
                    }, msFromNow);
                    exactTimers.push(timer);
                    console.log(`[useWorkoutReminders] Exact timer set for ${new Date(fireAt.toMillis()).toLocaleTimeString()} (${Math.round(msFromNow / 1000)}s)`);
                });
            } catch (err) {
                console.warn('[useWorkoutReminders] scheduleExact failed:', err);
            }
        };

        // Run both on mount
        checkDue();
        scheduleExact();

        // 30-second poll as fallback (catches reminders scheduled while the page was open
        // but whose exact timeout may have been missed due to tab throttling)
        const interval = window.setInterval(checkDue, 30_000);

        return () => {
            window.clearInterval(interval);
            exactTimers.forEach(t => clearTimeout(t));
        };
    }, [firebaseUser?.uid]);

    const dismiss = useCallback(() => {
        setBanner(prev => ({ ...prev, visible: false }));
    }, []);

    return { banner, dismiss };
}
