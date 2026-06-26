/**
 * Setup-time display mapping for exercises & workouts — how long it takes to get
 * set up before you can start (equipment, positioning, etc.). Shown as an
 * hourglass icon on video thumbnails:
 *
 *   quick → ⏳ near-empty hourglass (green)  — bodyweight, just start
 *   fast  → ⏳ hourglass           (amber)  — light gear / quick positioning
 *   slow  → ⏳ full hourglass      (red)    — barbell / weights to load & set up
 *
 * There is no per-video "setup time" field, so the level is derived from the
 * category (which implies the equipment), with difficulty as a fallback.
 */

export type SetupLevel = 'quick' | 'fast' | 'slow';

export const SETUP_DISPLAY: Record<SetupLevel, { label: string; icon: string; color: string }> = {
  quick: { label: 'Quick setup', icon: 'timer-sand-empty', color: '#22C55E' }, // green
  fast:  { label: 'Fast setup',  icon: 'timer-sand',       color: '#EAB308' }, // amber
  slow:  { label: 'Slow setup',  icon: 'timer-sand-full',  color: '#EF4444' }, // red
};

// Setup time is driven mostly by the equipment a category implies: barbell /
// weighted programs take the longest to set up; bodyweight stretching / recovery
// the least.
const CATEGORY_SETUP: Record<string, SetupLevel> = {
  MuscleGrowth: 'slow', Strength: 'slow', Gripcuff: 'slow', Challenge: 'slow',
  AthleticPerformance: 'fast', HIIT: 'fast', InjuryRehab: 'fast', Tutorial: 'fast', Mobility: 'fast',
  Stretching: 'quick', Recovery: 'quick', Yoga: 'quick',
};

const DIFFICULTY_SETUP: Record<string, SetupLevel> = {
  Beginner: 'quick', Intermediate: 'fast', Advanced: 'slow',
};

const strip = (v: string) => v.replace(/\s+/g, '');

function fromDifficulty(difficulty?: string | null): SetupLevel | null {
  if (!difficulty) return null;
  const d = difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase();
  return DIFFICULTY_SETUP[d] ?? null;
}

/**
 * Resolve a setup-time level from the category (preferred) or difficulty.
 * Returns null only when neither is provided.
 */
export function setupLevelFor(category?: string | null, difficulty?: string | null): SetupLevel | null {
  if (category) {
    const key = strip(String(category));
    return CATEGORY_SETUP[key] ?? CATEGORY_SETUP[String(category)] ?? fromDifficulty(difficulty) ?? 'fast';
  }
  return fromDifficulty(difficulty);
}

/** "Quick setup" / "Fast setup" / "Slow setup", or '' when undeterminable. */
export function setupTimeLabel(category?: string | null, difficulty?: string | null): string {
  const level = setupLevelFor(category, difficulty);
  return level ? SETUP_DISPLAY[level].label : '';
}
