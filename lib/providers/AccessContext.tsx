/**
 * AccessContext — manages paywall visibility and access state.
 *
 * Source of truth (in priority order):
 *   1. users.has_access column — checked at boot via direct query
 *   2. profile.hasAccess in UserContext — synced via Realtime when DB changes
 *   3. Local cache (AsyncStorage / localStorage) — offline fallback
 *
 * RPCs are called by the components (PaywallScreen), not here.
 * This context only manages the STATE of access; the DB writes happen in the UI layer
 * via supabase.rpc('activate_gripcuff_access' | 'activate_stripe_access').
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { useUser } from './UserContext';
import { supabase } from '../core/config/supabase';

export type AccessType = null | 'gripcuff' | 'subscription';
export type GripcuffStatus = null | 'has_gripcuff' | 'using_at_gym' | 'no_gripcuff';

/**
 * Normalize raw DB / profile access_type strings to the canonical AccessType.
 *
 * The Stripe webhook (stripe-webhook.ts) was originally written to store
 * access_type = 'subscription', but some rows in Supabase were written as
 * 'stripe' (e.g. by an older RPC or manual seeding).  Any Stripe-flavoured
 * string → 'subscription' so the rest of the app only ever sees the two
 * canonical values: 'gripcuff' | 'subscription'.
 */
const normalizeAccessType = (raw: string | null | undefined): AccessType => {
  if (raw === 'gripcuff') return 'gripcuff';
  if (raw === 'subscription' || raw === 'stripe') return 'subscription';
  return null;
};

interface AccessContextType {
  accessType: AccessType;
  hasAccess: boolean;
  loading: boolean;
  paywallVisible: boolean;
  surveyVisible: boolean;
  gripcuffStatus: GripcuffStatus;
  activationMessage: string | null;
  clearActivationMessage: () => void;
  /** Called by PaywallScreen after a successful RPC to immediately reflect access in UI */
  grantAccess: (type: 'gripcuff' | 'subscription', message?: string) => void;
  /** Manual Supabase poll — for the native "I've Completed Payment" button */
  checkAndRestoreAccess: () => Promise<boolean>;
  showPaywall: () => Promise<void>;
  hidePaywall: () => void;
  hideSurvey: () => void;
  completeSurvey: (status: GripcuffStatus) => Promise<void>;
  checkAndShowPaywall: () => boolean;
}

const AccessContext = createContext<AccessContextType>({
  accessType: null,
  hasAccess: false,
  loading: true,
  paywallVisible: false,
  surveyVisible: false,
  gripcuffStatus: null,
  activationMessage: null,
  clearActivationMessage: () => {},
  grantAccess: () => {},
  checkAndRestoreAccess: async () => false,
  showPaywall: async () => {},
  hidePaywall: () => {},
  hideSurvey: () => {},
  completeSurvey: async () => {},
  checkAndShowPaywall: () => false,
});

const LS_KEY        = 'raw1_accessType';
const GC_STATUS_KEY = 'raw1_gripcuffStatus';

// ─── Local cache helpers ──────────────────────────────────────────────────────

const readCache = async (): Promise<AccessType> => {
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      return (localStorage.getItem(LS_KEY) as AccessType) || null;
    }
    return ((await AsyncStorage.getItem(LS_KEY)) as AccessType) || null;
  } catch { return null; }
};

const writeCache = async (type: AccessType) => {
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      if (type) localStorage.setItem(LS_KEY, type);
      else localStorage.removeItem(LS_KEY);
      return;
    }
    if (type) await AsyncStorage.setItem(LS_KEY, type);
    else await AsyncStorage.removeItem(LS_KEY);
  } catch {}
};

const readGripcuffStatus = async (): Promise<GripcuffStatus> => {
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      return (localStorage.getItem(GC_STATUS_KEY) as GripcuffStatus) || null;
    }
    return ((await AsyncStorage.getItem(GC_STATUS_KEY)) as GripcuffStatus) || null;
  } catch { return null; }
};

