/**
 * BodyVisualizer — "How I look now"
 *
 * A 3D body model (the shared MuscleVisualizer) that responds live as the user
 * changes:
 *   • height  → uniform scale of the whole figure (taller = larger)
 *   • weight  → horizontal girth (via BMI) so heavier reads broader
 *   • gender / age → saved + shown in the read-outs
 *
 * It also lets the user flag how the body *feels* right now: tap a part on the
 * model (Front / Back) to mark TIGHTNESS (amber) or an INJURY (red). Those parts
 * are highlighted on the figure and listed as removable chips.
 *
 * Controls (gender chips + sliders + body-condition picker) live in the same
 * card. Values are seeded from the parent and committed back on release / tap via
 * `onCommit`, so the parent owns persistence.
 */
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, GestureResponderEvent, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MuscleVisualizer from '../MuscleVisualizer';
import { BodyCondition, BodyConditionType } from '../../models/User';

// ── Theme ───────────────────────────────────────────────────────────────────
const C = {
  orange:      '#F25912',
  indigo:      '#4C4E78',
  text:        '#211832',
  muted:       '#7A7C90',
  canvas:      '#EEEEF2',
  cardBg:      '#F8F8FC',
  border:      'rgba(33,24,50,0.08)',
  accentSoft:  'rgba(242,89,18,0.12)',
  rule:        'rgba(33,24,50,0.10)',
  bodyM:       '#A9CC97',   // soft green (male) — matches the reference figure
  bodyF:       '#E9A8B8',   // soft rose (female)
};

// ── Metric bounds ───────────────────────────────────────────────────────────
const HEIGHT_MIN = 120, HEIGHT_MAX = 215;   // cm
const WEIGHT_MIN = 35,  WEIGHT_MAX = 160;   // kg
const AGE_MIN    = 13,  AGE_MAX    = 90;    // years

export type Gender = 'male' | 'female';

export interface BodyMetrics {
  gender: Gender;
  heightCm: number;
  weightKg: number;
  age: number;
  /** Tightness / injury markers placed on the figure. */
  conditions: BodyCondition[];
}

interface Props {
  /** Optional name shown above the head, like the HeightComparison label. */
  name?: string | null;
  gender?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  age?: number | null;
  /** Existing tightness / injury markers to seed the picker with. */
  conditions?: BodyCondition[] | null;
  /** Fired on slider release / gender tap with the full latest metric set. */
  onCommit?: (m: BodyMetrics) => void;
  /** When provided, renders a prominent Save button that calls this with the
   *  current metrics. */
  onSave?: (m: BodyMetrics) => void;
  /** Disables the Save button + shows a spinner while a save is in flight. */
  saving?: boolean;
  /** When false, controls are hidden (read-only viewer). */
  editable?: boolean;
  /** Height of the figure canvas in px (full-screen uses a taller canvas). */
  canvasHeight?: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round = (v: number, step: number) => Math.round(v / step) * step;

// ── cm → ft/in label ────────────────────────────────────────────────────────
function toFeetInches(cm: number): string {
  const totalIn = cm / 2.54;
  let ft = Math.floor(totalIn / 12);
  let inch = Math.round(totalIn - ft * 12);
  if (inch === 12) { ft += 1; inch = 0; }
  return `${ft}'${inch}"`;
}

// ── Body-figure scaling ───────────────────────────────────────────────────────
// height → uniform scale of the whole 3D figure (taller = larger, fills more of
// the canvas, with HEIGHT_MAX filling it). weight → BMI-driven horizontal girth
// layered on top, so heavier reads broader. Mirrors the old 2D PNG behaviour.
const heightScaleOf = (m: BodyMetrics) =>
  clamp(m.heightCm, HEIGHT_MIN, HEIGHT_MAX) / HEIGHT_MAX;

const girthScaleOf = (m: BodyMetrics) => {
  const bmi = m.weightKg / Math.pow(m.heightCm / 100, 2);
  return clamp(1 + (bmi - 22) * 0.022, 0.86, 1.34);
};

// ── kg ⇄ lb (weight is shown in pounds; stored/computed in kg for BMI) ────────
const KG_PER_LB = 0.45359237;
const kgToLb = (kg: number) => kg / KG_PER_LB;
const lbToKg = (lb: number) => lb * KG_PER_LB;
const WEIGHT_MIN_LB = Math.round(kgToLb(WEIGHT_MIN)); // ~77 lb
const WEIGHT_MAX_LB = Math.round(kgToLb(WEIGHT_MAX)); // ~353 lb

// ── Body-condition picker ─────────────────────────────────────────────────────
// Tappable body-part dots overlaid on the model. x = horizontal offset from
// centre (0.5); y = fraction of viewer height. `both` = bilateral (offer L/R).
type Hotspot = { key: string; label: string; y: number; x: number; both: boolean };
const BODY_PARTS: Record<'front' | 'back', Hotspot[]> = {
  front: [
    { key: 'neck',      label: 'Neck',      y: 0.20, x: 0.00, both: false },
    { key: 'shoulders', label: 'Shoulders', y: 0.30, x: 0.12, both: true  },
    { key: 'chest',     label: 'Chest',     y: 0.37, x: 0.07, both: true  },
    { key: 'elbow',     label: 'Elbow',     y: 0.45, x: 0.17, both: true  },
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
    { key: 'elbow',      label: 'Elbow',      y: 0.45, x: 0.17, both: true  },
    { key: 'lower_back', label: 'Lower Back', y: 0.47, x: 0.00, both: false },
    { key: 'glutes',     label: 'Glutes',     y: 0.55, x: 0.06, both: true  },
    { key: 'knee',       label: 'Knee',       y: 0.72, x: 0.06, both: true  },
    { key: 'calves',     label: 'Calves',     y: 0.85, x: 0.05, both: true  },
    { key: 'ankle',      label: 'Ankle',      y: 0.93, x: 0.05, both: true  },
  ],
};
// Body-part key → MuscleVisualizer bone-group (must match BONE_GROUPS names in
// MuscleVisualizer so the mesh actually paints).
const HL_MAP: Record<string, string> = {
  shoulders: 'Shoulders', chest: 'Chest', abs: 'Abs', glutes: 'Glutes',
  quads: 'Quads', calves: 'Calves', neck: 'Neck', hip: 'Hip', knee: 'Knee',
  ankle: 'Ankle', elbow: 'Elbow', wrist: 'Wrist',
  upper_back: 'Back', lower_back: 'Back',
};
const PART_LABEL: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  [...BODY_PARTS.front, ...BODY_PARTS.back].forEach(h => { m[h.key] = h.label; });
  return m;
})();

