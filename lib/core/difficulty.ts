/**
 * Difficulty display mapping for exercises & workouts.
 *
 * The stored values stay 'Beginner' | 'Intermediate' | 'Advanced' (used across
 * data, filters and comparisons). These helpers map them to the user-facing
 * labels — renamed with emojis:
 *
 *   Beginner     → 🟢 Simplex
 *   Intermediate → 🟡 Medium
 *   Advanced     → 🔴 Complex
 */

export const DIFFICULTY_DISPLAY: Record<string, { label: string; emoji: string }> = {
  Beginner:     { label: 'Simplex', emoji: '🟢' },
  Intermediate: { label: 'Medium',  emoji: '🟡' },
  Advanced:     { label: 'Complex', emoji: '🔴' },
};

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
