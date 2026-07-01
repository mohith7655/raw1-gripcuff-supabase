/**
 * BodyGoalScreen — combined "My Body & Goals" editor (all-in-one, no toggle).
 *
 * Merges what used to be two separate screens (HowILookNow + Goals) into ONE
 * scrollable section:
 *   • Look & Injuries — gender / height / weight / age + injury & tightness
 *                       markers placed on the 3D figure (BodyVisualizer)
 *   • Goals           — body-transformation goals previewed on the figure
 *                       (GoalVisualizer)
 * Each part has its own Save (they persist different profile fields). Saving
 * does NOT leave the screen, so you can edit both in one visit.
 */
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

import { AmbientBackground } from '../components/theme';
import { useAuth } from '../providers/AuthContext';
import { useUser } from '../providers/UserContext';
import BodyVisualizer, { BodyMetrics } from '../components/profile/BodyVisualizer';
import GoalVisualizer, { GoalData, goalHighlights } from '../components/profile/GoalVisualizer';
import { GoalEntry } from '../models/User';

const C = { text: '#211832', muted: '#7A7C90' };

export const BodyGoalScreen = () => {
  const navigation = useNavigation<any>();
  const { supabaseUserId } = useAuth();
  const { profile, updateProfile } = useUser();
  const { height } = useWindowDimensions();

  const [savingBody, setSavingBody] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);
  // Live goal list (mirrored from the goal builder) so the SINGLE body model can
  // paint goal targets alongside injuries.
  const [goals, setGoals] = useState<GoalEntry[]>(() => profile?.goals ?? []);
  const goalHL = useMemo(() => goalHighlights(goals), [goals]);

  const canvasHeight = Math.round(Math.min(500, Math.max(330, height * 0.44)));

  const saveBody = async (m: BodyMetrics) => {
    if (!supabaseUserId) return;
    setSavingBody(true);
    try {
      await updateProfile(supabaseUserId, {
        gender: m.gender,
        age: Math.round(m.age),
        heightCm: Math.round(m.heightCm),
        weightKg: Math.round(m.weightKg),
        bodyConditions: m.conditions,
      });
    } catch (err) {
      console.warn('Failed to save body metrics', err);
      Alert.alert('Could not save', 'Please try again.');
    } finally {
      setSavingBody(false);
    }
  };

  const saveGoal = async (data: GoalData) => {
    if (!supabaseUserId) return;
    setSavingGoal(true);
    try {
      await updateProfile(supabaseUserId, { goals: data.goals });
    } catch (err) {
      console.warn('Failed to save goal', err);
      Alert.alert('Could not save', 'Please try again.');
    } finally {
      setSavingGoal(false);
    }
  };

  return (
    <AmbientBackground>
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <ChevronLeft size={24} color={C.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>My Body &amp; Goals</Text>
          <View style={s.backBtn} />
        </View>

        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── ONE body model: look + injuries (tap) + goal targets (painted) ── */}
          <Text style={s.sectionTitle}>My Body</Text>
          <Text style={s.intro}>
            Set your gender, height, weight and age, and tap the figure to mark injuries or tight
            areas. Your goal targets are painted on the same model below. Tap Save when it looks right.
          </Text>
          <BodyVisualizer
            name={profile?.fullName}
            gender={profile?.gender}
            heightCm={profile?.heightCm}
            weightKg={profile?.weightKg}
            age={profile?.age}
            conditions={profile?.bodyConditions}
            extraMuscles={goalHL.muscles}
            extraGroupColors={goalHL.colors}
            goals={goals}
            onGoalsChange={setGoals}
            canvasHeight={canvasHeight}
            saving={savingBody}
            onSave={saveBody}
          />

          <View style={s.divider} />

          {/* ── Goals (no second figure — picked from lists, shown on the model above) ── */}
          <Text style={s.sectionTitle}>Goals</Text>
          <Text style={s.intro}>
            Choose what you're working toward and pick the muscles or body parts from the lists —
            they're highlighted on the model above. Add as many goals as you like.
          </Text>
          <GoalVisualizer
            name={profile?.fullName}
            gender={profile?.gender}
            heightCm={profile?.heightCm}
            weightKg={profile?.weightKg}
            goals={goals}
            hideModel
            onChange={setGoals}
            canvasHeight={canvasHeight}
            saving={savingGoal}
            onSave={saveGoal}
          />
        </ScrollView>
      </SafeAreaView>
    </AmbientBackground>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(33,24,50,0.06)',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: C.text, fontSize: 18, fontWeight: '800' },

  content: { padding: 16, paddingBottom: Platform.OS === 'web' ? 40 : 24 },
  sectionTitle: { color: C.text, fontSize: 18, fontWeight: '800', marginBottom: 6 },
  intro: { color: C.muted, fontSize: 14, lineHeight: 20, marginBottom: 16 },
  divider: { height: 1, backgroundColor: 'rgba(33,24,50,0.06)', marginVertical: 24 },
});

export default BodyGoalScreen;
