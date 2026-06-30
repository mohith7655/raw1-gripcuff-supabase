/**
 * ThermometerHeat — the activity "temperature viewer" used on profiles.
 *
 * A thermometer whose mercury rises from the bulb in proportion to a heat score
 * (0–100). The mercury is orange (the app accent); the FILL HEIGHT is what reads
 * warmth at a glance for connects / workouts / challenges.
 */
import React from 'react';
import Svg, { Path, Rect, ClipPath, Defs, G } from 'react-native-svg';
import { Heat } from '../../utils/activityHeat';

// Classic thermometer: rounded-top stem + round bulb (single closed outline).
const THERMO_PATH = 'M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z';

const ORANGE = '#F25912';
const EMPTY = 'rgba(33,24,50,0.10)';
const OUTLINE = '#211832'; // near-black — the icon outline

let _thermoId = 0;

export function ThermometerHeat({
  heat,
  size = 16,
  color,
  outline = OUTLINE,
}: {
  heat: Heat;
  size?: number;
  color?: string;
  outline?: string;
}) {
  // Stable, unique clip id per instance (avoids collisions on web).
  const idRef = React.useRef<string>();
  if (!idRef.current) idRef.current = `thermo${++_thermoId}`;
  const clipId = idRef.current;

  const tint = color ?? ORANGE;
  const frac = Math.max(0, Math.min(1, heat.score / 100));

  // Bulb (bottom) is always filled; the mercury climbs the stem with warmth.
  const STEM_TOP = 5;
  const STEM_BOTTOM = 14;
  const fillTop = STEM_BOTTOM - frac * (STEM_BOTTOM - STEM_TOP);

  // Tall + narrow proportions of a real thermometer.
  const w = Math.round(size * 0.62);
  const h = Math.round(size * 1.4);

  return (
    <Svg width={w} height={h} viewBox="7 1 10 23">
      <Defs>
        <ClipPath id={clipId}>
          <Path d={THERMO_PATH} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clipId})`}>
        <Rect x={0} y={0} width={24} height={24} fill={EMPTY} />
        <Rect x={0} y={fillTop} width={24} height={24 - fillTop} fill={tint} />
      </G>
      <Path d={THERMO_PATH} fill="none" stroke={outline} strokeWidth={1.6} />
    </Svg>
  );
}
