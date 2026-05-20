import { useEffect, useState, useRef, useCallback } from 'react';
import type { ScheduledWorkout } from '../services/workoutReminder.service';

export interface ReminderModalState {
  visible: boolean;
  workout: ScheduledWorkout | null;
}

/**
 * Hook that manages reminder modal state.
 * Returns the modal state and a function to close the modal.
 */
export function useScheduledWorkoutReminders(uid: string | null | undefined) {
  const [modalState, setModalState] = useState<ReminderModalState>({
    visible: false,
    workout: null,
  });

  const closeModal = useCallback(() => {
    setModalState({ visible: false, workout: null });
  }, []);

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
          scheduledFor: new Date(),
          reminderInterval: { value: 10, unit: 'minutes' },
          status: 'scheduled',
          notificationIds: [],
          createdAt: new Date(),
          updatedAt: new Date(),
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
