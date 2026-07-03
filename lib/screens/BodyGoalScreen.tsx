/**
 * BodyGoalScreen — combined "My Body & Goals" editor (all-in-one, no toggle).
 *
 * One scrollable page:
 *   • My Body          — gender / height / weight / age + injury & tightness
 *                        markers placed on the 3D figure (BodyVisualizer). Goal
 *                        targets are painted on the same model.
 *   • Help With & Goals — everything you're working on (conditions + goals) read
 *                        back as ONE table, with the goal builder kept below for
 *                        adding/editing. A single Save persists body + goals.
 */
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { AmbientBackground } from '../components/theme';
import { useAuth } from '../providers/AuthContext';
import { useUser } from '../providers/UserContext';
import BodyVisualizer, { BodyMetrics, conditionRows } from '../components/profile/BodyVisualizer';
import GoalVisualizer, { goalHighlights } from '../components/profile/GoalVisualizer';
import { GoalEntry } from '../models/User';

const C = { text: '#211832', muted: '#7A7C90', border: 'rgba(33,24,50,0.08)', cardBg: '#F8F8FC', orange: '#F25912' };

export const BodyGoalScreen = () => {
  const navigation = useNavigation<any>();
  const { supabaseUserId } = useAuth();
  const { profile, updateProfile } = useUser();
  const { height } = useWindowDimensions();

  const [saving, setSaving] = useState(false);
  // Body metrics (incl. conditions) and goals are lifted here so the single body
  // model, the combined table and the goal builder all read/write the same state.
  const [metrics, setMetrics] = useState<BodyMetrics>(() => ({
    gender: profile?.gender === 'female' ? 'female' : 'male',
    heightCm: profile?.heightCm ?? 170,
    weightKg: profile?.weightKg ?? 70,
    age: profile?.age ?? 25,
    conditions: profile?.bodyConditions ?? [],
  }));
  const [goals, setGoals] = useState<GoalEntry[]>(() => profile?.goals ?? []);
  const goalHL = useMemo(() => goalHighlights(goals), [goals]);

  const canvasHeight = Math.round(Math.min(500, Math.max(330, height * 0.44)));

  // Body-condition rows for the top of the combined table (injuries / tight
  // areas placed on the figure). Goals live in the goal builder rendered right
  // below inside the same table card, so they're not duplicated here.
  const conditions = useMemo(() =>
    conditionRows(metrics.conditions).map((r, i) => ({
      ...r,
      remove: () => setMetrics(m => ({ ...m, conditions: m.conditions.filter((_, idx) => idx !== i) })),
    })),
  [metrics.conditions]);

  const save = async () => {
    if (!supabaseUserId) return;
    setSaving(true);
    try {
      await updateProfile(supabaseUserId, {
        gender: metrics.gender,
        age: Math.round(metrics.age),
        heightCm: Math.round(metrics.heightCm),
        weightKg: Math.round(metrics.weightKg),
        bodyConditions: metrics.conditions,
        // Drop blank part-goals (e.g. the builder's untouched default card).
        goals: goals.filter(g =>
          g.type === 'weight_loss'
            ? (g.kg ?? 0) > 0
            : ((g.type === 'muscle_growth' ? g.muscles : g.areas)?.length ?? 0) > 0,
        ),
      });
    } catch (err) {
      console.warn('Failed to save body & goals', err);
      Alert.alert('Could not save', 'Please try again.');
    } finally {
      setSaving(false);
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
            Set your gender, height, weight and age, and tap the figure to mark injuries, tight areas
            or goal targets. Everything you pick shows up in the table below.
          </Text>
          <BodyVisualizer
            name={profile?.fullName}
            gender={profile?.gender}
            heightCm={profile?.heightCm}
            weightKg={profile?.weightKg}
            age={profile?.age}
            conditions={metrics.conditions}
            extraMuscles={goalHL.muscles}
            extraGroupColors={goalHL.colors}
            goals={goals}
            onGoalsChange={setGoals}
            onCommit={setMetrics}
            hideConditionsBlock
            canvasHeight={canvasHeight}
          />

          <View style={s.divider} />

          {/* ── Help with & Goals — one combined table + the goal builder ────── */}
          <Text style={s.sectionTitle}>Help With &amp; Goals</Text>
          <Text style={s.intro}>
            Everything you're working toward in one place. Tap the figure above to mark injuries and
            tight areas, and add or edit goals right in the table below. Tap ✕ to remove a row.
          </Text>

          {/* One combined table: body conditions on top, then the goal builder
              (active goals + "Add a goal") rendered inside the same card so it
              all reads as a single list — no duplicated goal rows. */}
          <View style={s.table}>
            <View style={[s.tr, s.trHead]}>
              <Text style={[s.th, s.colType]}>Type</Text>
              <Text style={[s.th, s.colFocus]}>Focus</Text>
              <View style={s.colX} />
            </View>

            {conditions.map((r, i) => (
              <View key={i} style={s.tr}>
                <View style={[s.colType, s.typeCell]}>
                  <MaterialCommunityIcons name={r.icon as any} size={15} color={r.color} style={{ marginRight: 6 }} />
                  <Text style={[s.typeText, { color: r.color }]} numberOfLines={1}>{r.label}</Text>
                </View>
                <Text style={[s.td, s.colFocus]} numberOfLines={2}>{r.focus || '—'}</Text>
                <TouchableOpacity
                  style={s.colX}
                  onPress={r.remove}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.7}
                >
                  <Text style={s.xText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}

            {/* Goal builder — active goals as expandable rows + add (no 2nd figure;
                goals paint on the body model above). */}
            <GoalVisualizer
              name={profile?.fullName}
              gender={profile?.gender}
              heightCm={profile?.heightCm}
              weightKg={profile?.weightKg}
              goals={goals}
              hideModel
              hideSave
              onChange={setGoals}
              canvasHeight={canvasHeight}
            />
          </View>

          {/* ── One Save for body + goals ─────────────────────────────────── */}
          <TouchableOpacity
            style={[s.saveBtn, saving && { opacity: 0.6 }]}
            activeOpacity={0.85}
            disabled={saving}
            onPress={save}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Save</Text>}
          </TouchableOpacity>
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
  intro: { color: C.muted, fontSize: 14, lineHeight: 20, marginBottom: 12 },
  divider: { height: 1, backgroundColor: 'rgba(33,24,50,0.06)', marginVertical: 16 },

  // Combined Help-with / Goals table
  table: {
    backgroundColor: C.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    marginBottom: 4,
  },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  trHead: { backgroundColor: 'rgba(33,24,50,0.03)' },
  th: { color: C.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  td: { color: C.text, fontSize: 13, fontWeight: '600' },
  colType: { width: 150 },
  colFocus: { flex: 1, paddingRight: 8 },
  colX: { width: 24, alignItems: 'center', justifyContent: 'center' },
  typeCell: { flexDirection: 'row', alignItems: 'center' },
  typeText: { fontSize: 13, fontWeight: '800', flexShrink: 1 },
  xText: { color: C.muted, fontSize: 14, fontWeight: '900' },

  saveBtn: {
    marginTop: 20,
    height: 52,
    borderRadius: 14,
    backgroundColor: C.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});

export default BodyGoalScreen;
