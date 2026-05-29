import { supabase } from '../core/config/supabase';
import {
  BADGE_FAMILIES,
  BadgeFamilyKey,
  UserBadgeState,
  computeTier,
  getNextThreshold,
  getBadgeFamily,
} from './badge.types';

// ── Stats needed to derive badge progress ─────────────────────────────────────

export type UserBadgeStats = {
  bestStreak: number;         // streak family
  totalWorkouts: number;      // consistency family
  totalLiveSessions: number;  // social family
  totalViewers: number;       // accountability family (stub: 0 until tracked)
  coachSessions: number;      // coach family (stub: 0 until tracked)
  totalWatchMinutes: number;  // transformation family
  founderTier: number;        // 0 = not a founder, 1–5 = founder tier
};

// ── Derive badge states from stats (pure, no DB) ──────────────────────────────

export function deriveBadgeStates(stats: UserBadgeStats): UserBadgeState[] {
  const metricFor: Record<BadgeFamilyKey, number> = {
    streak:         stats.bestStreak,
    consistency:    stats.totalWorkouts,
    social:         stats.totalLiveSessions,
    accountability: stats.totalViewers,
    coach:          stats.coachSessions,
    transformation: stats.totalWatchMinutes,
    founder:        0, // special — admin-granted only
  };

  return BADGE_FAMILIES.map(family => {
    const progress = family.key === 'founder' ? 0 : metricFor[family.key];
    const currentTier = family.key === 'founder'
      ? stats.founderTier
      : computeTier(family, progress);
    const nextThreshold = getNextThreshold(family, currentTier);
    return {
      familyKey: family.key,
      currentTier,
      currentProgress: family.key === 'founder' ? 0 : progress,
      nextThreshold,
    };
  });
}

// ── Persist / fetch from Supabase ─────────────────────────────────────────────

export type DbBadgeRow = {
  user_id: string;
  badge_type: BadgeFamilyKey;
  current_tier: number;
  current_progress: number;
  next_threshold: number | null;
  earned_at: string | null;
};

export const BadgeService = {
  async fetchUserBadges(userId: string): Promise<UserBadgeState[]> {
    try {
      const { data, error } = await supabase
        .from('user_badge_progress')
        .select('badge_type, current_tier, current_progress, next_threshold, earned_at')
        .eq('user_id', userId);

      if (error || !data) return [];

      return data.map((row: any): UserBadgeState => ({
        familyKey: row.badge_type as BadgeFamilyKey,
        currentTier: row.current_tier ?? 0,
        currentProgress: row.current_progress ?? 0,
        nextThreshold: row.next_threshold ?? null,
        earnedAt: row.earned_at ?? undefined,
      }));
    } catch {
      return [];
    }
  },

  async upsertBadges(userId: string, states: UserBadgeState[]): Promise<void> {
    try {
      const rows: DbBadgeRow[] = states
        .filter(s => s.currentTier > 0)
        .map(s => ({
          user_id: userId,
          badge_type: s.familyKey,
          current_tier: s.currentTier,
          current_progress: s.currentProgress,
          next_threshold: s.nextThreshold,
          earned_at: s.earnedAt ?? new Date().toISOString(),
        }));
      if (rows.length === 0) return;
      await supabase
        .from('user_badge_progress')
        .upsert(rows, { onConflict: 'user_id,badge_type' });
    } catch { /* graceful */ }
  },

  // Returns the single highest-tier badge state (for leaderboard display)
  getHighestBadge(states: UserBadgeState[]): UserBadgeState | null {
    const earned = states.filter(s => s.currentTier > 0);
    if (earned.length === 0) return null;
    return earned.reduce((a, b) => b.currentTier > a.currentTier ? b : a);
  },
};
