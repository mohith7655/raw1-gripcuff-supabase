import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Animated,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useAuth } from '../providers/AuthContext';

const ORANGE = '#FF6B00';
const BG_VIDEO_URL =
  'https://firebasestorage.googleapis.com/v0/b/wazy-6c4a9.firebasestorage.app/o/Raw1-intro-app.mp4?alt=media&token=bc49d4aa-214e-4422-963b-f6d077d0d89c';

type ModalType = 'login' | 'signup' | null;

const isWeb = Platform.OS === 'web';

export const WelcomeScreen = () => {
  const insets = useSafeAreaInsets();
  const bgPlayer = useVideoPlayer(BG_VIDEO_URL, player => {
    player.loop = true;
    player.muted = true;
    player.play();
  });
  const { login, signup, clearError } = useAuth();
  const { width: winWidth } = useWindowDimensions();

  // Real visible height — 100vh breaks on mobile browsers because it includes
  // the collapsing address bar. We capture window.innerHeight on mount and
  // every resize instead.
  const [appHeight, setAppHeight] = useState<number>(() => {
    if (isWeb && typeof window !== 'undefined') return window.innerHeight;
    return Dimensions.get('window').height;
  });

  useEffect(() => {
    if (!isWeb || typeof window === 'undefined') return;
    const update = () => {
      const h = window.innerHeight;
      document.documentElement.style.setProperty('--app-height', `${h}px`);
      setAppHeight(h);
    };
    window.addEventListener('resize', update);
    update();
    return () => window.removeEventListener('resize', update);
  }, []);

  // Responsive card width: mobile=full, tablet=420, desktop=400
  const cardWidth: number | '100%' =
    !isWeb || winWidth < 480 ? '100%' : winWidth < 768 ? 420 : 400;
  const cardLeft =
    typeof cardWidth === 'number' ? (winWidth - cardWidth) / 2 : 0;

  // --- form state ---
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const slideAnim = useRef(new Animated.Value(appHeight)).current;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setFullName('');
    setConfirmPassword('');
    setLoading(false);
    setFocusedInput(null);
  };

  const openModal = useCallback(
    (type: ModalType) => {
      clearError?.();
      resetForm();
      setActiveModal(type);
      slideAnim.setValue(appHeight);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: Platform.OS !== 'web',
        tension: 60,
        friction: 12,
      }).start();
    },
    [slideAnim, appHeight],
  );

  const closeModal = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: appHeight,
      duration: 260,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      setActiveModal(null);
      resetForm();
    });
  }, [slideAnim, appHeight]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    try {
      setLoading(true);
      await login(email.trim(), password);
    } catch (err) {
      const msg = (err as Error).message;
      let friendly = 'Login failed. Please try again.';
      if (msg.includes('invalid-credential') || msg.includes('wrong-password'))
        friendly = 'Incorrect email or password.';
      else if (msg.includes('user-not-found'))
        friendly = 'No account found with this email.';
      else if (msg.includes('too-many-requests'))
        friendly = 'Too many attempts. Please try again later.';
      else if (msg.includes('invalid-email'))
        friendly = 'Please enter a valid email address.';
      Alert.alert('Login Failed', friendly);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!fullName || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    try {
      setLoading(true);
      await signup(email.trim(), password, fullName.trim());
    } catch (err) {
      const msg = (err as Error).message;
      let friendly = 'Sign up failed. Please try again.';
      if (msg.includes('email-already-in-use'))
        friendly = 'This email is already registered. Please log in.';
      else if (msg.includes('weak-password'))
        friendly = 'Password is too weak. Use at least 6 characters.';
      else if (msg.includes('invalid-email'))
        friendly = 'Please enter a valid email address.';
      Alert.alert('Sign Up Failed', friendly);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field: string) => [
    styles.input,
    focusedInput === field && styles.inputFocused,
  ];

  // Shared form content rendered inside both web and native sheets
  const renderSheetContent = () => (
    <ScrollView
      contentContainerStyle={[
        styles.sheetContent,
        isWeb
          ? ({ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' } as any)
          : { paddingBottom: Math.max(insets.bottom, 16) + 16 },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity style={styles.closeBtn} onPress={closeModal} hitSlop={12}>
        <Text style={styles.closeBtnText}>✕</Text>
      </TouchableOpacity>

      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle}>Raw1</Text>
        <Text style={styles.sheetSubtitle}>Fitness Training</Text>
      </View>

      {activeModal === 'signup' && (
        <TextInput
          style={inputStyle('fullName')}
          placeholder="Full Name"
          placeholderTextColor="#666"
          value={fullName}
          onChangeText={setFullName}
          onFocus={() => setFocusedInput('fullName')}
          onBlur={() => setFocusedInput(null)}
          editable={!loading}
          autoComplete="name"
        />
      )}

      <TextInput
        style={inputStyle('email')}
        placeholder="Email"
        placeholderTextColor="#666"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
        onFocus={() => setFocusedInput('email')}
        onBlur={() => setFocusedInput(null)}
        editable={!loading}
      />

      <TextInput
        style={inputStyle('password')}
        placeholder="Password"
        placeholderTextColor="#666"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        onFocus={() => setFocusedInput('password')}
        onBlur={() => setFocusedInput(null)}
        editable={!loading}
      />

      {activeModal === 'signup' && (
        <TextInput
          style={inputStyle('confirmPassword')}
          placeholder="Confirm Password"
          placeholderTextColor="#666"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          onFocus={() => setFocusedInput('confirmPassword')}
          onBlur={() => setFocusedInput(null)}
          editable={!loading}
        />
      )}

      <TouchableOpacity
        style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
        onPress={activeModal === 'login' ? handleLogin : handleSignUp}
        disabled={loading}
        activeOpacity={0.85}
      >
        <Text style={styles.submitBtnText}>
          {loading
            ? activeModal === 'login'
              ? 'Logging in...'
              : 'Creating account...'
            : activeModal === 'login'
              ? 'Log In'
              : 'Sign Up'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.toggleRow}
        onPress={() => openModal(activeModal === 'login' ? 'signup' : 'login')}
        disabled={loading}
      >
        <Text style={styles.toggleText}>
          {activeModal === 'login'
            ? "Don't have an account? "
            : 'Already have an account? '}
          <Text style={styles.toggleLink}>
            {activeModal === 'login' ? 'Sign Up' : 'Log In'}
          </Text>
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // ─────────────────────────────────────────────
  // WEB render — all positioning via inline styles
  // so we can use position:fixed, env(), vw units
  // ─────────────────────────────────────────────
  if (isWeb) {
    return (
      <View style={styles.root}>
        {/* Video: fixed wrapper with JS height — never 100vh */}
        <div
          style={({
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: `${appHeight}px`,
            background: '#000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            zIndex: 0,
          } as any)}
        >
          <video
            src={BG_VIDEO_URL}
            autoPlay
            loop
            muted
            playsInline
            style={({
              width: 'auto',
              height: `calc(${appHeight}px - 10px)`,
              maxWidth: '100%',
              objectFit: 'contain',
              paddingTop: 5,
              paddingBottom: 5,
              display: 'block',
            } as any)}
          />
        </div>

        {/* Buttons: fixed to bottom, respects safe-area & browser chrome */}
        <div
          style={({
            position: 'fixed',
            bottom: 0,
            left: cardLeft,
            width: typeof cardWidth === 'number' ? cardWidth : '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            padding: '0 24px',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
            zIndex: 10,
            boxSizing: 'border-box',
          } as any)}
        >
          <button
            onClick={() => openModal('signup')}
            style={({
              backgroundColor: ORANGE,
              border: 'none',
              borderRadius: 14,
              padding: '16px',
              color: '#fff',
              fontSize: 16,
              fontWeight: '700',
              cursor: 'pointer',
              letterSpacing: 0.3,
            } as any)}
          >
            Sign Up
          </button>
          <button
            onClick={() => openModal('login')}
            style={({
              backgroundColor: 'transparent',
              border: '1.5px solid rgba(255,255,255,0.85)',
              borderRadius: 14,
              padding: '15px',
              color: '#fff',
              fontSize: 16,
              fontWeight: '600',
              cursor: 'pointer',
              letterSpacing: 0.3,
            } as any)}
          >
            Log In
          </button>
        </div>

        {/* Modal: fixed overlay — avoids RN Modal portal z-index issues on web */}
        {activeModal !== null && (
          <div
            style={({
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: appHeight,
              zIndex: 20,
            } as any)}
          >
            {/* Backdrop */}
            <div
              onClick={closeModal}
              style={({
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.6)',
              } as any)}
            />

            {/* Sheet */}
            <Animated.View
              style={[
                {
                  position: 'absolute' as any,
                  bottom: 0,
                  left: cardLeft,
                  width: cardWidth,
                  maxHeight: appHeight * 0.80,
                  backgroundColor: '#1a1a1a',
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  overflow: 'hidden',
                  boxShadow: '0px 4px 10px rgba(0,0,0,0.2)',
                },
                { transform: [{ translateY: slideAnim }] },
              ]}
            >
              {renderSheetContent()}
            </Animated.View>
          </div>
        )}
      </View>
    );
  }

  // ─────────────────────────────────────────────
  // NATIVE render (iOS / Android)
  // ─────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <VideoView
        style={StyleSheet.absoluteFill}
        player={bgPlayer}
        contentFit="cover"
        nativeControls={false}
      />

      <View style={styles.overlay} />

      <View style={[styles.bottomSection, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}>
        <TouchableOpacity
          style={styles.signUpBtn}
          onPress={() => openModal('signup')}
          activeOpacity={0.85}
        >
          <Text style={styles.signUpBtnText}>Sign Up</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.loginBtn}
          onPress={() => openModal('login')}
          activeOpacity={0.85}
        >
          <Text style={styles.loginBtnText}>Log In</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={activeModal !== null}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeModal}
      >
        <TouchableWithoutFeedback onPress={closeModal}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            {renderSheetContent()}
          </KeyboardAvoidingView>
        </Animated.View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0)',
    zIndex: 1,
  },

  /* Native bottom buttons */
  bottomSection: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    gap: 16,
    zIndex: 2,
  },
  signUpBtn: {
    backgroundColor: ORANGE,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signUpBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  loginBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  /* Native modal */
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    boxShadow: '0px 4px 10px rgba(0,0,0,0.2)',
    elevation: 20,
  },

  /* Sheet content — shared web + native */
  sheetContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  closeBtn: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    padding: 4,
  },
  closeBtnText: {
    color: '#999',
    fontSize: 20,
    fontWeight: '500',
  },
  sheetHeader: {
    alignItems: 'center',
    marginBottom: 28,
    marginTop: 4,
  },
  sheetTitle: {
    fontSize: 40,
    fontWeight: '800',
    fontStyle: 'italic',
    color: ORANGE,
    letterSpacing: 1,
  },
  sheetSubtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#fff',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 15,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#333',
  },
  inputFocused: {
    borderColor: ORANGE,
  },
  submitBtn: {
    backgroundColor: ORANGE,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  submitBtnDisabled: {
    opacity: 0.55,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  toggleRow: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  toggleText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
  },
  toggleLink: {
    color: ORANGE,
    fontWeight: '600',
  },
});
