/**
 * GoalVisualizer — "My Goal" (stepped builder)
 *
 * Each goal is a card: pick the TYPE (Muscle Growth / Weight Loss / Injury Rehab
 * / Stretching), then for body-part goals you TAP THE FIGURE to select parts
 * (nearest landmark to the tap), with an ✕ on each marker to remove it. Add more
 * goals with "+ Add another goal".
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, GestureResponderEvent, Image as RNImage, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, G, Image as SvgImage, Line, Text as SvgText } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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

// MuscleVisualizer bone/region group (returned by a 3D raycast tap) → the body
// part key used here (must exist in BODY_PARTS). Elbow collapses to Arms; Back to
// upper back — the picker still lets the user pick side + goal type afterward.
const GROUP_TO_PART: Record<string, string> = {
  Shoulders: 'shoulders', Chest: 'chest', Arms: 'arms', Elbow: 'arms',
  Wrist: 'wrist', Abs: 'abs', Back: 'upper_back', Glutes: 'glutes',
  Quads: 'quads', Calves: 'calves', Neck: 'neck', Hip: 'hip',
  Knee: 'knee', Ankle: 'ankle',
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
// Goals are part-based: collapse side variants to their base, de-duplicated in
// order, so a part can never repeat (elbow / elbow::left / elbow::right → elbow).
const uniqueBases = (keys: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of keys) { const b = parseKey(k).base; if (!seen.has(b)) { seen.add(b); out.push(b); } }
  return out;
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

// Icons are MaterialCommunityIcons names, matching the Workouts category rows
// (weight-lifter / human-cane / yoga); weight loss keeps a fire icon.
const TYPE_META: Record<GoalType, { label: string; icon: string; color: string; soft: string; noun: string }> = {
  muscle_growth: { label: 'Muscle Growth', icon: 'weight-lifter', color: C.green,  soft: 'rgba(22,163,74,0.12)',  noun: 'muscles' },
  weight_loss:   { label: 'Weight Loss',   icon: 'fire',          color: C.yellow, soft: 'rgba(212,166,0,0.14)',  noun: '' },
  injury_rehab:  { label: 'Injury Rehab',  icon: 'human-cane',    color: C.red,    soft: 'rgba(220,38,38,0.12)',  noun: 'body parts' },
  stretching:    { label: 'Stretching',    icon: 'yoga',          color: C.blue,   soft: 'rgba(37,99,235,0.12)',  noun: 'body parts' },
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

// Landmarks offered in the list picker (hideModel mode), per goal type.
const partsForType = (type: GoalType): Landmark[] =>
  type === 'muscle_growth' ? MUSCLES : INJURY_AREAS;

// Goal selections → highlighted MuscleVisualizer bone-groups, coloured by goal
// type. Exported so the shared body model (BodyVisualizer) can paint goals too.
export function goalHighlights(goals: GoalEntry[] | null | undefined): {
  muscles: string[];
  colors: Record<string, string>;
} {
  const colors: Record<string, string> = {};
  const groups: string[] = [];
  for (const g of goals ?? []) {
    if (g.type === 'weight_loss') continue;
    const keys = g.type === 'muscle_growth' ? (g.muscles ?? []) : (g.areas ?? []);
    const col = TYPE_META[g.type].color;
    for (const k of keys) {
      const grp = HL_MAP[parseKey(k).base];
      if (!grp) continue;
      groups.push(grp);
      colors[grp] = col;
    }
  }
  return { muscles: groups, colors };
}

// One summary line per goal for the combined Help-with / Goals table
// (BodyGoalScreen). Weight loss reads as a signed weight; part goals list their
// selected landmark labels.
export interface GoalRow { icon: string; color: string; label: string; focus: string; }
export function goalRows(goals: GoalEntry[] | null | undefined): GoalRow[] {
  const units = loadUnits();
  return (goals ?? []).map(g => {
    const meta = TYPE_META[g.type];
    if (g.type === 'weight_loss') {
      return { icon: meta.icon, color: meta.color, label: meta.label, focus: `−${fmtWeight(g.kg ?? 0, units)}` };
    }
    const keys = g.type === 'muscle_growth' ? (g.muscles ?? []) : (g.areas ?? []);
    const focus = uniqueBases(keys).map(b => keyLabel(lmList(g.type), b)).join(', ');
    return { icon: meta.icon, color: meta.color, label: meta.label, focus };
  });
}

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
  /** Hide the built-in 3D figure (a shared body model paints goals instead) and
   *  pick body parts from a list rather than tapping the figure. */
  hideModel?: boolean;
  /** Fires with the current goal list whenever it changes (for the shared model). */
  onChange?: (goals: GoalEntry[]) => void;
  /** Hide the built-in Save button (a parent owns a shared Save for body + goals). */
  hideSave?: boolean;
}

