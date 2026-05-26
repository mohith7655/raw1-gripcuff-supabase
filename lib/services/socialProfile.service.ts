/**
 * SocialProfileService
 *
 * All social and place fields now live in the `profiles` table.
 * Single-query approach — no more dual users/profiles split.
 */

import { supabase } from '../core/config/supabase';
import { SocialProfile } from '../models/SocialProfile';

const numberOrNull = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
};

const slugify = (value: string): string => {
    const normalized = String(value || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/_{2,}/g, '_');
    return normalized || 'raw1_user';
};

const randomSuffix = () => Math.random().toString(16).slice(2, 6);

const fromRow = (row: any): SocialProfile => ({
    uid: row.id,
    qrSlug: row.qr_slug ?? null,
    bio: row.bio ?? null,
    whatIDo: row.what_i_do ?? null,
    openToConnect: row.open_to_connect ?? false,
    lookingToMeet: row.looking_to_meet ?? null,
    connectionGoals: Array.isArray(row.connection_goals) ? row.connection_goals : [],
    gymPlaceId: row.gym_place_id ?? null,
    gymName: row.gym_name ?? null,
    gymArea: row.gym_area ?? null,
    gymAddress: row.gym_address ?? null,
    gymLat: numberOrNull(row.gym_lat),
    gymLng: numberOrNull(row.gym_lng),
    housePlaceId: row.house_place_id ?? null,
    houseName: row.house_name ?? null,
    houseAddress: row.house_address ?? null,
    houseLat: numberOrNull(row.house_lat),
    houseLng: numberOrNull(row.house_lng),
    parkPlaceId: row.park_place_id ?? null,
    parkName: row.park_name ?? null,
    parkAddress: row.park_address ?? null,
    parkLat: numberOrNull(row.park_lat),
    parkLng: numberOrNull(row.park_lng),
    hobbies: Array.isArray(row.hobbies) ? row.hobbies : [],
    communityNote: row.community_note ?? null,
    helpingBeginners: row.helping_beginners ?? false,
    openToMentor: row.open_to_mentor ?? false,
    openToTrainAgeGroups: Array.isArray(row.open_to_train_age_groups) ? row.open_to_train_age_groups : [],
    city: row.city ?? null,
    country: row.country ?? null,
});

const ALL_COLS = [
    'id',
    'qr_slug',
    'bio',
    'what_i_do',
    'open_to_connect',
    'looking_to_meet',
    'connection_goals',
    'gym_name',
    'gym_area',
    'gym_place_id',
    'gym_address',
    'gym_lat',
    'gym_lng',
    'house_place_id',
    'house_name',
    'house_address',
    'house_lat',
    'house_lng',
    'park_place_id',
    'park_name',
    'park_address',
    'park_lat',
    'park_lng',
    'hobbies',
    'community_note',
    'helping_beginners',
    'open_to_mentor',
    'open_to_train_age_groups',
    'city',
    'country',
].join(', ');

export class SocialProfileService {
    static async ensureQrSlug(uid: string, seed?: string | null): Promise<string> {
        if (!uid) throw new Error('Missing uid for qr_slug generation');

        const { data: existing, error: existingErr } = await supabase
            .from('profiles')
            .select('id, qr_slug, username, full_name')
            .eq('id', uid)
            .maybeSingle();

        if (existingErr) throw new Error(existingErr.message);
        if (existing?.qr_slug) return existing.qr_slug;

        const base = slugify(seed || existing?.username || existing?.full_name || 'raw1_user');
        let candidate = base;

        for (let attempt = 0; attempt < 8; attempt++) {
            const { data: taken, error: takenErr } = await supabase
                .from('profiles')
                .select('id')
                .eq('qr_slug', candidate)
                .neq('id', uid)
                .maybeSingle();

            if (takenErr) throw new Error(takenErr.message);
            if (!taken) break;
            candidate = `${base}_${randomSuffix()}`;
        }

        const { error: upsertErr } = await supabase
            .from('profiles')
            .upsert({ id: uid, qr_slug: candidate }, { onConflict: 'id' });
        if (upsertErr) throw new Error(upsertErr.message);

        return candidate;
    }

    static async resolveUidBySlug(slug: string): Promise<string | null> {
        const clean = String(slug || '').trim();
        if (!clean) return null;
        const { data, error } = await supabase
            .from('profiles')
            .select('id')
            .eq('qr_slug', clean)
            .maybeSingle();

        if (error) {
            console.warn('[SocialProfile] resolveUidBySlug error:', error.message);
            return null;
        }
        return data?.id ?? null;
    }

