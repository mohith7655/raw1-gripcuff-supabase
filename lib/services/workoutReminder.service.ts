import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// ── Types ─────────────────────────────────────────────────────

export interface ReminderInterval {
    value: number;   // e.g. 30
    unit: 'minutes' | 'hours';
}

export interface ScheduledWorkout {
    id: string;
    userId: string;
    username?: string;
    profileImage?: string | null;
    workoutTitle?: string | null;
    categoryId?: string | null;
    categoryTitle?: string | null;
    programId?: string | null;
    programTitle?: string | null;
    workoutId: string;
    workoutName: string;
    videoId?: string;
    videoTitle?: string;
    combinedTitle?: string | null;
    category: string | null;
    programName: string | null;
    isPublic?: boolean;
    thumbnail: string | null;
    scheduledAt?: Date;
    scheduledFor: Date;
    reminderScheduledFor?: Date;
    reminderInterval: ReminderInterval;
    status: 'scheduled' | 'triggered' | 'active' | 'dismissed' | 'completed' | 'expired';
    notificationIds: string[];
    createdAt: Date;
    updatedAt: Date;
}

/** Legacy alias kept so callers importing WorkoutReminder still compile. */
export type WorkoutReminder = ScheduledWorkout;

export const REMINDER_PRESETS: { label: string; minutes: number }[] = [
    { label: 'Every 15 min',  minutes: 15  },
    { label: 'Every 30 min',  minutes: 30  },
    { label: 'Every 1 hour',  minutes: 60  },
    { label: 'Every 2 hours', minutes: 120 },
];

// ── Helpers ───────────────────────────────────────────────────

/** Convert flat minutes to { value, unit } — prefer hours when evenly divisible. */
function toIntervalShape(totalMinutes: number): ReminderInterval {
    if (totalMinutes >= 60 && totalMinutes % 60 === 0) {
        return { value: totalMinutes / 60, unit: 'hours' };
    }
    return { value: totalMinutes, unit: 'minutes' };
}

/** Convert { value, unit } back to flat minutes for notification math. */
export function intervalToMinutes(interval: ReminderInterval): number {
    return interval.unit === 'hours' ? interval.value * 60 : interval.value;
}

// ── Service ───────────────────────────────────────────────────

export class WorkoutReminderService {

    // ── Permissions ───────────────────────────────────────────

    static async requestPermissions(): Promise<boolean> {
        if (Platform.OS === 'web') return false;
        const { status: existing } = await Notifications.getPermissionsAsync();
        if (existing === 'granted') return true;
        const { status } = await Notifications.requestPermissionsAsync();
        return status === 'granted';
    }

