/**
 * GoalVisualizer — "My Goal"
 *
 * Three questions answered together (saved in one go):
 *   1. Weight loss   → how many kg to lose (compared to the saved weight).
 *   2. Muscle growth → pick your top 3 muscles (highlighted green).
 *   3. Injury rehab  → which body part + which side (highlighted orange).
 *
 * The silhouette previews all answers at once: it slims for weight-loss (with a
 * ghost of the current body behind), lights up the chosen muscles, and marks the
 * injured side(s). Committed via `onSave`; the parent persists it.
 */
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, GestureResponderEvent, Image as RNImage, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, G, Image as SvgImage, Line, Text as SvgText } from 'react-native-svg';

// ── Theme ───────────────────────────────────────────────────────────────────
const C = {
  orange:     '#F25912',
  green:      '#16a34a',
  blue:       '#2563eb',   // recovery — distinct from the orange CTA
  text:       '#211832',
  muted:      '#7A7C90',
  canvas:     '#EEEEF2',
  cardBg:     '#F8F8FC',
  border:     'rgba(33,24,50,0.08)',
  accentSoft: 'rgba(242,89,18,0.12)',
  greenSoft:  'rgba(22,163,74,0.12)',
  blueSoft:   'rgba(37,99,235,0.12)',
  rule:       'rgba(33,24,50,0.10)',
};

export type InjurySide = 'left' | 'right' | 'both';

export interface GoalData {
  weightLossKg: number | null;
  targetMuscles: string[] | null;
  injuryAreas: string[] | null;
  injurySide: InjurySide | null;
}

const SIDES: { key: InjurySide; label: string }[] = [
  { key: 'left',  label: 'Left' },
  { key: 'right', label: 'Right' },
  { key: 'both',  label: 'Both' },
];

// ── Body landmarks (yFrac: 0=head 1=feet; xFrac: fraction of body width; both = bilateral) ──
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

// ── Canvas geometry (matches BodyVisualizer) ──────────────────────────────────
const VB_W = 300;
const VB_H = 360;
const GROUND = 338;
const TOP_PAD = 16;
const HEIGHT_MAX = 215;
const PX_PER_CM = (GROUND - TOP_PAD) / HEIGHT_MAX;
const CX = 168;
const RULER_X = 56;
const TICKS = [0, 30, 60, 90, 120, 150, 180, 210];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round = (v: number, step: number) => Math.round(v / step) * step;
const girthFromBmi = (bmi: number) => clamp(1 + (bmi - 22) * 0.022, 0.86, 1.34);

function toFeetInches(cm: number): string {
  const totalIn = cm / 2.54;
  let ft = Math.floor(totalIn / 12);
  let inch = Math.round(totalIn - ft * 12);
  if (inch === 12) { ft += 1; inch = 0; }
  return `${ft}'${inch}"`;
}

// ── Figure artwork (shared with How I look now) ───────────────────────────────
const BOY_IMG = require('../../../assets/figures/boy.png');
const GIRL_IMG = require('../../../assets/figures/girl.png');

