// ── Tier system ───────────────────────────────────────────────────────────────

export type TierIndex = 0 | 1 | 2 | 3 | 4; // 0 = not yet earned, 1–5 in spirit but stored 0-based

export const TIER_COLORS = ['#9CA3AF', '#10B981', '#3B82F6', '#8B5CF6', '#FF6B00'] as const;
export const TIER_NAMES  = ['Tier 1', 'Tier 2', 'Tier 3', 'Tier 4', 'Mythic'] as const;

// Tier index for display (1-based label)
export function tierColor(tier: number): string {
  return TIER_COLORS[Math.min(Math.max(tier - 1, 0), 4)];
}

// ── Badge family definitions ───────────────────────────────────────────────────

export type BadgeFamilyKey =
  | 'streak'
  | 'consistency'
  | 'social'
  | 'accountability'
  | 'coach'
  | 'transformation'
  | 'founder';

export type BadgeTierDef = {
  tier: number;       // 1–5
  name: string;
  threshold: number;
};

export type BadgeFamilyDef = {
  key: BadgeFamilyKey;
  emoji: string;
  label: string;
  description: string;  // what the metric tracks
  unit: string;         // "days", "workouts", etc.
  tiers: BadgeTierDef[];
};

export const BADGE_FAMILIES: BadgeFamilyDef[] = [
  {
    key: 'streak',
    emoji: '🔥',
    label: 'Streak',
    description: 'Consecutive workout days',
    unit: 'days',
    tiers: [
      { tier: 1, name: 'Spark',    threshold: 3   },
      { tier: 2, name: 'Ember',    threshold: 7   },
      { tier: 3, name: 'Flame',    threshold: 21  },
      { tier: 4, name: 'Inferno',  threshold: 50  },
      { tier: 5, name: 'Phoenix',  threshold: 100 },
    ],
  },
  {
    key: 'consistency',
    emoji: '🏆',
    label: 'Consistency',
    description: 'Total workout days',
    unit: 'days',
    tiers: [
      { tier: 1, name: 'Rookie',     threshold: 7   },
      { tier: 2, name: 'Reliable',   threshold: 30  },
      { tier: 3, name: 'Dedicated',  threshold: 100 },
      { tier: 4, name: 'Relentless', threshold: 250 },
      { tier: 5, name: 'Unbreakable',threshold: 500 },
    ],
  },
  {
    key: 'social',
    emoji: '🤝',
    label: 'Social',
    description: 'Workouts completed with friends',
    unit: 'sessions',
    tiers: [
      { tier: 1, name: 'Buddy',     threshold: 5   },
      { tier: 2, name: 'Teammate',  threshold: 25  },
      { tier: 3, name: 'Motivator', threshold: 100 },
      { tier: 4, name: 'Leader',    threshold: 250 },
      { tier: 5, name: 'Legend',    threshold: 500 },
    ],
  },
  {
    key: 'accountability',
    emoji: '👀',
    label: 'Accountability',
    description: 'Viewers who joined your live sessions',
    unit: 'viewers',
    tiers: [
      { tier: 1, name: 'Seen',       threshold: 10    },
      { tier: 2, name: 'Noticed',    threshold: 100   },
      { tier: 3, name: 'Inspiring',  threshold: 500   },
      { tier: 4, name: 'Influencer', threshold: 2000  },
      { tier: 5, name: 'Icon',       threshold: 10000 },
    ],
  },
  {
    key: 'coach',
    emoji: '📣',
    label: 'Coach',
    description: 'Hours supporting other users',
    unit: 'sessions',
    tiers: [
      { tier: 1, name: 'Supporter',    threshold: 5    },
      { tier: 2, name: 'Encourager',   threshold: 25   },
      { tier: 3, name: 'Mentor',       threshold: 100  },
      { tier: 4, name: 'Coach',        threshold: 300  },
      { tier: 5, name: 'Master Coach', threshold: 1000 },
    ],
  },
  {
    key: 'transformation',
    emoji: '💪',
    label: 'Transformation',
    description: 'Total workout minutes',
    unit: 'min',
    tiers: [
      { tier: 1, name: 'Builder',   threshold: 600   },
      { tier: 2, name: 'Athlete',   threshold: 3000  },
      { tier: 3, name: 'Warrior',   threshold: 12000 },
      { tier: 4, name: 'Champion',  threshold: 30000 },
      { tier: 5, name: 'Titan',     threshold: 60000 },
    ],
  },
  {
    key: 'founder',
    emoji: '⭐',
    label: 'Founder',
    description: 'Early adopter status',
    unit: '',
    tiers: [
      { tier: 1, name: 'Early Bird', threshold: 0 },
      { tier: 2, name: 'Pioneer',    threshold: 0 },
      { tier: 3, name: 'Founder',    threshold: 0 },
      { tier: 4, name: 'OG',         threshold: 0 },
      { tier: 5, name: 'Legacy',     threshold: 0 },
    ],
  },
];

// ── Live badge state (computed per user) ──────────────────────────────────────

export type UserBadgeState = {
  familyKey: BadgeFamilyKey;
  currentTier: number;        // 0 = not yet started, 1–5 = achieved tier
  currentProgress: number;    // raw value (days/sessions/minutes)
  nextThreshold: number | null; // null if max tier reached
  earnedAt?: string;          // ISO date of most recent tier upgrade
};

export function getBadgeFamily(key: BadgeFamilyKey): BadgeFamilyDef {
  return BADGE_FAMILIES.find(f => f.key === key)!;
}

export function computeTier(family: BadgeFamilyDef, progress: number): number {
  let tier = 0;
  for (const t of family.tiers) {
    if (progress >= t.threshold) tier = t.tier;
  }
  return tier;
}

export function getNextThreshold(family: BadgeFamilyDef, currentTier: number): number | null {
  const next = family.tiers.find(t => t.tier === currentTier + 1);
  return next ? next.threshold : null;
}

export function getTierName(family: BadgeFamilyDef, tier: number): string {
  if (tier === 0) return 'Locked';
  return family.tiers.find(t => t.tier === tier)?.name ?? 'Locked';
}

export function getCurrentTierName(family: BadgeFamilyDef, tier: number): string {
  return getTierName(family, tier);
}

// Progress 0–1 toward next tier
export function tierProgress(family: BadgeFamilyDef, progress: number, currentTier: number): number {
  const prevThreshold = currentTier > 0 ? family.tiers[currentTier - 1].threshold : 0;
  const nextThreshold = getNextThreshold(family, currentTier);
  if (nextThreshold === null) return 1;
  if (nextThreshold <= prevThreshold) return 0;
  return Math.min((progress - prevThreshold) / (nextThreshold - prevThreshold), 1);
}
