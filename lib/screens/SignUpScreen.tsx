import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useAuth } from '../providers/AuthContext';
import { AppTheme, FontSizes, FontWeights } from '../core/theme/app_theme';
import { getWorkoutVideoUrl } from '../constants/videoUrls';

const BG_VIDEO_URL = getWorkoutVideoUrl('signup_login');

export const SignUpScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup, error, clearError } = useAuth();

  const bgPlayer = useVideoPlayer(BG_VIDEO_URL, player => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  const handleSignUp = async () => {
    if (!email || !password || !fullName || !confirmPassword) {
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
      clearError();
      await signup(email.trim(), password, fullName.trim());
      navigation.reset({
        index: 0,
        routes: [{ name: 'Onboarding' }],
      });
    } catch (err) {
      const msg = (err as Error).message;
      let friendlyMsg = 'Sign up failed. Please try again.';
      if (msg.includes('email-already-in-use')) {
        friendlyMsg = 'This email is already registered. Please log in instead.';
      } else if (msg.includes('weak-password')) {
        friendlyMsg = 'Password is too weak. Please use at least 6 characters.';
      } else if (msg.includes('invalid-email')) {
        friendlyMsg = 'Please enter a valid email address.';
      }
      Alert.alert('Sign Up Failed', friendlyMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* Background Video */}
      <VideoView
        style={styles.bgVideo}
        player={bgPlayer}
        contentFit="cover"
        nativeControls={false}
      />

      {/* Dark overlay */}
      <View style={styles.overlay} />

      {/* Content */}
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <TouchableOpacity
              style={{ position: 'absolute', left: 0, top: 0, padding: 12, zIndex: 10 }}
              onPress={() => navigation.reset({ index: 0, routes: [{ name: 'HomeTabs' }] })}
            >
              <Text style={{ fontSize: 24, color: AppTheme.textGrey }}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join Raw1 Fitness</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              placeholderTextColor={AppTheme.textGrey}
              value={fullName}
              onChangeText={setFullName}
              editable={!loading}
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor={AppTheme.textGrey}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              editable={!loading}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter password (min 6 characters)"
              placeholderTextColor={AppTheme.textGrey}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              editable={!loading}
            />

            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Confirm your password"
              placeholderTextColor={AppTheme.textGrey}
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              editable={!loading}
            />

            {error && <Text style={styles.errorText}>{error}</Text>}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSignUp}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{loading ? 'Creating account...' : 'Sign Up'}</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              onPress={() => navigation?.navigate('Login')}
              disabled={loading}
            >
              <Text style={styles.loginText}>
                Already have an account? <Text style={styles.loginLink}>Login</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  bgVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 48,
    alignItems: 'center',
  },
  title: {
    fontSize: 40,
    fontWeight: FontWeights.bold as any,
    color: AppTheme.primaryColor,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: FontSizes.h3,
    fontWeight: FontWeights.semibold as any,
    color: AppTheme.textWhite,
  },
  form: {
    marginBottom: 32,
  },
  label: {
    fontSize: FontSizes.body,
    fontWeight: FontWeights.semibold as any,
    color: AppTheme.textWhite,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: AppTheme.textWhite,
    fontSize: FontSizes.body,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  button: {
    backgroundColor: AppTheme.primaryColor,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: AppTheme.textWhite,
    fontSize: FontSizes.body,
    fontWeight: FontWeights.bold as any,
  },
  errorText: {
    color: '#ff5252',
    fontSize: FontSizes.small,
    marginTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: 24,
  },
  loginText: {
    textAlign: 'center',
    color: AppTheme.textGrey,
    fontSize: FontSizes.body,
  },
  loginLink: {
    color: AppTheme.primaryColor,
    fontWeight: FontWeights.semibold as any,
  },
});
