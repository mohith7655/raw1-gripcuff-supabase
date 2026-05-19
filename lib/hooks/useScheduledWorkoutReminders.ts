import { useEffect, useState, useRef, useCallback } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../core/config/firebase';
import type { ScheduledWorkout } from '../services/workoutReminder.service';

export interface ReminderModalState {
  visible: boolean;
  workout: ScheduledWorkout | null;
}

/**
 * Hook that polls for scheduled workouts and manages reminder modal state.
 * Returns the modal state and a function to close the modal.
 */
export function useScheduledWorkoutReminders(uid: string | null | undefined) {
  const [modalState, setModalState] = useState<ReminderModalState>({
    visible: false,
    workout: null,
  });

  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const processedDocsRef = useRef<Set<string>>(new Set());

  const checkReminders = useCallback(async () => {
    if (!uid) return;

    try {
      const now = new Date();
      const q = query(
        collection(db, 'scheduledWorkouts'),
        where('userId', '==', uid),
        where('status', 'in', ['scheduled', 'active']),
      );

      const snap = await getDocs(q);

      if (snap.empty) return;

      // Process each matching doc
      for (const docSnap of snap.docs) {
        // Skip if we've already processed this one in this session
        if (processedDocsRef.current.has(docSnap.id)) continue;

        const data = docSnap.data() as ScheduledWorkout;
        const dueAt =
          (data as any).scheduledAt?.toDate?.() ||
          (data as any).scheduledFor?.toDate?.() ||
          (data as any).triggerTime?.toDate?.() ||
          (data as any).reminderTime?.toDate?.() ||
          null;
        if (!dueAt || dueAt.getTime() > now.getTime()) continue;
        processedDocsRef.current.add(docSnap.id);

        // Mark as notified immediately to prevent duplicate triggers
        try {
          await updateDoc(docSnap.ref, {
            status: 'triggered',
            notificationSent: true,
            notifiedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          console.warn('[useScheduledWorkoutReminders] Failed to update status:', err);
        }

        // Show the modal for this workout
        console.log('[Reminder] reminder triggered', { id: docSnap.id, title: data.workoutName });
        console.log('[Reminder] reminder matched', { id: docSnap.id, dueAt: dueAt.toISOString() });
        setModalState({
          visible: true,
          workout: { ...data, id: docSnap.id, scheduledFor: (data as any).scheduledAt ?? (data as any).scheduledFor },
        });

        // Only show one at a time — the user must dismiss/snooze before the next fires
        break;
      }
    } catch (err: any) {
      if (err?.code !== 'permission-denied') {
        console.warn('[useScheduledWorkoutReminders] Poll failed:', err);
      }
    }
  }, [uid]);

  const closeModal = useCallback(() => {
    setModalState({ visible: false, workout: null });
  }, []);

  // Start polling when uid is available
  useEffect(() => {
    if (!uid) return;
    console.log('[Reminder] reminder listener started', { uid });

    // Check immediately on mount
    checkReminders();

    // Set up polling interval (every 30 seconds)
    pollingIntervalRef.current = setInterval(checkReminders, 30000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [uid, checkReminders]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleForegroundReminder = (event: Event) => {
      const detail = (event as CustomEvent<any>).detail || {};
      const workoutId = detail.workoutId || '';
      const scheduleId = detail.scheduleId || '';
      setModalState({
        visible: true,
        workout: {
          id: scheduleId,
          userId: uid || '',
          workoutId,
          workoutName: detail.workoutName || detail.videoTitle || 'Workout',
          videoId: detail.videoId || workoutId,
          videoTitle: detail.videoTitle || detail.workoutName || 'Workout',
          category: null,
          programName: null,
          thumbnail: null,
          scheduledFor: Timestamp.now(),
          reminderInterval: { value: 10, unit: 'minutes' },
          status: 'scheduled',
          notificationIds: [],
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
      });
      console.log('[Reminder] foreground popup opened', { scheduleId, workoutId });
    };
    window.addEventListener('raw1:foreground-reminder', handleForegroundReminder as EventListener);
    return () => window.removeEventListener('raw1:foreground-reminder', handleForegroundReminder as EventListener);
  }, [uid]);

  return {
    modalState,
    closeModal,
  };
}
