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

// ── 3D model hotspots — tappable body-part dots overlaid on the model. ─────────
// x = horizontal offset from centre (0.5); y = fraction of viewer height.
type Hotspot = { key: string; label: string; y: number; x: number; both: boolean };
const HOTSPOTS: Record<'muscle' | 'injury', { front: Hotspot[]; back: Hotspot[] }> = {
  muscle: {
    front: [
      { key: 'shoulders', label: 'Shoulders', y: 0.30, x: 0.12, both: true },
      { key: 'chest',     label: 'Chest',     y: 0.37, x: 0.07, both: true },
      { key: 'arms',      label: 'Arms',      y: 0.45, x: 0.17, both: true },
      { key: 'abs',       label: 'Abs',       y: 0.47, x: 0.00, both: false },
      { key: 'quads',     label: 'Quads',     y: 0.66, x: 0.06, both: true },
      { key: 'calves',    label: 'Calves',    y: 0.84, x: 0.05, both: true },
    ],
    back: [
      { key: 'shoulders', label: 'Shoulders', y: 0.30, x: 0.12, both: true },
      { key: 'back',      label: 'Back',      y: 0.40, x: 0.00, both: false },
      { key: 'arms',      label: 'Arms',      y: 0.45, x: 0.17, both: true },
      { key: 'glutes',    label: 'Glutes',    y: 0.55, x: 0.06, both: true },
      { key: 'calves',    label: 'Calves',    y: 0.84, x: 0.05, both: true },
    ],
  },
  injury: {
    front: [
      { key: 'neck',     label: 'Neck',     y: 0.20, x: 0.00, both: false },
      { key: 'shoulder', label: 'Shoulder', y: 0.30, x: 0.12, both: true },
      { key: 'elbow',    label: 'Elbow',    y: 0.46, x: 0.16, both: true },
      { key: 'wrist',    label: 'Wrist',    y: 0.57, x: 0.18, both: true },
      { key: 'hip',      label: 'Hip',      y: 0.52, x: 0.07, both: true },
      { key: 'knee',     label: 'Knee',     y: 0.70, x: 0.05, both: true },
      { key: 'ankle',    label: 'Ankle',    y: 0.90, x: 0.05, both: true },
    ],
    back: [
      { key: 'neck',       label: 'Neck',       y: 0.20, x: 0.00, both: false },
      { key: 'shoulder',   label: 'Shoulder',   y: 0.30, x: 0.12, both: true },
      { key: 'upper_back', label: 'Upper Back', y: 0.37, x: 0.00, both: false },
      { key: 'lower_back', label: 'Lower Back', y: 0.47, x: 0.00, both: false },
      { key: 'elbow',      label: 'Elbow',      y: 0.46, x: 0.16, both: true },
      { key: 'knee',       label: 'Knee',       y: 0.70, x: 0.05, both: true },
      { key: 'ankle',      label: 'Ankle',      y: 0.90, x: 0.05, both: true },
    ],
  },
};
// Goal landmark key → MuscleVisualizer highlight group.
const HL_MAP: Record<string, string> = {
  shoulders: 'Shoulders', chest: 'Chest', arms: 'Arms', back: 'Back',
  abs: 'Abs', glutes: 'Glutes', quads: 'Quads', calves: 'Calves',
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
  text:       '#211832',
  muted:      '#7A7C90',
  canvas:     '#EEEEF2',
  cardBg:     '#F8F8FC',
  border:     'rgba(33,24,50,0.08)',
  rule:       'rgba(33,24,50,0.10)',
};

const TYPE_META: Record<GoalType, { label: string; emoji: string; color: string; soft: string; noun: string }> = {
  muscle_growth: { label: 'Muscle Growth', emoji: '💪', color: C.green,  soft: 'rgba(22,163,74,0.12)', noun: 'muscles' },
  weight_loss:   { label: 'Weight Loss',   emoji: '🔥', color: C.orange, soft: 'rgba(242,89,18,0.12)', noun: '' },
  injury_rehab:  { label: 'Injury Rehab',  emoji: '🩹', color: C.blue,   soft: 'rgba(37,99,235,0.12)', noun: 'body parts' },
  stretching:    { label: 'Stretching',    emoji: '🧘', color: C.purple, soft: 'rgba(124,58,237,0.12)', noun: 'body parts' },
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
const lmList = (type: GoalType): Landmark[] => (type === 'injury_rehab' ? INJURY_AREAS : MUSCLES);

// ── Canvas geometry ───────────────────────────────────────────────────────────
const VB_W = 300, VB_H = 360, GROUND = 338, TOP_PAD = 16, HEIGHT_MAX = 215;
const PX_PER_CM = (GROUND - TOP_PAD) / HEIGHT_MAX;
const CX = 168, RULER_X = 56;
const TICKS = [0, 30, 60, 90, 120, 150, 180, 210];
const HIT_RADIUS = 42; // viewBox units — how close a tap must be to a landmark

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round = (v: number, step: number) => Math.round(v / step) * step;
const girthFromBmi = (bmi: number) => clamp(1 + (bmi - 22) * 0.022, 0.86, 1.34);
function toFeetInches(cm: number): string {
  const t = cm / 2.54; let ft = Math.floor(t / 12); let inch = Math.round(t - ft * 12);
  if (inch === 12) { ft += 1; inch = 0; } return `${ft}'${inch}"`;
}

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
}

