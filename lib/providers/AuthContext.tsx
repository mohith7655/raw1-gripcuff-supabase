import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { auth } from '../core/config/firebase';
import { supabase } from '../core/config/supabase';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';
import { User } from '../models/User';
import { AuthIdentityMapService } from '../services/authIdentityMap.service';

// ─── Debug logging ────────────────────────────────────────────────────────────

const TAG = '[Auth]';
const log = (msg: string, data?: object) =>
  console.log(`${TAG} ${msg}`, ...(data ? [data] : []));
const logWarn = (msg: string, data?: object) =>
  console.warn(`${TAG} ${msg}`, ...(data ? [data] : []));
const logError = (msg: string, err?: unknown) =>
  console.error(`${TAG} ${msg}`, err ?? '');

// ─── Error class ──────────────────────────────────────────────────────────────

export class AuthIdentityError extends Error {
  code: 'FIREBASE_UID_MISSING' | 'SUPABASE_UID_MISSING' | 'IDENTITY_MISMATCH' | 'IDENTITY_MAP_MISSING';
  constructor(code: AuthIdentityError['code'], message: string) {
    super(message);
    this.code = code;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type UnifiedAuthIdentity = {
  supabaseUser: SupabaseUser | null;
  firebaseUser: FirebaseUser | null;
  supabaseUserId: string | null;
  firebaseUid: string | null;
  email: string | null;
};

interface AuthContextType {
  user: User | null;
  identity: UnifiedAuthIdentity;
  firebaseUser: FirebaseUser | null;
  supabaseUser: SupabaseUser | null;
  firebaseUid: string | null;
  supabaseUserId: string | null;
  email: string | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  identityError: AuthIdentityError | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  requireFirebaseUid: (context: string) => string;
  requireSupabaseUserId: (context: string) => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [identityError, setIdentityError] = useState<AuthIdentityError | null>(null);

  // Set to true once Firebase has emitted its first auth state during boot.
  // Prevents false FIREBASE_UID_MISSING errors when Supabase resolves before Firebase.
  const firebaseBootedRef = useRef(false);
  // Set to true once the full boot sequence (both systems resolved) is done.
  // Prevents onAuthStateChange from double-processing events emitted during boot.
  const bootDoneRef = useRef(false);

  const supabaseUserId = supabaseUser?.id ?? null;
  const firebaseUid = firebaseUser?.uid ?? null;
  const email = supabaseUser?.email ?? firebaseUser?.email ?? null;

  // ─── Identity validation ───────────────────────────────────────────────────
  //
  // Always safe to call; handles every combination of null/non-null UIDs.
  // Does NOT set loading — callers manage that.
  const validateIdentity = async (
    sbId: string | null,
    fbUid: string | null,
    emailVal: string | null,
  ): Promise<void> => {
    if (!sbId) {
      log('identity: no Supabase session — clearing identity error');
      setIdentityError(null);
      return;
    }

    // Graceful fallback: Firebase session missing while Supabase session exists.
    // Could mean Firebase was signed out externally or account was deleted.
    // App continues with degraded Firebase features rather than crashing.
    if (!fbUid) {
      logWarn('identity: FIREBASE_UID_MISSING — Supabase session present, Firebase UID absent', { sbId });
      setIdentityError(
        new AuthIdentityError(
          'FIREBASE_UID_MISSING',
          'Firebase session missing while Supabase session exists.',
        ),
      );
      return;
    }

    try {
      log('identity: validating map', { sbId, fbUid });
      const mapping = await AuthIdentityMapService.ensureAndValidate({
        supabaseUserId: sbId,
        firebaseUid: fbUid,
        email: emailVal,
      });

      // Graceful fallback: mapping row missing after upsert (should be rare).
      if (!mapping) {
        logWarn('identity: IDENTITY_MAP_MISSING — map row absent after upsert', { sbId, fbUid });
        setIdentityError(
          new AuthIdentityError('IDENTITY_MAP_MISSING', 'Auth identity map row missing.'),
        );
        return;
      }

      log('identity: map validated OK', { sbId, fbUid, email: mapping.email });
      setIdentityError(null);
    } catch (e: any) {
      logError('identity: IDENTITY_MISMATCH — validation threw', e);
      setIdentityError(
        new AuthIdentityError('IDENTITY_MISMATCH', e?.message || 'Identity mapping mismatch.'),
      );
    }
  };

  // ─── Load Supabase user profile ────────────────────────────────────────────
  const loadProfile = async (sbId: string): Promise<void> => {
    try {
      log('profile: loading', { sbId });
      const profile = await UserService.getProfile(sbId);
      setUser(profile);
      log('profile: loaded', { uid: profile.uid });
    } catch (err) {
      logWarn('profile: load failed — setting user to null', { sbId });
      setUser(null);
    }
  };

  // ─── Boot sequence ─────────────────────────────────────────────────────────
  //
  // Critical ordering guarantee: loading stays true until BOTH Firebase and
  // Supabase have resolved their initial auth state. This prevents the app
  // from rendering the authenticated shell before firebaseUid is known,
  // which would cause false FIREBASE_UID_MISSING errors in validateIdentity.
  useEffect(() => {
    log('boot: starting dual-auth boot sequence');

    // Wrap Firebase's first onAuthStateChanged emission in a Promise so we
    // can await it alongside supabase.auth.getSession().
    let resolveFirebase!: (user: FirebaseUser | null) => void;
    const firebaseFirstEmit = new Promise<FirebaseUser | null>((resolve) => {
      resolveFirebase = resolve;
    });

    // Single Firebase subscription — handles both boot and post-boot events.
    const unsubFirebase = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);

      if (!firebaseBootedRef.current) {
        // First emission: resolve boot promise, do not run post-boot logic yet.
        log('firebase: first auth state received', { firebaseUid: fbUser?.uid ?? null });
        firebaseBootedRef.current = true;
        resolveFirebase(fbUser);
        return;
      }

      // Post-boot: token refresh, foreground/background transition, reconnect.
      log('firebase: auth state updated post-boot', { firebaseUid: fbUser?.uid ?? null });
      supabase.auth.getSession().then(({ data }) => {
        const sbId = data.session?.user?.id ?? null;
        const newFbUid = fbUser?.uid ?? null;
        const emailVal = data.session?.user?.email ?? fbUser?.email ?? null;
        validateIdentity(sbId, newFbUid, emailVal);
      });
    });

    // Boot: wait for BOTH systems before declaring loading done.
    const runBoot = async () => {
      const [{ data: sbData }, fbUser] = await Promise.all([
        supabase.auth.getSession(),
        firebaseFirstEmit,
      ]);

      const sbSession = sbData.session ?? null;

      log('boot: both auth systems resolved', {
        supabaseUserId: sbSession?.user?.id ?? null,
        firebaseUid: fbUser?.uid ?? null,
        hasSupabaseSession: !!sbSession,
        hasFirebaseUser: !!fbUser,
      });

      setSession(sbSession);
      setSupabaseUser(sbSession?.user ?? null);
      // firebaseUser already set by onAuthStateChanged above.

      const sbId = sbSession?.user?.id ?? null;
      const fbUid = fbUser?.uid ?? null;
      const emailVal = sbSession?.user?.email ?? fbUser?.email ?? null;

      log('boot: running identity validation');
      await validateIdentity(sbId, fbUid, emailVal);

      if (sbId) {
        log('boot: loading user profile', { sbId });
        await loadProfile(sbId);
      } else {
        log('boot: no Supabase session — skipping profile load');
        setUser(null);
      }

      bootDoneRef.current = true;
      setLoading(false);
      log('boot: sequence complete', { supabaseUserId: sbId, firebaseUid: fbUid });
    };

    runBoot();

    // Supabase ongoing subscription: token refresh, session expiry, logout.
    // Skipped during boot — runBoot() handles the initial state.
    const { data: subData } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!bootDoneRef.current) {
        log(`supabase: onAuthStateChange during boot — skipped (event=${_event})`);
        return;
      }

