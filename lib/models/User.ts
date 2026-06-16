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
  /** Body-transformation goal — powers the "My Goal" screen. */
  bodyGoal?: 'weight_loss' | 'muscle_growth' | 'injury_rehab';
  /** Injured body part (only when bodyGoal = 'injury_rehab'). */
  injuryArea?: string;
  /** Which side of the body is injured (for bilateral parts). */
  injurySide?: 'left' | 'right' | 'both';
  /** Kilograms the user wants to lose (only when bodyGoal = 'weight_loss'). */
  weightLossKg?: number;
  /** Up to 3 target muscle groups (only when bodyGoal = 'muscle_growth'). */
  targetMuscles?: string[];
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
  watchedMinutes?: number;
  watchedSeconds?: number;
  workoutSeconds?: number;
  todayWatchSeconds?: number;
  totalWatchSessions?: number;
  lastVideoWatchAt?: string | null;
  lastActiveAt?: string | null;
  totalLiveSessions?: number;
  // ── Access / subscription fields (from users.has_access, etc.) ──────────────
  hasAccess?: boolean;
  accessType?: string | null;
  stripeCustomerId?: string | null;
  subscriptionId?: string | null;
  subscriptionStatus?: string | null;
}

export type CreateUserInput = Omit<User, 'uid' | 'createdAt' | 'updatedAt'>;
