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
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MuscleVisualizer from '../MuscleVisualizer';
import { BodyCondition, GoalEntry } from '../../models/User';

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
const KG_PER_LB = 0.45359237;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const kgToLb = (kg: number) => Math.round(kg / KG_PER_LB);
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
const COND_META: Record<string, { emoji: string; label: string; color: string }> = {
  tightness: { emoji: '⚡', label: 'Tightness', color: '#d4a600' },
  injury:    { emoji: '🩹', label: 'Injury',    color: '#dc2626' },
};
function condLine(c: BodyCondition): string {
  const meta = COND_META[c.type];
  const side = c.side === 'left' ? 'Left ' : c.side === 'right' ? 'Right ' : '';
  return `${meta.emoji} ${meta.label}: ${side}${prettyKey(c.part)}`;
}

const GOAL_META: Record<string, { emoji: string; verb: string }> = {
  muscle_growth: { emoji: '💪', verb: 'Build' },
  weight_loss:   { emoji: '🔥', verb: 'Lose' },
  injury_rehab:  { emoji: '🩹', verb: 'Rehab' },
  stretching:    { emoji: '🧘', verb: 'Stretch' },
};

function goalLine(g: GoalEntry): string {
  const meta = GOAL_META[g.type];
  if (g.type === 'weight_loss') return `${meta.emoji} Lose ${Math.round(g.kg ?? 0)} kg`;
  const keys = g.type === 'muscle_growth' ? (g.muscles ?? []) : (g.areas ?? []);
  const labels = Array.from(new Set(keys.map(prettyKey))).join(', ');
  return `${meta.emoji} ${meta.verb}${labels ? `: ${labels}` : ''}`;
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
}

const FIG_H = 300;

export default function BodyGoalComparison({
  gender, heightCm, weightKg, goals, conditions, onPressNow, onPressGoal,
}: Props) {
  const modelGender = gender === 'female' ? 'female' : 'male';
  const h = clamp(heightCm ?? 170, HEIGHT_MIN, HEIGHT_MAX);
  const w = weightKg ?? 70;
  const heightM = h / 100;
  const bmi = w / (heightM * heightM);

  const list = goals ?? [];
  const condList = conditions ?? [];

  // Figure girth from current BMI.
  const nowGirth = girthFromBmi(bmi);

  // ── Condition icons pinned ON the model (injury / tightness) + painted groups ──
  // Goals are NOT drawn on the figure — they live in the "You want to achieve"
  // summary and are edited in the Goals questions screen.
  const { condMarkers, targeted, groupColors } = useMemo(() => {
    const markers: { id: string; xf: number; y: number; emoji: string; color: string }[] = [];
    const regions: string[] = [];
    const colors: Record<string, string> = {};
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
    return { condMarkers: markers, targeted: Array.from(new Set(regions)), groupColors: colors };
  }, [JSON.stringify(condList)]);

  const goalLines = list.map(goalLine);
  const condLines = condList.map(condLine);

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
            </>
          }
        />
      </TouchableOpacity>
      <Text style={s.figCaption}>{`${Math.round(h)} cm · ${kgToLb(w)} lb`}</Text>

      {/* ── What you are / want ───────────────────────────────────────────── */}
      <View style={s.summary}>
        <View style={s.summaryBlock}>
          <Text style={s.summaryLabel}>YOU ARE NOW</Text>
          <Text style={s.summaryText}>
            {`📏 ${Math.round(h)} cm   ·   ⚖️ ${kgToLb(w)} lb   ·   📊 BMI ${bmi.toFixed(1)} (${bmiLabel(bmi)})`}
          </Text>
        </View>

        {condLines.length > 0 && (
          <TouchableOpacity
            style={[s.summaryBlock, { marginTop: 12 }]}
            activeOpacity={0.7}
            onPress={onPressNow}
          >
            <View style={s.summaryHead}>
              <Text style={s.summaryLabel}>HELP WITH</Text>
              <Text style={[s.summaryEdit, { color: C.orange }]}>Edit ›</Text>
            </View>
            {condLines.map((line, i) => (
              <Text key={i} style={s.summaryText}>{line}</Text>
            ))}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[s.summaryBlock, { marginTop: 12 }]}
          activeOpacity={0.7}
          onPress={onPressGoal}
        >
          <View style={s.summaryHead}>
            <Text style={s.summaryLabel}>YOU WANT TO ACHIEVE</Text>
            <Text style={s.summaryEdit}>Edit ›</Text>
          </View>
          {goalLines.length === 0 ? (
            <Text style={[s.summaryText, { color: C.muted }]}>Tap to set what you want to achieve</Text>
          ) : (
            goalLines.map((line, i) => (
              <Text key={i} style={s.summaryText}>{line}</Text>
            ))
          )}
        </TouchableOpacity>
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

  summary: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 12,
  },
  summaryBlock: { gap: 4 },
  summaryHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryLabel: { color: C.muted, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  summaryEdit: { color: C.green, fontSize: 12, fontWeight: '700' },
  summaryText: { color: C.text, fontSize: 13, fontWeight: '600', lineHeight: 19 },
});