      log(`supabase: onAuthStateChange post-boot`, {
        event: _event,
        userId: nextSession?.user?.id ?? null,
      });

      setSession(nextSession);
      setSupabaseUser(nextSession?.user ?? null);

      const sbId = nextSession?.user?.id ?? null;
      // Use auth.currentUser (synchronous) — Firebase is already booted at this point.
      const fbUid = auth.currentUser?.uid ?? null;
      const emailVal = nextSession?.user?.email ?? null;

      await validateIdentity(sbId, fbUid, emailVal);

      if (!sbId) {
        setUser(null);
        return;
      }

      try {
        const profile = await UserService.getProfile(sbId);
        setUser(profile);
      } catch {
        const emailFallback = nextSession?.user?.email || '';
        // Session exists but profile fetch failed — provide a minimal user object.
        setUser({
          uid: sbId,
          email: emailFallback,
          fullName:
            (nextSession?.user?.user_metadata?.full_name as string | undefined) ||
            emailFallback.split('@')[0] ||
            'User',
          username: emailFallback.split('@')[0] || 'user',
          completedVideos: 0,
          totalVideos: 0,
          credits: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    });

    return () => {
      unsubFirebase();
      subData.subscription.unsubscribe();
    };
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
      const { data } = await supabase.auth.getUser();
      const fbUid = auth.currentUser?.uid ?? null;
      log('login: complete', { supabaseUserId: data.user?.id ?? null, firebaseUid: fbUid });
      await validateIdentity(data.user?.id ?? null, fbUid, emailArg);
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
      const { data } = await supabase.auth.getUser();
      const fbUid = auth.currentUser?.uid ?? null;
      log('signup: complete', { supabaseUserId: data.user?.id ?? null, firebaseUid: fbUid });
      await validateIdentity(data.user?.id ?? null, fbUid, emailArg);
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
      setIdentityError(null);
      await AuthService.logout();
      setUser(null);
      setSession(null);
      setSupabaseUser(null);
      setFirebaseUser(null);
      log('logout: complete — both sessions cleared');
    } catch (err) {
      logError('logout: failed', err);
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => setError(null);

  const requireFirebaseUid = (context: string): string => {
    if (!firebaseUid) {
      throw new AuthIdentityError('FIREBASE_UID_MISSING', `[${context}] Firebase UID missing.`);
    }
    return firebaseUid;
  };

  const requireSupabaseUserId = (context: string): string => {
    if (!supabaseUserId) {
      throw new AuthIdentityError('SUPABASE_UID_MISSING', `[${context}] Supabase user id missing.`);
    }
    return supabaseUserId;
  };

  const identity = useMemo<UnifiedAuthIdentity>(
    () => ({ supabaseUser, firebaseUser, supabaseUserId, firebaseUid, email }),
    [supabaseUser, firebaseUser, supabaseUserId, firebaseUid, email],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        identity,
        firebaseUser,
        supabaseUser,
        firebaseUid,
        supabaseUserId,
        email,
        session,
        loading,
        error,
        identityError,
        login,
        signup,
        logout,
        clearError,
        requireFirebaseUid,
        requireSupabaseUserId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
