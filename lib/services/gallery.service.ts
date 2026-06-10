import { supabase } from '../core/config/supabase';

export interface ProfilePhoto {
    id: string;
    url: string;
    sortOrder: number;
}

/** User-uploaded gallery photos shown on the profile (profile_photos table). */
export class GalleryService {
    static async list(uid: string): Promise<ProfilePhoto[]> {
        const { data, error } = await supabase
            .from('profile_photos')
            .select('id, url, sort_order')
            .eq('user_id', uid)
            .order('sort_order', { ascending: true });

        if (error) {
            console.warn('[Gallery] list error:', error.message);
            return [];
        }
        return (data ?? []).map((r: any) => ({
            id: r.id,
            url: r.url,
            sortOrder: r.sort_order ?? 0,
        }));
    }

    static async add(uid: string, url: string, sortOrder: number): Promise<ProfilePhoto> {
        const { data, error } = await supabase
            .from('profile_photos')
            .insert({ user_id: uid, url, sort_order: sortOrder })
            .select('id, url, sort_order')
            .single();

        if (error) {
            console.warn('[Gallery] add error:', error.message);
            throw error;
        }
        return { id: data.id, url: data.url, sortOrder: data.sort_order ?? 0 };
    }

    static async remove(id: string): Promise<void> {
        const { error } = await supabase.from('profile_photos').delete().eq('id', id);
        if (error) {
            console.warn('[Gallery] remove error:', error.message);
            throw error;
        }
    }
}
