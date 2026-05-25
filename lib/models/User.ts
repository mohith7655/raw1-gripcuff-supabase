export interface UserLocationData {
  address: string;
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
  locations?: UserLocations;
  completedVideos: number;
  totalVideos: number;
  credits: number;
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
  todayWatchSeconds?: number;
  totalWatchSessions?: number;
  lastVideoWatchAt?: string | null;
  totalLiveSessions?: number;
  // ── Access / subscription fields (from users.has_access, etc.) ──────────────
  hasAccess?: boolean;
  accessType?: string | null;
  stripeCustomerId?: string | null;
  subscriptionId?: string | null;
  subscriptionStatus?: string | null;
}

export type CreateUserInput = Omit<User, 'uid' | 'createdAt' | 'updatedAt'>;
