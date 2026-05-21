import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../core/config/supabase';
import { UserService } from '../services/user.service';
import { WatchTrackingService } from '../services/watchTracking.service';
import { DailyActivityService } from '../services/dailyActivity.service';
import { User } from '../models/User';
import { useAuth } from './AuthContext';

export type AppMode = 'ai' | 'coaching';

interface UserContextType {
  profile: User | null;
  loading: boolean;
  error: string | null;
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
  fetchProfile: (uid: string) => Promise<void>;
  updateProfile: (uid: string, data: Partial<User>) => Promise<void>;
  patchWatchTime: (addSeconds: number) => void;
  clearProfile: () => void;
  clearError: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appMode, setAppMode] = useState<AppMode>('ai');

  // Use supabaseUserId (not firebaseUser.uid) — the Supabase `users` table is
  // keyed by Supabase user ID, not Firebase UID.
  const { supabaseUserId } = useAuth();

  // Stale-fetch guard: the timestamp when the LATEST fetch STARTED.
  // Any fetch whose startedAt is earlier than this is discarded on completion.
  const lastFetchStartRef = useRef(0);
  // Rate-limit refs
  const fetchingRef = useRef(false);
  const lastFetchRef = useRef(0);
  // Debounce for realtime events (prevents processing bursts from a single DB write)
  const lastRealtimeRef = useRef(0);

  // Stable background refresh — never shows the loading spinner (spinner is for initial load only).
  // Guards: concurrent-call ref + 3-second cooldown + stale-fetch discard.
  // Declared before the boot useEffect so it can be referenced in the dependency array.
  const fetchProfile = useCallback(async (uid: string) => {
    const now = Date.now();
    if (fetchingRef.current) {
      console.log('[UserContext] fetchProfile skipped — already fetching');
      return;
    }
    if (now - lastFetchRef.current < 3000) {
      console.log('[UserContext] fetchProfile skipped — cooldown');
      return;
    }
    fetchingRef.current = true;
    const startedAt = Date.now();
    lastFetchStartRef.current = startedAt;
    lastFetchRef.current = startedAt;
    try {
      setError(null);
      const data = await UserService.getProfile(uid);
      if (startedAt >= lastFetchStartRef.current) {
        setProfile({
          ...data,
          watchedSeconds: Number(data.watchedSeconds || 0),
          todayWatchSeconds: Number(data.todayWatchSeconds || 0),
        });
        console.log('[Profile Read]', data.currentStreak ?? 0);
      } else {
        console.log('[Profile] stale fetch ignored');
      }
    } catch (err) {
      const errorMessage = (err as Error).message;
      // "User profile not found" is transient during bootstrap — don't surface as UI error
      if (errorMessage !== 'User profile not found') {
        setError(errorMessage);
      }
      console.warn('[UserContext] fetchProfile failed:', errorMessage);
    } finally {
      fetchingRef.current = false;
    }
  }, []); // no deps — uid is passed as argument, refs are stable

  useEffect(() => {
    if (!supabaseUserId) {
      setProfile(null);
      return;
    }

    const uid = supabaseUserId;
    let cancelled = false;

    setLoading(true);
    const startedAt = Date.now();
    lastFetchStartRef.current = startedAt;
    UserService.getProfile(uid)
      .then((data) => {
        if (!cancelled && startedAt >= lastFetchStartRef.current) {
          setProfile({
            ...data,
            watchedSeconds: Number(data.watchedSeconds || 0),
            todayWatchSeconds: Number(data.todayWatchSeconds || 0),
          });
          lastFetchRef.current = Date.now();
        }
        // Ensure today's activity row exists, recompute streak, then re-fetch profile
        // so the UI reflects the correct streak immediately after boot.
        // ensureTodayActivity creates today's row AND recalculates streak internally.
        DailyActivityService.ensureTodayActivity(uid)
          .then(() => {
            lastFetchRef.current = 0; // bypass cooldown — boot sequence needs fresh data
            return fetchProfile(uid);
          })
          .catch(() => {});
      })
      .catch((err) => {
        // Bootstrap is handled in AuthContext — a missing row here means bootstrap
        // is still in progress or failed. Leave profile null; do NOT retry.
        console.warn('[UserContext] initial profile load failed (bootstrap may be pending):', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const channel = supabase
      .channel(`user-profile-${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'users', filter: `id=eq.${uid}` },
        (payload: any) => {
          if (cancelled) return;
          const now = Date.now();
          // Debounce: 100ms — just enough to deduplicate duplicate Supabase events
          // for the same write. Must NOT be 2000ms — that blocks streak updates that
          // fire 0.5–1.5s after a watch-tracking flush.
          if (now - lastRealtimeRef.current < 100) return;
          lastRealtimeRef.current = now;

          const row = payload?.new;
          if (!row) return;

          // Update profile synchronously from the realtime payload — no network round-trip.
          // watchedSeconds / todayWatchSeconds are intentionally excluded here:
          // patchWatchTime() owns those fields via optimistic updates after each flush,
          // which prevents the race where a late realtime event overwrites the optimistic value.
          setProfile(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              currentStreak: Number(row.current_streak ?? prev.currentStreak ?? 0),
              bestStreak: Number(row.best_streak ?? prev.bestStreak ?? 0),
              lastWorkoutDate: row.last_workout_date ?? prev.lastWorkoutDate,
              credits: Number(row.credits ?? prev.credits ?? 0),
              completedWorkouts: Number(row.completed_workouts ?? prev.completedWorkouts ?? 0),
              weeklyActivity: row.weekly_activity != null
                ? (typeof row.weekly_activity === 'string'
                    ? JSON.parse(row.weekly_activity)
                    : row.weekly_activity)
                : prev.weeklyActivity,
            };
          });
          console.log('[Profile] realtime immutable update from DB');
        },
      )
      .subscribe();

    // Also listen to user_daily_activity so streak updates reflect immediately.
    const activityChannel = supabase
      .channel(`user-daily-activity-${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_daily_activity', filter: `user_id=eq.${uid}` },
        () => {
          if (cancelled) return;
          console.log('[Profile] user_daily_activity changed — scheduling refresh');
          lastFetchRef.current = 0;
          fetchProfile(uid).catch(() => {});
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      supabase.removeChannel(activityChannel);
    };
  }, [supabaseUserId, fetchProfile]);

  // Optimistic patch — called by WatchTrackingService after a successful flush
  // so the UI updates instantly. Always creates a new object reference (immutable update)
  // so React detects the state change in both dev and production builds.
  const patchWatchTime = useCallback((addSeconds: number) => {
    setProfile(prev => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        watchedSeconds: Number(prev.watchedSeconds || 0) + Number(addSeconds || 0),
        todayWatchSeconds: Number(prev.todayWatchSeconds || 0) + Number(addSeconds || 0),
        watchedMinutes: Math.floor(
          (Number(prev.watchedSeconds || 0) + Number(addSeconds || 0)) / 60
        ),
      };
      console.log('[Profile] realtime immutable update', updated.watchedSeconds);
      return updated;
    });
  }, []);

  // Wire patchWatchTime into WatchTrackingService so flushes update UI instantly.
  useEffect(() => {
    WatchTrackingService.setOnFlush(patchWatchTime);
    return () => { WatchTrackingService.setOnFlush(null); };
  }, [patchWatchTime]);

  // After streak is recalculated and written to DB, explicitly refetch profile so
  // Profile and Leaderboard see the updated current_streak / best_streak immediately.
  useEffect(() => {
    if (!supabaseUserId) return;
    const uid = supabaseUserId;
    WatchTrackingService.setOnStreakReady((readyUid) => {
      if (readyUid !== uid) return;
      fetchProfile(uid).then(() => {
        console.log('[Profile Read]', uid);
      }).catch(() => {});
    });
    return () => { WatchTrackingService.setOnStreakReady(null); };
  }, [supabaseUserId, fetchProfile]);

  const updateProfile = useCallback(async (uid: string, data: Partial<User>) => {
    try {
      setLoading(true);
      setError(null);
      await UserService.updateProfile(uid, data);
      const latest = await UserService.getProfile(uid);
      setProfile(latest);
    } catch (err) {
      const errorMessage = (err as Error).message;
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []); // no deps — uid/data are passed as arguments

  const clearProfile = useCallback(() => {
    setProfile(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <UserContext.Provider
      value={{ profile, loading, error, appMode, setAppMode, fetchProfile, updateProfile, patchWatchTime, clearProfile, clearError }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within UserProvider');
  return context;
}