const newGoal = (type: GoalType): GoalEntry =>
  type === 'weight_loss' ? { type, kg: 5 }
  : type === 'muscle_growth' ? { type, muscles: [] }
  : { type, areas: [], side: 'both' };

// ── Component ───────────────────────────────────────────────────────────────
export default function GoalVisualizer({
  name, gender, heightCm, weightKg, goals, onSave, saving = false, canvasHeight = 320, editable = true,
  showSummary = true, hideModel = false, onChange, hideSave = false,
}: Props) {
  const [list, setList] = useState<GoalEntry[]>(
    goals && goals.length ? goals : [newGoal('muscle_growth')],
  );
  // Mirror the working list up to the parent so a shared body model can paint it.
  useEffect(() => { onChange?.(list); }, [list]); // eslint-disable-line react-hooks/exhaustive-deps
  // Stay in sync when goals are edited elsewhere (e.g. added from the shared body
  // model's tap popup) — the parent owns the goal list and passes it back down.
  // Signature-guarded so our own onChange round-trip doesn't cause a loop.
  const goalsSig = useMemo(() => JSON.stringify(goals ?? []), [goals]);
  useEffect(() => {
    const incoming = goals ?? [];
    if (!incoming.length) return; // ignore empty external state (keep default goal)
    setList(prev => (JSON.stringify(prev) === goalsSig ? prev : incoming));
  }, [goalsSig]); // eslint-disable-line react-hooks/exhaustive-deps
  const [activeIndex, setActiveIndex] = useState(0);
  // Row-per-type builder (hideModel mode): which type's part picker is open.
  const [expandedType, setExpandedType] = useState<GoalType | null>(null);
  // Whether the "Add a goal" type chooser is open (hideModel mode).
  const [adding, setAdding] = useState(false);
  const [stageW, setStageW] = useState(0);
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
  // List-picker toggle (hideModel mode) — add/remove a body part on goal i.
  const togglePart = (i: number, key: string) => {
    const g = list[i];
    if (!g || g.type === 'weight_loss') return;
    const muscle = g.type === 'muscle_growth';
    const cur = (muscle ? g.muscles : g.areas) ?? [];
    const has = cur.includes(key);
    const next = has ? cur.filter(x => x !== key)
      : muscle && cur.length >= MAX_MUSCLES ? cur
      : [...cur, key];
    update(i, muscle ? { muscles: next } : { areas: next });
  };

  // ── Row-per-type builder helpers (hideModel mode) ──────────────────────────
  // One goal per type: toggling a part upserts the goal, and clearing its last
  // part drops it, so `list` stays in lock-step with what the table shows.
  const togglePartForType = (t: GoalType, key: string) => {
    setList(prev => {
      const next = [...prev];
      const muscle = t === 'muscle_growth';
      const idx = next.findIndex(g => g.type === t);
      if (idx === -1) {
        next.push(muscle ? { type: t, muscles: [key] } : { type: t, areas: [key], side: 'both' });
        return next;
      }
      const g = next[idx];
      const cur = (muscle ? g.muscles : g.areas) ?? [];
      // Base-aware: a part counts as present if any side variant of it exists;
      // toggling off removes every variant, toggling on adds the bare key.
      const has = cur.some(k => parseKey(k).base === key);
      const updated = has ? cur.filter(k => parseKey(k).base !== key)
        : muscle && uniqueBases(cur).length >= MAX_MUSCLES ? cur
        : [...cur, key];
      if (updated.length === 0) next.splice(idx, 1);
      else next[idx] = muscle ? { ...g, muscles: updated } : { ...g, areas: updated };
      return next;
    });
  };
  // Upsert the weight-loss target (creates the goal on first change).
  const setKg = (kg: number) => setList(prev => {
    const next = [...prev];
    const idx = next.findIndex(g => g.type === 'weight_loss');
    if (idx === -1) next.push({ type: 'weight_loss', kg });
    else next[idx] = { ...next[idx], kg };
    return next;
  });
  const removeType = (t: GoalType) => setList(prev => prev.filter(g => g.type !== t));

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
    if (g.type === 'weight_loss') return { icon: meta.icon, color: meta.color, text: `Lose ${fmtWeight(g.kg ?? 0, units)}` };
    const keys = g.type === 'muscle_growth' ? (g.muscles ?? []) : (g.areas ?? []);
    const labels = keys.map(k => keyLabel(lmList(g.type), k)).join(', ');
    return { icon: meta.icon, color: meta.color, text: `${meta.label}${labels ? `: ${labels}` : ''}` };
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

  // 3D raycast tap on the model → { group, side } → open the guided picker with
  // the detected anatomical side pre-filled (jumps straight to goal-type choices).
  const handlePartSelect = (group: string, side: 'left' | 'right' | null) => {
    const base = GROUP_TO_PART[group];
    if (!base) return;
    const meta = [...BODY_PARTS.front, ...BODY_PARTS.back].find(h => h.key === base);
    const both = meta?.both ?? false;
    const resolvedSide: InjurySide = both ? (side === 'left' || side === 'right' ? side : 'both') : 'both';
    setPicker({ base, label: meta?.label ?? base, both, xf: 0.5, y: 0.5, side: resolvedSide });
  };

  // Picker card — pinned to the bottom-centre of the stage. The 3D camera moves
  // freely (rotate / zoom / pan), so a fixed anchor stays legible instead of
  // chasing a body point that keeps moving.
  const POP_W = 180;
  const renderPicker = () => {
    if (!picker || !stageW) return null;
    const left = clamp(stageW / 2 - POP_W / 2, 4, Math.max(4, stageW - POP_W - 4));
    const showType = !picker.both || picker.side !== null;
    const isSelected = !!ownerOf(picker.base);
    return (
      <View
        style={[
          st.pop,
          { width: POP_W, left, bottom: 12 },
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
                  <MaterialCommunityIcons name={tm.icon as any} size={15} color={tm.color} />
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
      {/* ── 3D model + tappable hotspots (editable; hidden when a shared model
            paints goals instead) ──────────────────────────────────────── */}
      {editable && !hideModel && (
        <>
          {/* Wrapper keeps the popover visible even though the stage clips its content. */}
          <View style={st.modelWrap}>
            <View style={[st.stage, { padding: 0 }]} onLayout={e => setStageW(e.nativeEvent.layout.width)}>
              <MuscleVisualizer
                gender={female ? 'female' : 'male'}
                targetedMuscles={highlightMuscles}
                groupColors={groupColors}
                view="front"
                height={canvasHeight}
                hideControls
                onPartSelect={handlePartSelect}
                overlay={
                  <View style={st.hsTitle} pointerEvents="none">
                    <Text style={st.hsTitleName}>{name || 'Me'}</Text>
                    <Text style={st.hsTitleSub}>My Goals</Text>
                  </View>
                }
              />
            </View>
            {renderPicker()}
          </View>

          <Text style={st.pickHint}>
            Drag to rotate · pinch to zoom · tap a body part to choose Muscle Growth, Injury Rehab or Stretching.
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
            : summary.map((line, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MaterialCommunityIcons name={line.icon as any} size={14} color={line.color} />
                  <Text style={st.summaryLine}>{line.text}</Text>
                </View>
              ))}
        </View>
      )}

      {/* ── Goal builder (hideModel) — active goals as expandable rows + an
          "Add a goal" chooser. Rendered *inside* the Help-With table on
          BodyGoalScreen so conditions and goals read as one list, so there's no
          card frame here and inactive types are hidden until added. ─────────── */}
      {editable && hideModel && (() => {
        const isActive = (t: GoalType) => {
          const g = list.find(x => x.type === t);
          if (!g) return false;
          return t === 'weight_loss'
            ? (g.kg ?? 0) > 0
            : ((t === 'muscle_growth' ? g.muscles : g.areas)?.length ?? 0) > 0;
        };
        const activeTypes = TYPE_ORDER.filter(isActive);
        // A type mid-add: expanded for editing but not yet active. Shown as a
        // provisional row until the user picks a part / weight (or collapses it).
        const pending = expandedType && !activeTypes.includes(expandedType) ? expandedType : null;
        const rowTypes: GoalType[] = pending ? [...activeTypes, pending] : activeTypes;
        const inactiveTypes = TYPE_ORDER.filter(t => !activeTypes.includes(t) && t !== pending);
        const showAdd = inactiveTypes.length > 0;
        return (
          <>
            {rowTypes.map((t, ri) => {
              const meta = TYPE_META[t];
              const goal = list.find(g => g.type === t);
              const keys = t === 'weight_loss' ? []
                : t === 'muscle_growth' ? (goal?.muscles ?? []) : (goal?.areas ?? []);
              const active = activeTypes.includes(t);
              const expanded = expandedType === t;
              const lastRow = ri === rowTypes.length - 1 && !showAdd;
              const focusText = t === 'weight_loss'
                ? (active ? `− ${fmtWeight(goal?.kg ?? 0, units)}` : 'Tap to set')
                : (keys.length ? uniqueBases(keys).map(b => keyLabel(lmList(t), b)).join(', ') : 'Tap to pick');
              return (
                <View key={t} style={!lastRow && st.gRowDivider}>
                  <View style={st.gRow}>
                    <TouchableOpacity
                      style={st.gRowMain}
                      activeOpacity={0.7}
                      onPress={() => setExpandedType(expanded ? null : t)}
                    >
                      <View style={st.gTypeCell}>
                        <MaterialCommunityIcons name={meta.icon as any} size={16} color={meta.color} style={{ marginRight: 7 }} />
                        <Text style={[st.gTypeText, { color: active ? meta.color : C.muted }]} numberOfLines={1}>{meta.label}</Text>
                        <Text style={st.gGoalTag}> (goal)</Text>
                      </View>
                      <Text
                        style={[st.gFocus, { color: active ? C.text : C.muted, fontStyle: active ? 'normal' : 'italic' }]}
                        numberOfLines={1}
                      >
                        {focusText}
                      </Text>
                      <Text style={[st.gChevron, expanded && st.gChevronOpen]}>▸</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={st.gxCol}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => { removeType(t); if (expandedType === t) setExpandedType(null); }}
                    >
                      <Text style={st.gxText}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Expander — part chips (part goals) or kg control (weight loss) */}
                  {expanded && t !== 'weight_loss' && (
                    <View style={st.gExpand}>
                      <View style={st.tagRow}>
                        {partsForType(t).map(lm => {
                          const on = keys.some(k => parseKey(k).base === lm.key);
                          return (
                            <TouchableOpacity
                              key={lm.key}
                              style={[st.tag, on
                                ? { borderColor: meta.color, backgroundColor: meta.soft }
                                : { borderColor: 'rgba(33,24,50,0.12)' }]}
                              onPress={() => togglePartForType(t, lm.key)}
                              activeOpacity={0.8}
                            >
                              <Text style={[st.tagText, { color: on ? meta.color : C.muted }]}>{lm.label}</Text>
                              {on && <Text style={[st.tagX, { color: meta.color }]}> ✓</Text>}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      {t === 'muscle_growth' && <Text style={st.gHint}>Pick up to {MAX_MUSCLES}</Text>}
                    </View>
                  )}

                  {expanded && t === 'weight_loss' && (
                    <View style={st.gExpand}>
                      <View style={st.compareRow}>
                        <Compare label="Current" value={fmtWeight(curWeight, units)} />
                        <Text style={st.arrow}>→</Text>
                        <Compare label="Target" value={fmtWeight(Math.max(35, curWeight - (goal?.kg ?? 0)), units)} accent />
                        <View style={st.deltaPill}><Text style={st.deltaText}>−{fmtWeight(goal?.kg ?? 0, units)}</Text></View>
                      </View>
                      <View style={st.sliderHead}>
                        <Text style={st.qLabel}>{isWeightLb(units) ? 'Lb to lose' : 'Kg to lose'}</Text>
                        <Text style={st.sliderValue}>{fmtWeight(goal?.kg ?? 0, units)}</Text>
                      </View>
                      <Slider min={1} max={maxLose} step={1} value={goal?.kg ?? 1} color={C.orange} onChange={setKg} />
                    </View>
                  )}
                </View>
              );
            })}

            {showAdd && (
              <View>
                <TouchableOpacity style={st.gAddRow} activeOpacity={0.7} onPress={() => setAdding(a => !a)}>
                  <Text style={[st.gAddPlus, adding && st.gChevronOpen]}>＋</Text>
                  <Text style={st.gAddText}>Add a goal</Text>
                </TouchableOpacity>
                {adding && (
                  <View style={st.gAddChips}>
                    {inactiveTypes.map(t => {
                      const tm = TYPE_META[t];
                      return (
                        <TouchableOpacity
                          key={t}
                          style={[st.tag, { borderColor: 'rgba(33,24,50,0.12)' }]}
                          activeOpacity={0.85}
                          onPress={() => { setExpandedType(t); setAdding(false); }}
                        >
                          <MaterialCommunityIcons name={tm.icon as any} size={14} color={tm.color} style={{ marginRight: 5 }} />
                          <Text style={[st.tagText, { color: tm.color }]}>{tm.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}
          </>
        );
      })()}

      {/* ── Goal builder — stepped cards (tap-the-model / default) ─────────── */}
      {editable && !hideModel && (
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

                {/* Step 1 — type. Flowing pill chips, matching the Help-With and
                    Pick-body-parts chip style. */}
                <View style={st.tagRow}>
                  {TYPE_ORDER.map(t => {
                    const on = goal.type === t; const tm = TYPE_META[t];
                    return (
                      <TouchableOpacity
                        key={t}
                        activeOpacity={0.85}
                        onPress={() => setType(i, t)}
                        style={[st.tag, on
                          ? { borderColor: tm.color, backgroundColor: tm.soft }
                          : { borderColor: 'rgba(33,24,50,0.12)' }]}
                      >
                        <MaterialCommunityIcons name={tm.icon as any} size={14} color={tm.color} style={{ marginRight: 5 }} />
                        <Text style={[st.tagText, { color: on ? C.text : C.muted, fontWeight: on ? '800' : '700' }]}>{tm.label}</Text>
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
                        {hideModel
                          ? (goal.type === 'muscle_growth'
                              ? `Pick muscles (top ${MAX_MUSCLES})`
                              : 'Pick body parts')
                          : (goal.type === 'muscle_growth'
                              ? `Tap the 3D model to pick muscles (top ${MAX_MUSCLES})`
                              : 'Tap the 3D model to pick body parts')}
                      </Text>
                      <Text style={st.sliderValue}>
                        {(goal.type === 'muscle_growth' ? (goal.muscles ?? []) : (goal.areas ?? [])).length}
                        {goal.type === 'muscle_growth' ? `/${MAX_MUSCLES}` : ''}
                      </Text>
                    </View>

                    {hideModel ? (
                      /* List picker — tap chips to add/remove (no figure needed). */
                      <View style={st.tagRow}>
                        {partsForType(goal.type).map(lm => {
                          const cur = goal.type === 'muscle_growth' ? (goal.muscles ?? []) : (goal.areas ?? []);
                          const on = cur.includes(lm.key);
                          return (
                            <TouchableOpacity
                              key={lm.key}
                              style={[st.tag, on
                                ? { borderColor: meta.color, backgroundColor: meta.soft }
                                : { borderColor: 'rgba(33,24,50,0.12)' }]}
                              onPress={() => togglePart(i, lm.key)}
                              activeOpacity={0.8}
                            >
                              <Text style={[st.tagText, { color: on ? meta.color : C.muted }]}>{lm.label}</Text>
                              {on && <Text style={[st.tagX, { color: meta.color }]}> ✓</Text>}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ) : (
                      <>
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
                      </>
                    )}
                  </View>
                )}
              </View>
            );
          })}

          <TouchableOpacity style={st.addBtn} activeOpacity={0.85} onPress={addGoal}>
            <Text style={st.addBtnText}>＋ Add another goal</Text>
          </TouchableOpacity>

          {onSave && !hideSave && (
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

  // Row-per-type goal table (hideModel) — matches the summary table's frame.
  gRowDivider: { borderBottomWidth: 1, borderBottomColor: C.border },
  gRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 12 },
  gRowMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  gTypeCell: { flexDirection: 'row', alignItems: 'center', width: 150 },
  gTypeText: { fontSize: 13, fontWeight: '800', flexShrink: 1 },
  gGoalTag: { color: C.muted, fontSize: 11, fontWeight: '700' },
  gFocus: { flex: 1, fontSize: 13, fontWeight: '600', paddingRight: 8 },
  gChevron: { color: C.muted, fontSize: 14, fontWeight: '900', width: 16, textAlign: 'center' },
  gChevronOpen: { transform: [{ rotate: '90deg' }] },
  gxCol: { width: 24, alignItems: 'center', justifyContent: 'center', marginLeft: 2 },
  gxText: { color: C.muted, fontSize: 14, fontWeight: '900' },
  gExpand: { paddingHorizontal: 12, paddingBottom: 13, paddingTop: 0 },
  gHint: { color: C.muted, fontSize: 11, fontWeight: '600', marginTop: 8 },
  gRemove: { color: C.red, fontSize: 12, fontWeight: '700', marginTop: 12 },
  gAddRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12 },
  gAddPlus: { color: C.orange, fontSize: 15, fontWeight: '900', marginRight: 7 },
  gAddText: { color: C.orange, fontSize: 13, fontWeight: '800' },
  gAddChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 12, paddingBottom: 12 },

  qCard: { marginTop: 10, backgroundColor: C.cardBg, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 11 },
  qHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  qNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  qNumText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  qTitle: { flex: 1, color: C.text, fontSize: 15, fontWeight: '800' },
  removeText: { color: C.muted, fontSize: 13, fontWeight: '700' },
  qLabel: { color: C.text, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // Compact 2×2 — icon beside the label (single row) so each button is short.
  typeBtn: { width: '48%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 10, backgroundColor: C.canvas, borderWidth: 1.5, borderColor: C.border },
  typeEmoji: { fontSize: 20 },
  typeText: { color: C.muted, fontSize: 11, fontWeight: '600' },

  detail: { marginTop: 10 },
  tapRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  tapHint: { color: C.muted, fontSize: 12, marginTop: 8, fontWeight: '600' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1.5 },
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
