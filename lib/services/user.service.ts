import { supabase } from '../core/config/supabase';
import { User, UserLocationData, UserLocations } from '../models';
import { SocialProfileService } from './socialProfile.service';

const parseLocData = (jsonb: any, fallbackAddr?: string | null): UserLocationData | undefined => {
  if (jsonb && typeof jsonb === 'object' && typeof jsonb.address === 'string') {
    return {
      address: jsonb.address,
      placeName: jsonb.placeName,
      lat: Number(jsonb.lat ?? 0),
      lng: Number(jsonb.lng ?? 0),
      placeId: jsonb.placeId,
    };
  }
  if (fallbackAddr) return { address: fallbackAddr, lat: 0, lng: 0 };
  return undefined;
};

const toAppUser = (row: any, uid: string): User => {
  const locations: UserLocations = {};
  const gym = parseLocData(row?.gym_location_data, row?.gym_location);
  if (gym) locations.gym = gym;
  const home = parseLocData(row?.home_location_data, row?.home_location);
  if (home) locations.home = home;
  const park = parseLocData(row?.park_location_data, row?.park_location);
  if (park) locations.park = park;

  return {
    uid,
    email: row?.email || '',
    fullName: row?.full_name || 'User',
    username: row?.username || (row?.email ? String(row.email).split('@')[0] : 'user'),
    profileImageUrl: row?.avatar_url || undefined,
    phone: row?.phone || undefined,
    dateOfBirth: row?.date_of_birth || undefined,
    gender: row?.gender || undefined,
    age: row?.age != null ? Number(row.age) : undefined,
    heightCm: row?.height_cm != null ? Number(row.height_cm) : undefined,
    weightKg: row?.weight_kg != null ? Number(row.weight_kg) : undefined,
    bodyConditions: Array.isArray(row?.body_conditions)
      ? row.body_conditions
      : (typeof row?.body_conditions === 'string' ? JSON.parse(row.body_conditions) : undefined),
    bodyGoal: row?.body_goal || undefined,
    injuryArea: row?.injury_area || undefined,
    injuryAreas: Array.isArray(row?.injury_areas)
      ? row.injury_areas
      : (typeof row?.injury_areas === 'string' ? JSON.parse(row.injury_areas) : undefined),
    injurySide: row?.injury_side || undefined,
    weightLossKg: row?.weight_loss_kg != null ? Number(row.weight_loss_kg) : undefined,
    targetMuscles: Array.isArray(row?.target_muscles)
      ? row.target_muscles
      : (typeof row?.target_muscles === 'string' ? JSON.parse(row.target_muscles) : undefined),
    goals: Array.isArray(row?.goals)
      ? row.goals
      : (typeof row?.goals === 'string' ? JSON.parse(row.goals) : undefined),
    locations: Object.keys(locations).length > 0 ? locations : undefined,
    completedVideos: Number(row?.completed_videos ?? 0),
    totalVideos: Number(row?.total_videos ?? 0),
    credits: Number(row?.credits ?? 0),
    createdAt: row?.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row?.updated_at ? new Date(row.updated_at) : new Date(),
    currentStreak: Number(row?.current_streak ?? 0),
    bestStreak: Number(row?.best_streak ?? 0),
    lastWorkoutDate: row?.last_workout_date || null,
    weeklyActivity: typeof row?.weekly_activity === 'string' ? JSON.parse(row.weekly_activity) : (row?.weekly_activity || {}),
    completedWorkouts: Number(row?.completed_workouts ?? 0),
    totalSquats: Number(row?.total_squats ?? 0),
    watchedMinutes: Number(row?.watched_minutes ?? 0),
    watchedSeconds: Number(row?.watched_seconds ?? 0),
    workoutSeconds: Number(row?.workout_seconds ?? 0),
    todayWatchSeconds: Number(row?.today_watch_seconds ?? 0),
    totalWatchSessions: Number(row?.total_watch_sessions ?? 0),
    lastVideoWatchAt: row?.last_video_watch_at || null,
    lastActiveAt: row?.last_active_at || null,
    showActivityStatus: row?.show_activity_status ?? true,
    avgReplyMinutes: row?.avg_reply_minutes != null ? Number(row.avg_reply_minutes) : null,
    replySampleCount: Number(row?.reply_sample_count ?? 0),
    totalLiveSessions: Number(row?.total_live_sessions ?? 0),
    // ── Access / subscription ──────────────────────────────────────────────────
    hasAccess: Boolean(row?.has_access),
    accessType: row?.access_type ?? null,
    stripeCustomerId: row?.stripe_customer_id ?? null,
    subscriptionId: row?.subscription_id ?? null,
    subscriptionStatus: row?.subscription_status ?? null,
  };
};

