/**
 * BodyDetailsScreen — fields-based editor for injuries & goals (NO 3D model).
 *
 * The "view all" counterpart to the 3D BodyGoalScreen: everything is editable
 * with plain controls (chips / segmented pickers / steppers), so you can quickly
 * adjust your body metrics, injuries and goals without the figure.
 */
import React, { useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Plus, X } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

import { AmbientBackground } from '../components/theme';
import { useAuth } from '../providers/AuthContext';
import { useUser } from '../providers/UserContext';
import { BodyCondition, BodyConditionType, GoalEntry, GoalType } from '../models/User';

const C = { text: '#211832', muted: '#7A7C90', orange: '#F25912', card: 'rgba(255,255,255,0.62)', border: 'rgba(255,255,255,0.9)' };

// Body parts available for injuries and body-part goals.
const PARTS: { key: string; label: string }[] = [
  { key: 'neck', label: 'Neck' }, { key: 'shoulder', label: 'Shoulder' },
  { key: 'chest', label: 'Chest' }, { key: 'arms', label: 'Arms' },
  { key: 'elbow', label: 'Elbow' }, { key: 'wrist', label: 'Wrist' },
  { key: 'abs', label: 'Abs' }, { key: 'back', label: 'Back' },
  { key: 'upper_back', label: 'Upper Back' }, { key: 'lower_back', label: 'Lower Back' },
  { key: 'hip', label: 'Hip' }, { key: 'glutes', label: 'Glutes' },
  { key: 'quads', label: 'Quads' }, { key: 'knee', label: 'Knee' },
  { key: 'calves', label: 'Calves' }, { key: 'ankle', label: 'Ankle' },
];
const MUSCLES = ['shoulders', 'chest', 'arms', 'back', 'abs', 'glutes', 'quads', 'calves'];
const partLabel = (k: string) => PARTS.find((p) => p.key === k)?.label ?? k;

const COND_TYPES: { key: BodyConditionType; label: string; color: string }[] = [
  { key: 'tightness', label: 'Tightness', color: '#d97706' },
  { key: 'pain', label: 'Pain', color: '#ea580c' },
  { key: 'injury', label: 'Injury', color: '#dc2626' },
];
const SIDES: { key: 'left' | 'right' | 'both'; label: string }[] = [
  { key: 'both', label: 'Both' }, { key: 'left', label: 'Left' }, { key: 'right', label: 'Right' },
];
const GOAL_TYPES: { key: GoalType; label: string; emoji: string; color: string }[] = [
  { key: 'muscle_growth', label: 'Muscle Growth', emoji: '💪', color: '#16a34a' },
  { key: 'weight_loss', label: 'Weight Loss', emoji: '🔥', color: '#F25912' },
  { key: 'injury_rehab', label: 'Injury Rehab', emoji: '🩹', color: '#dc2626' },
  { key: 'stretching', label: 'Stretching', emoji: '🧘', color: '#2563eb' },
];
const MAX_MUSCLES = 3;

