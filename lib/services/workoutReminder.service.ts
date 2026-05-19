import { db } from '../core/config/firebase';
import {
    collection,
    addDoc,
    doc,
    updateDoc,
    getDocs,
    query,
    where,
    Timestamp,
    writeBatch,
} from 'firebase/firestore';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// ── Firestore collection ──────────────────────────────────────
const COLLECTION = 'scheduledWorkouts';

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
    scheduledAt?: Timestamp;
    scheduledFor: Timestamp;
    reminderScheduledFor?: Timestamp;
    reminderInterval: ReminderInterval;
    status: 'scheduled' | 'triggered' | 'active' | 'dismissed' | 'completed' | 'expired';
    notificationIds: string[];
    createdAt: Timestamp;
    updatedAt: Timestamp;
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
     */
    static async isDuplicate(uid: string, workoutId: string, scheduledAt: Date): Promise<boolean> {
        try {
            const windowMs = 2 * 60 * 60 * 1000;
            const from = Timestamp.fromDate(new Date(scheduledAt.getTime() - windowMs));
            const to   = Timestamp.fromDate(new Date(scheduledAt.getTime() + windowMs));

            const q = query(
                collection(db, COLLECTION),
                where('userId',    '==', uid),
                where('workoutId', '==', workoutId),
                where('status',    'in', ['active', 'scheduled']),
                where('scheduledAt', '>=', from),
                where('scheduledAt', '<=', to),
            );
            const snap = await getDocs(q);
            return !snap.empty;
        } catch (err) {
            console.warn('[WorkoutReminderService] isDuplicate check failed:', err);
            return false;
        }
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
            uid, username, profileImage, videoId, videoTitle, workoutId, workoutTitle,
            categoryId, categoryTitle, programId, programTitle, scheduledAt,
            intervalMinutes, category, programName, thumbnail,
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

        // Duplicate guard
        const dup = await WorkoutReminderService.isDuplicate(uid, videoId, scheduledAt);
        if (dup) {
            console.warn('[WorkoutReminderService] Duplicate reminder detected — skipping');
            throw new Error('duplicate_reminder');
        }

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

        // Write to Firestore using the scheduledWorkouts schema
        const now = Timestamp.now();
        const resolvedWorkoutTitle = workoutTitle ?? '';
        const resolvedVideoTitle = videoTitle;
        // Build a human-readable combined title: "Upper Body Hypertrophy • Day 1"
        const combinedTitle = resolvedWorkoutTitle && resolvedWorkoutTitle !== resolvedVideoTitle
            ? `${resolvedWorkoutTitle} • ${resolvedVideoTitle}`
            : resolvedVideoTitle;
        const payload: Omit<ScheduledWorkout, 'id'> = {
            userId:          uid,
            username:        username ?? '',
            profileImage:    profileImage ?? null,
            workoutId:       workoutId ?? videoId,
            workoutName:     resolvedVideoTitle,
            workoutTitle:    resolvedWorkoutTitle,
            categoryId:      categoryId ?? null,
            categoryTitle:   categoryTitle ?? category ?? '',
            programId:       programId ?? null,
            programTitle:    programTitle ?? programName ?? '',
            videoId,
            videoTitle:      resolvedVideoTitle,
            combinedTitle,
            category:        category  ?? null,
            programName:     programName ?? null,
            isPublic:        true,
            scheduledAt:     Timestamp.fromDate(scheduledAt),
            thumbnail:       thumbnail ?? null,
            scheduledFor:    Timestamp.fromDate(scheduledAt),
            reminderScheduledFor: Timestamp.fromDate(new Date(scheduledAt.getTime() - intervalMinutes * 60 * 1000)),
            reminderInterval: toIntervalShape(intervalMinutes),
            status:          'scheduled',
            notificationIds,
            createdAt:       now,
            updatedAt:       now,
        };

        console.log('[WorkoutReminderService] Writing to Firestore:', JSON.stringify(payload, null, 2));

        const ref = await addDoc(collection(db, COLLECTION), payload);
        console.log('[WorkoutReminderService] Saved with id:', ref.id);
        console.log('[Reminder] reminder created', { reminderId: ref.id, userId: uid, workoutId: payload.workoutId });
        return ref.id;
    }

    // ── Cancel ────────────────────────────────────────────────

    static async cancelReminder(reminderId: string, notificationIds: string[]): Promise<void> {
        if (Platform.OS !== 'web') {
            for (const id of notificationIds) {
                try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}
            }
        }
        try {
            await updateDoc(doc(db, COLLECTION, reminderId), {
                status: 'dismissed',
                updatedAt: Timestamp.now(),
            });
            console.log('[WorkoutReminderService] Cancelled reminder:', reminderId);
        } catch (err) {
            console.warn('[WorkoutReminderService] cancelReminder updateDoc failed:', err);
        }
    }

    // ── Fetch user reminders ──────────────────────────────────

    static async getUserReminders(uid: string): Promise<ScheduledWorkout[]> {
        const q = query(
            collection(db, COLLECTION),
            where('userId', '==', uid),
            where('status', '==', 'active'),
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as ScheduledWorkout));
    }

    // ── Expire stale reminders ────────────────────────────────

    /**
     * Marks any active reminders whose scheduledFor is in the past as 'expired'.
     * Call this on app resume / foreground.
     */
    static async cleanupExpired(uid: string): Promise<void> {
        try {
            const q = query(
                collection(db, COLLECTION),
                where('userId', '==', uid),
                where('status', '==', 'scheduled'),
                where('scheduledAt', '<', Timestamp.now()),
            );
            const snap = await getDocs(q);
            if (snap.empty) return;

            const batch = writeBatch(db);
            snap.docs.forEach(d => {
                batch.update(d.ref, { status: 'expired', updatedAt: Timestamp.now() });
            });
            await batch.commit();
            console.log(`[WorkoutReminderService] Expired ${snap.size} stale reminder(s)`);
        } catch (err) {
            console.warn('[WorkoutReminderService] cleanupExpired failed:', err);
        }
    }

    // ── Recurring reminders (new collection: 'reminders') ─────────────────

    /**
     * Schedule a recurring reminder that repeats every `intervalValue` `intervalUnit`.
     * Persists a document in `reminders` and schedules a short window of local notifications
     * so reminders continue while the app may be backgrounded. The client restores and
     * refills the scheduled notifications on app start.
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
            uid, videoId, videoTitle, workoutId, workoutTitle, scheduledAt,
            intervalValue, intervalUnit, recurrenceMode, thumbnail, category, programName,
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

        // Persist an initial doc (no notification ids yet) so we can include the id in
        // the scheduled notification payloads. We'll update the doc after scheduling.
        const nowTs = Timestamp.now();
        const docRef = await addDoc(collection(db, 'reminders'), sanitize({
            userId: uid,
            videoId,
            videoTitle,
            workoutId: workoutId ?? null,
            workoutTitle: workoutTitle ?? null,
            thumbnail: thumbnail ?? null,
            category: category ?? null,
            programName: programName ?? null,
            reminderType: 'recurring',
            recurrence: {
                mode: recurrenceMode ?? 'custom_interval',
                intervalValue,
                intervalUnit,
            },
            intervalValue,
            intervalUnit,
            nextTriggerAt: Timestamp.fromDate(next),
            notificationIds: [],
            status: 'active',
            createdAt: nowTs,
            updatedAt: nowTs,
        }));

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
                            data: { type: 'recurring_reminder', reminderId: docRef.id, videoId, videoTitle },
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

        try {
            await updateDoc(doc(db, 'reminders', docRef.id), {
                notificationIds,
                updatedAt: Timestamp.now(),
            });
            console.log('[Reminder] reminder created', {
                reminderId: docRef.id,
                userId: uid,
                type: 'recurring',
                nextTriggerAt: next.toISOString(),
            });
        } catch (err) {
            console.warn('[WorkoutReminderService] scheduleRecurringReminder: updateDoc failed', err);
            if (Platform.OS !== 'web') {
                for (const id of notificationIds) {
                    try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}
                }
            }
            try { await updateDoc(doc(db, 'reminders', docRef.id), { status: 'error', updatedAt: Timestamp.now() }); } catch {}
        }

        return docRef.id;
    }

    /**
     * Restore active recurring reminders for a user: cancel stale device notifications
     * (using stored ids) and schedule a fresh window of upcoming notifications.
     */
    static async restoreRecurringReminders(uid: string): Promise<void> {
        try {
            const q = query(collection(db, 'reminders'), where('userId', '==', uid), where('status', '==', 'active'));
            const snap = await getDocs(q);
            if (snap.empty) return;

            for (const d of snap.docs) {
                const data = d.data() as any;
                const intervalValue: number = data.intervalValue;
                const intervalUnit: 'minutes' | 'hours' = data.intervalUnit;
                const nextTs: Timestamp = data.nextTriggerAt;
                const notificationIds: string[] = data.notificationIds ?? [];

                // Cancel previously scheduled notifications referenced by the doc
                if (Platform.OS !== 'web') {
                    for (const id of notificationIds) {
                        try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}
                    }
                }

                // Compute fresh upcoming occurrences (same logic as scheduleRecurringReminder)
                const intervalMinutes = intervalUnit === 'hours' ? intervalValue * 60 : intervalValue;
                let next = nextTs?.toDate ? nextTs.toDate() : new Date();
                while (next.getTime() <= Date.now() + 2000) {
                    next = new Date(next.getTime() + intervalMinutes * 60_000);
                }

                const occurrences: Date[] = [];
                const scheduleWindowMs = 24 * 60 * 60 * 1000;
                let cursor = new Date(next.getTime());
                while (cursor.getTime() <= Date.now() + scheduleWindowMs && occurrences.length < 96) {
                    occurrences.push(new Date(cursor.getTime()));
                    cursor = new Date(cursor.getTime() + intervalMinutes * 60_000);
                }

                const newNotifIds: string[] = [];
                if (Platform.OS !== 'web') {
                    await WorkoutReminderService.setupAndroidChannel();
                    for (const fireAt of occurrences) {
                        const secondsFromNow = Math.floor((fireAt.getTime() - Date.now()) / 1000);
                        if (secondsFromNow < 1) continue;
                        const body = `${data.videoTitle} — Reminder`;
                        try {
                            const notifId = await Notifications.scheduleNotificationAsync({
                                content: {
                                    title: '⏰ Reminder',
                                    body,
                                    data: { type: 'recurring_reminder', reminderId: d.id, videoId: data.videoId, videoTitle: data.videoTitle },
                                    sound: true,
                                    ...(Platform.OS === 'android' ? { channelId: 'workout-reminders' } : {}),
                                },
                                trigger: { seconds: secondsFromNow },
                            });
                            newNotifIds.push(notifId);
                        } catch (err) {
                            console.warn('[WorkoutReminderService] restoreRecurringReminders: schedule failed', err);
                        }
                    }
                }

                // Update Firestore document with refreshed notification ids and nextTriggerAt
                try {
                    await updateDoc(d.ref, {
                        notificationIds: newNotifIds,
                        nextTriggerAt: Timestamp.fromDate(next),
                        updatedAt: Timestamp.now(),
                    });
                    console.log('[Reminder] recurring reminder rescheduled', { reminderId: d.id, nextTriggerAt: next.toISOString() });
                } catch (err) {
                    console.warn('[WorkoutReminderService] restoreRecurringReminders: updateDoc failed', err);
                }
            }
        } catch (err: any) {
            // permission-denied just means the user has no reminders yet — not an error
            if (err?.code !== 'permission-denied') {
                console.warn('[WorkoutReminderService] restoreRecurringReminders failed:', err);
            }
        }
    }
}
