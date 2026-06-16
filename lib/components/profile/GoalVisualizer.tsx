/**
 * GoalVisualizer — "My Goal"
 *
 * Reuses the boy/girl silhouette on a ruler and tailors it per goal:
 *   • Weight loss   → ask how many kg to lose (compared to the saved weight from
 *                     "How I look now"); a ghost of the current body sits behind
 *                     the slimmer target so you can compare.
 *   • Muscle growth → pick your top 3 muscles; they light up on a broader figure.
 *   • Injury rehab  → pick a body part; bilateral parts highlight on BOTH sides.
 *
 * Everything is committed via `onSave`; the parent persists it.
 */
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, GestureResponderEvent, Image as RNImage, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, G, Image as SvgImage, Line, Text as SvgText } from 'react-native-svg';

// ── Theme ───────────────────────────────────────────────────────────────────
const C = {
  orange:     '#F25912',
  green:      '#16a34a',
  text:       '#211832',
  muted:      '#7A7C90',
  canvas:     '#EEEEF2',
  cardBg:     '#F8F8FC',
  border:     'rgba(33,24,50,0.08)',
  accentSoft: 'rgba(242,89,18,0.12)',
  greenSoft:  'rgba(22,163,74,0.12)',
  rule:       'rgba(33,24,50,0.10)',
};

// ── Goals ─────────────────────────────────────────────────────────────────────
export type BodyGoal = 'weight_loss' | 'muscle_growth' | 'injury_rehab';
export type InjurySide = 'left' | 'right' | 'both';

export interface GoalData {
  goal: BodyGoal;
  injuryArea: string | null;
  injurySide: InjurySide | null;
  weightLossKg: number | null;
  targetMuscles: string[] | null;
}

const SIDES: { key: InjurySide; label: string }[] = [
  { key: 'left',  label: 'Left' },
  { key: 'right', label: 'Right' },
  { key: 'both',  label: 'Both' },
];

