/**
 * BodyGoalComparison — home-screen "My Body" card.
 *
 * A SINGLE 3D body (sized to the current girth) that visualises everything in
 * one place:
 *   • Injury conditions  → a 🩹 bandage badge pinned on that body part.
 *   • Tightness          → a ⚡ badge (distinct from injury) on that body part.
 *   • Muscle-growth goals → a "💪 (Abs)" chip next to the target muscle, with
 *     the muscle painted green on the figure.
 *
 * A summary beneath spells out the metrics, what to "help with", and the goals.
 * The figure and each summary block deep-link to their editors.
 */
import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import MuscleVisualizer from '../MuscleVisualizer';
import { BodyCondition, GoalEntry } from '../../models/User';
import { loadUnits, fmtHeight, fmtWeight, UnitSystem } from '../../utils/units';
import { useBodyInsights } from '../../hooks/useBodyInsights';

const HIT = { top: 8, bottom: 8, left: 8, right: 8 };

const C = {
  orange: '#F25912',
  indigo: '#4C4E78',
  green:  '#16a34a',
  text:   '#211832',
  muted:  '#7A7C90',
  canvas: '#EEEEF2',
  cardBg: '#F8F8FC',
  border: 'rgba(33,24,50,0.08)',
};

const HEIGHT_MIN = 120, HEIGHT_MAX = 215;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const girthFromBmi = (bmi: number) => clamp(1 + (bmi - 22) * 0.022, 0.86, 1.34);
const bmiLabel = (bmi: number) => (bmi < 18.5 ? 'lean' : bmi < 25 ? 'normal' : bmi < 30 ? 'curvy' : 'heavy');

// goal/condition body-part key (e.g. "chest::left", "knee") → MuscleVisualizer
// highlight group. Covers muscle-growth, stretching and injury-rehab parts.
const AREA_TO_GROUP: Record<string, string> = {
  shoulders: 'Shoulders', shoulder: 'Shoulders',
  chest: 'Chest', arms: 'Arms',
  back: 'Back', upper_back: 'Back', lower_back: 'Back',
  abs: 'Abs', glutes: 'Glutes', quads: 'Quads', calves: 'Calves',
  neck: 'Neck', elbow: 'Elbow', wrist: 'Wrist', hip: 'Hip', knee: 'Knee', ankle: 'Ankle',
};
const prettyKey = (k: string) =>
  k.split('::')[0].replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// Front-facing 2D positions for pinning condition icons onto the figure. `x` is
// the horizontal offset from centre (0.5); `y` is the fraction of figure height.
const FRONT_POS: Record<string, { x: number; y: number; both?: boolean }> = {
  neck:       { x: 0,    y: 0.16 },
  shoulders:  { x: 0.14, y: 0.27, both: true },
  chest:      { x: 0.09, y: 0.35, both: true },
  arms:       { x: 0.21, y: 0.46, both: true },
  upper_back: { x: 0,    y: 0.37 },
  back:       { x: 0,    y: 0.40 },
  lower_back: { x: 0,    y: 0.47 },
  abs:        { x: 0,    y: 0.49 },
  elbow:      { x: 0.18, y: 0.45, both: true },
  wrist:      { x: 0.19, y: 0.59, both: true },
  hip:        { x: 0.10, y: 0.55, both: true },
  glutes:     { x: 0.08, y: 0.56, both: true },
  quads:      { x: 0.08, y: 0.66, both: true },
  knee:       { x: 0.07, y: 0.77, both: true },
  calves:     { x: 0.06, y: 0.86, both: true },
  ankle:      { x: 0.06, y: 0.93, both: true },
};

// Condition icons — injury = bandage, tightness = a clearly distinct mark.
// Colours match the summary lines.
type Chip = { key: string; emoji: string; label: string; color: string; soft: string; num?: number };

const COND_META: Record<string, { emoji: string; label: string; color: string; soft: string }> = {
  tightness: { emoji: '⚡', label: 'Tightness', color: '#b08900', soft: 'rgba(212,166,0,0.16)' },
  pain:      { emoji: '😣', label: 'Pain',      color: '#ea580c', soft: 'rgba(234,88,12,0.14)' },
  injury:    { emoji: '🩹', label: 'Injury',    color: '#dc2626', soft: 'rgba(220,38,38,0.12)' },
};

// One chip per condition (compact, colour-coded by type).
function condChips(conds: BodyCondition[]): Chip[] {
  return conds.map((c, i) => {
    const meta = COND_META[c.type];
    const side = c.side === 'left' ? 'Left ' : c.side === 'right' ? 'Right ' : '';
    return { key: `${c.part}-${c.side ?? 'both'}-${i}`, emoji: meta.emoji, label: `${side}${prettyKey(c.part)}`, color: meta.color, soft: meta.soft };
  });
}

