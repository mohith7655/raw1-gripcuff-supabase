import { supabase } from '../core/config/supabase';

export interface AlarmConfig {
    time: string;       // HH:MM 24h — the time this alarm fires
    enabled: boolean;   // individual on/off toggle
    label?: string;     // optional user-set label
}

export interface MoveReminder {
    id?: string;
    userId: string;
    enabled: boolean;
    title: string;
    startTime: string;          // HH:MM 24-hour local
    endTime: string;            // HH:MM 24-hour local
    intervalMinutes: number;
    workoutDurationMin: number;
    generatedTimes: string[];   // HH:MM 24-hour local — kept for watcher compat
    alarmConfigs: AlarmConfig[];// per-alarm settings (source of truth)
    recurring: boolean;
    createdAt?: any;
    updatedAt?: any;
}

export const DEFAULT_MOVE_REMINDER: Omit<MoveReminder, 'userId'> = {
    enabled: false,
    title: 'Reminder to Move',
    startTime: '08:00',
    endTime: '20:00',
    intervalMinutes: 60,
    workoutDurationMin: 1,
    generatedTimes: [],
    alarmConfigs: [],
    recurring: true,
};

export function generateMoveTimes(
    startTime: string,
    endTime: string,
    intervalMinutes: number,
    minutesBefore = 0
): string[] {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;

    if (endTotal <= startTotal) return [];

    const times: string[] = [];
    let current = startTotal + intervalMinutes; // first reminder fires after 1 interval
    while (current <= endTotal) {
        const notifyMins = current - minutesBefore;
        if (notifyMins >= 0) {
            const h = Math.floor(notifyMins / 60);
            const m = notifyMins % 60;
            times.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        }
        current += intervalMinutes;
    }
    return times;
}

export function formatMoveTime12h(time24: string): string {
    const [h, m] = time24.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Derive AlarmConfig[] from a plain string[] — all enabled by default. */
export function timesToAlarmConfigs(times: string[]): AlarmConfig[] {
    return times.map(t => ({ time: t, enabled: true }));
}

function rowToReminder(row: any): MoveReminder {
    const times: string[] = row.generated_times ?? [];
    const rawConfigs: AlarmConfig[] = row.alarm_configs ?? [];
    // If DB has no configs yet, derive from generated_times (all enabled)
    const alarmConfigs: AlarmConfig[] = rawConfigs.length
        ? rawConfigs
        : timesToAlarmConfigs(times);
    return {
        id: row.id,
        userId: row.user_id,
        enabled: row.enabled,
        title: row.title ?? 'Reminder to Move',
        startTime: row.start_time,
        endTime: row.end_time,
        intervalMinutes: row.interval_minutes,
        workoutDurationMin: row.workout_duration_min,
        generatedTimes: times,
        alarmConfigs,
        recurring: row.recurring,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export const MoveReminderService = {
    async loadAll(uid: string): Promise<MoveReminder[]> {
        const { data, error } = await supabase
            .from('move_reminders')
            .select('*')
            .eq('user_id', uid);
        if (error || !data) return [];
        return data.map(rowToReminder);
    },

    async loadDefault(uid: string): Promise<MoveReminder | null> {
        const { data, error } = await supabase
            .from('move_reminders')
            .select('*')
            .eq('user_id', uid)
            .maybeSingle();
        if (error || !data) return null;
        return rowToReminder(data);
    },

    async save(uid: string, reminder: MoveReminder): Promise<MoveReminder> {
        // Derive alarmConfigs: use provided if non-empty, else generate fresh
        const alarmConfigs: AlarmConfig[] = reminder.alarmConfigs?.length
            ? reminder.alarmConfigs
            : timesToAlarmConfigs(
                generateMoveTimes(reminder.startTime, reminder.endTime, reminder.intervalMinutes)
            );

        // generatedTimes = all times from alarmConfigs (including disabled — watcher filters)
        const generatedTimes = alarmConfigs.map(a => a.time);

        const payload = {
            user_id: uid,
            enabled: reminder.enabled,
            title: reminder.title,
            start_time: reminder.startTime,
            end_time: reminder.endTime,
            interval_minutes: reminder.intervalMinutes,
            workout_duration_min: reminder.workoutDurationMin,
            generated_times: generatedTimes,
            alarm_configs: alarmConfigs,
            recurring: reminder.recurring,
            updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
            .from('move_reminders')
            .upsert(payload, { onConflict: 'user_id' })
            .select()
            .single();

        if (error) throw error;
        return rowToReminder(data);
    },

    async delete(uid: string, id: string): Promise<void> {
        await supabase
            .from('move_reminders')
            .delete()
            .eq('id', id)
            .eq('user_id', uid);
    },
};

/** One-time migration stub */
export async function migrateLegacyReminders(uid: string): Promise<void> {}