const COND_META: Record<BodyConditionType, { label: string; emoji: string; color: string; soft: string }> = {
  tightness: { label: 'Tightness', emoji: '🟡', color: '#d4a600', soft: 'rgba(212,166,0,0.16)' },
  injury:    { label: 'Injury',    emoji: '🩹', color: '#dc2626', soft: 'rgba(220,38,38,0.12)' },
};
const COND_ORDER: BodyConditionType[] = ['tightness', 'injury'];

type Side = 'left' | 'right' | 'both';
const SIDES: { key: Side; label: string }[] = [
  { key: 'left', label: 'L' }, { key: 'right', label: 'R' }, { key: 'both', label: 'Both' },
];

const sideText = (side?: Side) =>
  side === 'left' ? 'Left ' : side === 'right' ? 'Right ' : '';
const condLabel = (c: BodyCondition) =>
  `${sideText(c.side)}${PART_LABEL[c.part] ?? c.part}`;
// A condition is identified by part + side (so left & right knee can differ).
const condId = (part: string, side?: Side) => `${part}::${side ?? 'both'}`;

// ── Slider ──────────────────────────────────────────────────────────────────
function Slider({
  min, max, step, value, onChange, onCommit, color,
}: {
  min: number; max: number; step: number; value: number;
  onChange: (v: number) => void; onCommit?: () => void; color: string;
}) {
  const [w, setW] = useState(0);
  const pct = clamp((value - min) / (max - min), 0, 1);

  const update = (e: GestureResponderEvent) => {
    if (!w) return;
    const x = clamp(e.nativeEvent.locationX, 0, w);
    onChange(round(min + (x / w) * (max - min), step));
  };

  return (
    <View
      style={s.sliderTrack}
      onLayout={e => setW(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={update}
      onResponderMove={update}
      onResponderRelease={e => { update(e); onCommit?.(); }}
    >
      <View style={s.sliderRail} />
      <View style={[s.sliderFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      <View style={[s.sliderThumb, { left: `${pct * 100}%`, borderColor: color }]} />
    </View>
  );
}

// ── Vertical slider (bottom → top) ────────────────────────────────────────────
function VerticalSlider({
  min, max, step, value, onChange, onCommit, color, height,
}: {
  min: number; max: number; step: number; value: number;
  onChange: (v: number) => void; onCommit?: () => void; color: string; height: number;
}) {
  const [h, setH] = useState(0);
  const pct = clamp((value - min) / (max - min), 0, 1); // 0 = bottom, 1 = top

  const update = (e: GestureResponderEvent) => {
    if (!h) return;
    const y = clamp(e.nativeEvent.locationY, 0, h);
    const ratio = 1 - y / h; // invert: top is the maximum
    onChange(round(min + ratio * (max - min), step));
  };

  return (
    <View
      style={[s.vTrack, { height }]}
      onLayout={e => setH(e.nativeEvent.layout.height)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={update}
      onResponderMove={update}
      onResponderRelease={e => { update(e); onCommit?.(); }}
    >
      <View style={s.vRail} />
      <View style={[s.vFill, { height: `${pct * 100}%`, backgroundColor: color }]} />
      <View style={[s.vThumb, { bottom: `${pct * 100}%`, borderColor: color }]} />
    </View>
  );
}

// ── Component ───────────────────────────────────────────────────────────────
export default function BodyVisualizer({
  name, gender, heightCm, weightKg, age, conditions, onCommit, onSave, saving = false,
  editable = true, canvasHeight = 300,
}: Props) {
  const [m, setM] = useState<BodyMetrics>({
    gender: gender === 'female' ? 'female' : 'male',
    heightCm: clamp(heightCm ?? 170, HEIGHT_MIN, HEIGHT_MAX),
    weightKg: clamp(weightKg ?? 70, WEIGHT_MIN, WEIGHT_MAX),
    age: clamp(age ?? 25, AGE_MIN, AGE_MAX),
    conditions: Array.isArray(conditions) ? conditions : [],
  });

  // Body-condition picker UI state.
  const [modelView, setModelView] = useState<'front' | 'back'>('front');
  const [stageW, setStageW] = useState(0);
  const [picker, setPicker] = useState<
    { base: string; label: string; both: boolean; xf: number; y: number; side: Side | null } | null
  >(null);

  const set = (patch: Partial<BodyMetrics>) => setM(prev => ({ ...prev, ...patch }));
  const commit = (patch: Partial<BodyMetrics>) => {
    const next = { ...m, ...patch };
    setM(next);
    onCommit?.(next);
  };

  const bmi = m.weightKg / Math.pow(m.heightCm / 100, 2);
  const heightScale = useMemo(() => heightScaleOf(m), [m]);
  const girthScale = useMemo(() => girthScaleOf(m), [m]);

  // Conditions → highlighted bone groups, coloured by type (tightness amber,
  // injury red). Last condition on a shared group wins the colour.
  const { highlightMuscles, groupColors } = useMemo(() => {
    const groups: string[] = [];
    const colors: Record<string, string> = {};
    for (const c of m.conditions) {
      const grp = HL_MAP[c.part];
      if (!grp) continue;
      groups.push(grp);
      colors[grp] = COND_META[c.type].color;
    }
    return { highlightMuscles: groups, groupColors: colors };
  }, [m.conditions]);

  // The condition (if any) already on this base part — drives the dot label /
  // remove option in the picker.
  const conditionOn = (base: string) => m.conditions.find(c => c.part === base);

  // Commit a part-first selection: add (part + side + type), replacing any
  // existing condition on that exact part+side.
  const commitCondition = (type: BodyConditionType) => {
    if (!picker) return;
    const side: Side = !picker.both ? 'both' : (picker.side ?? 'both');
    const id = condId(picker.base, side);
    const next = m.conditions.filter(c => condId(c.part, c.side) !== id);
    next.push({ part: picker.base, type, side });
    commit({ conditions: next });
    setPicker(null);
  };

  // Remove every condition on this base part (any side).
  const removeCondition = (base: string) => {
    commit({ conditions: m.conditions.filter(c => c.part !== base) });
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

  // Coloured part labels for any part already flagged (no visible dots).
  const renderHotspots = () => (
    <>
      {BODY_PARTS[modelView].map(h => {
        const cond = conditionOn(h.key);
        if (!cond || picker?.base === h.key) return null;
        const xf = h.both ? 0.5 + h.x : 0.5;
        return (
          <Text
            key={h.key}
            style={[s.hsLabel, { left: `${xf * 100}%`, top: `${h.y * 100}%` }]}
            pointerEvents="none"
          >
            {COND_META[cond.type].emoji} {h.label}
          </Text>
        );
      })}
    </>
  );

  // Compact inline mini-menu anchored at the tapped dot.
  const POP_W = 140;
  const renderPicker = () => {
    if (!picker || !stageW) return null;
    const dotX = picker.xf * stageW;
    const dotY = picker.y * canvasHeight;
    const left = clamp(dotX - POP_W / 2, 4, Math.max(4, stageW - POP_W - 4));
    const below = picker.y < 0.28; // float above the dot unless near the top
    const showType = !picker.both || picker.side !== null;
    const isSelected = !!conditionOn(picker.base);
    return (
      <View
        style={[
          s.pop,
          { width: POP_W, left },
          below ? { top: dotY + 12 } : { bottom: canvasHeight - dotY + 12 },
        ]}
      >
        <View style={s.popHead}>
          <Text style={s.popTitle} numberOfLines={1}>{picker.label}</Text>
          <TouchableOpacity onPress={() => setPicker(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={s.popClose}>✕</Text>
          </TouchableOpacity>
        </View>

        {!showType ? (
          <View style={s.popRow}>
            {SIDES.map(sd => (
              <TouchableOpacity
                key={sd.key}
                style={s.popChip}
                activeOpacity={0.85}
                onPress={() => setPicker(p => (p ? { ...p, side: sd.key } : p))}
              >
                <Text style={s.popChipText}>{sd.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <>
            {COND_ORDER.map(t => {
              const tm = COND_META[t];
              return (
                <TouchableOpacity
                  key={t}
                  style={[s.popType, { borderColor: tm.color, backgroundColor: tm.soft }]}
                  activeOpacity={0.85}
                  onPress={() => commitCondition(t)}
                >
                  <Text style={s.popTypeEmoji}>{tm.emoji}</Text>
                  <Text style={s.popTypeText} numberOfLines={1}>{tm.label}</Text>
                </TouchableOpacity>
              );
            })}
            {picker.both && (
              <TouchableOpacity onPress={() => setPicker(p => (p ? { ...p, side: null } : p))} activeOpacity={0.8}>
                <Text style={s.popBack}>← side</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {isSelected && (
          <TouchableOpacity style={s.popRemove} activeOpacity={0.85} onPress={() => removeCondition(picker.base)}>
            <Text style={s.popRemoveText}>🗑  Remove</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View>
      {/* ── Front / Back toggle (drives the figure + which parts are tappable) ── */}
      {editable && (
        <View style={s.viewToggle}>
          {(['front', 'back'] as const).map(v => (
            <TouchableOpacity
              key={v}
              style={[s.viewBtn, modelView === v && s.viewBtnActive]}
              onPress={() => { setModelView(v); setPicker(null); }}
              activeOpacity={0.85}
            >
              <Text style={[s.viewBtnText, modelView === v && s.viewBtnTextActive]}>
                {v === 'front' ? 'Front' : 'Back'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Stage: vertical height slider (left) + morphing 3D figure ──────── */}
      <View style={s.stageRow}>
        {editable && (
          <View style={s.vSliderCol}>
            <Text style={s.vValue}>{Math.round(m.heightCm)}</Text>
            <VerticalSlider
              height={canvasHeight - 34}
              min={HEIGHT_MIN} max={HEIGHT_MAX} step={1} value={m.heightCm} color={C.indigo}
              onChange={v => set({ heightCm: v })} onCommit={() => commit({ heightCm: m.heightCm })}
            />
            <Text style={s.vUnit}>HEIGHT</Text>
          </View>
        )}
      {/* Wrapper keeps the picker popover visible even though the stage clips. */}
      <View style={s.modelWrap}>
      <View style={[s.stage, { flex: 1 }]} onLayout={e => setStageW(e.nativeEvent.layout.width)}>
        {/* 3D body — height scales the whole figure, weight (BMI) adds girth.
            Tightness / injury parts are painted via targetedMuscles + colours. */}
        <MuscleVisualizer
          view={editable ? modelView : 'front'}
          hideControls
          height={canvasHeight}
          heightScale={heightScale}
          girthScale={girthScale}
          targetedMuscles={highlightMuscles}
          groupColors={groupColors}
          overlay={
            <>
              {editable && (
                <View
                  style={StyleSheet.absoluteFill}
                  onStartShouldSetResponder={() => true}
                  onResponderRelease={handleModelTap}
                />
              )}
              <View style={s.figLabel} pointerEvents="none">
                <Text style={s.figLabelName}>{name || 'Me'}</Text>
                <Text style={s.figLabelSub}>
                  {`${Math.round(m.heightCm)} cm · ${toFeetInches(m.heightCm)}`}
                </Text>
              </View>
              {renderHotspots()}
            </>
          }
        />
      </View>
      {editable && renderPicker()}
      </View>
      </View>

      {editable && (
        <Text style={s.pickHint}>
          Tap a body part → pick a side → mark Tightness or Injury.
        </Text>
      )}

      {/* ── Weight: horizontal (lbs), right below the image ────────────── */}
      {editable && (
        <View style={s.weightBelow}>
          <View style={s.sliderHead}>
            <Text style={s.ctrlLabel}>Weight</Text>
            <Text style={s.sliderValue}>{Math.round(kgToLb(m.weightKg))} lb</Text>
          </View>
          <Slider
            min={WEIGHT_MIN_LB} max={WEIGHT_MAX_LB} step={1} value={Math.round(kgToLb(m.weightKg))} color={C.orange}
            onChange={v => set({ weightKg: clamp(lbToKg(v), WEIGHT_MIN, WEIGHT_MAX) })}
            onCommit={() => commit({ weightKg: m.weightKg })}
          />
        </View>
      )}

      {/* ── Read-outs ──────────────────────────────────────────────────── */}
      <View style={s.statsRow}>
        <Stat label="Height" value={`${Math.round(m.heightCm)} cm`} sub={toFeetInches(m.heightCm)} />
        <Stat label="Weight" value={`${Math.round(kgToLb(m.weightKg))} lb`} sub={`${Math.round(m.weightKg)} kg`} />
        <Stat label="BMI" value={bmi.toFixed(1)} sub={bmiLabel(bmi)} />
        <Stat label="Age" value={`${Math.round(m.age)}`} sub="yrs" />
      </View>

      {/* ── Controls ───────────────────────────────────────────────────── */}
      {editable && (
        <View style={s.controls}>
          {/* Gender */}
          <Text style={s.ctrlLabel}>Gender</Text>
          <View style={s.genderRow}>
            {(['male', 'female'] as Gender[]).map(g => {
              const active = m.gender === g;
              return (
                <TouchableOpacity
                  key={g}
                  activeOpacity={0.8}
                  onPress={() => commit({ gender: g })}
                  style={[s.genderBtn, active && { borderColor: g === 'female' ? C.bodyF : C.bodyM, backgroundColor: C.accentSoft }]}
                >
                  <Text style={[s.genderText, active && { color: C.text, fontWeight: '700' }]}>
                    {g === 'male' ? '👨  Male' : '👩  Female'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Age (height = vertical slider on the left, weight = below image) */}
          <SliderRow
            label="Age" value={`${Math.round(m.age)} yrs`}
            min={AGE_MIN} max={AGE_MAX} step={1} cur={m.age} color={C.muted}
            onChange={v => set({ age: v })} onCommit={() => commit({ age: m.age })}
          />

          {/* Tightness / injury chips */}
          <View style={s.condBlock}>
            <Text style={s.ctrlLabel}>Tightness &amp; injuries</Text>
            {m.conditions.length === 0 ? (
              <Text style={s.condEmpty}>Tap the figure above to flag a tight or injured part.</Text>
            ) : (
              <View style={s.tagRow}>
                {m.conditions.map((c, i) => {
                  const meta = COND_META[c.type];
                  return (
                    <TouchableOpacity
                      key={`${condId(c.part, c.side)}-${i}`}
                      style={[s.tag, { borderColor: meta.color, backgroundColor: meta.soft }]}
                      onPress={() => commit({ conditions: m.conditions.filter((_, idx) => idx !== i) })}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.tagText, { color: meta.color }]}>
                        {meta.emoji} {condLabel(c)} · {meta.label}
                      </Text>
                      <Text style={[s.tagX, { color: meta.color }]}> ✕</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      )}

      {/* ── Read-only condition summary ───────────────────────────────────── */}
      {!editable && m.conditions.length > 0 && (
        <View style={s.condSummary}>
          {m.conditions.map((c, i) => {
            const meta = COND_META[c.type];
            return (
              <Text key={i} style={[s.condSummaryLine, { color: meta.color }]}>
                {meta.emoji} {meta.label}: {condLabel(c)}
              </Text>
            );
          })}
        </View>
      )}

      {/* ── Save ───────────────────────────────────────────────────────── */}
      {onSave && (
        <TouchableOpacity
          style={[s.saveBtn, saving && { opacity: 0.6 }]}
          activeOpacity={0.85}
          disabled={saving}
          onPress={() => onSave(m)}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Small pieces ──────────────────────────────────────────────────────────────
function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statSub}>{sub}</Text>
    </View>
  );
}

function SliderRow({
  label, value, min, max, step, cur, color, onChange, onCommit,
}: {
  label: string; value: string; min: number; max: number; step: number;
  cur: number; color: string; onChange: (v: number) => void; onCommit: () => void;
}) {
  return (
    <View style={s.sliderRow}>
      <View style={s.sliderHead}>
        <Text style={s.ctrlLabel}>{label}</Text>
        <Text style={s.sliderValue}>{value}</Text>
      </View>
      <Slider min={min} max={max} step={step} value={cur} color={color}
        onChange={onChange} onCommit={onCommit} />
    </View>
  );
}

function bmiLabel(bmi: number): string {
  if (bmi < 18.5) return 'lean';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'curvy';
  return 'heavy';
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vSliderCol: {
    width: 44,
    alignItems: 'center',
    gap: 6,
  },
  vValue: { color: C.text, fontSize: 13, fontWeight: '800' },
  vUnit: { color: C.muted, fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },
  vTrack: {
    width: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vRail: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(33,24,50,0.10)',
  },
  vFill: {
    position: 'absolute',
    bottom: 0,
    width: 6,
    borderRadius: 3,
  },
  vThumb: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    marginBottom: -11,
    backgroundColor: '#fff',
    borderWidth: 3,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  weightBelow: { marginTop: 14 },
  modelWrap: { flex: 1, position: 'relative' },
  stage: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  figLabel: { position: 'absolute', top: 12, left: 0, right: 0, alignItems: 'center' },
  figLabelName: { color: C.text, fontSize: 13, fontWeight: '800' },
  figLabelSub: { color: C.muted, fontSize: 11, fontWeight: '700', marginTop: 1 },

  // Front / Back toggle
  viewToggle: {
    flexDirection: 'row', alignSelf: 'center', marginBottom: 10,
    backgroundColor: C.cardBg, borderRadius: 100, padding: 3,
    borderWidth: 1, borderColor: C.border,
  },
  viewBtn: { paddingHorizontal: 22, paddingVertical: 7, borderRadius: 100 },
  viewBtnActive: { backgroundColor: '#211832' },
  viewBtnText: { color: C.muted, fontSize: 13, fontWeight: '700' },
  viewBtnTextActive: { color: '#fff' },

  // On-model condition labels
  hsLabel: {
    position: 'absolute', width: 96, marginLeft: -48, marginTop: -30, textAlign: 'center',
    fontSize: 11, fontWeight: '900', color: '#3F3F49',
    textShadowColor: 'rgba(255,255,255,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  pickHint: { color: C.muted, fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 10 },

  // Guided picker popover
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

  // Condition chips / summary
  condBlock: { marginTop: 16 },
  condEmpty: { color: C.muted, fontSize: 13, marginTop: 8, lineHeight: 18 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  tag: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1.5 },
  tagText: { fontSize: 13, fontWeight: '700' },
  tagX: { fontSize: 12, fontWeight: '900' },
  condSummary: { marginTop: 12, gap: 4 },
  condSummaryLine: { fontSize: 14, fontWeight: '700' },

  statsRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  stat: {
    flex: 1,
    backgroundColor: C.cardBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 8,
    alignItems: 'center',
  },
  statValue: { color: C.text, fontSize: 14, fontWeight: '800' },
  statLabel: { color: C.muted, fontSize: 10, fontWeight: '700', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
  statSub: { color: C.muted, fontSize: 10, marginTop: 1 },
  saveBtn: {
    marginTop: 20,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#F25912',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  controls: { marginTop: 16 },
  ctrlLabel: { color: C.text, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  genderRow: { flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 4 },
  genderBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: C.cardBg,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
  },
  genderText: { color: C.muted, fontSize: 14, fontWeight: '600' },
  sliderRow: { marginTop: 16 },
  sliderHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
  sliderValue: { color: C.text, fontSize: 13, fontWeight: '700' },
  sliderTrack: {
    height: 26,
    justifyContent: 'center',
  },
  sliderRail: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 10,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(33,24,50,0.10)',
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: 10,
    height: 6,
    borderRadius: 3,
  },
  sliderThumb: {
    position: 'absolute',
    top: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    borderWidth: 3,
    marginLeft: -11,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