    static async get(uid: string): Promise<SocialProfile | null> {
        const { data, error } = await supabase
            .from('profiles')
            .select(ALL_COLS)
            .eq('id', uid)
            .maybeSingle();

        if (error) {
            console.warn('[SocialProfile] get error:', error.message);
            return null;
        }
        return data ? fromRow(data) : null;
    }

    static async update(uid: string, patch: Partial<Omit<SocialProfile, 'uid'>>): Promise<void> {
        const payload: Record<string, unknown> = {};

        // Social fields
        if (patch.bio !== undefined)                    payload.bio = patch.bio;
        if (patch.whatIDo !== undefined)                payload.what_i_do = patch.whatIDo;
        if (patch.openToConnect !== undefined)          payload.open_to_connect = patch.openToConnect;
        if (patch.lookingToMeet !== undefined)          payload.looking_to_meet = patch.lookingToMeet;
        if (patch.connectionGoals !== undefined)        payload.connection_goals = patch.connectionGoals;
        if (patch.gymName !== undefined)                payload.gym_name = patch.gymName;
        if (patch.gymArea !== undefined)                payload.gym_area = patch.gymArea;
        if (patch.hobbies !== undefined)                payload.hobbies = patch.hobbies;
        if (patch.communityNote !== undefined)          payload.community_note = patch.communityNote;
        if (patch.helpingBeginners !== undefined)       payload.helping_beginners = patch.helpingBeginners;
        if (patch.openToMentor !== undefined)           payload.open_to_mentor = patch.openToMentor;
        if (patch.openToTrainAgeGroups !== undefined)   payload.open_to_train_age_groups = patch.openToTrainAgeGroups;

        // Place fields
        if (patch.gymPlaceId !== undefined)             payload.gym_place_id = patch.gymPlaceId;
        if (patch.gymAddress !== undefined)             payload.gym_address = patch.gymAddress;
        if (patch.gymLat !== undefined)                 payload.gym_lat = patch.gymLat;
        if (patch.gymLng !== undefined)                 payload.gym_lng = patch.gymLng;
        if (patch.housePlaceId !== undefined)           payload.house_place_id = patch.housePlaceId;
        if (patch.houseName !== undefined)              payload.house_name = patch.houseName;
        if (patch.houseAddress !== undefined)           payload.house_address = patch.houseAddress;
        if (patch.houseLat !== undefined)               payload.house_lat = patch.houseLat;
        if (patch.houseLng !== undefined)               payload.house_lng = patch.houseLng;
        if (patch.parkPlaceId !== undefined)            payload.park_place_id = patch.parkPlaceId;
        if (patch.parkName !== undefined)               payload.park_name = patch.parkName;
        if (patch.parkAddress !== undefined)            payload.park_address = patch.parkAddress;
        if (patch.parkLat !== undefined)                payload.park_lat = patch.parkLat;
        if (patch.parkLng !== undefined)                payload.park_lng = patch.parkLng;
        if (patch.city !== undefined)                   payload.city = patch.city;
        if (patch.country !== undefined)                payload.country = patch.country;

        if (Object.keys(payload).length === 0) return;

        const { error } = await supabase
            .from('profiles')
            .upsert({ id: uid, ...payload }, { onConflict: 'id' });

        if (error) throw new Error(error.message);
    }

    static async getSuggestions(
        uid: string,
        excludeUids: string[],
        limit = 20,
    ): Promise<Array<SocialProfile & {
        fullName: string;
        username: string;
        avatarUrl: string | null;
        currentStreak: number;
        completedWorkouts: number;
    }>> {
        const allExclude = [uid, ...excludeUids];

        const { data, error } = await supabase
            .from('profiles')
            .select([
                'id',
                'full_name',
                'username',
                'avatar_url',
                'bio',
                'what_i_do',
                'open_to_connect',
                'looking_to_meet',
                'connection_goals',
                'gym_name',
                'gym_area',
                'hobbies',
                'community_note',
                'helping_beginners',
                'open_to_mentor',
                'open_to_train_age_groups',
            ].join(', '))
            .eq('open_to_connect', true)
            .limit(limit + allExclude.length);

        if (error) {
            console.warn('[SocialProfile] getSuggestions error:', error.message);
            return [];
        }

        return (data ?? [])
            .filter((row: any) => !allExclude.includes(row.id))
            .slice(0, limit)
            .map((row: any) => ({
                ...fromRow(row),
                fullName: row.full_name || 'User',
                username: row.username || '',
                avatarUrl: row.avatar_url ?? null,
                currentStreak: 0,
                completedWorkouts: 0,
            }));
    }
}