    static async setupAndroidChannel(): Promise<void> {
        if (Platform.OS !== 'android') return;
        await Notifications.setNotificationChannelAsync('workout-reminders', {
            name: 'Workout Reminders',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 300, 150, 300],
            lightColor: '#FF6B00',
            sound: 'default',
        });
    }

    // ── Notification scheduling math ──────────────────────────

    static buildNotificationTimes(scheduledAt: Date, intervalMinutes: number): Date[] {
        const workoutMs = scheduledAt.getTime();
        const nowMs = Date.now();
        const intervalMs = intervalMinutes * 60 * 1000;
        const times = new Set<number>();

        // Up to 4× intervals before the workout
        for (let mult = 1; mult <= 4; mult++) {
            const t = workoutMs - intervalMs * mult;
            if (t > nowMs + 30_000) times.add(t);
        }

        // Half-interval escalation
        const halfStep = workoutMs - Math.floor(intervalMs / 2);
        if (halfStep > nowMs + 30_000 && halfStep < workoutMs) times.add(halfStep);

        // Guaranteed 5-min warning
        const fiveBefore = workoutMs - 5 * 60 * 1000;
        if (fiveBefore > nowMs + 30_000) times.add(fiveBefore);

        // Workout start time itself
        if (workoutMs > nowMs + 30_000) times.add(workoutMs);

        return Array.from(times).sort((a, b) => a - b).map(ms => new Date(ms));
    }

    static formatCountdown(fireAt: Date, workoutAt: Date): string {
        const ms = workoutAt.getTime() - fireAt.getTime();
        if (ms <= 0) return "It's time to work out!";
        const mins = Math.round(ms / 60_000);
        if (mins < 60) return `Starts in ${mins} min${mins === 1 ? '' : 's'}`;
        const hours = Math.round(ms / 3_600_000);
        return `Starts in ${hours} hour${hours === 1 ? '' : 's'}`;
    }

    // ── Duplicate check ───────────────────────────────────────

    /**
     * Returns true if the user already has an active reminder for the same
     * workoutId scheduled within ±2 hours of scheduledAt.
     * Firestore removed — always returns false (no persistence layer).
     */
    static async isDuplicate(_uid: string, _workoutId: string, _scheduledAt: Date): Promise<boolean> {
        return false;
    }

    // ── Schedule ──────────────────────────────────────────────

    static async scheduleReminder(params: {
        uid: string;
        username?: string | null;
        profileImage?: string | null;
        videoId: string;
        videoTitle: string;
        workoutId?: string | null;
        workoutTitle?: string | null;
        categoryId?: string | null;
        categoryTitle?: string | null;
        programId?: string | null;
        programTitle?: string | null;
        scheduledAt: Date;
        intervalMinutes: number;
        category?: string;
        programName?: string | null;
        thumbnail?: string;
    }): Promise<string> {
        const {
            uid, videoId, videoTitle, scheduledAt, intervalMinutes,
        } = params;

        console.log('[WorkoutReminderService] scheduleReminder called', {
            uid, videoId, videoTitle,
            scheduledAt: scheduledAt.toISOString(),
            intervalMinutes,
        });

        // Validate required fields
        if (!uid)       throw new Error('userId is required');
        if (!videoId)   throw new Error('workoutId is required');
        if (!videoTitle) throw new Error('workoutName is required');
        if (!intervalMinutes || intervalMinutes <= 0) throw new Error('intervalMinutes must be > 0');
        if (scheduledAt.getTime() <= Date.now()) throw new Error('scheduledAt must be in the future');

        // Schedule push notifications (native only)
        const notificationIds: string[] = [];
        if (Platform.OS !== 'web') {
            await WorkoutReminderService.setupAndroidChannel();
            const times = WorkoutReminderService.buildNotificationTimes(scheduledAt, intervalMinutes);
            for (const fireAt of times) {
                const secondsFromNow = Math.floor((fireAt.getTime() - Date.now()) / 1000);
                if (secondsFromNow < 1) continue;
                const body = `${videoTitle} — ${WorkoutReminderService.formatCountdown(fireAt, scheduledAt)}`;
                try {
                    const notifId = await Notifications.scheduleNotificationAsync({
                        content: {
                            title: '⏰  Workout Reminder',
                            body,
                            data: { videoId, videoTitle, type: 'workout_reminder' },
                            sound: true,
                            ...(Platform.OS === 'android' ? { channelId: 'workout-reminders' } : {}),
                        },
                        trigger: { seconds: secondsFromNow },
                    });
                    notificationIds.push(notifId);
                    console.log(`[WorkoutReminderService] Notification scheduled at ${fireAt.toISOString()} (id: ${notifId})`);
                    console.log('[Reminder] local notification scheduled', { id: notifId, fireAt: fireAt.toISOString() });
                } catch (err) {
                    console.warn('[WorkoutReminderService] Failed to schedule notification:', err);
                }
            }
        }

        // Firestore write removed — return a generated local id
        const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        console.log('[WorkoutReminderService] Reminder scheduled (local only):', localId);
        return localId;
    }

    // ── Cancel ────────────────────────────────────────────────

    static async cancelReminder(_reminderId: string, notificationIds: string[]): Promise<void> {
        if (Platform.OS !== 'web') {
            for (const id of notificationIds) {
                try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}
            }
        }
        // Firestore updateDoc removed
        console.log('[WorkoutReminderService] Cancelled reminder (local only)');
    }

    // ── Fetch user reminders ──────────────────────────────────

    static async getUserReminders(_uid: string): Promise<ScheduledWorkout[]> {
        // Firestore removed — no persistence layer
        return [];
    }

    // ── Expire stale reminders ────────────────────────────────

    /**
     * Marks any active reminders whose scheduledFor is in the past as 'expired'.
     * Firestore removed — no-op.
     */
    static async cleanupExpired(_uid: string): Promise<void> {
        // Firestore removed — no-op
    }

    // ── Recurring reminders ───────────────────────────────────

    /**
     * Schedule a recurring reminder that repeats every `intervalValue` `intervalUnit`.
     * Schedules local notifications only (Firestore persistence removed).
     */
    static async scheduleRecurringReminder(params: {
        uid: string;
        videoId: string;
        videoTitle: string;
        workoutId?: string | null;
        workoutTitle?: string | null;
        scheduledAt: Date; // first intended trigger time
        intervalValue: number;
        intervalUnit: 'minutes' | 'hours';
        recurrenceMode?: 'daily' | 'weekdays' | 'custom_interval';
        thumbnail?: string | null;
        category?: string | null;
        programName?: string | null;
    }): Promise<string> {
        const {
            uid, videoId, videoTitle, scheduledAt,
            intervalValue, intervalUnit,
        } = params;

        if (!uid) throw new Error('userId is required');
        if (!videoId) throw new Error('videoId is required');
        if (!videoTitle) throw new Error('videoTitle is required');
        if (intervalValue <= 0) throw new Error('intervalValue must be > 0');

        // Convert to minutes for math
        const intervalMinutes = intervalUnit === 'hours' ? intervalValue * 60 : intervalValue;

        // Compute first nextTriggerAt that is in the future
        let next = new Date(scheduledAt.getTime());
        const now = Date.now();
        while (next.getTime() <= now + 2000) {
            next = new Date(next.getTime() + intervalMinutes * 60_000);
        }

        // Limit ahead-scheduling window: schedule notifications for the next 24 hours (or cap)
        const scheduleWindowMs = 24 * 60 * 60 * 1000;
        const occurrences: Date[] = [];
        let cursor = new Date(next.getTime());
        while (cursor.getTime() <= Date.now() + scheduleWindowMs && occurrences.length < 96) {
            occurrences.push(new Date(cursor.getTime()));
            cursor = new Date(cursor.getTime() + intervalMinutes * 60_000);
        }

        const localId = `local_recurring_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        const notificationIds: string[] = [];
        if (Platform.OS !== 'web') {
            await WorkoutReminderService.setupAndroidChannel();
            for (const fireAt of occurrences) {
                const secondsFromNow = Math.floor((fireAt.getTime() - Date.now()) / 1000);
                if (secondsFromNow < 1) continue;
                const body = `${videoTitle} — Reminder`;
                try {
                    const notifId = await Notifications.scheduleNotificationAsync({
                        content: {
                            title: '⏰ Reminder',
                            body,
                            data: { type: 'recurring_reminder', reminderId: localId, videoId, videoTitle },
                            sound: true,
                            ...(Platform.OS === 'android' ? { channelId: 'workout-reminders' } : {}),
                        },
                        trigger: { seconds: secondsFromNow },
                    });
                    notificationIds.push(notifId);
                } catch (err) {
                    console.warn('[WorkoutReminderService] scheduleRecurringReminder: failed to schedule', err);
                }
            }
        }

        console.log('[Reminder] recurring reminder created (local only)', {
            reminderId: localId,
            userId: uid,
            type: 'recurring',
            nextTriggerAt: next.toISOString(),
        });

        return localId;
    }

    /**
     * Restore active recurring reminders for a user.
     * Firestore removed — no-op.
     */
    static async restoreRecurringReminders(_uid: string): Promise<void> {
        // Firestore removed — no-op
    }
}
