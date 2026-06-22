/**
 * HowILookNowScreen — full-screen "How I look now" editor.
 *
 * Shows the body silhouette on the ruler with gender / height / weight / age
 * controls and a prominent Save button that persists to the user profile.
 * Reached from the profile's "How I look now" card.
 */
import React, { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

import { useAuth } from '../providers/AuthContext';
import { useUser } from '../providers/UserContext';
import BodyVisualizer, { BodyMetrics } from '../components/profile/BodyVisualizer';

const C = {
  bg:     '#EEEEF2',
  card:   '#F8F8FC',
  text:   '#211832',
  muted:  '#7A7C90',
  border: 'rgba(33,24,50,0.08)',
};

export const HowILookNowScreen = () => {
  const navigation = useNavigation<any>();
  const { supabaseUserId } = useAuth();
  const { profile, updateProfile } = useUser();
  const { height } = useWindowDimensions();
  const [saving, setSaving] = useState(false);

  const canvasHeight = Math.round(Math.min(520, Math.max(340, height * 0.46)));

  const handleSave = async (m: BodyMetrics) => {
    if (!supabaseUserId) return;
    setSaving(true);
    try {
      await updateProfile(supabaseUserId, {
        gender: m.gender,
        age: Math.round(m.age),
        heightCm: Math.round(m.heightCm),
        weightKg: Math.round(m.weightKg),
        bodyConditions: m.conditions,
      });
      navigation.goBack();
    } catch (err) {
      console.warn('Failed to save body metrics', err);
      Alert.alert('Could not save', 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ChevronLeft size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>How I look now</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.intro}>
          Set your gender, height, weight and age — your body figure updates live. Tap Save when it looks right.
        </Text>

        <BodyVisualizer
          name={profile?.fullName}
          gender={profile?.gender}
          heightCm={profile?.heightCm}
          weightKg={profile?.weightKg}
          age={profile?.age}
          conditions={profile?.bodyConditions}
          canvasHeight={canvasHeight}
          saving={saving}
          onSave={handleSave}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.bg,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: C.text, fontSize: 18, fontWeight: '800' },
  content: {
    padding: 16,
    paddingBottom: Platform.OS === 'web' ? 40 : 24,
  },
  intro: { color: C.muted, fontSize: 14, lineHeight: 20, marginBottom: 16 },
});

export default HowILookNowScreen;
