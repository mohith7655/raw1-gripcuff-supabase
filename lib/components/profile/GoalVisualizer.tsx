/**
 * GoalVisualizer — "My Goal" (stepped builder)
 *
 * Each goal is a card: pick the TYPE (Muscle Growth / Weight Loss / Injury Rehab
 * / Stretching), then for body-part goals you TAP THE FIGURE to select parts
 * (nearest landmark to the tap), with an ✕ on each marker to remove it. Add more
 * goals with "+ Add another goal".
 */
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, GestureResponderEvent, Image as RNImage, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, G, Image as SvgImage, Line, Text as SvgText } from 'react-native-svg';
import { GoalEntry, GoalType } from '../../models/User';
import MuscleVisualizer from '../MuscleVisualizer';
import { loadUnits, fmtWeight, isWeightLb, toFeetInches } from '../../utils/units';

// ── 3D model hotspots — tappable body-part dots overlaid on the model. ─────────
// x = horizontal offset from centre (0.5); y = fraction of viewer height.
// Single unified set (type-agnostic): tap a part → choose side → choose goal type.
type Hotspot = { key: string; label: string; y: number; x: number; both: boolean };
const BODY_PARTS: Record<'front' | 'back', Hotspot[]> = {
  front: [
    { key: 'neck',      label: 'Neck',      y: 0.20, x: 0.00, both: false },
    { key: 'shoulders', label: 'Shoulders', y: 0.30, x: 0.12, both: true  },
    { key: 'chest',     label: 'Chest',     y: 0.37, x: 0.07, both: true  },
    { key: 'arms',      label: 'Arms',      y: 0.45, x: 0.17, both: true  },
    { key: 'abs',       label: 'Abs',       y: 0.48, x: 0.00, both: false },
    { key: 'hip',       label: 'Hip',       y: 0.55, x: 0.08, both: true  },
    { key: 'wrist',     label: 'Wrist',     y: 0.59, x: 0.18, both: true  },
    { key: 'quads',     label: 'Quads',     y: 0.66, x: 0.06, both: true  },
    { key: 'knee',      label: 'Knee',      y: 0.76, x: 0.06, both: true  },
    { key: 'calves',    label: 'Calves',    y: 0.85, x: 0.05, both: true  },
    { key: 'ankle',     label: 'Ankle',     y: 0.93, x: 0.05, both: true  },
  ],
  back: [
    { key: 'neck',       label: 'Neck',       y: 0.20, x: 0.00, both: false },
    { key: 'shoulders',  label: 'Shoulders',  y: 0.30, x: 0.12, both: true  },
    { key: 'upper_back', label: 'Upper Back', y: 0.37, x: 0.00, both: false },
    { key: 'arms',       label: 'Arms',       y: 0.45, x: 0.17, both: true  },
    { key: 'lower_back', label: 'Lower Back', y: 0.47, x: 0.00, both: false },
    { key: 'glutes',     label: 'Glutes',     y: 0.55, x: 0.06, both: true  },
    { key: 'knee',       label: 'Knee',       y: 0.72, x: 0.06, both: true  },
    { key: 'calves',     label: 'Calves',     y: 0.85, x: 0.05, both: true  },
    { key: 'ankle',      label: 'Ankle',      y: 0.93, x: 0.05, both: true  },
  ],
};
// Goal landmark key → MuscleVisualizer bone-group (must match BONE_GROUPS names
// in MuscleVisualizer so the mesh actually paints; joints have their own groups).
const HL_MAP: Record<string, string> = {
  shoulders: 'Shoulders', chest: 'Chest', arms: 'Arms', back: 'Back',
  abs: 'Abs', glutes: 'Glutes', quads: 'Quads', calves: 'Calves',
  neck: 'Neck', hip: 'Hip', wrist: 'Wrist', knee: 'Knee',
  ankle: 'Ankle', upper_back: 'Back', lower_back: 'Back',
};

// Selections store side-aware keys: `base` (single) or `base::left` / `base::right`.
const SIDE_SEP = '::';
const sideKey = (base: string, side: 'left' | 'right' | 'single') =>
  side === 'single' ? base : `${base}${SIDE_SEP}${side}`;
const parseKey = (k: string): { base: string; side: 'left' | 'right' | null } => {
  const i = k.indexOf(SIDE_SEP);
  return i === -1 ? { base: k, side: null } : { base: k.slice(0, i), side: k.slice(i + SIDE_SEP.length) as 'left' | 'right' };
};
const keyLabel = (lists: Landmark[], k: string): string => {
  const { base, side } = parseKey(k);
  const lbl = lists.find(l => l.key === base)?.label ?? base;
  return side ? `${side === 'left' ? 'Left' : 'Right'} ${lbl}` : lbl;
};

export type { GoalEntry, GoalType };
export type InjurySide = 'left' | 'right' | 'both';
export interface GoalData { goals: GoalEntry[]; }

// ── Theme ───────────────────────────────────────────────────────────────────
const C = {
  orange:     '#F25912',
  green:      '#16a34a',
  blue:       '#2563eb',
  purple:     '#7c3aed',
  red:        '#dc2626',
  yellow:     '#d4a600',
  text:       '#211832',
  muted:      '#7A7C90',
  canvas:     '#EEEEF2',
  cardBg:     '#F8F8FC',
  border:     'rgba(33,24,50,0.08)',
  rule:       'rgba(33,24,50,0.10)',
};

