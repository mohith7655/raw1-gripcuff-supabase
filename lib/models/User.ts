export interface UserLocationData {
  address: string;
  placeName?: string;
  lat: number;
  lng: number;
  placeId?: string;
}

export interface UserLocations {
  gym?: UserLocationData;
  home?: UserLocationData;
  park?: UserLocationData;
}

export type GoalType = 'muscle_growth' | 'weight_loss' | 'injury_rehab' | 'stretching';

/** "How I look now" body annotations — tightness, pain, or an injury at a body part. */
export type BodyConditionType = 'tightness' | 'pain' | 'injury';

export interface BodyCondition {
  /** Body-part landmark key (e.g. 'knee', 'lower_back'). */
  part: string;
  type: BodyConditionType;
  /** Which side for bilateral parts. */
  side?: 'left' | 'right' | 'both';
}

export interface GoalEntry {
  type: GoalType;
  /** muscle_growth: up to 3 muscle groups. */
  muscles?: string[];
  /** weight_loss: kg to lose. */
  kg?: number;
  /** injury_rehab / stretching: body parts. */
  areas?: string[];
  /** injury_rehab: which side for bilateral parts. */
  side?: 'left' | 'right' | 'both';
}

export interface User {
  uid: string;
  email: string;
  fullName: string;
  username: string;
  profileImageUrl?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  age?: number;
  /** Height in centimetres — powers the "How I look now" body silhouette. */
  heightCm?: number;
  /** Weight in kilograms — powers the "How I look now" body silhouette. */
  weightKg?: number;
  /** "How I look now" tightness / injury markers on the body figure. */
  bodyConditions?: BodyCondition[];
  /** Body-transformation goal — powers the "My Goal" screen. */
  bodyGoal?: 'weight_loss' | 'muscle_growth' | 'injury_rehab';
  /** Injured body part (legacy single value). */
  injuryArea?: string;
  /** Injured body parts (multi-select). */
  injuryAreas?: string[];
  /** Which side of the body is injured (for bilateral parts). */
  injurySide?: 'left' | 'right' | 'both';
  /** Kilograms the user wants to lose (only when bodyGoal = 'weight_loss'). */
  weightLossKg?: number;
  /** Up to 3 target muscle groups (only when bodyGoal = 'muscle_growth'). */
  targetMuscles?: string[];
  /** Stepped goal builder — ordered list of typed goals (My Goal screen). */
  goals?: GoalEntry[];
  locations?: UserLocations;
  completedVideos: number;
  totalVideos: number;
  credits: number;
  dailyCredits?: number;
  dailyCreditsGrantedAt?: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  currentStreak?: number;
  bestStreak?: number;
  lastWorkoutDate?: string | null;
  weeklyActivity?: Record<string, boolean>;
  completedWorkouts?: number;
  /** Lifetime squats logged (challenge lobby + move reminders). */
  totalSquats?: number;
  watchedMinutes?: number;
  watchedSeconds?: number;
  workoutSeconds?: number;
  todayWatchSeconds?: number;
  totalWatchSessions?: number;
  lastVideoWatchAt?: string | null;
  lastActiveAt?: string | null;
  /** Privacy opt-out for the activity / reply-time hint (users.show_activity_status). */
  showActivityStatus?: boolean;
  /** Median message reply latency in minutes (users.avg_reply_minutes). */
  avgReplyMinutes?: number | null;
  /** How many reply samples avg_reply_minutes is based on (users.reply_sample_count). */
  replySampleCount?: number;
  totalLiveSessions?: number;
  // ── Access / subscription fields (from users.has_access, etc.) ──────────────
  hasAccess?: boolean;
  accessType?: string | null;
  stripeCustomerId?: string | null;
  subscriptionId?: string | null;
  subscriptionStatus?: string | null;
}

export type CreateUserInput = Omit<User, 'uid' | 'createdAt' | 'updatedAt'>;