export class UserService {
  static async getProfile(uid: string): Promise<User> {
    if (!uid) throw new Error('getProfile called with empty uid');
    console.log('[UserService] getProfile start:', uid);

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', uid)
      .maybeSingle();

    if (error) {
      console.error('[UserService] getProfile failed:', error.message);
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error('User profile not found');
    }

    return toAppUser(data, uid);
  }

  /**
   * Add squats to the user's lifetime counter (atomic via the add_squats RPC).
   * Returns the new total, or null on failure. Fire-and-forget friendly.
   */
  static async addSquats(uid: string, count: number): Promise<number | null> {
    if (!uid || !count || count <= 0) return null;
    try {
      const { data, error } = await supabase.rpc('add_squats', { p_uid: uid, p_count: Math.round(count) });
      if (error) {
        console.warn('[UserService] addSquats failed:', error.message);
        return null;
      }
      return typeof data === 'number' ? data : null;
    } catch (e) {
      console.warn('[UserService] addSquats threw:', e);
      return null;
    }
  }

  /** Stamp the signed-in user's presence (last_active_at = now). Fire-and-forget. */
  static async touchLastActive(): Promise<void> {
    try {
      await supabase.rpc('touch_last_active');
    } catch {
      /* presence is best-effort; never block the UI */
    }
  }

  static async createProfile(uid: string, profile: User): Promise<void> {
    console.log('[UserService] createProfile start:', uid);
    const payload = {
      id: uid,
      email: profile.email || null,
      username: profile.username || null,
      full_name: profile.fullName || null,
      avatar_url: profile.profileImageUrl || null,
      watched_minutes: 0,
      current_streak: 0,
      best_streak: 0,
      last_workout_date: null,
      weekly_activity: {},
      completed_workouts: 0,
      total_live_sessions: 0,
    };

    const { error } = await supabase.from('users').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('[UserService] createProfile failed:', error.message);
      throw new Error(error.message);
    }

