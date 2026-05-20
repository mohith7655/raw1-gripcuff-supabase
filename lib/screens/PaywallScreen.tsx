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
  Platform,
  Dimensions,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAccess } from '../providers/AccessContext';
import { useAuth } from '../providers/AuthContext';

const ORANGE = '#FF6B00';
const VALID_ORDER = '123456';
// On Netlify (prod + netlify dev) the function is at /.netlify/functions/…
// For bare `expo start` local dev, set EXPO_PUBLIC_STRIPE_CHECKOUT_URL in .env.local
const STRIPE_CHECKOUT_URL =
    process.env.EXPO_PUBLIC_STRIPE_CHECKOUT_URL ??
    '/.netlify/functions/create-checkout-session';

export const PaywallScreen = () => {
  const { paywallVisible, hidePaywall, grantAccess, hasAccess, activationMessage, clearActivationMessage } = useAccess();
  const { supabaseUserId } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: winWidth } = useWindowDimensions();
  const screenHeight = Dimensions.get('window').height;

  const [internalVisible, setInternalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;

  const [orderNumber, setOrderNumber] = useState('');
  const [orderError, setOrderError] = useState('');
  const [orderLoading, setOrderLoading] = useState(false);
  const [subLoading, setSubLoading] = useState(false);

  // Slide in when paywallVisible becomes true
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

  // Show success / cancelled messages from AccessContext
  useEffect(() => {
    if (!activationMessage) return;
    const isSuccess = activationMessage.includes('Welcome');
    Alert.alert(
      isSuccess ? '🎉 Success!' : 'Payment Cancelled',
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
      hidePaywall();
    });
  }, [screenHeight]);

  const handleActivateGripcuff = async () => {
    if (!orderNumber.trim()) {
      setOrderError('Please enter your order number.');
      return;
    }
    setOrderLoading(true);
    setOrderError('');
    // Simulate async check
    await new Promise((r) => setTimeout(r, 600));
    if (orderNumber.trim() === VALID_ORDER) {
      await grantAccess('gripcuff', { orderNumber: orderNumber.trim() });
      setOrderNumber('');
      handleClose();
    } else {
      setOrderError('Invalid order number. Please check and try again.');
    }
    setOrderLoading(false);
  };

  const handleSubscribe = async () => {
    try {
      setSubLoading(true);

      const response = await fetch(STRIPE_CHECKOUT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: supabaseUserId }),
      });

      const data = await response.json();

      if (data.url) {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.open(data.url, '_blank');
        } else {
          await Linking.openURL(data.url);
        }
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      Alert.alert('Error', 'Could not start checkout. Please try again.');
    } finally {
      setSubLoading(false);
    }
  };

  if (!internalVisible || hasAccess) return null;

  // Responsive: side-by-side on tablet/desktop, stacked on mobile
  const isWide = winWidth >= 480;
  const cardContainerStyle: any = {
    flexDirection: isWide ? 'row' : 'column',
    gap: 14,
    marginTop: 20,
  };

  // ─── WEB ───────────────────────────────────────────────────────────────────
  if (Platform.OS === 'web') {
    const appHeight =
      typeof window !== 'undefined' ? window.innerHeight : screenHeight;

    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: appHeight,
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
        } as any}
      >
        {/* Backdrop */}
        <div
          onClick={handleClose}
          style={({ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)' } as any)}
        />

        {/* Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            {
              width: isWide ? Math.min(winWidth, 860) : '100%',
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
            {/* Close */}
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>

            {/* Branding */}
            <View style={styles.brandRow}>
              <Text style={styles.logo}>Raw1</Text>
              <Text style={styles.tagline}>Choose how you want to start</Text>
            </View>

            {/* Cards */}
            <View style={cardContainerStyle}>
              <GripcuffCard
                orderNumber={orderNumber}
                setOrderNumber={setOrderNumber}
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
      {/* Backdrop tap area */}
      <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={handleClose} activeOpacity={1} />

      <View style={[styles.sheet, styles.nativeSheet]}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>

          <View style={styles.brandRow}>
            <Text style={styles.logo}>Raw1</Text>
            <Text style={styles.tagline}>Choose how you want to start</Text>
          </View>

          <View style={cardContainerStyle}>
            <GripcuffCard
              orderNumber={orderNumber}
              setOrderNumber={setOrderNumber}
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
        </ScrollView>
      </View>
    </Animated.View>
  );
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const GripcuffCard = ({
  orderNumber,
  setOrderNumber,
  orderError,
  loading,
  onSubmit,
  flex,
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
      onChangeText={(v) => { setOrderNumber(v); }}
      autoCapitalize="none"
      editable={!loading}
    />
    {!!orderError && <Text style={styles.errorText}>{orderError}</Text>}
    <TouchableOpacity
      style={[styles.cardBtn, loading && styles.btnDisabled]}
      onPress={onSubmit}
      disabled={loading}
      activeOpacity={0.85}
    >
      <Text style={styles.cardBtnText}>{loading ? 'Checking...' : 'Activate Free Access'}</Text>
    </TouchableOpacity>
  </View>
);

const SubscriptionCard = ({
  loading,
  onSubscribe,
  flex,
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
      {['Unlimited workout videos', 'Stretch and rehab programs', 'New content every week'].map((f) => (
        <Text key={f} style={styles.featureItem}>• {f}</Text>
      ))}
    </View>
    <TouchableOpacity
      style={[styles.cardBtn, loading && styles.btnDisabled]}
      onPress={onSubscribe}
      disabled={loading}
      activeOpacity={0.85}
    >
      <Text style={styles.cardBtnText}>{loading ? 'Loading...' : 'Start Subscription'}</Text>
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
    marginTop: 4,
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
});
