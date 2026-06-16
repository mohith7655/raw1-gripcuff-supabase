/**
 * GoalsScreen — full-screen "My Goal" editor.
 *
 * Pick a body-transformation goal (weight loss / muscle growth / injury rehab)
 * and preview it on the silhouette, then Save. Reached from the profile card.
 */
import React, { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

import { useAuth } from '../providers/AuthContext';
import { useUser } from '../providers/UserContext';
import GoalVisualizer, { GoalData } from '../components/profile/GoalVisualizer';

const C = {
  bg:     '#EEEEF2',
  text:   '#211832',
  muted:  '#7A7C90',
  border: 'rgba(33,24,50,0.08)',
};

export const GoalsScreen = () => {
  const navigation = useNavigation<any>();
  const { supabaseUserId } = useAuth();
  const { profile, updateProfile } = useUser();
  const { height } = useWindowDimensions();
  const [saving, setSaving] = useState(false);

  const canvasHeight = Math.round(Math.min(480, Math.max(320, height * 0.42)));

  const handleSave = async (data: GoalData) => {
    if (!supabaseUserId) return;
    setSaving(true);
    try {
      await updateProfile(supabaseUserId, {
        goals: data.goals,
      });
      navigation.goBack();
    } catch (err) {
      console.warn('Failed to save goal', err);
      Alert.alert('Could not save', 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ChevronLeft size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>My Goal</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.intro}>
          Choose what you're working toward — the figure updates to preview your goal.
        </Text>

        <GoalVisualizer
          name={profile?.fullName}
          gender={profile?.gender}
          heightCm={profile?.heightCm}
          weightKg={profile?.weightKg}
          goals={profile?.goals}
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
  content: { padding: 16, paddingBottom: Platform.OS === 'web' ? 40 : 24 },
  intro: { color: C.muted, fontSize: 14, lineHeight: 20, marginBottom: 16 },
});

export default GoalsScreen;
