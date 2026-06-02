// ── Tier system (10 levels per badge) ─────────────────────────────────────────

export const TIER_COLORS = [
  '#9CA3AF', // L1 — grey
  '#6EE7B7', // L2 — mint
  '#10B981', // L3 — green
  '#34D399', // L4
  '#3B82F6', // L5 — blue
  '#60A5FA', // L6
  '#8B5CF6', // L7 — purple
  '#A78BFA', // L8
  '#E89951', // L9 — orange
  '#FFD700', // L10 — gold / Mythic
] as const;

export function tierColor(tier: number): string {
  return TIER_COLORS[Math.min(Math.max(tier - 1, 0), 9)];
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
  tier: number;       // 1–10
  name: string;
  threshold: number;
};

export type BadgeFamilyDef = {
  key: BadgeFamilyKey;
  emoji: string;
  label: string;
  description: string;
  unit: string;
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
      { tier: 1,  name: 'Spark',      threshold: 2   },
      { tier: 2,  name: 'Ember',      threshold: 5   },
      { tier: 3,  name: 'Flame',      threshold: 10  },
      { tier: 4,  name: 'Blaze',      threshold: 20  },
      { tier: 5,  name: 'Inferno',    threshold: 30  },
      { tier: 6,  name: 'Wildfire',   threshold: 50  },
      { tier: 7,  name: 'Firestorm',  threshold: 75  },
      { tier: 8,  name: 'Volcano',    threshold: 100 },
      { tier: 9,  name: 'Phoenix',    threshold: 150 },
      { tier: 10, name: 'Eternal',    threshold: 365 },
    ],
  },
  {
    key: 'consistency',
    emoji: '🏆',
    label: 'Consistency',
    description: 'Total workout days',
    unit: 'days',
    tiers: [
      { tier: 1,  name: 'Rookie',       threshold: 5   },
      { tier: 2,  name: 'Regular',      threshold: 15  },
      { tier: 3,  name: 'Reliable',     threshold: 30  },
      { tier: 4,  name: 'Dedicated',    threshold: 60  },
      { tier: 5,  name: 'Committed',    threshold: 100 },
      { tier: 6,  name: 'Relentless',   threshold: 150 },
      { tier: 7,  name: 'Iron Will',    threshold: 200 },
      { tier: 8,  name: 'Unstoppable',  threshold: 300 },
      { tier: 9,  name: 'Unbreakable',  threshold: 400 },
      { tier: 10, name: 'Legend',       threshold: 500 },
    ],
  },
  {
    key: 'social',
    emoji: '🤝',
    label: 'Social',
    description: 'Workouts completed with friends',
    unit: 'sessions',
    tiers: [
      { tier: 1,  name: 'Friendly',    threshold: 2   },
      { tier: 2,  name: 'Buddy',       threshold: 5   },
      { tier: 3,  name: 'Partner',     threshold: 10  },
      { tier: 4,  name: 'Teammate',    threshold: 25  },
      { tier: 5,  name: 'Squad',       threshold: 50  },
      { tier: 6,  name: 'Motivator',   threshold: 75  },
      { tier: 7,  name: 'Energiser',   threshold: 100 },
      { tier: 8,  name: 'Leader',      threshold: 200 },
      { tier: 9,  name: 'Inspiration', threshold: 350 },
      { tier: 10, name: 'Legend',      threshold: 500 },
    ],
  },
  {
    key: 'accountability',
    emoji: '👀',
    label: 'Accountability',
    description: 'Viewers who joined your live sessions',
    unit: 'viewers',
    tiers: [
      { tier: 1,  name: 'Seen',        threshold: 5     },
      { tier: 2,  name: 'Noticed',     threshold: 25    },
      { tier: 3,  name: 'Watched',     threshold: 75    },
      { tier: 4,  name: 'Popular',     threshold: 200   },
      { tier: 5,  name: 'Inspiring',   threshold: 500   },
      { tier: 6,  name: 'Trending',    threshold: 1000  },
      { tier: 7,  name: 'Influencer',  threshold: 2500  },
      { tier: 8,  name: 'Viral',       threshold: 5000  },
      { tier: 9,  name: 'Icon',        threshold: 7500  },
      { tier: 10, name: 'Phenomenon',  threshold: 10000 },
    ],
  },
  {
    key: 'coach',
    emoji: '📣',
    label: 'Coach',
    description: 'Sessions supporting other users',
    unit: 'sessions',
    tiers: [
      { tier: 1,  name: 'Helper',       threshold: 2    },
      { tier: 2,  name: 'Supporter',    threshold: 5    },
      { tier: 3,  name: 'Guide',        threshold: 15   },
      { tier: 4,  name: 'Encourager',   threshold: 30   },
      { tier: 5,  name: 'Advisor',      threshold: 60   },
      { tier: 6,  name: 'Mentor',       threshold: 100  },
      { tier: 7,  name: 'Coach',        threshold: 200  },
      { tier: 8,  name: 'Pro Coach',    threshold: 400  },
      { tier: 9,  name: 'Elite Coach',  threshold: 700  },
      { tier: 10, name: 'Master Coach', threshold: 1000 },
    ],
  },
  {
    key: 'transformation',
    emoji: '💪',
    label: 'Transformation',
    description: 'Total workout minutes',
    unit: 'min',
    tiers: [
      { tier: 1,  name: 'Starter',    threshold: 60    },
      { tier: 2,  name: 'Mover',      threshold: 300   },
      { tier: 3,  name: 'Builder',    threshold: 600   },
      { tier: 4,  name: 'Athlete',    threshold: 1500  },
      { tier: 5,  name: 'Warrior',    threshold: 3000  },
      { tier: 6,  name: 'Grinder',    threshold: 6000  },
      { tier: 7,  name: 'Champion',   threshold: 12000 },
      { tier: 8,  name: 'Elite',      threshold: 25000 },
      { tier: 9,  name: 'Titan',      threshold: 45000 },
      { tier: 10, name: 'Immortal',   threshold: 60000 },
    ],
  },
  {
    key: 'founder',
    emoji: '⭐',
    label: 'Founder',
    description: 'Early adopter status',
    unit: '',
    tiers: [
      { tier: 1,  name: 'Early Bird',   threshold: 0 },
      { tier: 2,  name: 'Pioneer',      threshold: 0 },
      { tier: 3,  name: 'Founder',      threshold: 0 },
      { tier: 4,  name: 'OG',           threshold: 0 },
      { tier: 5,  name: 'Veteran',      threshold: 0 },
      { tier: 6,  name: 'Elder',        threshold: 0 },
      { tier: 7,  name: 'Pillar',       threshold: 0 },
      { tier: 8,  name: 'Cornerstone',  threshold: 0 },
      { tier: 9,  name: 'Legend',       threshold: 0 },
      { tier: 10, name: 'Legacy',       threshold: 0 },
    ],
  },
];

// ── Live badge state ───────────────────────────────────────────────────────────

export type UserBadgeState = {
  familyKey: BadgeFamilyKey;
  currentTier: number;          // 0 = not earned, 1–10
  currentProgress: number;
  nextThreshold: number | null;
  earnedAt?: string;
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

export function tierProgress(family: BadgeFamilyDef, progress: number, currentTier: number): number {
  const prevThreshold = currentTier > 0 ? family.tiers[currentTier - 1].threshold : 0;
  const nextThreshold = getNextThreshold(family, currentTier);
  if (nextThreshold === null) return 1;
  if (nextThreshold <= prevThreshold) return 0;
  return Math.min((progress - prevThreshold) / (nextThreshold - prevThreshold), 1);
}
