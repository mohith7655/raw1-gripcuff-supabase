import { supabase } from '../core/config/supabase';
import { User } from '../models';

const toAppUser = (row: any, uid: string): User => ({
  uid,
  email: row?.email || '',
  fullName: row?.full_name || row?.fullName || 'User',
  username: row?.username || (row?.email ? String(row.email).split('@')[0] : 'user'),
  profileImageUrl: row?.avatar_url || row?.profileImageUrl || undefined,
  completedVideos: Number(row?.completed_videos ?? row?.completedVideos ?? 0),
  totalVideos: Number(row?.total_videos ?? row?.totalVideos ?? 0),
  credits: Number(row?.credits ?? 0),
  createdAt: row?.created_at ? new Date(row.created_at) : new Date(),
  updatedAt: row?.updated_at ? new Date(row.updated_at) : new Date(),
});

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

  static async createProfile(uid: string, profile: User): Promise<void> {
    console.log('[UserService] createProfile start:', uid);
    const payload = {
      id: uid,
      email: profile.email || null,
      username: profile.username || null,
      full_name: profile.fullName || null,
      avatar_url: profile.profileImageUrl || null,
      streak: 0,
      watched_minutes: 0,
    };

    const { error } = await supabase.from('users').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('[UserService] createProfile failed:', error.message);
      throw new Error(error.message);
    }
  }

  static async updateProfile(uid: string, data: Partial<User>): Promise<void> {
    console.log('[UserService] updateProfile start:', uid, Object.keys(data));
    const payload: Record<string, any> = {};
    if (data.email !== undefined) payload.email = data.email;
    if (data.username !== undefined) payload.username = data.username;
    if (data.fullName !== undefined) payload.full_name = data.fullName;
    if (data.profileImageUrl !== undefined) payload.avatar_url = data.profileImageUrl;

    const { error } = await supabase.from('users').update(payload).eq('id', uid);
    if (error) {
      console.error('[UserService] updateProfile failed:', error.message);
      throw new Error(error.message);
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
