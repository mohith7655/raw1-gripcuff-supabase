import { supabase } from '../core/config/supabase';
import { User } from '../models';
import { UserService } from './user.service';

const TAG = '[AuthService]';
const log = (msg: string, data?: object) =>
  console.log(`${TAG} ${msg}`, ...(data ? [data] : []));
const logWarn = (msg: string, data?: object) =>
  console.warn(`${TAG} ${msg}`, ...(data ? [data] : []));
const logError = (msg: string, err?: unknown) =>
  console.error(`${TAG} ${msg}`, err ?? '');

export class AuthService {
  static async loginWithEmail(email: string, password: string): Promise<User> {
    try {
      log('login: start', { email });
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        logError('login: failed', error);
        throw new Error(error?.message || 'Login failed');
      }
      log('login: OK', { supabaseUserId: data.user.id });

      const uid = data.user.id;
      try {
        log('login: loading profile', { uid });
        return await UserService.getProfile(uid);
      } catch {
        logWarn('login: profile not found — auto-creating', { uid });
        const newUser: User = {
          uid,
          email: data.user.email || email,
          fullName: email.split('@')[0],
          username: email.split('@')[0],
          completedVideos: 0,
          totalVideos: 0,
          credits: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        try {
          await UserService.createProfile(uid, newUser);
        } catch (createError) {
          logWarn('login: auto-create profile failed — using local user', createError);
        }
        return newUser;
      }
    } catch (error: any) {
      logError('login: unhandled error', error);
      throw new Error(error?.message || 'Login failed');
    }
  }

  static async signupWithEmail(
    email: string,
    password: string,
    fullName: string,
  ): Promise<User> {
    try {
      log('signup: start', { email });
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });

      if (error || !data.user) {
        logError('signup: failed', error);
        throw new Error(error?.message || 'Signup failed');
      }
      log('signup: OK', { supabaseUserId: data.user.id });

      const newUser: User = {
        uid: data.user.id,
        email,
        fullName,
        username: email.split('@')[0],
        completedVideos: 0,
        totalVideos: 0,
        credits: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      try {
        await UserService.createProfile(data.user.id, newUser);
        log('signup: profile created', { uid: data.user.id });
      } catch (profileError) {
        logWarn('signup: profile creation failed — using local user', profileError);
      }

      return newUser;
    } catch (error: any) {
      logError('signup: unhandled error', error);
      throw new Error(error?.message || 'Signup failed');
    }
  }

  static async logout(): Promise<void> {
    try {
      log('logout: signing out');
      await supabase.auth.signOut();
      log('logout: complete');
    } catch (error: any) {
      logError('logout: failed', error);
      throw new Error(error?.message || 'Logout failed');
    }
  }
}
