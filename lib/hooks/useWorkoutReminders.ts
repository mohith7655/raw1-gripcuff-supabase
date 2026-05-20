import { useState, useEffect, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
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
    const { supabaseUserId } = useAuth();

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

    const dismiss = useCallback(() => {
        setBanner(prev => ({ ...prev, visible: false }));
    }, []);

    return { banner, dismiss };
}