export const BodyDetailsScreen = () => {
  const navigation = useNavigation<any>();
  const { supabaseUserId } = useAuth();
  const { profile, updateProfile } = useUser();

  const [conditions, setConditions] = useState<BodyCondition[]>(() => profile?.bodyConditions ?? []);
  const [goals, setGoals] = useState<GoalEntry[]>(() => profile?.goals ?? []);
  const [saving, setSaving] = useState(false);

  // ── Injuries ──
  const addCondition = () => setConditions((p) => [...p, { part: 'knee', type: 'tightness', side: 'both' }]);
  const updateCondition = (i: number, patch: Partial<BodyCondition>) =>
    setConditions((p) => p.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const removeCondition = (i: number) => setConditions((p) => p.filter((_, idx) => idx !== i));

  // ── Goals ──
  const addGoal = () => setGoals((p) => [...p, { type: 'muscle_growth', muscles: [] }]);
  const updateGoal = (i: number, patch: Partial<GoalEntry>) =>
    setGoals((p) => p.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));
  const setGoalType = (i: number, type: GoalType) =>
    setGoals((p) => p.map((g, idx) => (idx === i
      ? (type === 'weight_loss' ? { type, kg: 5 } : type === 'muscle_growth' ? { type, muscles: [] } : { type, areas: [], side: 'both' })
      : g)));
  const removeGoal = (i: number) => setGoals((p) => p.filter((_, idx) => idx !== i));
  const toggleGoalPart = (i: number, key: string) => {
    const g = goals[i];
    if (g.type === 'weight_loss') return;
    const muscle = g.type === 'muscle_growth';
    const cur = (muscle ? g.muscles : g.areas) ?? [];
    const has = cur.includes(key);
    const next = has ? cur.filter((x) => x !== key) : muscle && cur.length >= MAX_MUSCLES ? cur : [...cur, key];
    updateGoal(i, muscle ? { muscles: next } : { areas: next });
  };

  const save = async () => {
    if (!supabaseUserId) return;
    setSaving(true);
    try {
      await updateProfile(supabaseUserId, { bodyConditions: conditions, goals });
      navigation.goBack();
    } catch (err) {
      console.warn('Failed to save body details', err);
      Alert.alert('Could not save', 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const Chip = ({ label, on, color, onPress }: { label: string; on: boolean; color: string; onPress: () => void }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[s.chip, on ? { backgroundColor: `${color}1A`, borderColor: color } : { borderColor: 'rgba(33,24,50,0.12)' }]}
    >
      <Text style={[s.chipText, { color: on ? color : C.muted }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <AmbientBackground>
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <ChevronLeft size={24} color={C.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Edit details</Text>
          <View style={s.backBtn} />
        </View>

        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          {/* ── Injuries ── */}
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>Injuries &amp; tightness</Text>
            <TouchableOpacity style={s.addBtn} onPress={addCondition} activeOpacity={0.8}>
              <Plus size={15} color={C.orange} />
              <Text style={s.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
          {conditions.length === 0 && <Text style={s.empty}>No injuries reported. Tap Add to log one.</Text>}
          {conditions.map((c, i) => (
            <View key={i} style={s.itemCard}>
              <View style={s.itemTopRow}>
                <Text style={s.itemLabel}>Body part</Text>
                <TouchableOpacity onPress={() => removeCondition(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={16} color={C.muted} />
                </TouchableOpacity>
              </View>
              <View style={s.chipWrap}>
                {PARTS.map((p) => (
                  <Chip key={p.key} label={p.label} on={c.part === p.key} color={C.orange} onPress={() => updateCondition(i, { part: p.key })} />
                ))}
              </View>
              <Text style={[s.itemLabel, { marginTop: 10 }]}>Type</Text>
              <View style={s.chipWrap}>
                {COND_TYPES.map((t) => (
                  <Chip key={t.key} label={t.label} on={c.type === t.key} color={t.color} onPress={() => updateCondition(i, { type: t.key })} />
                ))}
              </View>
              <Text style={[s.itemLabel, { marginTop: 10 }]}>Side</Text>
              <View style={s.chipWrap}>
                {SIDES.map((sd) => (
                  <Chip key={sd.key} label={sd.label} on={(c.side ?? 'both') === sd.key} color={C.orange} onPress={() => updateCondition(i, { side: sd.key })} />
                ))}
              </View>
            </View>
          ))}

          <View style={s.divider} />

          {/* ── Goals ── */}
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>Goals</Text>
            <TouchableOpacity style={s.addBtn} onPress={addGoal} activeOpacity={0.8}>
              <Plus size={15} color={C.orange} />
              <Text style={s.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
          {goals.length === 0 && <Text style={s.empty}>No goals set. Tap Add to create one.</Text>}
          {goals.map((g, i) => {
            const tMeta = GOAL_TYPES.find((t) => t.key === g.type)!;
            const muscle = g.type === 'muscle_growth';
            const partKeys = muscle ? MUSCLES : PARTS.map((p) => p.key);
            const selected = (muscle ? g.muscles : g.areas) ?? [];
            return (
              <View key={i} style={s.itemCard}>
                <View style={s.itemTopRow}>
                  <Text style={s.itemLabel}>Goal {i + 1}</Text>
                  <TouchableOpacity onPress={() => removeGoal(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <X size={16} color={C.muted} />
                  </TouchableOpacity>
                </View>
                <View style={s.chipWrap}>
                  {GOAL_TYPES.map((t) => (
                    <Chip key={t.key} label={`${t.emoji} ${t.label}`} on={g.type === t.key} color={t.color} onPress={() => setGoalType(i, t.key)} />
                  ))}
                </View>

                {g.type === 'weight_loss' ? (
                  <View style={{ marginTop: 12 }}>
                    <Text style={s.itemLabel}>Kg to lose: {g.kg ?? 0}</Text>
                    <View style={s.stepperRow}>
                      <TouchableOpacity style={s.stepBtn} onPress={() => updateGoal(i, { kg: Math.max(1, (g.kg ?? 1) - 1) })}>
                        <Text style={s.stepBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={s.stepValue}>{g.kg ?? 0} kg</Text>
                      <TouchableOpacity style={s.stepBtn} onPress={() => updateGoal(i, { kg: Math.min(60, (g.kg ?? 0) + 1) })}>
                        <Text style={s.stepBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <>
                    <Text style={[s.itemLabel, { marginTop: 10 }]}>
                      {muscle ? `Muscles (up to ${MAX_MUSCLES})` : 'Body parts'} · {selected.length} selected
                    </Text>
                    <View style={s.chipWrap}>
                      {partKeys.map((k) => (
                        <Chip key={k} label={partLabel(k)} on={selected.includes(k)} color={tMeta.color} onPress={() => toggleGoalPart(i, k)} />
                      ))}
                    </View>
                  </>
                )}
              </View>
            );
          })}

          <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} activeOpacity={0.85}>
            <Text style={s.saveBtnText}>{saving ? 'Saving…' : 'Save details'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </AmbientBackground>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(33,24,50,0.06)',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  // Consistent type scale: titles 16 · all field text 13 · button 15.
  headerTitle: { color: C.text, fontSize: 16, fontWeight: '800' },
  content: { padding: 16, paddingBottom: Platform.OS === 'web' ? 48 : 32 },

  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { color: C.text, fontSize: 16, fontWeight: '800' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, backgroundColor: 'rgba(242,89,18,0.1)' },
  addBtnText: { color: C.orange, fontSize: 13, fontWeight: '700' },
  empty: { color: C.muted, fontSize: 13, fontWeight: '500', marginBottom: 8 },

  itemCard: {
    backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border,
    padding: 14, marginBottom: 12,
    shadowColor: '#211832', shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 4,
  },
  itemTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  itemLabel: { color: C.muted, fontSize: 13, fontWeight: '700' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 7 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: '700' },

  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 },
  stepBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(33,24,50,0.06)' },
  stepBtnText: { color: C.text, fontSize: 20, fontWeight: '700', lineHeight: 22 },
  stepValue: { color: C.text, fontSize: 13, fontWeight: '800', minWidth: 60, textAlign: 'center' },

  divider: { height: 1, backgroundColor: 'rgba(33,24,50,0.06)', marginVertical: 22 },
  saveBtn: { marginTop: 8, backgroundColor: C.orange, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});

export default BodyDetailsScreen;
