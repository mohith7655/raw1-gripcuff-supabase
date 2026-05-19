import { useRef, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../core/config/firebase';
import { useAuth } from '../providers/AuthContext';

export interface IntervalAlertConfig {
    enabled: boolean;
    intervalMinutes: number;
    message: string;
    totalMinutes: number;
}

export const INTERVAL_PRESETS = [1, 2, 5, 10];

export const MESSAGE_PRESETS = [
    'Next set! Keep going! 💪',
    'Stay strong! You\'ve got this! 🔥',
    'Keep pushing! Almost there! ⚡',
    'Great work! Stay focused! 🏋️',
];

export interface UseIntervalAlertsReturn {
    start: (
        config: IntervalAlertConfig,
        workoutName: string,
        scheduleId?: string | null,
    ) => Promise<string | null>;
    stop: (trackingId: string) => Promise<void>;
}

export function useIntervalAlerts(): UseIntervalAlertsReturn {
    const { requireFirebaseUid } = useAuth();
    const inAppTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const countRef = useRef(0);

    const start = useCallback(async (
        config: IntervalAlertConfig,
        workoutName: string,
        scheduleId?: string | null,
    ): Promise<string | null> => {
        if (!config.enabled) return null;

        // Clear any previous in-app interval
        if (inAppTimerRef.current !== null) {
            clearInterval(inAppTimerRef.current);
        }
        countRef.current = 0;

        const maxTicks = Math.floor(config.totalMinutes / config.intervalMinutes);

        inAppTimerRef.current = setInterval(() => {
            countRef.current += 1;
            if (countRef.current > maxTicks) {
                if (inAppTimerRef.current !== null) {
                    clearInterval(inAppTimerRef.current);
                    inAppTimerRef.current = null;
                }
                return;
            }
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('intervalAlert', {
                    detail: { message: config.message, workoutName, tick: countRef.current },
                }));
            }
        }, config.intervalMinutes * 60 * 1000);

        // Schedule background FCM notifications via Cloud Function
        try {
            const uid = requireFirebaseUid('useIntervalAlerts.start');

            const fns = getFunctions(app);
            const sendFn = httpsCallable<
                {
                    userId: string;
                    workoutName: string;
                    intervalMinutes: number;
                    totalMinutes: number;
                    message: string;
                    startTime: number;
                    scheduleId: string | null;
                },
                { trackingId: string; scheduled: number }
            >(fns, 'sendIntervalNotifications');

            const result = await sendFn({
                userId: uid,
                workoutName,
                intervalMinutes: config.intervalMinutes,
                totalMinutes: config.totalMinutes,
                message: config.message,
                startTime: Date.now(),
                scheduleId: scheduleId ?? null,
            });

            return result.data.trackingId;
        } catch (err) {
            console.warn('[useIntervalAlerts] FCM scheduling failed:', err);
            return null;
        }
    }, []);

    const stop = useCallback(async (trackingId: string): Promise<void> => {
        if (inAppTimerRef.current !== null) {
            clearInterval(inAppTimerRef.current);
            inAppTimerRef.current = null;
        }

        try {
            const fns = getFunctions(app);
            const cancelFn = httpsCallable<{ trackingId: string }, void>(
                fns,
                'cancelIntervalNotifications',
            );
            await cancelFn({ trackingId });
        } catch (err) {
            console.warn('[useIntervalAlerts] FCM cancel failed:', err);
        }
    }, []);

    return { start, stop };
}
