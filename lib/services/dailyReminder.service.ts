import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../core/config/firebase';

export type DailyReminderSettings = {
    enabled: boolean;
    startHour: number;       // 1–12
    startMinute: number;     // 0–59
    amPm: 'AM' | 'PM';
    remindersPerDay: number; // 1,2,3,4,5,6,8,10
    intervalMinutes: number; // 15,30,45,60,120,180,240
    generatedReminderTimes: string[]; // HH:MM (24-hour local)
    timezone: string;
};

export const DEFAULT_REMINDER_SETTINGS: DailyReminderSettings = {
    enabled: false,
    startHour: 7,
    startMinute: 0,
    amPm: 'AM',
    remindersPerDay: 3,
    intervalMinutes: 60,
    generatedReminderTimes: [],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};

export function generateReminderTimes(
    startHour: number,
    startMinute: number,
    amPm: 'AM' | 'PM',
    remindersPerDay: number,
    intervalMinutes: number
): string[] {
    // Convert to 24-hour
    let h24 = startHour % 12;
    if (amPm === 'PM') h24 += 12;

    const totalMinutesStart = h24 * 60 + startMinute;
    const times: string[] = [];

    for (let i = 0; i < remindersPerDay; i++) {
        const totalMin = totalMinutesStart + i * intervalMinutes;
        const clampedMin = totalMin % (24 * 60); // wrap at midnight
        const hh = Math.floor(clampedMin / 60);
        const mm = clampedMin % 60;
        times.push(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
    }

    console.log('[DailyReminder] generateReminderTimes', {
        startHour,
        startMinute,
        amPm,
        remindersPerDay,
        intervalMinutes,
        generated: times,
    });

    return times;
}

export function format12h(time24: string): string {
    const [h, m] = time24.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

const settingsRef = (uid: string) => doc(db, 'users', uid, 'settings', 'dailyReminder');

export const DailyReminderService = {
    async load(uid: string): Promise<DailyReminderSettings> {
        const snap = await getDoc(settingsRef(uid));
        if (!snap.exists()) return { ...DEFAULT_REMINDER_SETTINGS };
        return { ...DEFAULT_REMINDER_SETTINGS, ...(snap.data() as Partial<DailyReminderSettings>) };
    },

    async save(uid: string, settings: DailyReminderSettings): Promise<void> {
        const times = generateReminderTimes(
            settings.startHour,
            settings.startMinute,
            settings.amPm,
            settings.remindersPerDay,
            settings.intervalMinutes
        );
        const payload: DailyReminderSettings = {
            ...settings,
            generatedReminderTimes: times,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
        await setDoc(settingsRef(uid), { ...payload, updatedAt: serverTimestamp() }, { merge: true });
        console.log('[DailyReminder] saved settings', payload);
    },
};
