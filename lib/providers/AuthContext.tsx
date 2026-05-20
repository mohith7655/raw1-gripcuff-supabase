import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../core/config/supabase';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';
import { User } from '../models/User';

const TAG = '[Auth]';
const log = (msg: string, data?: object) =>
  console.log(`${TAG} ${msg}`, ...(data ? [data] : []));
const logWarn = (msg: string, data?: object) =>
  console.warn(`${TAG} ${msg}`, ...(data ? [data] : []));
const logError = (msg: string, err?: unknown) =>
  console.error(`${TAG} ${msg}`, err ?? '');

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  supabaseUserId: string | null;
  email: string | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  requireSupabaseUserId: (context: string) => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const signupInProgressRef = useRef(false);
  // Guards against duplicate profile loads when INITIAL_SESSION + getSession() both fire for same uid
  const lastLoadedUidRef = useRef<string | null>(null);

  const supabaseUserId = supabaseUser?.id ?? null;
  const email = supabaseUser?.email ?? null;

  // ─── Load profile (with auto-bootstrap for missing rows) ──────────────────
  const loadProfile = async (sbId: string, authEmail?: string | null): Promise<void> => {
    try {
      const profile = await UserService.getProfile(sbId);
      setUser(profile);
      log('profile: loaded', { uid: profile.uid });
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === 'User profile not found') {
        log('[Auth Bootstrap] creating missing profile', { sbId });
        const email = authEmail || '';
        const handle = email.split('@')[0] || 'user';
        const bootstrapUser: User = {
          uid: sbId,
          email,
          fullName: handle,
          username: handle,
          completedVideos: 0,
          totalVideos: 0,
          credits: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        try {
          await UserService.createProfile(sbId, bootstrapUser);
          log('[Auth Bootstrap] profile exists', { sbId });
          const created = await UserService.getProfile(sbId);
          setUser(created);
          log('[UserContext] bootstrap complete', { sbId });
        } catch (createErr) {
          logWarn('[Auth Bootstrap] bootstrap failed — using local fallback', { sbId });
          setUser(bootstrapUser);
        }
      } else {
        logWarn('profile: load failed', { sbId });
        setUser(null);
      }
    }
  };

  // ─── On auth session: apply state ─────────────────────────────────────────
  const applySession = async (nextSession: Session | null, eventType?: string): Promise<void> => {
    setSession(nextSession);
    setSupabaseUser(nextSession?.user ?? null);

    const sbId = nextSession?.user?.id ?? null;
    if (!sbId) {
      setUser(null);
      lastLoadedUidRef.current = null;
      return;
    }

    // Same uid already loaded (e.g. INITIAL_SESSION races with getSession() on web) — skip.
    if (lastLoadedUidRef.current === sbId) {
      log('[Auth] duplicate auth event ignored', { event: eventType, uid: sbId });
      return;
    }
    // Claim this uid immediately to block any concurrent applySession calls for same uid.
    lastLoadedUidRef.current = sbId;

    await loadProfile(sbId, nextSession?.user?.email);
  };

  // ─── Boot ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    log('boot: starting Supabase auth boot');

    supabase.auth.getSession().then(async ({ data }) => {
      const initSession = data.session ?? null;
      log('boot: initial session resolved', { userId: initSession?.user?.id ?? null });
      await applySession(initSession);
      setLoading(false);
      log('boot: complete');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      log(`supabase: onAuthStateChange`, { event: _event, userId: nextSession?.user?.id ?? null });
      // TOKEN_REFRESHED fires every ~1 hour — only sync the session token, no profile reload.
      if (_event === 'TOKEN_REFRESHED') {
        setSession(nextSession);
        return;
      }
      await applySession(nextSession, _event);
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Login ─────────────────────────────────────────────────────────────────
  const login = async (emailArg: string, password: string) => {
    try {
      log('login: start', { email: emailArg });
      setLoading(true);
      setError(null);
      const userData = await AuthService.loginWithEmail(emailArg, password);
      setUser(userData);
    } catch (err) {
      logError('login: failed', err);
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // ─── Signup ────────────────────────────────────────────────────────────────
  const signup = async (emailArg: string, password: string, fullName: string) => {
    try {
      log('signup: start', { email: emailArg });
      setLoading(true);
      setError(null);
      const userData = await AuthService.signupWithEmail(emailArg, password, fullName);
      setUser(userData);
    } catch (err) {
      logError('signup: failed', err);
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // ─── Logout ────────────────────────────────────────────────────────────────
  const logout = async () => {
    try {
      log('logout: start');
      setLoading(true);
      setError(null);
      await AuthService.logout();
      setUser(null);
      setSession(null);
      setSupabaseUser(null);
      log('logout: complete');
    } catch (err) {
      logError('logout: failed', err);
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => setError(null);

  const requireSupabaseUserId = (context: string): string => {
    if (!supabaseUserId) {
      throw new Error(`[${context}] Supabase user id missing.`);
    }
    return supabaseUserId;
  };

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      supabaseUser,
      supabaseUserId,
      email,
      session,
      loading,
      error,
      login,
      signup,
      logout,
      clearError,
      requireSupabaseUserId,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, supabaseUser, supabaseUserId, email, session, loading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
