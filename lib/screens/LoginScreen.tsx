import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useAuth } from '../providers/AuthContext';
import { AppTheme, FontSizes, FontWeights } from '../core/theme/app_theme';
import { getWorkoutVideoUrl } from '../constants/videoUrls';

const BG_VIDEO_URL = getWorkoutVideoUrl('signup_login');

export const LoginScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, error, clearError } = useAuth();

  const bgPlayer = useVideoPlayer(BG_VIDEO_URL, player => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      clearError();
      await login(email.trim(), password);
    } catch (err) {
      const msg = (err as Error).message;
      let friendlyMsg = 'Login failed. Please try again.';
      if (msg.includes('invalid-credential') || msg.includes('wrong-password')) {
        friendlyMsg = 'Incorrect email or password. Please try again.';
      } else if (msg.includes('user-not-found')) {
        friendlyMsg = 'No account found with this email. Please sign up first.';
      } else if (msg.includes('too-many-requests')) {
        friendlyMsg = 'Too many login attempts. Please try again later.';
      } else if (msg.includes('invalid-email')) {
        friendlyMsg = 'Please enter a valid email address.';
      }
      Alert.alert('Login Failed', friendlyMsg);
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
            <Text style={styles.title}>Raw1</Text>
            <Text style={styles.subtitle}>Fitness Training</Text>
          </View>

          <View style={styles.form}>
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
              placeholder="Enter your password"
              placeholderTextColor={AppTheme.textGrey}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              editable={!loading}
            />

            {error && <Text style={styles.errorText}>{error}</Text>}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{loading ? 'Logging in...' : 'Login'}</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              onPress={() => navigation?.navigate('SignUp')}
              disabled={loading}
            >
              <Text style={styles.signUpText}>
                Don't have an account? <Text style={styles.signUpLink}>Sign Up</Text>
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
  signUpText: {
    textAlign: 'center',
    color: AppTheme.textGrey,
    fontSize: FontSizes.body,
  },
  signUpLink: {
    color: AppTheme.primaryColor,
    fontWeight: FontWeights.semibold as any,
  },
});
