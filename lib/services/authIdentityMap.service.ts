import { supabase } from '../core/config/supabase';

const TAG = '[IdentityMap]';
const log = (msg: string, data?: object) =>
  console.log(`${TAG} ${msg}`, ...(data ? [data] : []));
const logWarn = (msg: string, data?: object) =>
  console.warn(`${TAG} ${msg}`, ...(data ? [data] : []));
const logError = (msg: string, err?: unknown) =>
  console.error(`${TAG} ${msg}`, err ?? '');

type EnsureArgs = {
  supabaseUserId: string;
  firebaseUid: string;
  email: string | null;
};

type IdentityMapRow = {
  supabase_user_id: string;
  firebase_uid: string;
  email: string | null;
};

export class AuthIdentityMapService {
  static async ensureAndValidate(args: EnsureArgs): Promise<IdentityMapRow | null> {
    const { supabaseUserId, firebaseUid, email } = args;

    log('ensureAndValidate: upserting map row', { supabaseUserId, firebaseUid, email });

    const upsertPayload = {
      supabase_user_id: supabaseUserId,
      firebase_uid: firebaseUid,
      email,
    };

    const { error: upsertError } = await supabase
      .from('auth_identity_map')
      .upsert(upsertPayload, { onConflict: 'supabase_user_id' });

    if (upsertError) {
      logError(`ensureAndValidate: upsert failed`, upsertError);
      throw new Error(`[IdentityMap] upsert failed: ${upsertError.message}`);
    }

    log('ensureAndValidate: upsert OK — fetching row to validate', { supabaseUserId });

    const { data, error } = await supabase
      .from('auth_identity_map')
      .select('supabase_user_id,firebase_uid,email')
      .eq('supabase_user_id', supabaseUserId)
      .maybeSingle();

    if (error) {
      logError(`ensureAndValidate: select failed`, error);
      throw new Error(`[IdentityMap] select failed: ${error.message}`);
    }

    if (!data) {
      logWarn('ensureAndValidate: row absent after upsert — possible RLS block', { supabaseUserId });
      return null;
    }

    // Validation: stored firebase_uid must match what we were given.
    // A mismatch means the same Supabase account is being claimed by a different Firebase UID.
    if (data.firebase_uid !== firebaseUid) {
      logError('ensureAndValidate: MISMATCH', {
        supabaseUserId,
        storedFirebaseUid: data.firebase_uid,
        providedFirebaseUid: firebaseUid,
      });
      throw new Error(
        `[IdentityMap] mismatch: stored firebase_uid=${data.firebase_uid}, current firebase_uid=${firebaseUid}`,
      );
    }

    log('ensureAndValidate: validated OK', { supabaseUserId, firebaseUid, email: data.email });
    return data as IdentityMapRow;
  }

  // Returns the stored Firebase UID for a Supabase user — for Firestore compatibility only.
  // Returns null for users who never had a Firebase account (new signups post-migration).
  static async getLegacyFirebaseUid(supabaseUserId: string): Promise<string | null> {
    const row = await AuthIdentityMapService.lookup(supabaseUserId);
    return row?.firebase_uid ?? null;
  }

  // Read-only lookup — useful for debugging without side effects.
  static async lookup(supabaseUserId: string): Promise<IdentityMapRow | null> {
    log('lookup', { supabaseUserId });
    const { data, error } = await supabase
      .from('auth_identity_map')
      .select('supabase_user_id,firebase_uid,email')
      .eq('supabase_user_id', supabaseUserId)
      .maybeSingle();

    if (error) {
      logError('lookup: failed', error);
      return null;
    }

    if (!data) {
      logWarn('lookup: no row found', { supabaseUserId });
      return null;
    }

    log('lookup: found', { supabaseUserId, firebaseUid: data.firebase_uid });
    return data as IdentityMapRow;
  }
}