const writeGripcuffStatus = async (status: GripcuffStatus) => {
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      if (status) localStorage.setItem(GC_STATUS_KEY, status);
      else localStorage.removeItem(GC_STATUS_KEY);
      return;
    }
    if (status) await AsyncStorage.setItem(GC_STATUS_KEY, status);
    else await AsyncStorage.removeItem(GC_STATUS_KEY);
  } catch {}
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AccessProvider = ({ children }: { children: React.ReactNode }) => {
  const { supabaseUserId } = useAuth();
  // AccessProvider is inside UserProvider — safe to use useUser()
  const { profile } = useUser();

  const [currentUid, setCurrentUid]               = useState<string | null>(null);
  const [accessType, setAccessType]               = useState<AccessType>(null);
  const [loading, setLoading]                     = useState(true);
  const [paywallVisible, setPaywallVisible]       = useState(false);
  const [surveyVisible, setSurveyVisible]         = useState(false);
  const [gripcuffStatus, setGripcuffStatus]       = useState<GripcuffStatus>(null);
  const [activationMessage, setActivationMessage] = useState<string | null>(null);

  const currentUidRef = useRef<string | null>(null);

  // Detect Stripe redirect URL params on web — set once at mount before the user logs in
  const pendingStripeRef = useRef<{ detected: boolean; sessionId: string | null }>({
    detected: false,
    sessionId: null,
  });
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const params  = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    window.history.replaceState({}, '', window.location.pathname);
    if (payment === 'success') {
      pendingStripeRef.current = { detected: true, sessionId: params.get('session_id') };
    } else if (payment === 'cancelled') {
      setPaywallVisible(true);
      setActivationMessage('Payment cancelled. Try again when ready.');
    }
  }, []);

  // ─── Core apply — updates state + local cache ───────────────────────────────
  const applyAccess = useCallback((type: AccessType) => {
    setAccessType(type);
    writeCache(type);
    if (type) {
      setPaywallVisible(false);
      setSurveyVisible(false);
    }
  }, []);

  // ─── Sync from UserContext profile ─────────────────────────────────────────
  // When UserContext loads the profile (or Realtime updates has_access on the
  // users table), propagate to AccessContext. This is the primary post-boot path.
  useEffect(() => {
    if (profile?.hasAccess === true) {
      const at = normalizeAccessType(profile.accessType) ?? 'subscription';
      applyAccess(at);
      console.log('[AccessContext] profile.hasAccess → access granted:', at);
    }
  }, [profile?.hasAccess, profile?.accessType, applyAccess]);

  // ─── Boot / uid-change sync ─────────────────────────────────────────────────
  // Reads users.has_access directly so access is restored before profile fully loads.
  useEffect(() => {
    const sync = async () => {
      const uid = supabaseUserId ?? null;

      if (!uid) {
        setCurrentUid(null);
        currentUidRef.current = null;
        applyAccess(null);
        setLoading(false);
        return;
      }

      setCurrentUid(uid);
      currentUidRef.current = uid;

      // ── Handle Stripe web redirect ──────────────────────────────────────────
      if (pendingStripeRef.current.detected) {
        const { sessionId } = pendingStripeRef.current;
        pendingStripeRef.current = { detected: false, sessionId: null };

        console.log('[AccessContext] Stripe web redirect detected, session_id:', sessionId);

        // Call the confirmed-working RPC. Pass session_id as p_subscription_id;
        // the webhook (stripe-webhook.ts) will later fill in the full details.
        try {
          const { data, error } = await supabase.rpc('activate_stripe_access', {
            p_user_id:             uid,
            p_stripe_customer_id:  null,
            p_subscription_id:     sessionId,
            p_payment_intent_id:   null,
          });
          if (error) {
            console.error('[AccessContext] activate_stripe_access RPC error:', error.message);
          } else if (data?.success) {
            applyAccess('subscription');
            setActivationMessage(data.message || 'Subscription activated! Welcome to Raw1 🎉');
            setLoading(false);
            return;
          } else {
            console.warn('[AccessContext] activate_stripe_access returned:', data?.error);
          }
        } catch (e) {
          console.error('[AccessContext] activate_stripe_access threw:', e);
        }
        // Fall through to local cache if RPC fails
      }

      // ── Primary: read users.has_access (single fast query) ─────────────────
      try {
        const { data: row, error } = await supabase
          .from('users')
          .select('has_access, access_type')
          .eq('id', uid)
          .maybeSingle();

        if (error) {
          console.warn('[AccessContext] users.has_access fetch error:', error.message);
        } else if (row?.has_access && row?.access_type) {
          applyAccess(normalizeAccessType(row.access_type) ?? 'subscription');
          setLoading(false);
          return;
        }
      } catch (e) {
        console.warn('[AccessContext] users.has_access check failed:', e);
      }

      // ── Fallback: local cache ───────────────────────────────────────────────
      const cached = await readCache();
      if (cached) applyAccess(normalizeAccessType(cached) ?? cached);

      const cachedGcStatus = await readGripcuffStatus();
      if (cachedGcStatus) setGripcuffStatus(cachedGcStatus);

      setLoading(false);
    };

    sync().catch((e) => {
      console.warn('[AccessContext] sync failed:', e);
      setLoading(false);
    });
  }, [applyAccess, supabaseUserId]);

  const hasAccess = accessType === 'gripcuff' || accessType === 'subscription';

  // ─── Realtime: auto-grant when webhook writes to user_access (native Stripe) ─
  // For the native Stripe flow: Linking.openURL → user pays in browser →
  // Stripe webhook fires → stripe-webhook.ts Netlify function writes user_access →
  // Supabase Realtime notifies the app here.
  useEffect(() => {
    const uid = currentUid;
    if (!uid || hasAccess) return;

    console.log('[AccessContext] subscribing user_access Realtime for uid:', uid);

    const channel = supabase
      .channel(`access-grant-${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_access', filter: `user_id=eq.${uid}` },
        (payload) => {
          const row = payload.new as any;
          console.log('[AccessContext] user_access Realtime:', payload.eventType, row?.access_type);
          if (row?.is_active && row?.access_type) {
            applyAccess(normalizeAccessType(row.access_type) ?? 'subscription');
            setActivationMessage('Access activated! Welcome to Raw1 🎉');
          }
        },
      )
      .subscribe((status, err) => {
        if (err) console.warn('[AccessContext] user_access Realtime error:', err);
        else console.log('[AccessContext] user_access Realtime:', status);
      });

    return () => { supabase.removeChannel(channel); };
  }, [currentUid, hasAccess, applyAccess]);

  // ─── grantAccess ────────────────────────────────────────────────────────────
  // Called by PaywallScreen AFTER a successful RPC call to immediately reflect
  // access in the UI — no DB write here (the component already did the RPC).
  const grantAccess = useCallback(
    (type: 'gripcuff' | 'subscription', message?: string) => {
      applyAccess(type);
      setActivationMessage(
        message ??
        (type === 'gripcuff'
          ? 'Access activated! Welcome to Raw1 🎉'
          : 'Subscription activated! Welcome to Raw1 🎉'),
      );
    },
    [applyAccess],
  );

  // ─── checkAndRestoreAccess — manual poll (native "Check Payment" button) ────
  const checkAndRestoreAccess = useCallback(async (): Promise<boolean> => {
    const uid = currentUidRef.current;
    if (!uid) return false;

    try {
      const { data: row, error } = await supabase
        .from('users')
        .select('has_access, access_type')
        .eq('id', uid)
        .maybeSingle();

      if (error) {
        console.error('[AccessContext] checkAndRestoreAccess error:', error.message);
        return false;
      }

      if (row?.has_access && row?.access_type) {
        applyAccess(row.access_type as AccessType);
        setActivationMessage('Access activated! Welcome to Raw1 🎉');
        return true;
      }
    } catch (e) {
      console.error('[AccessContext] checkAndRestoreAccess threw:', e);
    }
    return false;
  }, [applyAccess]);

  const clearActivationMessage = useCallback(() => setActivationMessage(null), []);

  const showPaywall = useCallback(async () => {
    const savedGcStatus = await readGripcuffStatus();
    if (savedGcStatus) setPaywallVisible(true);
    else setSurveyVisible(true);
  }, []);

  const hidePaywall   = useCallback(() => setPaywallVisible(false), []);
  const hideSurvey    = useCallback(() => setSurveyVisible(false), []);

  const completeSurvey = useCallback(async (status: GripcuffStatus) => {
    setGripcuffStatus(status);
    await writeGripcuffStatus(status);
    setSurveyVisible(false);
    setPaywallVisible(true);
  }, []);

  const checkAndShowPaywall = useCallback((): boolean => {
    if (hasAccess) return false;
    setPaywallVisible(true);
    return true;
  }, [hasAccess]);

  return (
    <AccessContext.Provider
      value={{
        accessType,
        hasAccess,
        loading,
        paywallVisible,
        surveyVisible,
        gripcuffStatus,
        activationMessage,
        clearActivationMessage,
        grantAccess,
        checkAndRestoreAccess,
        showPaywall,
        hidePaywall,
        hideSurvey,
        completeSurvey,
        checkAndShowPaywall,
      }}
    >
      {children}
    </AccessContext.Provider>
  );
};

export const useAccess = () => useContext(AccessContext);
