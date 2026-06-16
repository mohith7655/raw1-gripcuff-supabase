/**
 * ComparisonView — side-by-side body height/weight comparison.
 *
 * Two stylized human silhouettes (slim + heavy) are rendered on a shared
 * baseline over a faint ruler grid, scaled RELATIVE to each other so the taller
 * person is visibly taller on screen. All SVG path data is generated in this
 * file — no external assets.
 *
 *   <ComparisonView people={[p1, p2]} />
 *
 * Tech: React Native + react-native-svg.
 */
import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { G, Line, Path, Text as SvgText } from 'react-native-svg';

// ── Data model ────────────────────────────────────────────────────────────────
export interface ComparisonPerson {
  id: number;
  name: string;
  heightCm: number;
  weightKg: number;
  isSlim: boolean;
}

// ──────────────────────────────────────────────────────────────────────────────
// 1. SILHOUETTE PATH GENERATION (hardcoded, computed once at module load)
// ──────────────────────────────────────────────────────────────────────────────

const VB_H = 240; // natural viewBox height shared by both figures

// Outline landmarks walked top → bottom down the RIGHT half of the body.
// [yFrac, halfWidthFrac(slim), halfWidthFrac(heavy)]  — fractions of VB_H.
// Mirroring the right half produces the full, symmetric silhouette.
type Row = [number, number, number];

const BODY: Row[] = [
  [0.000, 0.008, 0.008], // crown (centre)
  [0.018, 0.066, 0.072], // upper head
  [0.055, 0.084, 0.092], // widest head
  [0.095, 0.062, 0.072], // jaw
  [0.120, 0.036, 0.050], // neck
  [0.146, 0.048, 0.066], // neck base
  [0.165, 0.150, 0.210], // shoulder peak
  [0.205, 0.135, 0.214], // shoulder → chest
  [0.285, 0.120, 0.226], // chest
  [0.350, 0.108, 0.242], // ribs (heavy belly grows)
  [0.410, 0.092, 0.252], // waist (heavy belly widest)
  [0.460, 0.120, 0.236], // hips
  [0.512, 0.128, 0.224], // glute / upper thigh
  [0.572, 0.105, 0.182], // thigh
  [0.690, 0.072, 0.122], // knee
  [0.805, 0.056, 0.096], // shin
  [0.930, 0.044, 0.068], // outer ankle
  [0.982, 0.078, 0.106], // toe (outward)
  [0.998, 0.026, 0.040], // inner foot
  [0.930, 0.018, 0.028], // inner ankle
  [0.805, 0.020, 0.030], // inner shin
  [0.690, 0.026, 0.040], // inner knee
  [0.572, 0.040, 0.070], // inner thigh
  [0.520, 0.007, 0.010], // crotch (centre)
];

// Arm: a closed teardrop hanging from the shoulder, ending in a hand.
const ARM: Row[] = [
  [0.168, 0.155, 0.215], // shoulder top (outer)
  [0.200, 0.170, 0.245], // deltoid (widest)
  [0.262, 0.162, 0.240], // upper arm
  [0.342, 0.156, 0.232], // elbow
  [0.435, 0.150, 0.222], // forearm
  [0.500, 0.145, 0.210], // wrist
  [0.530, 0.151, 0.218], // knuckles
  [0.550, 0.120, 0.180], // fingertips
  [0.524, 0.100, 0.155], // hand (inner)
  [0.500, 0.100, 0.150], // inner wrist
  [0.435, 0.106, 0.165], // inner forearm
  [0.342, 0.112, 0.180], // inner upper arm
  [0.262, 0.118, 0.195], // inner deltoid
  [0.188, 0.135, 0.205], // armpit
];

interface Pt { x: number; y: number; }

// Catmull-Rom → cubic bézier over a closed loop → smooth, organic outline.
function smoothClosed(pts: Pt[]): string {
  const n = pts.length;
  if (n < 3) return '';
  const f = (v: number) => v.toFixed(2);
  let d = `M ${f(pts[0].x)} ${f(pts[0].y)} `;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += `C ${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p2.x)} ${f(p2.y)} `;
  }
  return d + 'Z';
}

