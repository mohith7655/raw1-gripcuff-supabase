import React, { createContext, useContext, useState, useEffect } from 'react';
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

  useEffect(() => {
    if (!supabaseUserId) {
      setProfile(null);
      return;
    }

    const uid = supabaseUserId;
    let cancelled = false;

    console.log('[UserContext] loading profile for supabaseUserId:', uid);
    setLoading(true);

    UserService.getProfile(uid)
      .then((data) => {
        if (!cancelled) {
          console.log('[UserContext] profile loaded', { uid });
          setProfile(data);
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
          try {
            const latest = await UserService.getProfile(uid);
            if (!cancelled) {
              console.log('[UserContext] realtime profile refresh', { uid });
              setProfile(latest);
            }
          } catch (err) {
            console.warn('[UserContext] realtime profile refresh failed:', err);
          }
        },
      )
      .subscribe((status) => {
        console.log('[UserContext] realtime status:', status);
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabaseUserId]);

  const fetchProfile = async (uid: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await UserService.getProfile(uid);
      setProfile(data);
    } catch (err) {
      const errorMessage = (err as Error).message;
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (uid: string, data: Partial<User>) => {
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
  };

  const clearProfile = () => {
    setProfile(null);
    setError(null);
  };

  const clearError = () => setError(null);

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
