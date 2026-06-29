/**
 * activityHeat — turns a user's recent activity into "hot ↔ cold" heat scores for
 * two dimensions, shown as colour-coded pills on profiles / the connection sheet:
 *
 *   • workout heat  (🏋️ dumbbell) — how much they've been training recently
 *   • social  heat  (🙌 high-five) — how much they've been training WITH others
 *                                    (co-workouts + head-to-head challenges)
 *
 * Both are computed client-side from the same per-day activity that powers the
 * profile heatmap (see activityMap.service.loadActivityMap), so NO new tables or
 * columns are required — only that the underlying activity rows are readable.
 */
import { ActivityMapData } from '../services/activityMap.service';

export type HeatLevel = 'hot' | 'warm' | 'cool' | 'cold';

export interface Heat {
  score: number;      // 0–100
  level: HeatLevel;
  color: string;      // icon / text tint
  soft: string;       // pill background
  label: string;      // "Hot" / "Warm" / "Cool" / "Cold"
}

const HEAT: Record<HeatLevel, { color: string; soft: string; label: string }> = {
  // "Hot" uses a fiery red rather than the CTA orange (#F25912) so heat pills
  // never read like tappable action buttons.
  hot:  { color: '#EF4444', soft: 'rgba(239,68,68,0.14)',  label: 'Hot' },
  warm: { color: '#F59E0B', soft: 'rgba(245,158,11,0.16)', label: 'Warm' },
  cool: { color: '#3B82F6', soft: 'rgba(59,130,246,0.14)', label: 'Cool' },
  cold: { color: '#94A3B8', soft: 'rgba(148,163,184,0.18)', label: 'Cold' },
};

const levelFromScore = (s: number): HeatLevel =>
  s >= 66 ? 'hot' : s >= 40 ? 'warm' : s >= 15 ? 'cool' : 'cold';

const makeHeat = (score: number): Heat => {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const level = levelFromScore(clamped);
  return { score: clamped, level, ...HEAT[level] };
};

// Whole days between a YYYY-MM-DD key and today (local).
function daysAgo(dayKey: string | null, now = new Date()): number {
  if (!dayKey) return Infinity;
  const [y, m, d] = dayKey.split('-').map(Number);
  if (!y || !m || !d) return Infinity;
  const then = new Date(y, m - 1, d).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.max(0, Math.round((today - then) / 86400000));
}

// Heat = 60% recency (how recently) + 40% frequency (how often) over the window.
function heatFrom(lastDay: string | null, activeDays: number, windowDays: number): Heat {
  const recency = lastDay === null ? 0 : Math.max(0, 1 - daysAgo(lastDay) / windowDays);
  // Hitting ~half the days in the window counts as maxed-out frequency.
  const frequency = Math.min(1, activeDays / (windowDays * 0.5));
  return makeHeat(100 * (0.6 * recency + 0.4 * frequency));
}

export interface ActivityHeats {
  workout: Heat;
  social: Heat;
  /** Head-to-head challenge heat — how recently / often they've competed. */
  challenge: Heat;
  /** Most recent active day (any kind), YYYY-MM-DD, for "active N days ago". */
  lastActiveDay: string | null;
}

/**
 * Derive workout + social heat from a loaded activity map, looking only at the
 * last `windowDays` (default 30).
 */
export function computeHeats(map: ActivityMapData, windowDays = 30): ActivityHeats {
  let workoutDays = 0;
  let socialDays = 0;
  let challengeDays = 0;
  let lastWorkout: string | null = null;
  let lastSocial: string | null = null;
  let lastChallenge: string | null = null;

  for (const [key, day] of Object.entries(map.byDay)) {
    if (!day.active) continue;
    if (daysAgo(key) > windowDays) continue;
    workoutDays += 1;
    if (!lastWorkout || key > lastWorkout) lastWorkout = key;
    if (day.kinds.has('friend') || day.kinds.has('challenge')) {
      socialDays += 1;
      if (!lastSocial || key > lastSocial) lastSocial = key;
    }
    if (day.kinds.has('challenge')) {
      challengeDays += 1;
      if (!lastChallenge || key > lastChallenge) lastChallenge = key;
    }
  }

  return {
    workout: heatFrom(lastWorkout, workoutDays, windowDays),
    social: heatFrom(lastSocial, socialDays, windowDays),
    challenge: heatFrom(lastChallenge, challengeDays, windowDays),
    lastActiveDay: map.lastActiveDate,
  };
}

// ── Gender display meta (shared by the sheet + full profile) ──────────────────
export interface GenderMeta { icon: string; color: string; bg: string; border: string; }
export function genderMeta(gender?: string | null): GenderMeta | null {
  const g = (gender || '').toLowerCase();
  if (g === 'male')   return { icon: '♂', color: '#2563eb', bg: 'rgba(37,99,235,0.12)',  border: 'rgba(37,99,235,0.30)' };
  if (g === 'female') return { icon: '♀', color: '#db2777', bg: 'rgba(219,39,119,0.12)', border: 'rgba(219,39,119,0.30)' };
  return null;
}

// App presence from `last_active_at` (stamped on every app open) → short label
// + a status colour (green recent, amber this week, grey otherwise).
export function appActiveLabel(lastActiveAt?: string | null): { text: string; color: string } {
  const t = lastActiveAt ? new Date(lastActiveAt).getTime() : NaN;
  if (!Number.isFinite(t)) return { text: 'Activity hidden', color: '#7A7C90' };
  const mins = (Date.now() - t) / 60_000;
  if (mins < 5)  return { text: 'Active now', color: '#16a34a' };
  if (mins < 60) return { text: `Active ${Math.round(mins)}m ago`, color: '#16a34a' };
  const hrs = mins / 60;
  if (hrs < 24)  return { text: `Active ${Math.round(hrs)}h ago`, color: '#16a34a' };
  const days = hrs / 24;
  if (days < 7)  return { text: `Active ${Math.round(days)}d ago`, color: '#d4a600' };
  return { text: `Online ${new Date(t).toLocaleDateString()}`, color: '#7A7C90' };
}

// True when the user hasn't opened the app for `days`+ days (default 14) — used
// to grey-scale their profile picture as an "inactive" signal. Unknown / missing
// last-active is treated as active (not greyed) to avoid false negatives.
export function isInactiveSince(lastActiveAt?: string | null, days = 14): boolean {
  if (!lastActiveAt) return false;
  const t = new Date(lastActiveAt).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t > days * 86_400_000;
}

// "Active N days/weeks ago" from a last-active day key (heatmap-derived).
export function lastActiveLabel(dayKey: string | null): string {
  if (!dayKey) return 'No recent activity';
  const d = daysAgo(dayKey);
  if (d <= 0) return 'Active today';
  if (d === 1) return 'Active yesterday';
  if (d < 7) return `Active ${d}d ago`;
  if (d < 30) return `Active ${Math.round(d / 7)}w ago`;
  return 'Inactive 30d+';
}
