/**
 * Difficulty display mapping for exercises & workouts.
 *
 * The stored values stay 'Beginner' | 'Intermediate' | 'Advanced' (used across
 * data, filters and comparisons). These helpers map them to the user-facing
 * labels — renamed with emojis:
 *
 *   Beginner     → 🟢 Simple
 *   Intermediate → 🟡 Medium
 *   Advanced     → 🔴 Complex
 */

export const DIFFICULTY_DISPLAY: Record<string, { label: string; emoji: string }> = {
  Beginner:     { label: 'Simple', emoji: '🟢' },
  Intermediate: { label: 'Medium',  emoji: '🟡' },
  Advanced:     { label: 'Complex', emoji: '🔴' },
};

// Solid colour matching each difficulty's dot (🟢/🟡/🔴) — used to render the
// difficulty as a bare coloured dot next to a video title.
export const DIFFICULTY_COLORS: Record<string, string> = {
  Beginner:     '#22C55E', // green
  Intermediate: '#EAB308', // amber
  Advanced:     '#EF4444', // red
};

/** Difficulty → dot colour. Null when unknown/missing. */
export function difficultyColor(value?: string | null): string | null {
  if (!value) return null;
  return DIFFICULTY_COLORS[normalize(value)] ?? null;
}

const normalize = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

/** Emoji + renamed label, e.g. "🟢 Easy". Case-insensitive; falls back to the raw value. */
export function formatDifficulty(value?: string | null): string {
  if (!value) return '';
  const d = DIFFICULTY_DISPLAY[normalize(value)];
  return d ? `${d.emoji} ${d.label}` : value;
}

/** Renamed label only, no emoji, e.g. "Easy". Falls back to the raw value. */
export function difficultyLabel(value?: string | null): string {
  if (!value) return '';
  return DIFFICULTY_DISPLAY[normalize(value)]?.label ?? value;
}

/** Emoji icon only, e.g. "🟢". Empty string if the value is unknown/missing. */
export function difficultyEmoji(value?: string | null): string {
  if (!value) return '';
  return DIFFICULTY_DISPLAY[normalize(value)]?.emoji ?? '';
}
