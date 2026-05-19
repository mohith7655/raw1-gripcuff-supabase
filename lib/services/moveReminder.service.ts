import {
    collection,
    doc,
    getDocs,
    setDoc,
    deleteDoc,
    addDoc,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from '../core/config/firebase';

export interface MoveReminder {
    id?: string;
    userId: string;
    enabled: boolean;
    title: string;
    startTime: string;         // HH:MM 24-hour local
    endTime: string;           // HH:MM 24-hour local
    intervalHours: 1 | 2;
    minutesBefore: 5 | 10 | 15 | 30;
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
    intervalHours: 2,
    minutesBefore: 10,
    generatedTimes: [],
    recurring: true,
};

export function generateMoveTimes(
    startTime: string,
    endTime: string,
    intervalHours: 1 | 2,
    minutesBefore = 0
): string[] {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;
    const intervalMins = intervalHours * 60;

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

const col = (uid: string) => collection(db, 'users', uid, 'moveReminders');

export const MoveReminderService = {
    async loadAll(uid: string): Promise<MoveReminder[]> {
        try {
            const snap = await getDocs(col(uid));
            return snap.docs.map(d => ({ id: d.id, ...d.data() } as MoveReminder));
        } catch {
            return [];
        }
    },

    async loadDefault(uid: string): Promise<MoveReminder | null> {
        const all = await MoveReminderService.loadAll(uid);
        return all[0] ?? null;
    },

    async save(uid: string, reminder: MoveReminder): Promise<MoveReminder> {
        const { id, ...data } = reminder;
        const times = generateMoveTimes(data.startTime, data.endTime, data.intervalHours, data.minutesBefore);
        const payload = {
            ...data,
            userId: uid,
            generatedTimes: times,
            updatedAt: serverTimestamp(),
        };

        if (id) {
            await setDoc(doc(db, 'users', uid, 'moveReminders', id), payload, { merge: true });
            return { ...reminder, id, generatedTimes: times };
        } else {
            const ref = await addDoc(col(uid), { ...payload, createdAt: serverTimestamp() });
            return { ...reminder, id: ref.id, generatedTimes: times };
        }
    },

    async delete(uid: string, id: string): Promise<void> {
        await deleteDoc(doc(db, 'users', uid, 'moveReminders', id));
    },
};

/** One-time migration: copy universalReminders → moveReminders, then delete old docs. */
export async function migrateLegacyReminders(uid: string): Promise<void> {
    try {
        const legacyRef = collection(db, 'users', uid, 'universalReminders');
        const legacySnap = await getDocs(legacyRef);
        if (legacySnap.empty) return;

        const newSnap = await getDocs(col(uid));
        if (newSnap.empty) {
            await Promise.all(
                legacySnap.docs.map(d =>
                    setDoc(doc(col(uid), d.id), d.data())
                )
            );
        }

        // Delete old docs regardless (already migrated or just copied)
        await Promise.all(
            legacySnap.docs.map(d =>
                deleteDoc(doc(db, 'users', uid, 'universalReminders', d.id))
            )
        );
    } catch {
        // Migration failure is non-fatal — old reminders simply stay in legacy collection
    }
}
