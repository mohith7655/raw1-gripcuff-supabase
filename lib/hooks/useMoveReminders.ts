import { useState, useEffect, useCallback } from 'react';
import { MoveReminder, MoveReminderService } from '../services/moveReminder.service';

export function useMoveReminders(userId?: string) {
    const [reminders, setReminders] = useState<MoveReminder[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        if (!userId) { setLoading(false); return; }
        try {
            const data = await MoveReminderService.loadAll(userId);
            setReminders(data);
        } catch (e) {
            console.warn('[useMoveReminders] load failed:', e);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => { load(); }, [load]);

    const save = useCallback(async (reminder: MoveReminder): Promise<MoveReminder> => {
        if (!userId) throw new Error('No userId');
        const saved = await MoveReminderService.save(userId, reminder);
        setReminders(prev => {
            const idx = prev.findIndex(r => r.id === saved.id);
            if (idx >= 0) {
                const next = [...prev];
                next[idx] = saved;
                return next;
            }
            return [...prev, saved];
        });
        return saved;
    }, [userId]);

    const remove = useCallback(async (id: string) => {
        if (!userId) return;
        await MoveReminderService.delete(userId, id);
        setReminders(prev => prev.filter(r => r.id !== id));
    }, [userId]);

    return { reminders, loading, save, remove, reload: load };
}