function aspectOf(src: number, fallback: number): number {
  try {
    const resolver = (RNImage as any)?.resolveAssetSource;
    if (typeof resolver === 'function') {
      const meta = resolver(src);
      if (meta && meta.width && meta.height) return meta.width / meta.height;
    }
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
  const update = (e: GestureResponderEvent) => {
    if (!w) return;
    const x = clamp(e.nativeEvent.locationX, 0, w);
    onChange(round(min + (x / w) * (max - min), step));
  };
  return (
    <View
      style={st.sliderTrack}
      onLayout={e => setW(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={update}
      onResponderMove={update}
    >
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
  injuryArea?: string | null;
  injuryAreas?: string[] | null;
  injurySide?: InjurySide | null;
  weightLossKg?: number | null;
  targetMuscles?: string[] | null;
  onSave?: (data: GoalData) => void;
  saving?: boolean;
  canvasHeight?: number;
  editable?: boolean;
}

// ── Component ───────────────────────────────────────────────────────────────
export default function GoalVisualizer({
  name, gender, heightCm, weightKg, injuryArea, injuryAreas, injurySide, weightLossKg, targetMuscles,
  onSave, saving = false, canvasHeight = 320, editable = true,
}: Props) {
  const [muscles, setMuscles] = useState<string[]>(targetMuscles ?? []);
  const [areas, setAreas] = useState<string[]>(
    injuryAreas ?? (injuryArea ? [injuryArea] : []),
  );
  const [side, setSide] = useState<InjurySide>(injurySide ?? 'both');

  const curWeight = weightKg ?? 70;
  const heightM = (heightCm ?? 170) / 100;
  const maxLose = Math.max(1, Math.round(curWeight - 35));
  const [lossKg, setLossKg] = useState<number>(clamp(weightLossKg ?? 0, 0, maxLose));

  const targetWeight = Math.max(35, curWeight - lossKg);
  const selectedInjuries = INJURY_AREAS.filter(a => areas.includes(a.key));
  const showSidePicker = selectedInjuries.some(a => a.both);

  const female = gender === 'female';
  const src = female ? GIRL_IMG : BOY_IMG;
  const aspect = female ? ASPECT.female : ASPECT.male;

  const fig = useMemo(() => {
    const h = clamp(heightCm ?? 170, 120, HEIGHT_MAX) * PX_PER_CM;
    const ty = GROUND - h;
    const baseW = h * aspect;
    const bmiCur = curWeight / (heightM * heightM);
    const girthCur = girthFromBmi(bmiCur);
    const girthMain = lossKg > 0 ? girthFromBmi(targetWeight / (heightM * heightM)) : girthCur;
    return { h, ty, baseW, girthCur, girthMain, showGhost: lossKg > 0 };
  }, [heightCm, aspect, curWeight, heightM, lossKg, targetWeight]);

  // Combined markers: muscles (green) + injury (orange). Body faces viewer, so
  // its own LEFT is on the viewer's RIGHT.
  const markers = useMemo(() => {
    const list: { x: number; y: number; r: number; label: string; color: string; fill: string }[] = [];
    const r = Math.max(10, fig.h * 0.045);
    const y = (lm: Landmark) => fig.ty + lm.yFrac * fig.h;
    const off = (lm: Landmark) => lm.xFrac * fig.baseW * fig.girthMain;
    const bodyLeftX = (lm: Landmark) => CX + off(lm);
    const bodyRightX = (lm: Landmark) => CX - off(lm);

    muscles.forEach(key => {
      const m = MUSCLES.find(x => x.key === key);
      if (!m) return;
      if (m.both) {
        list.push({ x: bodyRightX(m), y: y(m), r, label: '', color: C.green, fill: 'rgba(22,163,74,0.22)' });
        list.push({ x: bodyLeftX(m), y: y(m), r, label: m.label, color: C.green, fill: 'rgba(22,163,74,0.22)' });
      } else {
        list.push({ x: CX + off(m), y: y(m), r, label: m.label, color: C.green, fill: 'rgba(22,163,74,0.22)' });
      }
    });

    const bFill = 'rgba(37,99,235,0.22)';
    selectedInjuries.forEach(lm => {
      if (!lm.both) {
        list.push({ x: CX + off(lm), y: y(lm), r, label: lm.label, color: C.blue, fill: bFill });
      } else if (side === 'left') {
        list.push({ x: bodyLeftX(lm), y: y(lm), r, label: `Left ${lm.label}`, color: C.blue, fill: bFill });
      } else if (side === 'right') {
        list.push({ x: bodyRightX(lm), y: y(lm), r, label: `Right ${lm.label}`, color: C.blue, fill: bFill });
      } else {
        list.push({ x: bodyRightX(lm), y: y(lm), r, label: '', color: C.blue, fill: bFill });
        list.push({ x: bodyLeftX(lm), y: y(lm), r, label: lm.label, color: C.blue, fill: bFill });
      }
    });
    return list;
  }, [muscles, selectedInjuries, side, fig]);

  const labelTop = clamp(fig.ty - 26, 10, GROUND);

  const toggleMuscle = (key: string) => {
    setMuscles(prev =>
      prev.includes(key) ? prev.filter(k => k !== key)
        : prev.length >= MAX_MUSCLES ? prev
        : [...prev, key],
    );
  };

  const toggleArea = (key: string) => {
    setAreas(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const handleSave = () => {
    onSave?.({
      weightLossKg: lossKg > 0 ? lossKg : null,
      targetMuscles: muscles.length > 0 ? muscles : null,
      injuryAreas: areas.length > 0 ? areas : null,
      injurySide: showSidePicker ? side : null,
    });
  };

  const figureImage = (girth: number, opacity: number) => (
    <G transform={`translate(${CX} ${GROUND}) scale(${girth} 1) translate(${-CX} ${-GROUND})`} opacity={opacity}>
      <SvgImage href={src} x={CX - fig.baseW / 2} y={fig.ty} width={fig.baseW} height={fig.h} preserveAspectRatio="xMidYMax meet" />
    </G>
  );

  // Read-only summary (preview card).
  const summary: string[] = [];
  if (lossKg > 0) summary.push(`🔥 Lose ${Math.round(lossKg)} kg`);
  if (muscles.length) summary.push(`💪 ${muscles.map(k => MUSCLES.find(m => m.key === k)?.label ?? k).join(', ')}`);
  if (selectedInjuries.length) {
    const sidePrefix = showSidePicker ? `${side === 'both' ? 'Both' : side[0].toUpperCase() + side.slice(1)} · ` : '';
    summary.push(`🩹 ${sidePrefix}${selectedInjuries.map(a => a.label).join(', ')}`);
  }

  return (
    <View>
      {/* ── Stage ──────────────────────────────────────────────────────── */}
      <View style={st.stage}>
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

          {markers.map((m, i) => (
            <G key={i}>
              <Circle cx={m.x} cy={m.y} r={m.r} fill={m.fill} stroke={m.color} strokeWidth={2} />
              <Circle cx={m.x} cy={m.y} r={2.5} fill={m.color} />
              {!!m.label && (
                <SvgText x={m.x} y={m.y - m.r - 5} fontSize={11} fontWeight="700" fill={m.color} textAnchor="middle">{m.label}</SvgText>
              )}
            </G>
          ))}

          <SvgText x={CX} y={labelTop} fontSize={11} fill={C.text} textAnchor="middle" fontWeight="700">{name || 'Me'}</SvgText>
          <SvgText x={CX} y={labelTop + 13} fontSize={11} fill={C.muted} textAnchor="middle" fontWeight="700">My Goals</SvgText>
        </Svg>
      </View>

      {/* ── Read-only summary (preview) ────────────────────────────────── */}
      {!editable && (
        <View style={st.summaryWrap}>
          {summary.length === 0
            ? <Text style={st.summaryEmpty}>Tap Edit to set your goals</Text>
            : summary.map((line, i) => <Text key={i} style={st.summaryLine}>{line}</Text>)}
        </View>
      )}

      {/* ── 3 questions ────────────────────────────────────────────────── */}
      {editable && (
        <>
          {/* Q1 — Weight loss */}
          <View style={st.qCard}>
            <View style={st.qHead}>
              <View style={st.qNum}><Text style={st.qNumText}>1</Text></View>
              <Text style={st.qTitle}>Do you want to lose weight?</Text>
            </View>
            <View style={st.compareRow}>
              <Compare label="Current" value={`${Math.round(curWeight)} kg`} />
              <Text style={st.arrow}>→</Text>
              <Compare label="Target" value={`${Math.round(targetWeight)} kg`} accent />
              <View style={st.deltaPill}><Text style={st.deltaText}>{lossKg > 0 ? `−${Math.round(lossKg)} kg` : 'none'}</Text></View>
            </View>
            {weightKg == null && (
              <Text style={st.hint}>Tip: set your weight in “How I look now” for an accurate comparison.</Text>
            )}
            <View style={st.sliderHead}>
              <Text style={st.qLabel}>Kg to lose</Text>
              <Text style={st.sliderValue}>{lossKg > 0 ? `${Math.round(lossKg)} kg` : '0 (skip)'}</Text>
            </View>
            <Slider min={0} max={maxLose} step={1} value={lossKg} color={C.orange} onChange={setLossKg} />
          </View>

          {/* Q2 — Muscle growth */}
          <View style={st.qCard}>
            <View style={st.qHead}>
              <View style={st.qNum}><Text style={st.qNumText}>2</Text></View>
              <Text style={st.qTitle}>Which muscles do you want to grow?</Text>
              <Text style={st.qCount}>{muscles.length}/{MAX_MUSCLES}</Text>
            </View>
            <View style={st.chipGrid}>
              {MUSCLES.map(m => {
                const active = muscles.includes(m.key);
                const full = !active && muscles.length >= MAX_MUSCLES;
                return (
                  <TouchableOpacity key={m.key} activeOpacity={0.85} disabled={full}
                    onPress={() => toggleMuscle(m.key)}
                    style={[st.chip, active && st.chipActiveGreen, full && st.chipDisabled]}>
                    <Text style={[st.chipText, active && st.chipTextActiveGreen]}>{m.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Q3 — Injury rehab (multi-select) */}
          <View style={st.qCard}>
            <View style={st.qHead}>
              <View style={[st.qNum, { backgroundColor: C.blue }]}><Text style={st.qNumText}>3</Text></View>
              <Text style={st.qTitle}>Recovering from any injuries?</Text>
              {areas.length > 0 && <Text style={st.qCount}>{areas.length}</Text>}
            </View>
            <View style={st.chipGrid}>
              {INJURY_AREAS.map(a => {
                const active = areas.includes(a.key);
                return (
                  <TouchableOpacity key={a.key} activeOpacity={0.85}
                    onPress={() => toggleArea(a.key)}
                    style={[st.chip, active && st.chipActiveBlue]}>
                    <Text style={[st.chipText, active && st.chipTextActiveBlue]}>{a.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {showSidePicker && (
              <>
                <Text style={[st.qLabel, { marginTop: 14 }]}>Which side?</Text>
                <View style={st.sideRow}>
                  {SIDES.map(sd => {
                    const active = side === sd.key;
                    return (
                      <TouchableOpacity key={sd.key} activeOpacity={0.85} onPress={() => setSide(sd.key)}
                        style={[st.sideBtn, active && st.chipActiveBlue]}>
                        <Text style={[st.chipText, active && st.chipTextActiveBlue]}>{sd.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={st.hint}>Applies to bilateral parts. Left / right is your body's own side.</Text>
              </>
            )}
          </View>

          {onSave && (
            <TouchableOpacity style={[st.saveBtn, saving && { opacity: 0.6 }]} activeOpacity={0.85}
              disabled={saving} onPress={handleSave}>
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
  stage: {
    backgroundColor: C.canvas,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    paddingVertical: 6,
  },
  summaryWrap: { marginTop: 12, gap: 4 },
  summaryLine: { color: C.text, fontSize: 14, fontWeight: '600' },
  summaryEmpty: { color: C.muted, fontSize: 14 },

  qCard: {
    marginTop: 14,
    backgroundColor: C.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
  },
  qHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  qNum: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: C.orange,
    alignItems: 'center', justifyContent: 'center',
  },
  qNumText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  qTitle: { flex: 1, color: C.text, fontSize: 15, fontWeight: '800' },
  qCount: { color: C.muted, fontSize: 13, fontWeight: '700' },
  qLabel: { color: C.text, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },

  compareRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  compareCol: { alignItems: 'center' },
  compareValue: { color: C.text, fontSize: 18, fontWeight: '800' },
  compareLabel: { color: C.muted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginTop: 2 },
  arrow: { color: C.muted, fontSize: 18, fontWeight: '800' },
  deltaPill: { marginLeft: 'auto', backgroundColor: C.accentSoft, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  deltaText: { color: C.orange, fontSize: 14, fontWeight: '800' },
  hint: { color: C.muted, fontSize: 12, marginTop: 8 },

  sliderHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 12, marginBottom: 10 },
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
  sideBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: C.canvas,
    borderWidth: 1.5, borderColor: C.border, alignItems: 'center',
  },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: C.canvas,
    borderWidth: 1.5, borderColor: C.border,
  },
  chipActive: { borderColor: C.orange, backgroundColor: C.accentSoft },
  chipActiveGreen: { borderColor: C.green, backgroundColor: C.greenSoft },
  chipActiveBlue: { borderColor: C.blue, backgroundColor: C.blueSoft },
  chipDisabled: { opacity: 0.4 },
  chipText: { color: C.muted, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: C.text, fontWeight: '800' },
  chipTextActiveGreen: { color: C.green, fontWeight: '800' },
  chipTextActiveBlue: { color: C.blue, fontWeight: '800' },

  saveBtn: { marginTop: 20, height: 52, borderRadius: 14, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});
