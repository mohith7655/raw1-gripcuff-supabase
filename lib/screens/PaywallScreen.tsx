import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  ScrollView,
  ActivityIndicator,
  Platform,
  Dimensions,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAccess } from '../providers/AccessContext';
import { useAuth } from '../providers/AuthContext';
import { useUser } from '../providers/UserContext';
import { supabase } from '../core/config/supabase';

const ORANGE = '#FF6B00';

// Netlify function URL for creating a Stripe Checkout session.
// Set EXPO_PUBLIC_STRIPE_CHECKOUT_URL in .env.local for local dev.
const STRIPE_CHECKOUT_URL =
    process.env.EXPO_PUBLIC_STRIPE_CHECKOUT_URL ??
    '/.netlify/functions/create-checkout-session';

export const PaywallScreen = () => {
  const {
    paywallVisible,
    hidePaywall,
    grantAccess,
    checkAndRestoreAccess,
    hasAccess,
    activationMessage,
    clearActivationMessage,
  } = useAccess();
  const { supabaseUserId, email } = useAuth();
  const { profile, fetchProfile }  = useUser();

  const insets = useSafeAreaInsets();
  const { width: winWidth } = useWindowDimensions();
  const screenHeight = Dimensions.get('window').height;

  const [internalVisible, setInternalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;

  const [orderNumber, setOrderNumber]         = useState('123456');
  const [orderError, setOrderError]           = useState('');
  const [orderLoading, setOrderLoading]       = useState(false);
  const [subLoading, setSubLoading]           = useState(false);
  // Native-only: shown after Linking.openURL while waiting for Stripe webhook
  const [paymentPending, setPaymentPending]   = useState(false);
  const [checkingStatus, setCheckingStatus]   = useState(false);

  // ─── Slide in when paywallVisible becomes true ──────────────────────────────
  useEffect(() => {
    if (paywallVisible && !internalVisible) {
      setInternalVisible(true);
      slideAnim.setValue(screenHeight);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: Platform.OS !== 'web',
        tension: 58,
        friction: 12,
      }).start();
    }
  }, [paywallVisible, screenHeight]);

  // ─── Auto-close when access is granted ─────────────────────────────────────
  // Covers: gripcuff RPC → grantAccess() → hasAccess = true
  //         Stripe Realtime → profile.hasAccess → AccessContext sync → hasAccess = true
  useEffect(() => {
    if ((hasAccess || profile?.hasAccess === true) && internalVisible) {
      handleClose();
    }
  }, [hasAccess, profile?.hasAccess]);

  // ─── Show success / error messages as Alert ─────────────────────────────────
  useEffect(() => {
    if (!activationMessage) return;
    const isSuccess =
      activationMessage.includes('Welcome') || activationMessage.includes('activated');
    Alert.alert(
      isSuccess ? '🎉 Success!' : 'Payment Update',
      activationMessage,
      [{ text: 'OK', onPress: clearActivationMessage }],
    );
  }, [activationMessage]);

  const handleClose = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: screenHeight,
      duration: 260,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      setInternalVisible(false);
      setPaymentPending(false);
      hidePaywall();
    });
  }, [screenHeight]);

  // ─── GRIPCUFF ORDER NUMBER FLOW ─────────────────────────────────────────────
  // Calls supabase.rpc('activate_gripcuff_access') directly per the confirmed RPC.
  // Shows the exact error from the RPC inline — no Alert, no generic messages.
  const handleActivateGripcuff = async () => {
    const trimmed = orderNumber.trim();

    if (!trimmed) {
      setOrderError('Please enter your order number.');
      return;
    }

    const uid = supabaseUserId;
    if (!uid) {
      setOrderError('Not logged in. Please restart the app and try again.');
      return;
    }

    setOrderLoading(true);
    setOrderError('');

    try {
      console.log('[PaywallScreen] calling activate_gripcuff_access RPC', { uid, trimmed });

      const { data, error } = await supabase.rpc('activate_gripcuff_access', {
        p_user_id:     uid,
        p_order_number: trimmed,
      });

      if (error) {
        // Supabase/network error
        console.error('[PaywallScreen] activate_gripcuff_access RPC error:', error.message);
        setOrderError(error.message);
        return;
      }

      if (!data?.success) {
        // RPC returned { success: false, error: '...' }
        const msg = data?.error || 'Invalid order number. Please check and try again.';
        console.warn('[PaywallScreen] activate_gripcuff_access returned failure:', msg);
        setOrderError(msg);
        return;
      }

      // ✅ RPC succeeded — { success: true, access_type: 'gripcuff', message: '...' }
      console.log('[PaywallScreen] activate_gripcuff_access success:', data);

      // 1. Immediately update AccessContext so the paywall closes
      grantAccess('gripcuff', data.message);

      // 2. Reload the profile so the rest of the app (UserContext) reflects has_access = true
      //    Reset cooldown guard first so this fetch isn't skipped
      await fetchProfile(uid);

      setOrderNumber('');
      // handleClose is called automatically by the hasAccess useEffect above

    } catch (err: any) {
      const msg = err?.message ?? 'Network error. Please check your connection.';
      console.error('[PaywallScreen] handleActivateGripcuff threw:', msg);
      setOrderError(msg);
    } finally {
      setOrderLoading(false);
    }
  };

  // ─── STRIPE $4.99/MONTH FLOW ────────────────────────────────────────────────
  // @stripe/stripe-react-native is NOT installed.
  // → Web:   open Stripe Checkout in new tab; return redirect ?payment=success
  //          is handled by AccessContext which calls activate_stripe_access RPC.
  // → Native: open Stripe Checkout in device browser; Supabase Realtime in
  //           AccessContext fires when the stripe-webhook.ts Netlify function
  //           writes to user_access after receiving checkout.session.completed.
  const handleSubscribe = async () => {
    const uid = supabaseUserId;
    if (!uid) {
      Alert.alert('Not logged in', 'Please log in before subscribing.');
      return;
    }

    try {
      setSubLoading(true);

      const response = await fetch(STRIPE_CHECKOUT_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId: uid, userEmail: email }),
      });

      const data = await response.json();

      if (!response.ok || !data.url) {
        const msg = data.error || 'No checkout URL returned from server.';
        console.error('[PaywallScreen] Stripe checkout error:', msg);
        Alert.alert('Payment Error', msg);
        return;
      }

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        // Web: Stripe redirects back to ?payment=success — AccessContext handles it
        window.open(data.url, '_blank');
      } else {
        // Native: browser opens, user pays, Stripe webhook → Realtime → AccessContext
        await Linking.openURL(data.url);
        setPaymentPending(true);
      }
    } catch (err: any) {
      const msg = err?.message ?? 'Could not start checkout. Please try again.';
      console.error('[PaywallScreen] handleSubscribe threw:', msg);
      Alert.alert('Payment Error', msg);
    } finally {
      setSubLoading(false);
    }
  };

  // Native: user taps "I've completed payment — check now"
  const handleCheckStatus = async () => {
    setCheckingStatus(true);
    try {
      const found = await checkAndRestoreAccess();
      if (!found) {
        Alert.alert(
          'Not Confirmed Yet',
          "We haven't received confirmation yet — it usually takes a few seconds after checkout.\n\nPlease wait and try again.",
        );
      }
      // If found: AccessContext sets hasAccess → true → auto-close effect fires
    } catch (err: any) {
      console.error('[PaywallScreen] checkAndRestoreAccess threw:', err?.message ?? err);
    } finally {
      setCheckingStatus(false);
    }
  };

  // Never render if the user already has access (safety guard in addition to auto-close)
  if (!internalVisible || hasAccess || profile?.hasAccess === true) return null;

  const isWide: boolean = winWidth >= 480;
  const cardContainerStyle: any = {
    flexDirection: isWide ? 'row' : 'column',
    gap: 14,
    marginTop: 20,
  };

  // ── Native waiting screen (after Linking.openURL) ────────────────────────────
  const renderPaymentPending = () => (
    <View style={styles.pendingContainer}>
      <ActivityIndicator size="large" color={ORANGE} style={{ marginBottom: 20 }} />
      <Text style={styles.pendingTitle}>Waiting for payment confirmation…</Text>
      <Text style={styles.pendingSubtitle}>
        Complete checkout in your browser, then come back here.
        {'\n'}Access is granted automatically once payment is confirmed.
      </Text>

      <TouchableOpacity
        style={[styles.cardBtn, { marginTop: 28 }, checkingStatus && styles.btnDisabled]}
        onPress={handleCheckStatus}
        disabled={checkingStatus}
        activeOpacity={0.85}
      >
        <Text style={styles.cardBtnText}>
          {checkingStatus ? 'Checking…' : "I've Completed Payment — Verify Now"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.cancelLink}
        onPress={() => { setPaymentPending(false); handleClose(); }}
        activeOpacity={0.7}
      >
        <Text style={styles.cancelLinkText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCards = () => (
    <>
      <View style={styles.brandRow}>
        <Text style={styles.logo}>Raw1</Text>
        <Text style={styles.tagline}>Choose how you want to start</Text>
      </View>

      <View style={cardContainerStyle}>
        <GripcuffCard
          orderNumber={orderNumber}
          setOrderNumber={(v) => { setOrderNumber(v); setOrderError(''); }}
          orderError={orderError}
          loading={orderLoading}
          onSubmit={handleActivateGripcuff}
          flex={isWide ? 1 : undefined}
        />
        <SubscriptionCard
          loading={subLoading}
          onSubscribe={handleSubscribe}
          flex={isWide ? 1 : undefined}
        />
      </View>
    </>
  );

  // ─── WEB ───────────────────────────────────────────────────────────────────
  if (Platform.OS === 'web') {
    const appHeight =
      typeof window !== 'undefined' ? window.innerHeight : screenHeight;

    return (
      <div
        style={{
          position:       'fixed',
          top:            0,
          left:           0,
          width:          '100vw',
          height:         appHeight,
          zIndex:         100,
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'flex-end',
        } as any}
      >
        <div
          onClick={handleClose}
          style={({ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)' } as any)}
        />
        <Animated.View
          style={[
            styles.sheet,
            {
              width:     isWide ? Math.min(winWidth, 860) : '100%',
              maxHeight: appHeight * 0.92,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
            {renderCards()}
          </ScrollView>
        </Animated.View>
      </div>
    );
  }

  // ─── NATIVE ────────────────────────────────────────────────────────────────
  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFillObject,
        styles.nativeRoot,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      {!paymentPending && (
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          onPress={handleClose}
          activeOpacity={1}
        />
      )}

      <View style={[styles.sheet, styles.nativeSheet]}>
        {paymentPending ? (
          <View style={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
            {renderPaymentPending()}
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
            {renderCards()}
          </ScrollView>
        )}
      </View>
    </Animated.View>
  );
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const GripcuffCard = ({
  orderNumber, setOrderNumber, orderError, loading, onSubmit, flex,
}: {
  orderNumber: string;
  setOrderNumber: (v: string) => void;
  orderError: string;
  loading: boolean;
  onSubmit: () => void;
  flex?: number;
}) => (
  <View style={[styles.card, styles.cardFree, flex ? { flex } : {}]}>
    <Text style={styles.cardTitle}>I have a Gripcuff</Text>
    <Text style={styles.cardSubtitle}>Enter your order number to get started</Text>
    <TextInput
      style={styles.orderInput}
      placeholder="Enter order number"
      placeholderTextColor="#555"
      value={orderNumber}
      onChangeText={setOrderNumber}
      autoCapitalize="none"
      editable={!loading}
      returnKeyType="done"
      onSubmitEditing={onSubmit}
    />
    <Text style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>Use code: 123456</Text>
    {!!orderError && <Text style={styles.errorText}>{orderError}</Text>}
    <TouchableOpacity
      style={[styles.cardBtn, loading && styles.btnDisabled]}
      onPress={onSubmit}
      disabled={loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <Text style={styles.cardBtnText}>Activate Free Access</Text>
      )}
    </TouchableOpacity>
  </View>
);

const SubscriptionCard = ({
  loading, onSubscribe, flex,
}: {
  loading: boolean;
  onSubscribe: () => void;
  flex?: number;
}) => (
  <View style={[styles.card, styles.cardSub, flex ? { flex } : {}]}>
    <View style={styles.badge}>
      <Text style={styles.badgeText}>MOST POPULAR</Text>
    </View>
    <Text style={styles.cardPrice}>$4.99 / month</Text>
    <Text style={styles.cardSubtitle}>Full access to all workouts and features</Text>
    <View style={styles.featureList}>
      {[
        'Unlimited workout videos',
        'Stretch and rehab programs',
        'New content every week',
      ].map((f) => (
        <Text key={f} style={styles.featureItem}>• {f}</Text>
      ))}
    </View>
    <TouchableOpacity
      style={[styles.cardBtn, loading && styles.btnDisabled]}
      onPress={onSubscribe}
      disabled={loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <Text style={styles.cardBtnText}>Start Subscription</Text>
      )}
    </TouchableOpacity>
  </View>
);

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  nativeRoot: {
    zIndex: 100,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    boxShadow: '0px 4px 10px rgba(0,0,0,0.2)',
    elevation: 30,
  },
  nativeSheet: {
    maxHeight: '92%',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  closeBtn: {
    alignSelf: 'flex-end',
    padding: 6,
    marginBottom: 4,
  },
  closeBtnText: {
    color: '#888',
    fontSize: 20,
    fontWeight: '500',
  },

  brandRow: {
    alignItems: 'center',
    marginBottom: 4,
  },
  logo: {
    fontSize: 42,
    fontWeight: '800',
    fontStyle: 'italic',
    color: ORANGE,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 4,
  },

  card: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1.5,
  },
  cardFree: {
    borderColor: '#333',
    backgroundColor: '#242424',
  },
  cardSub: {
    borderColor: ORANGE,
    backgroundColor: '#1f1408',
  },

  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,107,0,0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 10,
  },
  badgeText: {
    color: ORANGE,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  cardTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardPrice: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 4,
  },
  cardSubtitle: {
    color: '#888',
    fontSize: 13,
    marginBottom: 14,
  },

  orderInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1.5,
    borderColor: '#333',
    marginBottom: 8,
  },
  errorText: {
    color: '#ff5252',
    fontSize: 12,
    marginBottom: 8,
    lineHeight: 18,
  },

  featureList: {
    marginBottom: 16,
    gap: 6,
  },
  featureItem: {
    color: '#ccc',
    fontSize: 13,
  },

  cardBtn: {
    backgroundColor: ORANGE,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    minHeight: 50,
  },
  btnDisabled: {
    opacity: 0.55,
  },
  cardBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // ── Native payment-pending ────────────────────────────────────────────────────
  pendingContainer: {
    paddingVertical: 32,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  pendingTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  pendingSubtitle: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  cancelLink: {
    marginTop: 20,
    padding: 8,
  },
  cancelLinkText: {
    color: '#666',
    fontSize: 14,
  },
});