const TYPE_META: Record<GoalType, { label: string; emoji: string; color: string; soft: string; noun: string }> = {
  muscle_growth: { label: 'Muscle Growth', emoji: '💪', color: C.green,  soft: 'rgba(22,163,74,0.12)',  noun: 'muscles' },
  weight_loss:   { label: 'Weight Loss',   emoji: '🔥', color: C.yellow, soft: 'rgba(212,166,0,0.14)',  noun: '' },
  injury_rehab:  { label: 'Injury Rehab',  emoji: '🩹', color: C.red,    soft: 'rgba(220,38,38,0.12)',  noun: 'body parts' },
  stretching:    { label: 'Stretching',    emoji: '🧘', color: C.blue,   soft: 'rgba(37,99,235,0.12)',  noun: 'body parts' },
};
const TYPE_ORDER: GoalType[] = ['muscle_growth', 'weight_loss', 'injury_rehab', 'stretching'];

const SIDES: { key: InjurySide; label: string }[] = [
  { key: 'left', label: 'Left' }, { key: 'right', label: 'Right' }, { key: 'both', label: 'Both' },
];

// ── Body landmarks ────────────────────────────────────────────────────────────
type Landmark = { key: string; label: string; yFrac: number; xFrac: number; both: boolean };

const INJURY_AREAS: Landmark[] = [
  { key: 'neck',       label: 'Neck',       yFrac: 0.12, xFrac: 0.00, both: false },
  { key: 'shoulder',   label: 'Shoulder',   yFrac: 0.19, xFrac: 0.34, both: true  },
  { key: 'elbow',      label: 'Elbow',      yFrac: 0.36, xFrac: 0.40, both: true  },
  { key: 'wrist',      label: 'Wrist',      yFrac: 0.49, xFrac: 0.44, both: true  },
  { key: 'upper_back', label: 'Upper Back', yFrac: 0.30, xFrac: 0.00, both: false },
  { key: 'lower_back', label: 'Lower Back', yFrac: 0.44, xFrac: 0.00, both: false },
  { key: 'hip',        label: 'Hip',        yFrac: 0.52, xFrac: 0.22, both: true  },
  { key: 'knee',       label: 'Knee',       yFrac: 0.70, xFrac: 0.16, both: true  },
  { key: 'ankle',      label: 'Ankle',      yFrac: 0.93, xFrac: 0.12, both: true  },
];

const MUSCLES: Landmark[] = [
  { key: 'shoulders', label: 'Shoulders', yFrac: 0.19, xFrac: 0.30, both: true  },
  { key: 'chest',     label: 'Chest',     yFrac: 0.27, xFrac: 0.16, both: true  },
  { key: 'arms',      label: 'Arms',      yFrac: 0.34, xFrac: 0.40, both: true  },
  { key: 'back',      label: 'Back',      yFrac: 0.31, xFrac: 0.00, both: false },
  { key: 'abs',       label: 'Abs',       yFrac: 0.40, xFrac: 0.00, both: false },
  { key: 'glutes',    label: 'Glutes',    yFrac: 0.52, xFrac: 0.18, both: true  },
  { key: 'quads',     label: 'Quads',     yFrac: 0.62, xFrac: 0.16, both: true  },
  { key: 'calves',    label: 'Calves',    yFrac: 0.82, xFrac: 0.13, both: true  },
];
const MAX_MUSCLES = 3;
// Merged master list (dedup by key) so a part chosen on the model resolves to a
// landmark regardless of which goal type it ends up under.
const MASTER_AREAS: Landmark[] = (() => {
  const seen = new Set<string>();
  const out: Landmark[] = [];
  for (const lm of [...MUSCLES, ...INJURY_AREAS]) {
    if (seen.has(lm.key)) continue;
    seen.add(lm.key);
    out.push(lm);
  }
  return out;
})();
const lmList = (_type: GoalType): Landmark[] => MASTER_AREAS;

// Goal types offered in the part-first picker (weight loss isn't body-part based).
const PART_TYPES: GoalType[] = ['muscle_growth', 'injury_rehab', 'stretching'];

// ── Canvas geometry ───────────────────────────────────────────────────────────
const VB_W = 300, VB_H = 360, GROUND = 338, TOP_PAD = 16, HEIGHT_MAX = 215;
const PX_PER_CM = (GROUND - TOP_PAD) / HEIGHT_MAX;
const CX = 168, RULER_X = 56;
const TICKS = [0, 30, 60, 90, 120, 150, 180, 210];
const HIT_RADIUS = 42; // viewBox units — how close a tap must be to a landmark

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round = (v: number, step: number) => Math.round(v / step) * step;
const girthFromBmi = (bmi: number) => clamp(1 + (bmi - 22) * 0.022, 0.86, 1.34);

// ── Figure artwork ────────────────────────────────────────────────────────────
const BOY_IMG = require('../../../assets/figures/boy.png');
const GIRL_IMG = require('../../../assets/figures/girl.png');
function aspectOf(src: number, fallback: number): number {
  try {
    const r = (RNImage as any)?.resolveAssetSource;
    if (typeof r === 'function') { const m = r(src); if (m?.width && m?.height) return m.width / m.height; }
  } catch { /* ignore */ }
  return fallback;
}
const ASPECT = { male: aspectOf(BOY_IMG, 0.5), female: aspectOf(GIRL_IMG, 0.5) };

