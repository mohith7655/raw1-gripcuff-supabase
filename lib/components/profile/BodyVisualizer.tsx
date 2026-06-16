/**
 * BodyVisualizer — "How I look now"
 *
 * A boy/girl PNG silhouette shown beside a cm/ft height ruler (inspired by
 * HeightComparison). The figure responds live as the user changes:
 *   • gender  → swaps boy.png / girl.png
 *   • height  → overall scale + where the head reaches on the ruler
 *   • weight  → horizontal stretch (via BMI) so heavier reads broader
 *   • age     → saved + shown in the read-outs
 *
 * Controls (gender chips + three draggable sliders) live in the same card.
 * Values are seeded from the parent and committed back on release / tap via
 * `onCommit`, so the parent owns persistence.
 */
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, GestureResponderEvent, Image as RNImage, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { G, Image as SvgImage, Line, Text as SvgText } from 'react-native-svg';

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
}

interface Props {
  /** Optional name shown above the head, like the HeightComparison label. */
  name?: string | null;
  gender?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  age?: number | null;
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

// ── Canvas geometry ─────────────────────────────────────────────────────────
const VB_W = 300;
const VB_H = 360;
const GROUND = 338;        // y of the floor line
const TOP_PAD = 16;        // min y the tallest figure may reach
const PX_PER_CM = (GROUND - TOP_PAD) / HEIGHT_MAX; // tallest figure fills the canvas
const CX = 168;            // horizontal centre of the figure (ruler sits left)

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

// ── Figure artwork (boy / girl PNGs) ──────────────────────────────────────────
// Static silhouettes; height scales them on the ruler and weight (BMI) applies a
// horizontal stretch so heavier reads broader. Drop the two files at these paths:
//   assets/figures/boy.png   (male)
//   assets/figures/girl.png  (female)
const BOY_IMG = require('../../../assets/figures/boy.png');
const GIRL_IMG = require('../../../assets/figures/girl.png');

// Intrinsic aspect (width / height) of each PNG, resolved once.
// `resolveAssetSource` exists on native but NOT on react-native-web, so guard it
// and fall back to a slightly-wide default (the figure never distorts because
// the <Image> uses preserveAspectRatio="…meet"; a wider box just adds side room).
function aspectOf(src: number, fallback: number): number {
  try {
    const resolver = (RNImage as any)?.resolveAssetSource;
    if (typeof resolver === 'function') {
      const meta = resolver(src);
      if (meta && meta.width && meta.height) return meta.width / meta.height;
    }
  } catch {
    /* ignore — fall through to default */
  }
  return fallback;
}
const ASPECT = {
  male: aspectOf(BOY_IMG, 0.5),
  female: aspectOf(GIRL_IMG, 0.5),
};

// Resolve the on-screen geometry for the current metrics.
function buildFigure(m: BodyMetrics) {
  const h = clamp(m.heightCm, HEIGHT_MIN, HEIGHT_MAX) * PX_PER_CM; // pixel height
  const ty = GROUND - h;                                          // y at top of head
  const female = m.gender === 'female';
  const src = female ? GIRL_IMG : BOY_IMG;
  const aspect = female ? ASPECT.female : ASPECT.male;
  const baseW = h * aspect;                                       // width at normal BMI

  // BMI-driven horizontal stretch. Centre normal (~22) at 1.0; clamp so the
  // silhouette fattens/slims believably without grotesque distortion.
  const bmi = m.weightKg / Math.pow(m.heightCm / 100, 2);
  const girthX = clamp(1 + (bmi - 22) * 0.022, 0.86, 1.34);

  return { h, ty, src, baseW, girthX };
}

// ── kg ⇄ lb (weight is shown in pounds; stored/computed in kg for BMI) ────────
const KG_PER_LB = 0.45359237;
const kgToLb = (kg: number) => kg / KG_PER_LB;
const lbToKg = (lb: number) => lb * KG_PER_LB;
const WEIGHT_MIN_LB = Math.round(kgToLb(WEIGHT_MIN)); // ~77 lb
const WEIGHT_MAX_LB = Math.round(kgToLb(WEIGHT_MAX)); // ~353 lb

// ── Ruler ticks (every 30cm) ────────────────────────────────────────────────
const TICKS = [0, 30, 60, 90, 120, 150, 180, 210];
const RULER_X = 56;

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
  name, gender, heightCm, weightKg, age, onCommit, onSave, saving = false,
  editable = true, canvasHeight = 300,
}: Props) {
  const [m, setM] = useState<BodyMetrics>({
    gender: gender === 'female' ? 'female' : 'male',
    heightCm: clamp(heightCm ?? 170, HEIGHT_MIN, HEIGHT_MAX),
    weightKg: clamp(weightKg ?? 70, WEIGHT_MIN, WEIGHT_MAX),
    age: clamp(age ?? 25, AGE_MIN, AGE_MAX),
  });

  const set = (patch: Partial<BodyMetrics>) => setM(prev => ({ ...prev, ...patch }));
  const commit = (patch: Partial<BodyMetrics>) => {
    const next = { ...m, ...patch };
    setM(next);
    onCommit?.(next);
  };

  const fig = useMemo(() => buildFigure(m), [m]);
  const bmi = m.weightKg / Math.pow(m.heightCm / 100, 2);
  // Stacked label above the head (name / cm / ft), like the reference.
  const labelTop = clamp(fig.ty - 36, 10, GROUND);
  // Half-width of the figure's head marker line (≈ image width at the head).
  const headW = (fig.baseW * fig.girthX) / 2;

  return (
    <View>
      {/* ── Stage: vertical height slider (left) + ruler + morphing figure ── */}
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
      <View style={[s.stage, { flex: 1 }]}>
        <Svg width="100%" height={canvasHeight} viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid meet">
          {/* Ruler grid lines + labels */}
          <G>
            {TICKS.map(cm => {
              const ty = GROUND - cm * PX_PER_CM;
              return (
                <G key={cm}>
                  <Line x1={RULER_X} y1={ty} x2={VB_W - 8} y2={ty} stroke={C.rule} strokeWidth={1} />
                  <SvgText x={RULER_X - 6} y={ty + 4} fontSize={11} fill={C.muted} textAnchor="end">
                    {cm}
                  </SvgText>
                  <SvgText x={VB_W - 4} y={ty + 4} fontSize={10} fill={C.muted} textAnchor="end">
                    {toFeetInches(cm)}
                  </SvgText>
                </G>
              );
            })}
            {/* axis units */}
            <SvgText x={RULER_X - 6} y={12} fontSize={10} fill={C.muted} textAnchor="end" fontWeight="700">cm</SvgText>
            <SvgText x={VB_W - 4} y={12} fontSize={10} fill={C.muted} textAnchor="end" fontWeight="700">ft</SvgText>
          </G>

          {/* Floor */}
          <Line x1={RULER_X} y1={GROUND} x2={VB_W - 8} y2={GROUND} stroke={C.muted} strokeWidth={1.5} />

          {/* Figure — boy / girl PNG, scaled by height and stretched by weight.
              The transform fattens horizontally about the centre axis while
              keeping the feet planted on the floor (GROUND). */}
          <G transform={`translate(${CX} ${GROUND}) scale(${fig.girthX} 1) translate(${-CX} ${-GROUND})`}>
            <SvgImage
              href={fig.src}
              x={CX - fig.baseW / 2}
              y={fig.ty}
              width={fig.baseW}
              height={fig.h}
              preserveAspectRatio="xMidYMax meet"
            />
          </G>

          {/* HeightComparison-style label stacked above the head */}
          <SvgText x={CX} y={labelTop} fontSize={11} fill={C.text} textAnchor="middle" fontWeight="700">
            {name || 'Me'}
          </SvgText>
          <SvgText x={CX} y={labelTop + 12} fontSize={10} fill={C.text} textAnchor="middle" fontWeight="700">
            {`cm: ${m.heightCm.toFixed(0)}`}
          </SvgText>
          <SvgText x={CX} y={labelTop + 23} fontSize={10} fill={C.text} textAnchor="middle" fontWeight="700">
            {`ft: ${toFeetInches(m.heightCm)}`}
          </SvgText>
          <Line
            x1={CX - headW - 6} y1={fig.ty - 4} x2={CX + headW + 6} y2={fig.ty - 4}
            stroke={C.text} strokeWidth={1.5}
          />
        </Svg>
      </View>
      </View>

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
  stage: {
    backgroundColor: C.canvas,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    paddingVertical: 6,
  },
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
