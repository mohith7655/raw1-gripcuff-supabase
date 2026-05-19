import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../core/config/supabase';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';
import { User } from '../models/User';
import { AuthIdentityMapService } from '../services/authIdentityMap.service';

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
  /** Legacy Firebase UID from auth_identity_map — used only for Firestore compat.
   *  Null for users created after Firebase Auth removal. */
  firebaseUid: string | null;
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
  const [firebaseUid, setFirebaseUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabaseUserId = supabaseUser?.id ?? null;
  const email = supabaseUser?.email ?? null;

  // ─── Load profile ──────────────────────────────────────────────────────────
  const loadProfile = async (sbId: string): Promise<void> => {
    try {
      const profile = await UserService.getProfile(sbId);
      setUser(profile);
      log('profile: loaded', { uid: profile.uid });
    } catch {
      logWarn('profile: load failed', { sbId });
      setUser(null);
    }
  };

  // ─── Resolve legacy Firebase UID from identity map ─────────────────────────
  const resolveLegacyFirebaseUid = async (sbId: string): Promise<void> => {
    try {
      const fbUid = await AuthIdentityMapService.getLegacyFirebaseUid(sbId);
      setFirebaseUid(fbUid);
      if (fbUid) {
        log('legacy firebase uid resolved', { sbId, fbUid });
      } else {
        log('no legacy firebase uid — new user or post-migration account', { sbId });
      }
    } catch {
      logWarn('legacy firebase uid lookup failed — setting null', { sbId });
      setFirebaseUid(null);
    }
  };

  // ─── On auth session: apply state ─────────────────────────────────────────
  const applySession = async (nextSession: Session | null): Promise<void> => {
    setSession(nextSession);
    setSupabaseUser(nextSession?.user ?? null);

    const sbId = nextSession?.user?.id ?? null;
    if (!sbId) {
      setUser(null);
      setFirebaseUid(null);
      return;
    }

    await Promise.all([
      loadProfile(sbId),
      resolveLegacyFirebaseUid(sbId),
    ]);
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
      await applySession(nextSession);
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
      setFirebaseUid(null);
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
      firebaseUid,
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
    [user, supabaseUser, supabaseUserId, firebaseUid, email, session, loading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