const GOALS: { key: BodyGoal; label: string; emoji: string }[] = [
  { key: 'weight_loss',   label: 'Weight Loss',   emoji: '🔥' },
  { key: 'muscle_growth', label: 'Muscle Growth', emoji: '💪' },
  { key: 'injury_rehab',  label: 'Injury Rehab',  emoji: '🩹' },
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
  goal?: BodyGoal | null;
  injuryArea?: string | null;
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
  name, gender, heightCm, weightKg, goal, injuryArea, injurySide, weightLossKg, targetMuscles,
  onSave, saving = false, canvasHeight = 320, editable = true,
}: Props) {
  const [selectedGoal, setSelectedGoal] = useState<BodyGoal>(goal ?? 'weight_loss');
  const [selectedArea, setSelectedArea] = useState<string | null>(injuryArea ?? null);
  const [side, setSide] = useState<InjurySide>(injurySide ?? 'both');
  const [muscles, setMuscles] = useState<string[]>(targetMuscles ?? []);

  // Bilateral landmark currently selected for injury (drives the side picker).
  const injuryLm = INJURY_AREAS.find(a => a.key === selectedArea);
  const showSidePicker = selectedGoal === 'injury_rehab' && !!injuryLm?.both;

  const curWeight = weightKg ?? 70;
  const heightM = (heightCm ?? 170) / 100;
  const maxLose = Math.max(1, Math.round(curWeight - 35)); // never below 35 kg
  const [lossKg, setLossKg] = useState<number>(clamp(weightLossKg ?? 5, 1, maxLose));

  const targetWeight = Math.max(35, curWeight - lossKg);

  const female = gender === 'female';
  const src = female ? GIRL_IMG : BOY_IMG;
  const aspect = female ? ASPECT.female : ASPECT.male;

  const fig = useMemo(() => {
    const h = clamp(heightCm ?? 170, 120, HEIGHT_MAX) * PX_PER_CM;
    const ty = GROUND - h;
    const baseW = h * aspect;
    const bmiCur = curWeight / (heightM * heightM);

    const girthCur = girthFromBmi(bmiCur);
    let girthMain = girthCur;
    let showGhost = false;
    if (selectedGoal === 'weight_loss') {
      girthMain = girthFromBmi(targetWeight / (heightM * heightM));
      showGhost = true;
    } else if (selectedGoal === 'muscle_growth') {
      girthMain = clamp(girthCur * 1.12, 0.9, 1.5);
      showGhost = true;
    }
    return { h, ty, baseW, girthCur, girthMain, showGhost };
  }, [heightCm, aspect, curWeight, heightM, selectedGoal, targetWeight]);

  // Markers (injury or muscle) → screen points.
  // Figure faces the viewer, so the body's own LEFT is on the viewer's RIGHT.
  const markers = useMemo(() => {
    const list: { x: number; y: number; r: number; label: string }[] = [];
    const r = Math.max(11, fig.h * 0.05);
    const y = (lm: Landmark) => fig.ty + lm.yFrac * fig.h;
    const off = (lm: Landmark) => lm.xFrac * fig.baseW * fig.girthMain;
    const bodyLeftX = (lm: Landmark) => CX + off(lm);   // viewer's right
    const bodyRightX = (lm: Landmark) => CX - off(lm);  // viewer's left

    if (selectedGoal === 'injury_rehab' && injuryLm) {
      const lm = injuryLm;
      if (!lm.both) {
        list.push({ x: CX + off(lm), y: y(lm), r, label: lm.label });
      } else if (side === 'left') {
        list.push({ x: bodyLeftX(lm), y: y(lm), r, label: `Left ${lm.label}` });
      } else if (side === 'right') {
        list.push({ x: bodyRightX(lm), y: y(lm), r, label: `Right ${lm.label}` });
      } else {
        list.push({ x: bodyRightX(lm), y: y(lm), r, label: '' });
        list.push({ x: bodyLeftX(lm), y: y(lm), r, label: lm.label });
      }
    } else if (selectedGoal === 'muscle_growth') {
      muscles.forEach(key => {
        const m = MUSCLES.find(x => x.key === key);
        if (!m) return;
        if (m.both) {
          list.push({ x: bodyRightX(m), y: y(m), r, label: '' });
          list.push({ x: bodyLeftX(m), y: y(m), r, label: m.label });
        } else {
          list.push({ x: CX + off(m), y: y(m), r, label: m.label });
        }
      });
    }
    return list;
  }, [selectedGoal, injuryLm, side, muscles, fig]);

  const markerColor = selectedGoal === 'injury_rehab' ? C.orange : C.green;
  const markerFill = selectedGoal === 'injury_rehab' ? 'rgba(242,89,18,0.22)' : 'rgba(22,163,74,0.22)';

  const labelTop = clamp(fig.ty - 30, 10, GROUND);
  const goalMeta = GOALS.find(g => g.key === selectedGoal)!;

  const toggleMuscle = (key: string) => {
    setMuscles(prev =>
      prev.includes(key) ? prev.filter(k => k !== key)
        : prev.length >= MAX_MUSCLES ? prev
        : [...prev, key],
    );
  };

  const handleSave = () => {
    onSave?.({
      goal: selectedGoal,
      injuryArea: selectedGoal === 'injury_rehab' ? selectedArea : null,
      injurySide: showSidePicker ? side : null,
      weightLossKg: selectedGoal === 'weight_loss' ? lossKg : null,
      targetMuscles: selectedGoal === 'muscle_growth' ? muscles : null,
    });
  };

  const figureImage = (girth: number, opacity: number) => (
    <G transform={`translate(${CX} ${GROUND}) scale(${girth} 1) translate(${-CX} ${-GROUND})`} opacity={opacity}>
      <SvgImage href={src} x={CX - fig.baseW / 2} y={fig.ty} width={fig.baseW} height={fig.h} preserveAspectRatio="xMidYMax meet" />
    </G>
  );

  return (
    <View>
      {/* ── Stage ──────────────────────────────────────────────────────── */}
      <View style={st.stage}>
        <Svg width="100%" height={canvasHeight} viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid meet">
          {/* Ruler */}
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

          {/* Ghost (current body) behind, then the goal-shaped body */}
          {fig.showGhost && figureImage(fig.girthCur, 0.3)}
          {figureImage(fig.girthMain, 1)}

          {/* Highlights */}
          {markers.map((m, i) => (
            <G key={i}>
              <Circle cx={m.x} cy={m.y} r={m.r} fill={markerFill} stroke={markerColor} strokeWidth={2} />
              <Circle cx={m.x} cy={m.y} r={2.5} fill={markerColor} />
              {!!m.label && (
                <SvgText x={m.x} y={m.y - m.r - 5} fontSize={11} fontWeight="700" fill={markerColor} textAnchor="middle">{m.label}</SvgText>
              )}
            </G>
          ))}

          {/* Header label */}
          <SvgText x={CX} y={labelTop} fontSize={11} fill={C.text} textAnchor="middle" fontWeight="700">{name || 'Me'}</SvgText>
          <SvgText x={CX} y={labelTop + 13} fontSize={11} fill={C.text} textAnchor="middle" fontWeight="700">
            {`${goalMeta.emoji} ${goalMeta.label}`}
          </SvgText>
        </Svg>
      </View>

      {editable && (
        <>
          {/* ── Goal chips ─────────────────────────────────────────────── */}
          <Text style={st.ctrlLabel}>My goal</Text>
          <View style={st.goalRow}>
            {GOALS.map(g => {
              const active = selectedGoal === g.key;
              return (
                <TouchableOpacity key={g.key} activeOpacity={0.85} onPress={() => setSelectedGoal(g.key)}
                  style={[st.goalBtn, active && st.goalBtnActive]}>
                  <Text style={st.goalEmoji}>{g.emoji}</Text>
                  <Text style={[st.goalText, active && st.goalTextActive]}>{g.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Weight loss: compare + how many kg ─────────────────────── */}
          {selectedGoal === 'weight_loss' && (
            <View style={st.section}>
              <View style={st.compareRow}>
                <Compare label="Current" value={`${Math.round(curWeight)} kg`} />
                <Text style={st.arrow}>→</Text>
                <Compare label="Target" value={`${Math.round(targetWeight)} kg`} accent />
                <View style={st.deltaPill}><Text style={st.deltaText}>−{Math.round(lossKg)} kg</Text></View>
              </View>
              {weightKg == null && (
                <Text style={st.hint}>Tip: set your weight in “How I look now” for an accurate comparison.</Text>
              )}
              <View style={st.sliderHead}>
                <Text style={st.ctrlLabel}>How much to lose</Text>
                <Text style={st.sliderValue}>{Math.round(lossKg)} kg</Text>
              </View>
              <Slider min={1} max={maxLose} step={1} value={lossKg} color={C.orange} onChange={setLossKg} />
            </View>
          )}

          {/* ── Muscle growth: top 3 muscles ───────────────────────────── */}
          {selectedGoal === 'muscle_growth' && (
            <View style={st.section}>
              <View style={st.sliderHead}>
                <Text style={st.ctrlLabel}>Top muscles to grow</Text>
                <Text style={st.sliderValue}>{muscles.length}/{MAX_MUSCLES}</Text>
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
          )}

          {/* ── Injury rehab: body part + which side ───────────────────── */}
          {selectedGoal === 'injury_rehab' && (
            <View style={st.section}>
              <Text style={st.ctrlLabel}>Which body part?</Text>
              <View style={st.chipGrid}>
                {INJURY_AREAS.map(a => {
                  const active = selectedArea === a.key;
                  return (
                    <TouchableOpacity key={a.key} activeOpacity={0.85}
                      onPress={() => setSelectedArea(active ? null : a.key)}
                      style={[st.chip, active && st.chipActive]}>
                      <Text style={[st.chipText, active && st.chipTextActive]}>{a.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {showSidePicker && (
                <>
                  <Text style={[st.ctrlLabel, { marginTop: 16 }]}>Which side?</Text>
                  <View style={st.sideRow}>
                    {SIDES.map(sd => {
                      const active = side === sd.key;
                      return (
                        <TouchableOpacity key={sd.key} activeOpacity={0.85} onPress={() => setSide(sd.key)}
                          style={[st.sideBtn, active && st.chipActive]}>
                          <Text style={[st.chipText, active && st.chipTextActive]}>{sd.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text style={st.hint}>Left / right is your body's own side.</Text>
                </>
              )}
            </View>
          )}

          {/* ── Save ─────────────────────────────────────────────────── */}
          {onSave && (
            <TouchableOpacity style={[st.saveBtn, saving && { opacity: 0.6 }]} activeOpacity={0.85}
              disabled={saving} onPress={handleSave}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={st.saveBtnText}>Save Goal</Text>}
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
  ctrlLabel: { color: C.text, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  goalRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  goalBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: C.cardBg,
    borderWidth: 1.5, borderColor: C.border, alignItems: 'center', gap: 4,
  },
  goalBtnActive: { borderColor: C.orange, backgroundColor: C.accentSoft },
  goalEmoji: { fontSize: 22 },
  goalText: { color: C.muted, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  goalTextActive: { color: C.text, fontWeight: '800' },

  section: { marginTop: 18 },
  compareRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  compareCol: { alignItems: 'center' },
  compareValue: { color: C.text, fontSize: 18, fontWeight: '800' },
  compareLabel: { color: C.muted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginTop: 2 },
  arrow: { color: C.muted, fontSize: 18, fontWeight: '800' },
  deltaPill: { marginLeft: 'auto', backgroundColor: C.accentSoft, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  deltaText: { color: C.orange, fontSize: 14, fontWeight: '800' },
  hint: { color: C.muted, fontSize: 12, marginBottom: 8 },

  sliderHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8, marginBottom: 10 },
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
    flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: C.cardBg,
    borderWidth: 1.5, borderColor: C.border, alignItems: 'center',
  },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: C.cardBg,
    borderWidth: 1.5, borderColor: C.border,
  },
  chipActive: { borderColor: C.orange, backgroundColor: C.accentSoft },
  chipActiveGreen: { borderColor: C.green, backgroundColor: C.greenSoft },
  chipDisabled: { opacity: 0.4 },
  chipText: { color: C.muted, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: C.text, fontWeight: '800' },
  chipTextActiveGreen: { color: C.green, fontWeight: '800' },

  saveBtn: { marginTop: 22, height: 52, borderRadius: 14, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});