// ── Slider ──────────────────────────────────────────────────────────────────
function Slider({ min, max, step, value, onChange, color }: {
  min: number; max: number; step: number; value: number; onChange: (v: number) => void; color: string;
}) {
  const [w, setW] = useState(0);
  const pct = clamp((value - min) / (max - min || 1), 0, 1);
  const upd = (e: GestureResponderEvent) => {
    if (!w) return;
    onChange(round(min + (clamp(e.nativeEvent.locationX, 0, w) / w) * (max - min), step));
  };
  return (
    <View style={st.sliderTrack} onLayout={e => setW(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true}
      onResponderGrant={upd} onResponderMove={upd}>
      <View style={st.sliderRail} />
      <View style={[st.sliderFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      <View style={[st.sliderThumb, { left: `${pct * 100}%`, borderColor: color }]} />
    </View>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  name?: string | null;
  gender?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  goals?: GoalEntry[] | null;
  onSave?: (data: GoalData) => void;
  saving?: boolean;
  canvasHeight?: number;
  editable?: boolean;
  /** Read-only mode: show the goal summary lines beneath the figure. */
  showSummary?: boolean;
}

const newGoal = (type: GoalType): GoalEntry =>
  type === 'weight_loss' ? { type, kg: 5 }
  : type === 'muscle_growth' ? { type, muscles: [] }
  : { type, areas: [], side: 'both' };

// ── Component ───────────────────────────────────────────────────────────────
export default function GoalVisualizer({
  name, gender, heightCm, weightKg, goals, onSave, saving = false, canvasHeight = 320, editable = true,
  showSummary = true,
}: Props) {
  const [list, setList] = useState<GoalEntry[]>(
    goals && goals.length ? goals : [newGoal('muscle_growth')],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [stageW, setStageW] = useState(0);
  // 3D model view (editable mode): front/back lets hotspots align with the body.
  const [modelView, setModelView] = useState<'front' | 'back'>('front');
  // Part-first guided picker: tap a body part → choose side → choose goal type.
  const [picker, setPicker] = useState<
    { base: string; label: string; both: boolean; xf: number; y: number; side: InjurySide | null } | null
  >(null);

  const units = loadUnits();
  const curWeight = weightKg ?? 70;
  const heightM = (heightCm ?? 170) / 100;
  const maxLose = Math.max(1, Math.round(curWeight - 35));

  const update = (i: number, patch: Partial<GoalEntry>) =>
    setList(prev => prev.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));
  const setType = (i: number, type: GoalType) => {
    setList(prev => prev.map((g, idx) => (idx === i ? newGoal(type) : g)));
    setActiveIndex(i);
  };
  const addGoal = () => { setList(prev => [...prev, newGoal('weight_loss')]); setActiveIndex(list.length); };
  const removeGoal = (i: number) => {
    setList(prev => prev.filter((_, idx) => idx !== i));
    setActiveIndex(a => clamp(a > i ? a - 1 : a, 0, Math.max(0, list.length - 2)));
  };

  const female = gender === 'female';
  const src = female ? GIRL_IMG : BOY_IMG;
  const aspect = female ? ASPECT.female : ASPECT.male;

  const fig = useMemo(() => {
    const h = clamp(heightCm ?? 170, 120, HEIGHT_MAX) * PX_PER_CM;
    const ty = GROUND - h;
    const baseW = h * aspect;
    const girthCur = girthFromBmi(curWeight / (heightM * heightM));
    const lossKg = list.filter(g => g.type === 'weight_loss').reduce((a, g) => a + (g.kg ?? 0), 0);
    const girthMain = lossKg > 0
      ? girthFromBmi(Math.max(35, curWeight - lossKg) / (heightM * heightM))
      : girthCur;
    return { h, ty, baseW, girthCur, girthMain, showGhost: lossKg > 0 };
  }, [heightCm, aspect, curWeight, heightM, list]);

  // Landmark → viewBox point(s).
  const lmY = (lm: Landmark) => fig.ty + lm.yFrac * fig.h;
  const lmOff = (lm: Landmark) => lm.xFrac * fig.baseW * fig.girthMain;

  // Selected keys per goal → markers (combined preview).
  const markers = useMemo(() => {
    const out: { x: number; y: number; r: number; label: string; color: string; fill: string }[] = [];
    const r = Math.max(10, fig.h * 0.045);
    list.forEach(g => {
      if (g.type === 'weight_loss') return;
      const meta = TYPE_META[g.type];
      const fill = meta.soft.replace('0.12', '0.22');
      const keys = g.type === 'muscle_growth' ? (g.muscles ?? []) : (g.areas ?? []);
      keys.forEach(rawKey => {
        const { base, side } = parseKey(rawKey);
        const lm = lmList(g.type).find(x => x.key === base);
        if (!lm) return;
        if (!lm.both) { out.push({ x: CX + lmOff(lm), y: lmY(lm), r, label: lm.label, color: meta.color, fill }); return; }
        const L = { x: CX + lmOff(lm), y: lmY(lm), r, color: meta.color, fill };
        const R = { x: CX - lmOff(lm), y: lmY(lm), r, color: meta.color, fill };
        if (side === 'left')       out.push({ ...L, label: `Left ${lm.label}` });
        else if (side === 'right') out.push({ ...R, label: `Right ${lm.label}` });
        else { out.push({ ...R, label: '' }); out.push({ ...L, label: lm.label }); }
      });
    });
    return out;
  }, [list, fig]);

  // viewBox ⇄ pixel mapping (Svg uses preserveAspectRatio xMidYMid meet).
  // STAGE_PAD = the stage's vertical padding, so the Svg starts at y = STAGE_PAD.
  const STAGE_PAD = 6;
  const scale = stageW > 0 ? Math.min(stageW / VB_W, canvasHeight / VB_H) : 0;
  const offX = (stageW - VB_W * scale) / 2;
  const offY = STAGE_PAD + (canvasHeight - VB_H * scale) / 2;
  const vbToPx = (x: number, y: number) => ({ x: offX + x * scale, y: offY + y * scale });

  // One ✕ chip per selected key (placed at the marker).
  const xChips = useMemo(() => {
    if (!scale || !editable) return [] as { gi: number; key: string; type: GoalType; color: string; px: number; py: number }[];
    return list.flatMap((g, gi) => {
      if (g.type === 'weight_loss') return [];
      const keys = g.type === 'muscle_growth' ? (g.muscles ?? []) : (g.areas ?? []);
      const meta = TYPE_META[g.type];
      return keys.map(key => {
        const lm = lmList(g.type).find(l => l.key === key);
        if (!lm) return null;
        const p = vbToPx(CX + lmOff(lm), lmY(lm));
        return { gi, key, type: g.type, color: meta.color, px: p.x, py: p.y };
      }).filter(Boolean) as any[];
    });
  }, [list, fig, scale, editable]);

  const removeKey = (gi: number, key: string, type: GoalType) => {
    const g = list[gi];
    if (type === 'muscle_growth') update(gi, { muscles: (g.muscles ?? []).filter(k => k !== key) });
    else update(gi, { areas: (g.areas ?? []).filter(k => k !== key) });
  };

  // Tap the figure → nearest landmark for the ACTIVE goal → toggle.
  const handleStageTap = (e: GestureResponderEvent) => {
    if (!scale) return;
    const goal = list[activeIndex];
    if (!goal || goal.type === 'weight_loss') return;
    const vbX = (e.nativeEvent.locationX - offX) / scale;
    const vbY = (e.nativeEvent.locationY - offY) / scale;
    let best: Landmark | null = null, bestD = Infinity;
    for (const lm of lmList(goal.type)) {
      const y = lmY(lm), o = lmOff(lm);
      for (const x of (lm.both ? [CX + o, CX - o] : [CX + o])) {
        const d = Math.hypot(x - vbX, y - vbY);
        if (d < bestD) { bestD = d; best = lm; }
      }
    }
    if (!best || bestD > HIT_RADIUS) return;
    if (goal.type === 'muscle_growth') {
      const cur = goal.muscles ?? [];
      if (cur.includes(best.key)) update(activeIndex, { muscles: cur.filter(k => k !== best!.key) });
      else if (cur.length < MAX_MUSCLES) update(activeIndex, { muscles: [...cur, best.key] });
    } else {
      const cur = goal.areas ?? [];
      update(activeIndex, { areas: cur.includes(best.key) ? cur.filter(k => k !== best!.key) : [...cur, best.key] });
    }
  };

  const labelTop = clamp(fig.ty - 26, 10, GROUND);
  const handleSave = () => onSave?.({ goals: list });

  const figureImage = (girth: number, opacity: number) => (
    <G transform={`translate(${CX} ${GROUND}) scale(${girth} 1) translate(${-CX} ${-GROUND})`} opacity={opacity}>
      <SvgImage href={src} x={CX - fig.baseW / 2} y={fig.ty} width={fig.baseW} height={fig.h} preserveAspectRatio="xMidYMax meet" />
    </G>
  );

  const summary = list.map(g => {
    const meta = TYPE_META[g.type];
    if (g.type === 'weight_loss') return `${meta.emoji} Lose ${fmtWeight(g.kg ?? 0, units)}`;
    const keys = g.type === 'muscle_growth' ? (g.muscles ?? []) : (g.areas ?? []);
    const labels = keys.map(k => keyLabel(lmList(g.type), k)).join(', ');
    return `${meta.emoji} ${meta.label}${labels ? `: ${labels}` : ''}`;
  });

  const activeGoal = list[activeIndex];
  const figureInteractive = editable && activeGoal && activeGoal.type !== 'weight_loss';

  // ── 3D model selection (editable mode) ──────────────────────────────────────
  // Highlight every part picked across ALL body goals, coloured by goal type
  // (muscle growth → green, injury → red, stretching → blue).
  const { highlightMuscles, groupColors } = useMemo(() => {
    const colors: Record<string, string> = {};
    const groups: string[] = [];
    for (const g of list) {
      if (g.type === 'weight_loss') continue;
      const keys = g.type === 'muscle_growth' ? (g.muscles ?? []) : (g.areas ?? []);
      const col = TYPE_META[g.type].color;
      for (const k of keys) {
        const grp = HL_MAP[parseKey(k).base];
        if (!grp) continue;
        groups.push(grp);
        colors[grp] = col; // last selection wins if a group is shared
      }
    }
    return { highlightMuscles: groups, groupColors: colors };
  }, [list]);

  // Which goal (if any) owns this base body part → drives the dot colour/label.
  const ownerOf = (base: string) => {
    for (const g of list) {
      if (g.type === 'weight_loss') continue;
      const keys = g.type === 'muscle_growth' ? (g.muscles ?? []) : (g.areas ?? []);
      if (keys.some(k => parseKey(k).base === base)) return { meta: TYPE_META[g.type] };
    }
    return null;
  };

  // Commit a part-first selection: add the chosen part (+ side) to the goal of the
  // chosen type, creating that goal if it doesn't exist yet.
  const commitPart = (type: GoalType) => {
    if (!picker) return;
    const base = picker.base;
    const tokens: ('left' | 'right' | 'single')[] = !picker.both
      ? ['single']
      : picker.side === 'both'
        ? ['left', 'right']
        : [(picker.side ?? 'both') as 'left' | 'right'];
    const newKeys = tokens.map(s => sideKey(base, s));

    const existing = list.findIndex(g => g.type === type);
    setActiveIndex(existing === -1 ? list.length : existing);
    setList(prev => {
      const next = [...prev];
      let idx = next.findIndex(g => g.type === type);
      if (idx === -1) { next.push(newGoal(type)); idx = next.length - 1; }
      const g = next[idx];
      if (type === 'muscle_growth') {
        const merged = Array.from(new Set([...(g.muscles ?? []), ...newKeys])).slice(0, MAX_MUSCLES);
        next[idx] = { ...g, muscles: merged };
      } else {
        const merged = Array.from(new Set([...(g.areas ?? []), ...newKeys]));
        next[idx] = { ...g, areas: merged };
      }
      return next;
    });
    setPicker(null);
  };

  // Remove a body part straight from the model — clears every side variant of it
  // from all goals.
  const removePart = (base: string) => {
    setList(prev => prev.map(g => {
      if (g.type === 'muscle_growth') return { ...g, muscles: (g.muscles ?? []).filter(k => parseKey(k).base !== base) };
      if (g.type === 'injury_rehab' || g.type === 'stretching') return { ...g, areas: (g.areas ?? []).filter(k => parseKey(k).base !== base) };
      return g;
    }));
    setPicker(null);
  };

  // Tap anywhere on the model → nearest body part → open the guided picker.
  const handleModelTap = (e: GestureResponderEvent) => {
    if (!stageW) return;
    const fx = clamp(e.nativeEvent.locationX / stageW, 0, 1);
    const fy = clamp(e.nativeEvent.locationY / canvasHeight, 0, 1);
    let best: { h: Hotspot; hx: number } | null = null;
    let bestD = Infinity;
    for (const h of BODY_PARTS[modelView]) {
      const xs = h.both ? [0.5 + h.x, 0.5 - h.x] : [0.5];
      for (const hx of xs) {
        const d = Math.hypot(hx - fx, h.y - fy);
        if (d < bestD) { bestD = d; best = { h, hx }; }
      }
    }
    if (!best || bestD > 0.2) return; // tapped empty space (head, off-body)
    setPicker({ base: best.h.key, label: best.h.label, both: best.h.both, xf: best.hx, y: best.h.y, side: null });
  };

  // No visible dots — just the coloured name labels for parts already selected.
  const renderHotspots = () => (
    <>
      {BODY_PARTS[modelView].map(h => {
        const owner = ownerOf(h.key);
        if (!owner || picker?.base === h.key) return null;
        const xf = h.both ? 0.5 + h.x : 0.5;
        return (
          <Text
            key={h.key}
            // White text reads on any highlight colour (green/red/blue); the dark
            // outline keeps it legible on the light-blue unselected body too.
            style={[st.hsLabel, { left: `${xf * 100}%`, top: `${h.y * 100}%` }]}
            pointerEvents="none"
          >
            {h.label}
          </Text>
        );
      })}
    </>
  );

  // Small inline mini-menu anchored at the tapped dot (sized like the body labels).
  const POP_W = 132;
  const renderPicker = () => {
    if (!picker || !stageW) return null;
    const dotX = picker.xf * stageW;
    const dotY = picker.y * canvasHeight;
    const left = clamp(dotX - POP_W / 2, 4, Math.max(4, stageW - POP_W - 4));
    // Prefer floating above the dot so the menu never covers the goal cards below.
    const below = picker.y < 0.28;
    const showType = !picker.both || picker.side !== null;
    const isSelected = !!ownerOf(picker.base);
    return (
      <View
        style={[
          st.pop,
          { width: POP_W, left },
          below ? { top: dotY + 12 } : { bottom: canvasHeight - dotY + 12 },
        ]}
      >
        <View style={st.popHead}>
          <Text style={st.popTitle} numberOfLines={1}>{picker.label}</Text>
          <TouchableOpacity onPress={() => setPicker(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={st.popClose}>✕</Text>
          </TouchableOpacity>
        </View>

        {!showType ? (
          <View style={st.popRow}>
            {SIDES.map(s => (
              <TouchableOpacity
                key={s.key}
                style={st.popChip}
                activeOpacity={0.85}
                onPress={() => setPicker(p => (p ? { ...p, side: s.key } : p))}
              >
                <Text style={st.popChipText}>{s.key === 'both' ? 'Both' : s.label[0]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <>
            {PART_TYPES.map(t => {
              const tm = TYPE_META[t];
              return (
                <TouchableOpacity
                  key={t}
                  style={[st.popType, { borderColor: tm.color, backgroundColor: tm.soft }]}
                  activeOpacity={0.85}
                  onPress={() => commitPart(t)}
                >
                  <Text style={st.popTypeEmoji}>{tm.emoji}</Text>
                  <Text style={st.popTypeText} numberOfLines={1}>{tm.label}</Text>
                </TouchableOpacity>
              );
            })}
            {picker.both && (
              <TouchableOpacity onPress={() => setPicker(p => (p ? { ...p, side: null } : p))} activeOpacity={0.8}>
                <Text style={st.popBack}>← side</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {isSelected && (
          <TouchableOpacity style={st.popRemove} activeOpacity={0.85} onPress={() => removePart(picker.base)}>
            <Text style={st.popRemoveText}>🗑  Remove</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View>
      {/* ── 3D model + tappable hotspots (editable) ────────────────────── */}
      {editable && (
        <>
          {/* Front / Back toggle — outside the model */}
          <View style={st.viewToggle}>
            {(['front', 'back'] as const).map(v => (
              <TouchableOpacity
                key={v}
                style={[st.viewBtn, modelView === v && st.viewBtnActive]}
                onPress={() => setModelView(v)}
                activeOpacity={0.85}
              >
                <Text style={[st.viewBtnText, modelView === v && st.viewBtnTextActive]}>
                  {v === 'front' ? 'Front' : 'Back'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Wrapper keeps the popover visible even though the stage clips its content. */}
          <View style={st.modelWrap}>
            <View style={[st.stage, { padding: 0 }]} onLayout={e => setStageW(e.nativeEvent.layout.width)}>
              <MuscleVisualizer
                gender={female ? 'female' : 'male'}
                targetedMuscles={highlightMuscles}
                groupColors={groupColors}
                view={modelView}
                height={canvasHeight}
                hideControls
                overlay={
                  <>
                    {/* Invisible tap layer — tap the body directly to open the picker. */}
                    <View
                      style={StyleSheet.absoluteFill}
                      onStartShouldSetResponder={() => true}
                      onResponderRelease={handleModelTap}
                    />
                    <View style={st.hsTitle} pointerEvents="none">
                      <Text style={st.hsTitleName}>{name || 'Me'}</Text>
                      <Text style={st.hsTitleSub}>My Goals</Text>
                    </View>
                    {renderHotspots()}
                  </>
                }
              />
            </View>
            {renderPicker()}
          </View>

          <Text style={st.pickHint}>
            Tap a body part → pick a side → choose Muscle Growth, Injury Rehab or Stretching.
          </Text>
        </>
      )}

      {/* ── 2D figure (read-only preview) ──────────────────────────────── */}
      {!editable && (
      <View
        style={st.stage}
        onLayout={e => setStageW(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => !!figureInteractive}
        onResponderRelease={handleStageTap}
      >
        <Svg width="100%" height={canvasHeight} viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid meet">
          <G>
            {TICKS.map(cm => {
              const ty = GROUND - cm * PX_PER_CM;
              return (
                <G key={cm}>
                  <Line x1={RULER_X} y1={ty} x2={VB_W - 8} y2={ty} stroke={C.rule} strokeWidth={1} />
                  <SvgText x={RULER_X - 6} y={ty + 4} fontSize={11} fill={C.muted} textAnchor="end">{cm}</SvgText>
                  <SvgText x={VB_W - 4} y={ty + 4} fontSize={10} fill={C.muted} textAnchor="end">{toFeetInches(cm)}</SvgText>
                </G>
              );
            })}
            <SvgText x={RULER_X - 6} y={12} fontSize={10} fill={C.muted} textAnchor="end" fontWeight="700">cm</SvgText>
            <SvgText x={VB_W - 4} y={12} fontSize={10} fill={C.muted} textAnchor="end" fontWeight="700">ft</SvgText>
          </G>
          <Line x1={RULER_X} y1={GROUND} x2={VB_W - 8} y2={GROUND} stroke={C.muted} strokeWidth={1.5} />

          {fig.showGhost && figureImage(fig.girthCur, 0.3)}
          {figureImage(fig.girthMain, 1)}

          {markers.map((mk, i) => (
            <G key={i}>
              <Circle cx={mk.x} cy={mk.y} r={mk.r} fill={mk.fill} stroke={mk.color} strokeWidth={2} />
              <Circle cx={mk.x} cy={mk.y} r={2.5} fill={mk.color} />
              {!!mk.label && <SvgText x={mk.x} y={mk.y - mk.r - 5} fontSize={11} fontWeight="700" fill={mk.color} textAnchor="middle">{mk.label}</SvgText>}
            </G>
          ))}

          <SvgText x={CX} y={labelTop} fontSize={11} fill={C.text} textAnchor="middle" fontWeight="700">{name || 'Me'}</SvgText>
          <SvgText x={CX} y={labelTop + 13} fontSize={11} fill={C.muted} textAnchor="middle" fontWeight="700">My Goals</SvgText>
        </Svg>

        {/* ✕ remove chips overlaid on each selection */}
        {xChips.map((c, i) => (
          <TouchableOpacity
            key={`${c.gi}-${c.key}-${i}`}
            style={[st.xChip, { left: c.px + 8, top: c.py - 24, borderColor: c.color }]}
            onPress={() => removeKey(c.gi, c.key, c.type)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={[st.xChipText, { color: c.color }]}>✕</Text>
          </TouchableOpacity>
        ))}
      </View>
      )}

      {/* ── Preview summary ────────────────────────────────────────────── */}
      {!editable && showSummary && (
        <View style={st.summaryWrap}>
          {summary.length === 0
            ? <Text style={st.summaryEmpty}>Tap Edit to set your goals</Text>
            : summary.map((line, i) => <Text key={i} style={st.summaryLine}>{line}</Text>)}
        </View>
      )}

      {/* ── Goal builder ───────────────────────────────────────────────── */}
      {editable && (
        <>
          {list.map((goal, i) => {
            const meta = TYPE_META[goal.type];
            const active = i === activeIndex;
            const bodyGoal = goal.type !== 'weight_loss';
            return (
              <View key={i} style={[st.qCard, active && bodyGoal && { borderColor: meta.color, borderWidth: 1.5 }]}>
                <TouchableOpacity style={st.qHead} activeOpacity={0.8} onPress={() => setActiveIndex(i)}>
                  <View style={[st.qNum, { backgroundColor: meta.color }]}><Text style={st.qNumText}>{i + 1}</Text></View>
                  <Text style={st.qTitle}>Goal {i + 1}</Text>
                  {list.length > 1 && (
                    <TouchableOpacity onPress={() => removeGoal(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={st.removeText}>Remove</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>

                {/* Step 1 — type */}
                <View style={st.typeGrid}>
                  {TYPE_ORDER.map(t => {
                    const on = goal.type === t; const tm = TYPE_META[t];
                    return (
                      <TouchableOpacity key={t} activeOpacity={0.85} onPress={() => setType(i, t)}
                        style={[st.typeBtn, on && { borderColor: tm.color, backgroundColor: tm.soft }]}>
                        <Text style={st.typeEmoji}>{tm.emoji}</Text>
                        <Text style={[st.typeText, on && { color: C.text, fontWeight: '800' }]}>{tm.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Step 2 — follow-up */}
                {goal.type === 'weight_loss' && (
                  <View style={st.detail}>
                    <View style={st.compareRow}>
                      <Compare label="Current" value={fmtWeight(curWeight, units)} />
                      <Text style={st.arrow}>→</Text>
                      <Compare label="Target" value={fmtWeight(Math.max(35, curWeight - (goal.kg ?? 0)), units)} accent />
                      <View style={st.deltaPill}><Text style={st.deltaText}>−{fmtWeight(goal.kg ?? 0, units)}</Text></View>
                    </View>
                    <View style={st.sliderHead}>
                      <Text style={st.qLabel}>{isWeightLb(units) ? 'Lb to lose' : 'Kg to lose'}</Text>
                      <Text style={st.sliderValue}>{fmtWeight(goal.kg ?? 0, units)}</Text>
                    </View>
                    <Slider min={1} max={maxLose} step={1} value={goal.kg ?? 1} color={C.orange} onChange={v => update(i, { kg: v })} />
                  </View>
                )}

                {bodyGoal && (
                  <View style={st.detail}>
                    <View style={st.tapRow}>
                      <Text style={st.qLabel}>
                        {goal.type === 'muscle_growth'
                          ? `Tap the 3D model to pick muscles (top ${MAX_MUSCLES})`
                          : 'Tap the 3D model to pick body parts'}
                      </Text>
                      <Text style={st.sliderValue}>
                        {(goal.type === 'muscle_growth' ? (goal.muscles ?? []) : (goal.areas ?? [])).length}
                        {goal.type === 'muscle_growth' ? `/${MAX_MUSCLES}` : ''}
                      </Text>
                    </View>
                    {!active && (
                      <TouchableOpacity onPress={() => setActiveIndex(i)} activeOpacity={0.8}>
                        <Text style={[st.tapHint, { color: meta.color }]}>Tap here to edit this goal on the model ↑</Text>
                      </TouchableOpacity>
                    )}
                    {active && <Text style={st.tapHint}>Use Front / Back, then tap a dot on the model · tap again to remove</Text>}

                    {/* selected as removable tags (also removable here) */}
                    <View style={st.tagRow}>
                      {(goal.type === 'muscle_growth' ? (goal.muscles ?? []) : (goal.areas ?? [])).map(key => (
                        <TouchableOpacity key={key} style={[st.tag, { borderColor: meta.color, backgroundColor: meta.soft }]}
                          onPress={() => removeKey(i, key, goal.type)} activeOpacity={0.8}>
                          <Text style={[st.tagText, { color: meta.color }]}>{keyLabel(lmList(goal.type), key)}</Text>
                          <Text style={[st.tagX, { color: meta.color }]}> ✕</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            );
          })}

          <TouchableOpacity style={st.addBtn} activeOpacity={0.85} onPress={addGoal}>
            <Text style={st.addBtnText}>＋ Add another goal</Text>
          </TouchableOpacity>

          {onSave && (
            <TouchableOpacity style={[st.saveBtn, saving && { opacity: 0.6 }]} activeOpacity={0.85} disabled={saving} onPress={handleSave}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={st.saveBtnText}>Save Goals</Text>}
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

function Compare({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={st.compareCol}>
      <Text style={[st.compareValue, accent && { color: C.orange }]}>{value}</Text>
      <Text style={st.compareLabel}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  stage: { position: 'relative', backgroundColor: C.canvas, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden', paddingVertical: 6 },

  // 3D model overlay — title + tappable body-part dots
  hsTitle: { position: 'absolute', top: 10, left: 0, right: 0, alignItems: 'center' },
  hsTitleName: { color: C.text, fontSize: 12, fontWeight: '800' },
  hsTitleSub: { color: C.muted, fontSize: 11, fontWeight: '700' },
  hsDot: {
    position: 'absolute', width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    marginLeft: -10, marginTop: -10,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 3,
  },
  hsLabel: {
    position: 'absolute', width: 90, marginLeft: -45, marginTop: -30, textAlign: 'center',
    fontSize: 11, fontWeight: '900', color: '#3F3F49',
    // Light halo keeps the dark-grey text legible on any highlight colour.
    textShadowColor: 'rgba(255,255,255,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  viewToggle: {
    flexDirection: 'row', alignSelf: 'center', marginBottom: 10,
    backgroundColor: C.cardBg, borderRadius: 100, padding: 3,
    borderWidth: 1, borderColor: C.border,
  },
  viewBtn: { paddingHorizontal: 22, paddingVertical: 7, borderRadius: 100 },
  viewBtnActive: { backgroundColor: '#211832' },
  viewBtnText: { color: C.muted, fontSize: 13, fontWeight: '700' },
  viewBtnTextActive: { color: '#fff' },
  xChip: {
    position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff',
    borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 3,
  },
  xChipText: { fontSize: 12, fontWeight: '900', lineHeight: 14 },

  // Guided part-first picker — compact inline mini-menu
  modelWrap: { position: 'relative' },
  pickHint: { color: C.muted, fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 10 },
  pop: {
    position: 'absolute', backgroundColor: 'rgba(255,255,255,0.97)', borderRadius: 10, padding: 6,
    borderWidth: 1, borderColor: C.border, zIndex: 50,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 8,
  },
  popHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5, paddingHorizontal: 2 },
  popTitle: { flex: 1, color: C.text, fontSize: 12, fontWeight: '800' },
  popClose: { color: C.muted, fontSize: 11, fontWeight: '900', paddingLeft: 4 },
  popRow: { flexDirection: 'row', gap: 4 },
  popChip: { flex: 1, paddingVertical: 6, borderRadius: 7, backgroundColor: C.canvas, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  popChipText: { color: C.text, fontSize: 12, fontWeight: '800' },
  popType: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 7, borderRadius: 8, borderWidth: 1, marginTop: 4 },
  popTypeEmoji: { fontSize: 13 },
  popTypeText: { flex: 1, color: C.text, fontSize: 11, fontWeight: '700' },
  popBack: { color: C.muted, fontSize: 11, fontWeight: '700', marginTop: 5, textAlign: 'center' },
  popRemove: {
    marginTop: 6, paddingVertical: 6, borderRadius: 8, alignItems: 'center',
    backgroundColor: 'rgba(220,38,38,0.10)', borderWidth: 1, borderColor: 'rgba(220,38,38,0.35)',
  },
  popRemoveText: { color: '#dc2626', fontSize: 11, fontWeight: '800' },

  summaryWrap: { marginTop: 12, gap: 4 },
  summaryLine: { color: C.text, fontSize: 14, fontWeight: '600' },
  summaryEmpty: { color: C.muted, fontSize: 14 },

  qCard: { marginTop: 14, backgroundColor: C.cardBg, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14 },
  qHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  qNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  qNumText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  qTitle: { flex: 1, color: C.text, fontSize: 15, fontWeight: '800' },
  removeText: { color: C.muted, fontSize: 13, fontWeight: '700' },
  qLabel: { color: C.text, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn: { width: '48%', paddingVertical: 12, borderRadius: 12, backgroundColor: C.canvas, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', gap: 3 },
  typeEmoji: { fontSize: 20 },
  typeText: { color: C.muted, fontSize: 12, fontWeight: '600' },

  detail: { marginTop: 14 },
  tapRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  tapHint: { color: C.muted, fontSize: 12, marginTop: 8, fontWeight: '600' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  tag: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1.5 },
  tagText: { color: C.muted, fontSize: 13, fontWeight: '700' },
  tagX: { fontSize: 12, fontWeight: '900' },

  compareRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  compareCol: { alignItems: 'center' },
  compareValue: { color: C.text, fontSize: 18, fontWeight: '800' },
  compareLabel: { color: C.muted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginTop: 2 },
  arrow: { color: C.muted, fontSize: 18, fontWeight: '800' },
  deltaPill: { marginLeft: 'auto', backgroundColor: 'rgba(242,89,18,0.12)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  deltaText: { color: C.orange, fontSize: 14, fontWeight: '800' },

  sliderHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10, marginBottom: 10 },
  sliderValue: { color: C.text, fontSize: 13, fontWeight: '700' },
  sliderTrack: { height: 26, justifyContent: 'center' },
  sliderRail: { position: 'absolute', left: 0, right: 0, top: 10, height: 6, borderRadius: 3, backgroundColor: 'rgba(33,24,50,0.10)' },
  sliderFill: { position: 'absolute', left: 0, top: 10, height: 6, borderRadius: 3 },
  sliderThumb: {
    position: 'absolute', top: 2, width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff',
    borderWidth: 3, marginLeft: -11, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },

  sideRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  sideBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: C.canvas, borderWidth: 1.5, borderColor: C.border, alignItems: 'center' },

  addBtn: { marginTop: 14, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.border, alignItems: 'center' },
  addBtnText: { color: C.text, fontSize: 14, fontWeight: '800' },

  saveBtn: { marginTop: 18, height: 52, borderRadius: 14, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});
