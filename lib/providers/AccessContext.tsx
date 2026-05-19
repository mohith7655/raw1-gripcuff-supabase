import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../core/config/firebase';
import { useAuth } from './AuthContext';

export type AccessType = null | 'gripcuff' | 'subscription';
export type GripcuffStatus = null | 'has_gripcuff' | 'using_at_gym' | 'no_gripcuff';

export interface GrantMeta {
  orderNumber?: string;
  subscriptionId?: string;
}

interface AccessContextType {
  accessType: AccessType;
  hasAccess: boolean;
  loading: boolean;
  paywallVisible: boolean;
  surveyVisible: boolean;
  gripcuffStatus: GripcuffStatus;
  activationMessage: string | null;
  clearActivationMessage: () => void;
  grantAccess: (type: 'gripcuff' | 'subscription', meta?: GrantMeta) => Promise<void>;
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
  grantAccess: async () => {},
  showPaywall: async () => {},
  hidePaywall: () => {},
  hideSurvey: () => {},
  completeSurvey: async () => {},
  checkAndShowPaywall: () => false,
});

const LS_KEY = 'raw1_accessType';
const GC_STATUS_KEY = 'raw1_gripcuffStatus';

const readCache = async (): Promise<AccessType> => {
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      return (localStorage.getItem(LS_KEY) as AccessType) || null;
    }
    return ((await AsyncStorage.getItem(LS_KEY)) as AccessType) || null;
  } catch {
    return null;
  }
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
  } catch {
    return null;
  }
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

const writeAccessDoc = (uid: string, type: 'gripcuff' | 'subscription', meta: GrantMeta = {}) =>
  setDoc(
    doc(db, 'user_access', uid),
    {
      accessType: type,
      orderNumber: meta.orderNumber ?? null,
      subscriptionId: meta.subscriptionId ?? null,
      activatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

export const AccessProvider = ({ children }: { children: React.ReactNode }) => {
  const { firebaseUid, supabaseUserId } = useAuth();

  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [accessType, setAccessType] = useState<AccessType>(null);
  const [loading, setLoading] = useState(true);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [surveyVisible, setSurveyVisible] = useState(false);
  const [gripcuffStatus, setGripcuffStatus] = useState<GripcuffStatus>(null);
  const [activationMessage, setActivationMessage] = useState<string | null>(null);
  const snapshotUnsubRef = useRef<(() => void) | null>(null);

  const pendingStripeRef = useRef<{ detected: boolean; sessionId: string | null }>({
    detected: false,
    sessionId: null,
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    window.history.replaceState({}, '', window.location.pathname);
    if (payment === 'success') {
      pendingStripeRef.current = { detected: true, sessionId: params.get('session_id') };
    } else if (payment === 'cancelled') {
      setPaywallVisible(true);
      setActivationMessage('Payment cancelled. Try again when ready.');
    }
  }, []);

  const applyAccess = useCallback((type: AccessType) => {
    setAccessType(type);
    writeCache(type);
    if (type) {
      setPaywallVisible(false);
      setSurveyVisible(false);
    }
  }, []);

  useEffect(() => {
    const sync = async () => {
      const uid = firebaseUid ?? null;
      console.log({ supabaseUserId, firebaseUid: uid });

      snapshotUnsubRef.current?.();
      snapshotUnsubRef.current = null;

      if (!uid) {
        setCurrentUid(null);
        applyAccess(null);
        setLoading(false);
        return;
      }

      setCurrentUid(uid);

      const cached = await readCache();
      if (cached) setAccessType(cached);
      const cachedGcStatus = await readGripcuffStatus();
      if (cachedGcStatus) setGripcuffStatus(cachedGcStatus);

      if (pendingStripeRef.current.detected) {
        const { sessionId } = pendingStripeRef.current;
        pendingStripeRef.current = { detected: false, sessionId: null };
        await writeAccessDoc(uid, 'subscription', { subscriptionId: sessionId ?? undefined });
        applyAccess('subscription');
        setLoading(false);
        setActivationMessage('Welcome to Raw1! Subscription activated.');
      }

      let firstFire = true;
      snapshotUnsubRef.current = onSnapshot(
        doc(db, 'user_access', uid),
        async (snap) => {
          const type: AccessType = snap.exists() ? ((snap.data()?.accessType as AccessType) ?? null) : null;
          applyAccess(type);

          if (snap.exists()) {
            const fsGcStatus = (snap.data()?.gripcuffStatus as GripcuffStatus) ?? null;
            if (fsGcStatus) {
              setGripcuffStatus(fsGcStatus);
              writeGripcuffStatus(fsGcStatus);
            }
          }

          if (firstFire) {
            firstFire = false;
            setLoading(false);
          }
        },
        () => {
          if (firstFire) {
            firstFire = false;
            setLoading(false);
          }
        }
      );
    };

    sync().catch((e) => {
      console.warn('[AccessContext] identity sync failed:', e);
      setLoading(false);
    });

    return () => {
      snapshotUnsubRef.current?.();
    };
  }, [applyAccess, firebaseUid, supabaseUserId]);

  const hasAccess = accessType === 'gripcuff' || accessType === 'subscription';

  const grantAccess = useCallback(
    async (type: 'gripcuff' | 'subscription', meta: GrantMeta = {}) => {
      if (!firebaseUid) throw new Error('[AccessContext.grantAccess] Firebase UID missing.');
      await writeAccessDoc(firebaseUid, type, meta);
      applyAccess(type);
    },
    [firebaseUid, applyAccess]
  );

  const clearActivationMessage = useCallback(() => setActivationMessage(null), []);

  const showPaywall = useCallback(async () => {
    if (currentUid) {
      try {
        const userSnap = await getDoc(doc(db, 'users', currentUid));
        if (!userSnap.data()?.onboardingCompleted) return;
      } catch {}
    }
    const savedGcStatus = await readGripcuffStatus();
    if (savedGcStatus) setPaywallVisible(true);
    else setSurveyVisible(true);
  }, [currentUid]);

  const hidePaywall = useCallback(() => setPaywallVisible(false), []);
  const hideSurvey = useCallback(() => setSurveyVisible(false), []);

  const completeSurvey = useCallback(
    async (status: GripcuffStatus) => {
      setGripcuffStatus(status);
      await writeGripcuffStatus(status);
      if (currentUid && status) {
        await setDoc(doc(db, 'user_access', currentUid), { gripcuffStatus: status }, { merge: true });
      }
      setSurveyVisible(false);
      setPaywallVisible(true);
    },
    [currentUid]
  );

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