const GOAL_META: Record<string, { emoji: string; verb: string; color: string; soft: string }> = {
  muscle_growth: { emoji: '🏋️', verb: 'Build',   color: '#16a34a', soft: 'rgba(22,163,74,0.12)' },
  weight_loss:   { emoji: '🔥', verb: 'Lose',    color: '#F25912', soft: 'rgba(242,89,18,0.12)' },
  injury_rehab:  { emoji: '🩹', verb: 'Rehab',   color: '#dc2626', soft: 'rgba(220,38,38,0.12)' },
  stretching:    { emoji: '🧘', verb: 'Stretch', color: '#4C4E78', soft: 'rgba(76,78,120,0.12)' },
};

// Short type label pinned next to a goal marker on the figure.
const GOAL_TYPE_LABEL: Record<string, string> = {
  muscle_growth: 'Muscle Growth',
  weight_loss:   'Weight Loss',
  injury_rehab:  'Rehab',
  stretching:    'Stretching',
};

// Flatten goals into one chip per target area (weight-loss stays a single chip);
// the emoji conveys the goal type so chips pack tightly across the row.
function goalChips(goals: GoalEntry[], units: UnitSystem): Chip[] {
  const out: Chip[] = [];
  goals.forEach((g, gi) => {
    const meta = GOAL_META[g.type];
    if (!meta) return;
    const num = gi + 1; // one number per goal, shared by its areas + the figure pin
    if (g.type === 'weight_loss') {
      out.push({ key: `wl-${gi}`, num, emoji: meta.emoji, label: `Lose ${fmtWeight(g.kg ?? 0, units)}`, color: meta.color, soft: meta.soft });
      return;
    }
    const keys = g.type === 'muscle_growth' ? (g.muscles ?? []) : (g.areas ?? []);
    Array.from(new Set(keys.map(prettyKey))).forEach((label, ai) => {
      out.push({ key: `${g.type}-${gi}-${ai}`, num, emoji: meta.emoji, label, color: meta.color, soft: meta.soft });
    });
  });
  return out;
}

interface Props {
  name?: string | null;
  gender?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  age?: number | null;
  goals?: GoalEntry[] | null;
  conditions?: BodyCondition[] | null;
  onPressNow?: () => void;
  onPressGoal?: () => void;
  /** Opens the fields-based "view all & edit" editor (no 3D). */
  onViewAll?: () => void;
}

const FIG_H = 300;

