import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../providers/AuthContext';
import { useUser } from '../providers/UserContext';
import { AppTheme, FontSizes, FontWeights } from '../core/theme/app_theme';

export const SplashScreen = ({ navigation }: any) => {
  const { supabaseUserId, loading: authLoading } = useAuth();
  const { fetchProfile } = useUser();

  useEffect(() => {
    if (authLoading) return;

    // Fire profile fetch in background using Supabase user ID (not Firebase UID).
    // The Supabase `users` table is keyed by supabaseUserId.
    if (supabaseUserId) {
      fetchProfile(supabaseUserId).catch((err) =>
        console.warn('Background profile fetch failed:', err)
      );
    }

    // Always navigate to auth screen immediately
    const timer = setTimeout(() => {
      navigation.reset({
        index: 0,
        routes: [{ name: 'AuthStack' }],
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [authLoading]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <Text style={styles.title}>Raw1</Text>
        <Text style={styles.subtitle}>Fitness Training</Text>
        <ActivityIndicator size="large" color={AppTheme.primaryColor} style={styles.loader} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AppTheme.background,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 50,
    fontWeight: FontWeights.bold as any,
    color: AppTheme.primaryColor,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: FontSizes.h3,
    fontWeight: FontWeights.semibold as any,
    color: AppTheme.textWhite,
    marginBottom: 48,
  },
  loader: {
    marginVertical: 24,
  },
  loadingText: {
    fontSize: FontSizes.body,
    color: AppTheme.textGrey,
    marginTop: 24,
  },
});
