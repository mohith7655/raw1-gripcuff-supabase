/**
 * activityMap.service — per-day workout activity for the GitHub-style heatmap.
 *
 * Intensity comes from `user_daily_activity` (watched_minutes per local day) —
 * the same data that powers the home weekly/lifetime stats and the streak, so
 * the map reflects real in-app activity. On top of that we tag each day's
 * activity TYPE:
 *   • workout_activity.metadata.sourceType / workout_type → solo | friend | daily-challenge
 *   • challenge_sessions (head-to-head) → challenge
 *
 * Reports the last active day so the UI can show "N days since last workout".
 */
import { supabase } from '../core/config/supabase';
import { ChallengeSessionService } from './challengeSession.service';

export type ActivityKind = 'solo' | 'friend' | 'challenge';

export interface DayActivity {
  minutes: number;
  active: boolean;
  kinds: Set<ActivityKind>;
}

export interface ActivityMapData {
  byDay: Record<string, DayActivity>;
  lastActiveDate: string | null; // YYYY-MM-DD
  activeDays: number;
}

// Local-timezone day key (matches the grid cells built in the component).
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export async function loadActivityMap(uid: string, days = 126): Promise<ActivityMapData> {
  const byDay: Record<string, DayActivity> = {};
  if (!uid) return { byDay, lastActiveDate: null, activeDays: 0 };

  const since = new Date(Date.now() - days * 86400000);
  const sinceISO = since.toISOString();
  const sinceKey = dayKey(since);

  const ensure = (k: string): DayActivity =>
    byDay[k] ?? (byDay[k] = { minutes: 0, active: false, kinds: new Set<ActivityKind>() });

  // 1) Daily watch minutes — canonical intensity (powers streak + home stats).
  try {
    const { data } = await supabase
      .from('user_daily_activity')
      .select('activity_date, watched_minutes')
      .eq('user_id', uid)
      .gte('activity_date', sinceKey);
    (data ?? []).forEach((r: any) => {
      const mins = Number(r.watched_minutes || 0);
      const e = ensure(String(r.activity_date));
      e.minutes += mins;
      if (mins > 0) { e.active = true; e.kinds.add('solo'); }
    });
  } catch {}

  // 2) Completion log — tags days as friend co-workout / daily challenge.
  try {
    const { data } = await supabase
      .from('workout_activity')
      .select('workout_type, completed_at, watched_minutes, metadata')
      .eq('user_id', uid)
      .gte('completed_at', sinceISO);
    (data ?? []).forEach((r: any) => {
      if (!r.completed_at) return;
      const src = r.metadata?.sourceType;
      const kind: ActivityKind =
        src === 'daily_challenge'
          ? 'challenge'
          : r.workout_type === 'liveSession' || src === 'friend_workout' || src === 'live_session'
            ? 'friend'
            : 'solo';
      const e = ensure(dayKey(new Date(r.completed_at)));
      e.active = true;
      e.kinds.add(kind);
      if (!e.minutes) e.minutes += Number(r.watched_minutes || 0); // don't double-count daily minutes
    });
  } catch {}

  // 3) Head-to-head challenges.
  try {
    const challenges = await ChallengeSessionService.loadPreviousForUser(uid);
    challenges.forEach((c) => {
      if (!c.createdAt) return;
      const t = new Date(c.createdAt);
      if (t.getTime() < since.getTime()) return;
      const e = ensure(dayKey(t));
      e.active = true;
      e.kinds.add('challenge');
    });
  } catch {}

  let lastActiveDate: string | null = null;
  let activeDays = 0;
  for (const k of Object.keys(byDay)) {
    if (!byDay[k].active) continue;
    activeDays += 1;
    if (!lastActiveDate || k > lastActiveDate) lastActiveDate = k;
  }
  return { byDay, lastActiveDate, activeDays };
}