export default function BodyGoalComparison({
  gender, heightCm, weightKg, age, goals, conditions, onPressNow, onPressGoal, onViewAll,
}: Props) {
  const modelGender = gender === 'female' ? 'female' : 'male';
  const units = loadUnits();
  const h = clamp(heightCm ?? 170, HEIGHT_MIN, HEIGHT_MAX);
  const w = weightKg ?? 70;
  const heightM = h / 100;
  const bmi = w / (heightM * heightM);

  const list = goals ?? [];
  const condList = conditions ?? [];

  // AI read on the body (cached; only re-calls when metrics/injuries/goals change).
  const { insights, loading: aiLoading } = useBodyInsights({
    gender, age, heightCm, weightKg, conditions: condList, goals: list,
  });

  // Figure girth from current BMI.
  const nowGirth = girthFromBmi(bmi);

  // ── Icons pinned ON the model + painted groups ───────────────────────────────
  // Conditions (injury / tightness) get an emoji badge; goals ("you want to
  // achieve") get a numbered badge + a short type label (e.g. "1 Muscle Growth").
  const { condMarkers, goalMarkers, targeted, groupColors } = useMemo(() => {
    const markers: { id: string; xf: number; y: number; emoji: string; color: string }[] = [];
    const gMarkers: { id: string; xf: number; y: number; num: number; typeLabel: string; color: string; showLabel: boolean }[] = [];
    const regions: string[] = [];
    const colors: Record<string, string> = {};

    // Conditions first — they take colour priority on any shared body group.
    condList.forEach((c, i) => {
      const base = c.part.split('::')[0];
      const grp = AREA_TO_GROUP[base];
      if (grp) { regions.push(grp); colors[grp] = COND_META[c.type].color; }
      const meta = COND_META[c.type];
      const p = FRONT_POS[base];
      if (meta && p) {
        // Pin to the requested side for bilateral parts.
        const xf = p.both ? (c.side === 'left' ? 0.5 - p.x : 0.5 + p.x) : 0.5;
        markers.push({ id: `${base}_${c.side ?? 'both'}_${i}`, xf, y: p.y, emoji: meta.emoji, color: meta.color });
      }
    });

    // Goals — each goal owns ONE number (its position in the list, matching the
    // chip legend below), shared by all of that goal's body-part pins. The type
    // text is shown once per goal to keep the figure uncluttered.
    list.forEach((g, gi) => {
      const meta = GOAL_META[g.type];
      if (!meta || g.type === 'weight_loss') return; // weight-loss has no body part
      const num = gi + 1;
      const keys = g.type === 'muscle_growth' ? (g.muscles ?? []) : (g.areas ?? []);
      const bases = Array.from(new Set(keys.map((k) => k.split('::')[0])));
      let first = true;
      bases.forEach((base) => {
        const p = FRONT_POS[base];
        if (!p) return;
        const xf = p.both ? 0.5 + p.x : 0.5;
        gMarkers.push({ id: `g_${gi}_${base}`, xf, y: p.y, num, typeLabel: GOAL_TYPE_LABEL[g.type] ?? meta.verb, color: meta.color, showLabel: first });
        first = false;
        const grp = AREA_TO_GROUP[base];
        if (grp && !colors[grp]) { regions.push(grp); colors[grp] = meta.color; }
      });
    });

    return { condMarkers: markers, goalMarkers: gMarkers, targeted: Array.from(new Set(regions)), groupColors: colors };
  }, [JSON.stringify(condList), JSON.stringify(list)]);

  const goalItems = goalChips(list, units);
  const condItems = condChips(condList);

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <Text style={s.cardTitle}>My Body</Text>
        <TouchableOpacity onPress={onPressNow} activeOpacity={0.7} hitSlop={HIT}>
          <Text style={[s.summaryEdit, { color: C.orange }]}>Edit ›</Text>
        </TouchableOpacity>
      </View>

      {/* ── Single 3D body with condition badges + goal chips pinned on it ──── */}
      <TouchableOpacity style={s.figStage} activeOpacity={0.9} onPress={onPressNow}>
        <MuscleVisualizer
          gender={modelGender}
          view="front"
          hideControls
          height={FIG_H}
          girthScale={nowGirth}
          targetedMuscles={targeted}
          groupColors={groupColors}
          overlay={
            <>
              {/* Condition icons pinned on the body part (injury / tightness) */}
              {condMarkers.map((m) => (
                <View
                  key={`c_${m.id}`}
                  style={[s.condBadge, { left: `${m.xf * 100}%`, top: `${m.y * 100}%`, borderColor: m.color }]}
                  pointerEvents="none"
                >
                  <Text style={s.condBadgeIcon}>{m.emoji}</Text>
                </View>
              ))}

              {/* Goal markers — numbered badge + type label ("1 Muscle Growth") */}
              {goalMarkers.map((g) => (
                <View
                  key={g.id}
                  style={[s.goalPin, { left: `${g.xf * 100}%`, top: `${g.y * 100}%` }]}
                  pointerEvents="none"
                >
                  <View style={[s.goalNum, { backgroundColor: g.color }]}>
                    <Text style={s.goalNumText}>{g.num}</Text>
                  </View>
                  {g.showLabel && (
                    <Text style={[s.goalPinLabel, { color: g.color }]} numberOfLines={1}>{g.typeLabel}</Text>
                  )}
                </View>
              ))}
            </>
          }
        />
      </TouchableOpacity>
      <Text style={s.figCaption}>{`${fmtHeight(h, units)} · ${fmtWeight(w, units)}`}</Text>

      {/* ── What you are / want — packed chip rows, minimal whitespace ─────── */}
      <View style={s.summary}>
        <View style={s.summaryHead}>
          <Text style={s.summaryLabel}>YOU ARE NOW</Text>
        </View>
        <View style={s.chipRow}>
          <View style={s.metricChip}><Text style={s.metricChipText}>📏 {fmtHeight(h, units)}</Text></View>
          <View style={s.metricChip}><Text style={s.metricChipText}>⚖️ {fmtWeight(w, units)}</Text></View>
          <View style={s.metricChip}><Text style={s.metricChipText}>📊 BMI {bmi.toFixed(1)} · {bmiLabel(bmi)}</Text></View>
        </View>

        {condItems.length > 0 && (
          <TouchableOpacity style={s.summaryBlock} activeOpacity={0.7} onPress={onPressNow}>
            <View style={s.summaryHead}>
              <Text style={s.summaryLabel}>HELP WITH</Text>
            </View>
            <View style={s.chipRow}>
              {condItems.map((c) => (
                <View key={c.key} style={[s.chip, { borderColor: c.color, backgroundColor: c.soft }]}>
                  <Text style={s.chipText}>{c.emoji} {c.label}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={s.summaryBlock} activeOpacity={0.7} onPress={onPressGoal}>
          <View style={s.summaryHead}>
            <Text style={s.summaryLabel}>YOU WANT TO ACHIEVE</Text>
          </View>
          {goalItems.length === 0 ? (
            <Text style={[s.summaryText, { color: C.muted }]}>Tap to set what you want to achieve</Text>
          ) : (
            <View style={s.chipRow}>
              {goalItems.map((g) => (
                <View key={g.key} style={[s.chip, { borderColor: g.color, backgroundColor: g.soft }]}>
                  {g.num != null && (
                    <View style={[s.chipNumDot, { backgroundColor: g.color }]}>
                      <Text style={s.chipNumText}>{g.num}</Text>
                    </View>
                  )}
                  <Text style={s.chipText}>{g.emoji} {g.label}</Text>
                </View>
              ))}
            </View>
          )}
        </TouchableOpacity>

        {/* ── AI body read — "what's going on with your body" ──────────────── */}
        {(aiLoading || insights?.insight) && (
          <View style={s.aiBlock}>
            <View style={s.aiHeadRow}>
              <View style={s.aiHead}>
                <Sparkles size={14} color={C.orange} />
                <Text style={s.aiLabel}>WHAT'S GOING ON WITH YOUR BODY</Text>
              </View>
              {onViewAll && (
                <TouchableOpacity onPress={onViewAll} activeOpacity={0.7} hitSlop={HIT}>
                  <Text style={s.aiViewAll}>View all ›</Text>
                </TouchableOpacity>
              )}
            </View>
            {aiLoading && !insights ? (
              <View style={s.aiLoadingRow}>
                <ActivityIndicator size="small" color={C.orange} />
                <Text style={s.aiLoadingText}>Reading your body data…</Text>
              </View>
            ) : (
              <Text style={s.aiInsight}>{insights?.insight}</Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: C.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginTop: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  cardTitle: { color: C.text, fontSize: 16, fontWeight: '800' },

  figStage: { borderRadius: 14, overflow: 'hidden' },
  figCaption: { color: C.text, fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 6 },

  // Injury / tightness icon pinned on the body part (centred on its anchor).
  condBadge: {
    position: 'absolute',
    width: 24, height: 24, borderRadius: 12,
    marginLeft: -12, marginTop: -12,
    backgroundColor: '#fff',
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 3,
  },
  condBadgeIcon: { fontSize: 12 },

  // Goal marker pinned on the body part: numbered dot + short type label.
  goalPin: {
    position: 'absolute',
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginLeft: -10, marginTop: -10,
  },
  goalNum: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 3,
  },
  goalNumText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  goalPinLabel: {
    fontSize: 11, fontWeight: '900',
    textShadowColor: 'rgba(255,255,255,0.95)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },

  summary: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 10,
  },
  summaryBlock: { marginTop: 10 },
  summaryHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  summaryLabel: { color: C.muted, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  summaryEdit: { color: C.green, fontSize: 12, fontWeight: '700' },
  summaryText: { color: C.text, fontSize: 13, fontWeight: '600', lineHeight: 19 },

  // AI body read
  aiBlock: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(33,24,50,0.06)',
  },
  aiHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  aiHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aiLabel: { color: C.orange, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  aiViewAll: { color: C.orange, fontSize: 12, fontWeight: '700' },
  aiInsight: { color: C.text, fontSize: 13, fontWeight: '500', lineHeight: 19 },
  aiLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiLoadingText: { color: C.muted, fontSize: 12.5, fontWeight: '500' },

  // Packed, wrapping chip rows (replaces stacked single-item lines)
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 4, paddingHorizontal: 9,
    borderRadius: 100, borderWidth: 1,
  },
  chipText: { color: C.text, fontSize: 12.5, fontWeight: '700' },
  chipNumDot: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  chipNumText: { color: '#fff', fontSize: 9.5, fontWeight: '900' },
  metricChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 4, paddingHorizontal: 9,
    borderRadius: 100, borderWidth: 1, borderColor: 'rgba(33,24,50,0.12)',
    backgroundColor: C.canvas,
  },
  metricChipText: { color: C.text, fontSize: 12.5, fontWeight: '700' },
});
