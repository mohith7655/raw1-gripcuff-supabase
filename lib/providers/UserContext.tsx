import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../core/config/supabase';
import { UserService } from '../services/user.service';
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

  // Track in-flight fetch and last fetch time to prevent concurrent/rapid duplicate calls
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
    UserService.getProfile(uid)
      .then((data) => {
        if (!cancelled) {
          setProfile(data);
          lastFetchRef.current = Date.now();
        }
      })
      .catch((err) => {
        console.warn('[UserContext] initial profile load failed:', err);
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
            console.log('[UserContext] realtime refresh skipped — cooldown');
            return;
          }
          lastRealtimeFetchRef.current = now;
          try {
            const latest = await UserService.getProfile(uid);
            if (!cancelled) {
              console.log('[UserContext] realtime profile refresh');
              setProfile(latest);
              lastFetchRef.current = Date.now();
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
  // Guards: concurrent-call ref + 3-second cooldown between calls.
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
    lastFetchRef.current = now;
    try {
      setError(null);
      const data = await UserService.getProfile(uid);
      setProfile(data);
    } catch (err) {
      const errorMessage = (err as Error).message;
      setError(errorMessage);
      console.warn('[UserContext] fetchProfile failed:', errorMessage);
    } finally {
      fetchingRef.current = false;
    }
  }, []); // no deps — uid is passed as argument

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
      value={{ profile, loading, error, appMode, setAppMode, fetchProfile, updateProfile, clearProfile, clearError }}
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