    const { error: profilesErr } = await supabase
      .from('profiles')
      .upsert({
        id: uid,
        username: profile.username || null,
        full_name: profile.fullName || null,
        avatar_url: profile.profileImageUrl || null,
      }, { onConflict: 'id' });
    if (profilesErr) {
      console.warn('[UserService] profiles upsert failed:', profilesErr.message);
    } else {
      try {
        await SocialProfileService.ensureQrSlug(uid, profile.username || profile.fullName || null);
      } catch (slugErr) {
        console.warn('[UserService] ensure qr_slug failed:', slugErr);
      }
    }
  }

  static async updateProfile(uid: string, data: Partial<User>): Promise<void> {
    console.log('[UserService] updateProfile start:', uid, Object.keys(data));

    const payload: Record<string, any> = {};
    if (data.email !== undefined) payload.email = data.email;
    if (data.username !== undefined) payload.username = data.username;
    if (data.fullName !== undefined) payload.full_name = data.fullName;
    if (data.profileImageUrl !== undefined) payload.avatar_url = data.profileImageUrl;
    if (data.phone !== undefined) payload.phone = data.phone || null;
    if (data.dateOfBirth !== undefined) payload.date_of_birth = data.dateOfBirth || null;
    if (data.gender !== undefined) payload.gender = data.gender || null;
    if (data.age !== undefined) payload.age = data.age ?? null;
    if (data.heightCm !== undefined) payload.height_cm = data.heightCm ?? null;
    if (data.weightKg !== undefined) payload.weight_kg = data.weightKg ?? null;
    if (data.bodyConditions !== undefined) payload.body_conditions = data.bodyConditions ?? null;
    if (data.bodyGoal !== undefined) payload.body_goal = data.bodyGoal ?? null;
    if (data.injuryArea !== undefined) payload.injury_area = data.injuryArea ?? null;
    if (data.injuryAreas !== undefined) payload.injury_areas = data.injuryAreas ?? null;
    if (data.injurySide !== undefined) payload.injury_side = data.injurySide ?? null;
    if (data.weightLossKg !== undefined) payload.weight_loss_kg = data.weightLossKg ?? null;
    if (data.targetMuscles !== undefined) payload.target_muscles = data.targetMuscles ?? null;
    if (data.goals !== undefined) payload.goals = data.goals ?? null;
    if (data.locations !== undefined) {
      payload.gym_location = data.locations?.gym?.address ?? null;
      payload.home_location = data.locations?.home?.address ?? null;
      payload.park_location = data.locations?.park?.address ?? null;
      payload.gym_location_data = data.locations?.gym ?? null;
      payload.home_location_data = data.locations?.home ?? null;
      payload.park_location_data = data.locations?.park ?? null;
    }
    if (data.currentStreak !== undefined) payload.current_streak = data.currentStreak;
    if (data.bestStreak !== undefined) payload.best_streak = data.bestStreak;
    if (data.lastWorkoutDate !== undefined) payload.last_workout_date = data.lastWorkoutDate;
    if (data.weeklyActivity !== undefined) payload.weekly_activity = data.weeklyActivity;
    if (data.completedWorkouts !== undefined) payload.completed_workouts = data.completedWorkouts;
    // watched_minutes is derived from watched_seconds — never set it directly
    if (data.totalLiveSessions !== undefined) payload.total_live_sessions = data.totalLiveSessions;

    console.log('[UserService] updateProfile mapped payload', payload);

    if (Object.keys(payload).length === 0) {
      console.warn('[UserService] updateProfile called with empty payload — skipping');
      return;
    }

    const { error } = await supabase.from('users').upsert({ id: uid, ...payload }, { onConflict: 'id' });
    if (error) {
      console.error('[UserService] updateProfile failed:', error.message);
      throw new Error(error.message);
    }

    // Mirror a subset of fields into the public `profiles` table. Only include
    // keys that were actually provided so we never overwrite columns with nulls.
    const profilePayload: Record<string, any> = {};
    if (data.username !== undefined) profilePayload.username = data.username ?? null;
    if (data.fullName !== undefined) profilePayload.full_name = data.fullName ?? null;
    if (data.profileImageUrl !== undefined) profilePayload.avatar_url = data.profileImageUrl ?? null;
    if (data.age !== undefined) profilePayload.age = data.age ?? null;
    if (data.gender !== undefined) profilePayload.gender = data.gender ?? null;
    if (data.dateOfBirth !== undefined) profilePayload.date_of_birth = data.dateOfBirth ?? null;
    if (data.phone !== undefined) profilePayload.phone = data.phone ?? null;
    if (data.currentStreak !== undefined) profilePayload.current_streak = data.currentStreak ?? null;
    if (data.bestStreak !== undefined) profilePayload.best_streak = data.bestStreak ?? null;
    if (data.completedWorkouts !== undefined) profilePayload.completed_workouts = data.completedWorkouts ?? null;
    if (data.heightCm !== undefined) profilePayload.height_cm = data.heightCm ?? null;
    if (data.weightKg !== undefined) profilePayload.weight_kg = data.weightKg ?? null;
    if (data.bodyConditions !== undefined) profilePayload.body_conditions = data.bodyConditions ?? null;
    if (data.bodyGoal !== undefined) profilePayload.body_goal = data.bodyGoal ?? null;
    if (data.injuryArea !== undefined) profilePayload.injury_area = data.injuryArea ?? null;
    if (data.injuryAreas !== undefined) profilePayload.injury_areas = data.injuryAreas ?? null;
    if (data.injurySide !== undefined) profilePayload.injury_side = data.injurySide ?? null;
    if (data.weightLossKg !== undefined) profilePayload.weight_loss_kg = data.weightLossKg ?? null;
    if (data.targetMuscles !== undefined) profilePayload.target_muscles = data.targetMuscles ?? null;
    if (data.goals !== undefined) profilePayload.goals = data.goals ?? null;

    if (Object.keys(profilePayload).length > 0) {
      // Upsert only when a username is present (required NOT NULL for inserts).
      // Otherwise the profiles row already exists — update it in place so we
      // don't trip the username NOT NULL constraint on the insert tuple.
      const { error: profileSyncErr } = data.username
        ? await supabase.from('profiles').upsert({ id: uid, ...profilePayload }, { onConflict: 'id' })
        : await supabase.from('profiles').update(profilePayload).eq('id', uid);
      if (profileSyncErr) {
        console.warn('[UserService] profile mirror sync failed:', profileSyncErr.message);
      }
      if (data.username || data.fullName) {
        try {
          await SocialProfileService.ensureQrSlug(uid, data.username || data.fullName || null);
        } catch (slugErr) {
          console.warn('[UserService] ensure qr_slug failed:', slugErr);
        }
      }
    }
  }

  static async searchUserByEmail(email: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('[UserService] searchUserByEmail failed:', error.message);
      return null;
    }
    if (!data) return null;
    return toAppUser(data, data.id);
  }

  static async deleteProfile(uid: string): Promise<void> {
    const { error } = await supabase.from('users').delete().eq('id', uid);
    if (error) {
      console.warn('[UserService] deleteProfile failed:', error.message);
    }
  }
}