// Build the full silhouette `d` for a given width column (1 = slim, 2 = heavy).
function buildFigure(cx: number, col: 1 | 2): string {
  const pt = (r: Row): Pt => ({ x: cx + r[col] * VB_H, y: r[0] * VB_H });

  // Body: right half + mirrored left half (skip on-axis endpoints to avoid dups).
  const right = BODY.map(pt);
  const loop: Pt[] = [...right];
  for (let i = BODY.length - 2; i >= 1; i--) loop.push({ x: 2 * cx - right[i].x, y: right[i].y });
  const body = smoothClosed(loop);

  // Arms: full right-arm loop + mirrored left arm.
  const armR = ARM.map(pt);
  const armRPath = smoothClosed(armR);
  const armLPath = smoothClosed(armR.map(p => ({ x: 2 * cx - p.x, y: p.y })));

  return `${body} ${armRPath} ${armLPath}`;
}

// Natural viewBox widths differ so the heavy figure reads broader on screen.
const SLIM_VB_W = 96;
const SLIM_CX = 48;
const HEAVY_VB_W = 132;
const HEAVY_CX = 66;

const SLIM_PATH = buildFigure(SLIM_CX, 1);
const HEAVY_PATH = buildFigure(HEAVY_CX, 2);

export const SLIM_ASPECT = SLIM_VB_W / VB_H;   // width / height
export const HEAVY_ASPECT = HEAVY_VB_W / VB_H;

// ──────────────────────────────────────────────────────────────────────────────
// 2. FIGURE COMPONENTS (each owns its hardcoded path)
// ──────────────────────────────────────────────────────────────────────────────

interface FigureProps {
  width: number;
  height: number;
  color: string;
  /** Optional offset when embedded inside another <Svg>. */
  x?: number;
  y?: number;
}

export const SlimFigureSVG: React.FC<FigureProps> = ({ width, height, color, x = 0, y = 0 }) => (
  <Svg
    x={x} y={y} width={width} height={height}
    viewBox={`0 0 ${SLIM_VB_W} ${VB_H}`}
    preserveAspectRatio="xMidYMax meet"
  >
    <Path d={SLIM_PATH} fill={color} />
  </Svg>
);

export const HeavyFigureSVG: React.FC<FigureProps> = ({ width, height, color, x = 0, y = 0 }) => (
  <Svg
    x={x} y={y} width={width} height={height}
    viewBox={`0 0 ${HEAVY_VB_W} ${VB_H}`}
    preserveAspectRatio="xMidYMax meet"
  >
    <Path d={HEAVY_PATH} fill={color} />
  </Svg>
);

// ──────────────────────────────────────────────────────────────────────────────
// 3. HELPERS
// ──────────────────────────────────────────────────────────────────────────────

