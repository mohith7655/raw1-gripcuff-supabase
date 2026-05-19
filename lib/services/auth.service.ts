import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '../core/config/firebase';
import { supabase } from '../core/config/supabase';
import { User } from '../models';
import { UserService } from './user.service';
import { AuthIdentityMapService } from './authIdentityMap.service';

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
      // Step 1: Supabase sign-in
      log('login: Supabase sign-in start', { email });
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        logError('login: Supabase sign-in failed', error);
        throw new Error(error?.message || 'Login failed');
      }
      log('login: Supabase sign-in OK', { supabaseUserId: data.user.id });

      // Step 2: Firebase mirror sign-in
      log('login: Firebase mirror sign-in start', { email });
      await signInWithEmailAndPassword(auth, email, password);
      const firebaseUid = auth.currentUser?.uid ?? null;
      if (!firebaseUid) {
        logError('login: Firebase mirror sign-in returned no UID — rolling back Supabase session');
        await supabase.auth.signOut();
        throw new Error('Firebase mirror session missing after login.');
      }
      log('login: Firebase mirror sign-in OK', { firebaseUid });

      // Step 3: Identity mapping
      const supabaseUserId = data.user.id;
      log('login: identity map validation', { supabaseUserId, firebaseUid });
      await AuthIdentityMapService.ensureAndValidate({
        supabaseUserId,
        firebaseUid,
        email: data.user.email ?? email,
      });
      log('login: identity map OK', { supabaseUserId, firebaseUid });

      // Step 4: Load or auto-create profile
      const uid = data.user.id;
      try {
        log('login: loading profile', { uid });
        return await UserService.getProfile(uid);
      } catch (profileError) {
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
          log('login: auto-created profile', { uid });
        } catch (createError) {
          logWarn('login: auto-create profile failed — proceeding with local user', createError);
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
      // Step 1: Supabase sign-up
      log('signup: Supabase sign-up start', { email });
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });

      if (error || !data.user) {
        logError('signup: Supabase sign-up failed', error);
        throw new Error(error?.message || 'Signup failed');
      }
      log('signup: Supabase sign-up OK', { supabaseUserId: data.user.id });

      // Step 2: Firebase mirror account creation
      log('signup: Firebase mirror account creation start', { email });
      await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUid = auth.currentUser?.uid ?? null;
      if (!firebaseUid) {
        logError('signup: Firebase mirror sign-up returned no UID — rolling back Supabase session');
        await supabase.auth.signOut();
        throw new Error('Firebase mirror session missing after signup.');
      }
      log('signup: Firebase mirror account created', { firebaseUid });

      // Step 3: Identity mapping
      const supabaseUserId = data.user.id;
      log('signup: identity map creation', { supabaseUserId, firebaseUid });
      await AuthIdentityMapService.ensureAndValidate({ supabaseUserId, firebaseUid, email });
      log('signup: identity map OK', { supabaseUserId, firebaseUid });

      // Step 4: Create Supabase user profile
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
        log('signup: creating user profile', { uid: data.user.id });
        await UserService.createProfile(data.user.id, newUser);
        log('signup: profile created');
      } catch (firestoreError) {
        logWarn('signup: profile creation failed — proceeding with local user', firestoreError);
      }

      return newUser;
    } catch (error: any) {
      logError('signup: unhandled error', error);
      throw new Error(error?.message || 'Signup failed');
    }
  }

  static async logout(): Promise<void> {
    try {
      log('logout: signing out of Supabase');
      await supabase.auth.signOut();
      log('logout: Supabase sign-out OK');

      log('logout: signing out of Firebase');
      await signOut(auth);
      log('logout: Firebase sign-out OK');

      log('logout: both sessions cleared', {
        supabaseUserId: null,
        firebaseUid: auth.currentUser?.uid ?? null,
      });
    } catch (error: any) {
      logError('logout: failed', error);
      throw new Error(error?.message || 'Logout failed');
    }
  }

  static getCurrentUser(): FirebaseUser | null {
    try {
      return auth.currentUser || null;
    } catch (error) {
      logError('getCurrentUser: error', error);
      return null;
    }
  }

  static getCurrentUserUID(): string | null {
    return this.getCurrentUser()?.uid || null;
  }
}
