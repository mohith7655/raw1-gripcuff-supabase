import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../core/config/supabase';
import { UserService } from '../services/user.service';
import { WatchTrackingService } from '../services/watchTracking.service';
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
  const lastRealtimeFetchRef = useRef(0);

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
        async () => {
          if (cancelled) return;
          const now = Date.now();
          // Debounce: ignore realtime bursts within 5 seconds
          if (now - lastRealtimeFetchRef.current < 5000) {
            console.log('[Realtime] existing subscription reused — cooldown');
            return;
          }
          lastRealtimeFetchRef.current = now;
          const realtimeStartedAt = Date.now();
          lastFetchStartRef.current = realtimeStartedAt;
          try {
            const latest = await UserService.getProfile(uid);
            if (!cancelled && realtimeStartedAt >= lastFetchStartRef.current) {
              console.log('[Profile] realtime patch applied');
              setProfile({
                ...latest,
                watchedSeconds: Number(latest.watchedSeconds || 0),
                todayWatchSeconds: Number(latest.todayWatchSeconds || 0),
              });
              lastFetchRef.current = Date.now();
            } else if (!cancelled) {
              console.log('[Profile] stale fetch ignored');
            }
          } catch (err) {
            console.warn('[UserContext] realtime profile refresh failed:', err);
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabaseUserId]);

  // Stable background refresh — never shows the loading spinner (spinner is for initial load only).
  // Guards: concurrent-call ref + 3-second cooldown + stale-fetch discard.
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

  // Optimistic patch — called by WatchTrackingService after a successful flush
  // so the UI updates instantly without waiting for the next realtime event.
  const patchWatchTime = useCallback((addSeconds: number) => {
    lastFetchStartRef.current = Date.now(); // mark as "latest update" to suppress stale fetches
    setProfile(prev => {
      if (!prev) return prev;
      const newWatchedSeconds = (prev.watchedSeconds ?? 0) + addSeconds;
      const newTodaySeconds = (prev.todayWatchSeconds ?? 0) + addSeconds;
      console.log('[Profile] realtime patch applied', { addSeconds, newWatchedSeconds });
      return {
        ...prev,
        watchedSeconds: newWatchedSeconds,
        watchedMinutes: Math.floor(newWatchedSeconds / 60),
        todayWatchSeconds: newTodaySeconds,
      };
    });
  }, []);

  // Wire patchWatchTime into WatchTrackingService so flushes update UI instantly.
  useEffect(() => {
    WatchTrackingService.setOnFlush(patchWatchTime);
    return () => { WatchTrackingService.setOnFlush(null); };
  }, [patchWatchTime]);

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
