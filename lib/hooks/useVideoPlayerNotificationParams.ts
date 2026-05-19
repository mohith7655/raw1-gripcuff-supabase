import { useEffect, useState } from 'react';

export interface VideoPlayerParams {
  workoutId: string;
  scheduleId: string;
  fromNotification: boolean;
}

/**
 * Hook that reads URL search params for VideoPlayer navigation.
 * Returns null if not navigating to VideoPlayer, or the params object if yes.
 */
export function useVideoPlayerNotificationParams(): VideoPlayerParams | null {
  const [params, setParams] = useState<VideoPlayerParams | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.location) return;

    const searchParams = new URLSearchParams(window.location.search);
    const screen = searchParams.get('screen');

    if (screen === 'VideoPlayer') {
      const workoutId = searchParams.get('workoutId') || '';
      const scheduleId = searchParams.get('scheduleId') || '';
      const fromNotification = searchParams.get('fromNotification') === 'true';

      if (workoutId) {
        setParams({
          workoutId,
          scheduleId,
          fromNotification,
        });

        // Clear the URL params after reading
        // (so refresh doesn't re-trigger the modal)
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, []);

  return params;
}