/** Convert centimetres to a `5'11"` style string. */
export function cmToFeetInches(cm: number): string {
  const totalIn = cm / 2.54;
  let ft = Math.floor(totalIn / 12);
  let inch = Math.round(totalIn - ft * 12);
  if (inch === 12) { ft += 1; inch = 0; }
  return `${ft}'${inch}"`;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ──────────────────────────────────────────────────────────────────────────────
// 4. COMPARISON VIEW
// ──────────────────────────────────────────────────────────────────────────────

const FIGURE_COLORS = ['#c5e1a5', '#558b2f'];   // left (slim), right (heavy)
const GRID_COLOR = 'rgba(33,24,50,0.07)';
const BASELINE_COLOR = '#e53935';               // red baseline
const TEXT_COLOR = '#211832';
const SUB_COLOR = '#5b5570';

const TOP_RESERVE = 58;   // space above the tallest head for labels
const BOTTOM_RESERVE = 30; // space below the baseline
const SIDE_PAD = 10;
const COL_GAP = 14;

interface ComparisonViewProps {
  people: ComparisonPerson[];
  /** Total SVG height. Width is responsive to the container. */
  height?: number;
}

export const ComparisonView: React.FC<ComparisonViewProps> = ({ people, height = 380 }) => {
  const [containerW, setContainerW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setContainerW(e.nativeEvent.layout.width);

  // We compare exactly two people.
  const pair = people.slice(0, 2);

  const layout = useMemo(() => {
    if (containerW <= 0 || pair.length < 2) return null;

    const W = containerW;
    const H = height;
    const baselineY = H - BOTTOM_RESERVE;
    const drawingH = baselineY - TOP_RESERVE;       // pixels available for the tallest figure
    const colW = (W - SIDE_PAD * 2 - COL_GAP) / 2;   // per-person column width

    const maxHeightCm = Math.max(...pair.map(p => p.heightCm));

    // Per-person aspect (slim is narrower than heavy).
    const aspectOf = (p: ComparisonPerson) => (p.isSlim ? SLIM_ASPECT : HEAVY_ASPECT);

    // Relative scale: limited by BOTH the vertical room and the column width,
    // so nothing clips horizontally or vertically.
    const heightLimit = drawingH / maxHeightCm;
    const widthLimit = Math.min(...pair.map(p => colW / (p.heightCm * aspectOf(p))));
    const pxPerCm = Math.min(heightLimit, widthLimit);

    const figures = pair.map((p, i) => {
      const figH = p.heightCm * pxPerCm;
      const figW = figH * aspectOf(p);
      const colLeft = SIDE_PAD + i * (colW + COL_GAP);
      const figX = colLeft + (colW - figW) / 2;
      const headTopY = baselineY - figH;
      return {
        person: p,
        figW,
        figH,
        figX,
        headTopY,
        colCenterX: colLeft + colW / 2,
        colLeft,
        colW,
        color: FIGURE_COLORS[i] ?? FIGURE_COLORS[0],
      };
    });

    // Grid lines every ~1/8 of the drawing height.
    const gridStep = drawingH / 8;
    const gridYs: number[] = [];
    for (let y = baselineY; y >= TOP_RESERVE - 1; y -= gridStep) gridYs.push(y);

    return { W, H, baselineY, figures, gridYs };
  }, [containerW, height, pair]);

  return (
    <View style={styles.container} onLayout={onLayout}>
      {layout && (
        <Svg width={layout.W} height={layout.H}>
          {/* ── Ruler grid (behind everything) ─────────────────────────── */}
          <G>
            {layout.gridYs.map((y, idx) => (
              <Line
                key={`grid-${idx}`}
                x1={0} y1={y} x2={layout.W} y2={y}
                stroke={GRID_COLOR} strokeWidth={1}
              />
            ))}
          </G>

          {/* ── Figures + per-person height markers and labels ─────────── */}
          {layout.figures.map(fig => {
            const { person, color } = fig;
            const Figure = person.isSlim ? SlimFigureSVG : HeavyFigureSVG;
            const half = fig.figW / 2 + 10;
            return (
              <G key={person.id}>
                {/* the silhouette */}
                <Figure x={fig.figX} y={fig.headTopY} width={fig.figW} height={fig.figH} color={color} />

                {/* height marker line at the top of the head */}
                <Line
                  x1={fig.colCenterX - half} y1={fig.headTopY}
                  x2={fig.colCenterX + half} y2={fig.headTopY}
                  stroke={TEXT_COLOR} strokeWidth={1.5}
                />

                {/* stacked label above the head */}
                <SvgText
                  x={fig.colCenterX} y={fig.headTopY - 32}
                  fontSize={13} fontWeight="700" fill={TEXT_COLOR} textAnchor="middle"
                >
                  {person.name}
                </SvgText>
                <SvgText
                  x={fig.colCenterX} y={fig.headTopY - 18}
                  fontSize={11} fontWeight="700" fill={SUB_COLOR} textAnchor="middle"
                >
                  {`cm: ${person.heightCm}`}
                </SvgText>
                <SvgText
                  x={fig.colCenterX} y={fig.headTopY - 6}
                  fontSize={11} fontWeight="700" fill={SUB_COLOR} textAnchor="middle"
                >
                  {`ft: ${cmToFeetInches(person.heightCm)}`}
                </SvgText>
              </G>
            );
          })}

          {/* ── Shared red baseline (drawn last, on top) ───────────────── */}
          <Line
            x1={0} y1={layout.baselineY} x2={layout.W} y2={layout.baselineY}
            stroke={BASELINE_COLOR} strokeWidth={2}
          />
        </Svg>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#f6f7f4',
    borderRadius: 12,
    overflow: 'hidden',
  },
});

export default ComparisonView;
