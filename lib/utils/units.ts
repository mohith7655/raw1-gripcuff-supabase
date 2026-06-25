/**
 * Shared body-metric unit system — the single source of truth for how height and
 * weight are displayed across the profile.
 *
 * PRODUCT RULE: units are ALWAYS paired as one of exactly two combinations, so a
 * height unit can never appear next to the "wrong" weight unit:
 *   • 'cm_lb'   → height in cm,     weight in lb   (default)
 *   • 'ftin_kg' → height in ft·in,  weight in kg
 *
 * Metrics are always stored/computed in metric (kg, cm); this only changes
 * display. The preference is persisted per-device (web-safe).
 */
export type UnitSystem = 'cm_lb' | 'ftin_kg';

const UNITS_KEY = 'body_metrics_units';
const KG_PER_LB = 0.45359237;

export const kgToLb = (kg: number) => kg / KG_PER_LB;
export const lbToKg = (lb: number) => lb * KG_PER_LB;

export function loadUnits(): UnitSystem {
  try {
    if (typeof localStorage !== 'undefined') {
      const v = localStorage.getItem(UNITS_KEY);
      if (v === 'cm_lb' || v === 'ftin_kg') return v;
      // Migrate legacy values from the old metric/imperial toggle.
      if (v === 'metric') return 'cm_lb';
      if (v === 'imperial') return 'ftin_kg';
    }
  } catch {}
  return 'cm_lb';
}

export function saveUnits(u: UnitSystem) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(UNITS_KEY, u);
  } catch {}
}

/** cm → e.g. 5'11" */
export function toFeetInches(cm: number): string {
  const totalIn = cm / 2.54;
  let ft = Math.floor(totalIn / 12);
  let inch = Math.round(totalIn - ft * 12);
  if (inch === 12) { ft += 1; inch = 0; }
  return `${ft}'${inch}"`;
}

/** True when the chosen pairing displays weight in pounds. */
export const isWeightLb = (sys: UnitSystem) => sys === 'cm_lb';

/** Display a weight (kg) in the chosen pairing's unit. */
export const fmtWeight = (kg: number, sys: UnitSystem) =>
  isWeightLb(sys) ? `${Math.round(kgToLb(kg))} lb` : `${Math.round(kg)} kg`;

/** Display a height (cm) in the chosen pairing's unit. */
export const fmtHeight = (cm: number, sys: UnitSystem) =>
  sys === 'cm_lb' ? `${Math.round(cm)} cm` : toFeetInches(cm);

/** Short labels for the two pairings (e.g. unit-picker menus). */
export const PAIR_LABEL: Record<UnitSystem, { label: string; sub: string }> = {
  cm_lb:   { label: 'cm · lb',    sub: 'height cm · weight lb' },
  ftin_kg: { label: 'ft/in · kg', sub: 'height ft/in · weight kg' },
};