const newGoal = (type: GoalType): GoalEntry =>
  type === 'weight_loss' ? { type, kg: 5 }
  : type === 'muscle_growth' ? { type, muscles: [] }
  : { type, areas: [], side: 'both' };

// ── Component ───────────────────────────────────────────────────────────────
export default function GoalVisualizer({
  name, gender, heightCm, weightKg, goals, onSave, saving = false, canvasHeight = 320, editable = true,
}: Props) {
  const [list, setList] = useState<GoalEntry[]>(
    goals && goals.length ? goals : [newGoal('muscle_growth')],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [stageW, setStageW] = useState(0);
  // 3D model view (editable mode): front/back lets hotspots align with the body.
  const [modelView, setModelView] = useState<'front' | 'back'>('front');

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
    if (g.type === 'weight_loss') return `${meta.emoji} Lose ${Math.round(g.kg ?? 0)} kg`;
    const keys = g.type === 'muscle_growth' ? (g.muscles ?? []) : (g.areas ?? []);
    const labels = keys.map(k => keyLabel(lmList(g.type), k)).join(', ');
    return `${meta.emoji} ${meta.label}${labels ? `: ${labels}` : ''}`;
  });

  const activeGoal = list[activeIndex];
  const figureInteractive = editable && activeGoal && activeGoal.type !== 'weight_loss';

  // ── 3D model selection (editable mode) ──────────────────────────────────────
  const activeKeys = activeGoal
    ? (activeGoal.type === 'muscle_growth' ? (activeGoal.muscles ?? []) : (activeGoal.areas ?? []))
    : [];
  const activeMeta = activeGoal ? TYPE_META[activeGoal.type] : TYPE_META.muscle_growth;
  const highlightMuscles = activeKeys.map(k => HL_MAP[parseKey(k).base]).filter(Boolean);

  const toggleKey = (key: string) => {
    const goal = list[activeIndex];
    if (!goal || goal.type === 'weight_loss') return;
    if (goal.type === 'muscle_growth') {
      const cur = goal.muscles ?? [];
      if (cur.includes(key)) update(activeIndex, { muscles: cur.filter(k => k !== key) });
      else if (cur.length < MAX_MUSCLES) update(activeIndex, { muscles: [...cur, key] });
    } else {
      const cur = goal.areas ?? [];
      update(activeIndex, { areas: cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key] });
    }
  };

  // Tappable hotspot dots overlaid on the 3D model for the active goal.
  // Each side is independent (tap the left dot → only the left side is added).
  // Dots are faint by default; the body-part word only appears once selected.
  const renderHotspots = () => {
    if (!activeGoal || activeGoal.type === 'weight_loss') return null;
    const setKey = activeGoal.type === 'injury_rehab' ? 'injury' : 'muscle';
    const spots = HOTSPOTS[setKey][modelView];
    return (
      <>
        {spots.flatMap(h => {
          const sides: ('left' | 'right' | 'single')[] = h.both ? ['left', 'right'] : ['single'];
          return sides.map(side => {
            const xf = side === 'single' ? 0.5 : side === 'left' ? 0.5 - h.x : 0.5 + h.x;
            const k = sideKey(h.key, side);
            const selected = activeKeys.includes(k);
            const label = side === 'single' ? h.label : `${side === 'left' ? 'Left' : 'Right'} ${h.label}`;
            return (
              <React.Fragment key={k}>
                <TouchableOpacity
                  style={[st.hsDot, {
                    left: `${xf * 100}%`, top: `${h.y * 100}%`,
                    backgroundColor: selected ? activeMeta.color : 'rgba(33,24,50,0.22)',
                    borderColor: selected ? '#fff' : 'rgba(255,255,255,0.65)',
                  }]}
                  onPress={() => toggleKey(k)}
                  activeOpacity={0.8}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                />
                {selected && (
                  <Text
                    style={[st.hsLabel, { left: `${xf * 100}%`, top: `${h.y * 100}%`, color: activeMeta.color }]}
                    pointerEvents="none"
                  >
                    {label}
                  </Text>
                )}
              </React.Fragment>
            );
          });
        })}
      </>
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

          <View style={[st.stage, { padding: 0 }]} onLayout={e => setStageW(e.nativeEvent.layout.width)}>
            <MuscleVisualizer
              targetedMuscles={highlightMuscles}
              view={modelView}
              height={canvasHeight}
              hideControls
              overlay={
                <>
                  <View style={st.hsTitle} pointerEvents="none">
                    <Text style={st.hsTitleName}>{name || 'Me'}</Text>
                    <Text style={st.hsTitleSub}>My Goals</Text>
                  </View>
                  {renderHotspots()}
                </>
              }
            />
          </View>
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
      {!editable && (
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
                      <Compare label="Current" value={`${Math.round(curWeight)} kg`} />
                      <Text style={st.arrow}>→</Text>
                      <Compare label="Target" value={`${Math.round(Math.max(35, curWeight - (goal.kg ?? 0)))} kg`} accent />
                      <View style={st.deltaPill}><Text style={st.deltaText}>−{Math.round(goal.kg ?? 0)} kg</Text></View>
                    </View>
                    <View style={st.sliderHead}>
                      <Text style={st.qLabel}>Kg to lose</Text>
                      <Text style={st.sliderValue}>{Math.round(goal.kg ?? 0)} kg</Text>
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
    fontSize: 11, fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
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
