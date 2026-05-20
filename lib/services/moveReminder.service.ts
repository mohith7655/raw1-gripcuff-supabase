export interface MoveReminder {
    id?: string;
    userId: string;
    enabled: boolean;
    title: string;
    startTime: string;         // HH:MM 24-hour local
    endTime: string;           // HH:MM 24-hour local
    intervalMinutes: number;
    workoutDurationMin: number;
    generatedTimes: string[];  // HH:MM 24-hour local
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
    const intervalMins = intervalMinutes;

    if (endTotal <= startTotal) return [];

    const times: string[] = [];
    let current = startTotal;
    while (current <= endTotal) {
        const notifyMins = current - minutesBefore;
        if (notifyMins >= 0) {
            const h = Math.floor(notifyMins / 60);
            const m = notifyMins % 60;
            times.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        }
        current += intervalMins;
    }
    return times;
}

export function formatMoveTime12h(time24: string): string {
    const [h, m] = time24.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export const MoveReminderService = {
    async loadAll(uid: string): Promise<MoveReminder[]> {
        return [];
    },

    async loadDefault(uid: string): Promise<MoveReminder | null> {
        return null;
    },

    async save(uid: string, reminder: MoveReminder): Promise<MoveReminder> {
        const { id, ...data } = reminder;
        const times = generateMoveTimes(data.startTime, data.endTime, data.intervalMinutes);
        return { ...reminder, generatedTimes: times };
    },

    async delete(uid: string, id: string): Promise<void> {},
};

/** One-time migration stub */
export async function migrateLegacyReminders(uid: string): Promise<void> {}
