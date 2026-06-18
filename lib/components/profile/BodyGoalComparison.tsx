/**
 * BodyGoalComparison — home-screen "Now vs Goal" card.
 *
 * Two side-by-side 3D bodies: the current body ("Now", sized to the current
 * girth) next to the goal body ("Goal", target muscles painted green, girth
 * reduced toward the target weight). A summary beneath spells out what the user
 * is now and what they want to achieve. Each figure has its own Edit link and
 * deep-links to its full editor (body metrics / goals).
 *
 * Both figures are independent WebGL models; MuscleVisualizer clones the GLB per
 * instance so they can mount together and paint different colors.
 */
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MuscleVisualizer from '../MuscleVisualizer';
import { GoalEntry } from '../../models/User';

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

const HEIGHT_MIN = 120, HEIGHT_MAX = 215, WEIGHT_FLOOR = 35;
const KG_PER_LB = 0.45359237;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const kgToLb = (kg: number) => Math.round(kg / KG_PER_LB);
const girthFromBmi = (bmi: number) => clamp(1 + (bmi - 22) * 0.022, 0.86, 1.34);
const bmiLabel = (bmi: number) => (bmi < 18.5 ? 'lean' : bmi < 25 ? 'normal' : bmi < 30 ? 'curvy' : 'heavy');

// goal body-part key (e.g. "chest::left", "knee") → MuscleVisualizer highlight
// group. Covers muscle-growth, stretching and injury-rehab parts.
const AREA_TO_GROUP: Record<string, string> = {
  // muscles / stretches
  shoulders: 'Shoulders', shoulder: 'Shoulders',
  chest: 'Chest', arms: 'Arms',
  back: 'Back', upper_back: 'Back', lower_back: 'Back',
  abs: 'Abs', glutes: 'Glutes', quads: 'Quads', calves: 'Calves',
  // injury-rehab joints
  neck: 'Neck', elbow: 'Elbow', wrist: 'Wrist', hip: 'Hip', knee: 'Knee', ankle: 'Ankle',
};
const prettyKey = (k: string) =>
  k.split('::')[0].replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

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
  onPressNow?: () => void;
  onPressGoal?: () => void;
}

export default function BodyGoalComparison({
  heightCm, weightKg, goals, onPressNow, onPressGoal,
}: Props) {
  const h = clamp(heightCm ?? 170, HEIGHT_MIN, HEIGHT_MAX);
  const w = weightKg ?? 70;
  const heightM = h / 100;
  const bmi = w / (heightM * heightM);

  const list = goals ?? [];

  // "Now" figure girth (horizontal scale) from current BMI.
  const nowGirth = girthFromBmi(bmi);

  // Target weight after all weight-loss goals → slimmer goal figure + chip.
  const lossKg = list.filter((g) => g.type === 'weight_loss').reduce((a, g) => a + (g.kg ?? 0), 0);
  const goalWeight = Math.max(WEIGHT_FLOOR, w - lossKg);
  const goalGirth = girthFromBmi(goalWeight / (heightM * heightM));

  // Regions to light up green on the body — across every goal type that names a
  // body part (muscle-growth muscles, injury-rehab / stretching areas).
  const goalRegions = useMemo(() => {
    const out = new Set<string>();
    for (const g of list) {
      const keys =
        g.type === 'muscle_growth' ? (g.muscles ?? [])
        : g.type === 'injury_rehab' || g.type === 'stretching' ? (g.areas ?? [])
        : [];
      for (const k of keys) {
        const grp = AREA_TO_GROUP[k.split('::')[0]];
        if (grp) out.add(grp);
      }
    }
    return Array.from(out);
  }, [JSON.stringify(list)]);

  const goalLines = list.map(goalLine);
  const goalCaption =
    lossKg > 0 ? `${kgToLb(goalWeight)} lb`
    : goalRegions.length ? 'Target areas'
    : 'Set a goal';

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <Text style={s.cardTitle}>Now vs Goal</Text>
      </View>

      {/* ── Two 3D bodies, Now vs Goal (goal muscles painted green) ────────── */}
      <View style={s.figuresRow}>
        <FigureColumn
          label="NOW"  labelColor={C.orange}
          girth={nowGirth} targeted={[]}
          caption={`${Math.round(h)} cm · ${kgToLb(w)} lb`}
          onEdit={onPressNow}
        />
        <View style={s.vsCol}><Text style={s.vsText}>vs</Text></View>
        <FigureColumn
          label="GOAL" labelColor={C.green}
          girth={goalGirth} targeted={goalRegions}
          caption={goalCaption}
          onEdit={onPressGoal}
        />
      </View>

      {/* ── What you are / want ───────────────────────────────────────────── */}
      <View style={s.summary}>
        <View style={s.summaryBlock}>
          <Text style={s.summaryLabel}>YOU ARE NOW</Text>
          <Text style={s.summaryText}>
            {`📏 ${Math.round(h)} cm   ·   ⚖️ ${kgToLb(w)} lb   ·   📊 BMI ${bmi.toFixed(1)} (${bmiLabel(bmi)})`}
          </Text>
        </View>

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

// ── One figure column: header (label + Edit), 3D body, caption ─────────────────
function FigureColumn({
  label, labelColor, girth, targeted, caption, onEdit,
}: {
  label: string; labelColor: string;
  girth: number; targeted: string[]; caption: string; onEdit?: () => void;
}) {
  return (
    <View style={s.figCol}>
      <View style={s.figHead}>
        <Text style={[s.figLabel, { color: labelColor }]}>{label}</Text>
        <TouchableOpacity onPress={onEdit} activeOpacity={0.7} hitSlop={HIT}>
          <Text style={s.summaryEdit}>Edit ›</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={s.figStage} activeOpacity={0.9} onPress={onEdit}>
        <MuscleVisualizer
          view="front"
          hideControls
          height={240}
          girthScale={girth}
          targetedMuscles={targeted}
        />
      </TouchableOpacity>
      <Text style={s.figCaption}>{caption}</Text>
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

  // Two figure columns + a "vs" divider
  figuresRow: { flexDirection: 'row', alignItems: 'flex-end' },
  figCol: { flex: 1 },
  figHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  figLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  figStage: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  figCaption: { color: C.text, fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 6 },
  vsCol: { width: 22, alignItems: 'center', justifyContent: 'center', paddingBottom: 110 },
  vsText: { color: C.muted, fontSize: 12, fontWeight: '800' },

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
