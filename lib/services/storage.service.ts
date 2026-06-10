import { supabase } from '../core/config/supabase';

export class StorageService {
    static async uploadProfilePicture(
        uid: string,
        localUri: string,
        onProgress?: (pct: number) => void,
    ): Promise<string> {
        console.log('avatar upload start');
        console.log('picked image', localUri);

        onProgress?.(10);
        const response = await fetch(localUri);
        const blob = await response.blob();
        onProgress?.(40);

        const path = `avatars/${uid}/${Date.now()}.jpg`;
        const { error } = await supabase.storage
            .from('avatars')
            .upload(path, blob, { contentType: 'image/jpeg' });

        if (error) {
            console.error('avatar upload failed', error);
            throw new Error(error.message);
        }

        onProgress?.(90);
        const { data } = supabase.storage.from('avatars').getPublicUrl(path);
        const publicUrl = data.publicUrl;
        console.log('upload success', publicUrl);
        onProgress?.(100);
        return publicUrl;
    }

    /** Upload one gallery photo to the public avatars bucket under gallery/<uid>/. */
    static async uploadGalleryPhoto(uid: string, localUri: string): Promise<string> {
        const response = await fetch(localUri);
        const blob = await response.blob();
        const path = `gallery/${uid}/${Date.now()}.jpg`;
        const { error } = await supabase.storage
            .from('avatars')
            .upload(path, blob, { contentType: 'image/jpeg' });

        if (error) {
            console.error('gallery upload failed', error);
            throw new Error(error.message);
        }
        const { data } = supabase.storage.from('avatars').getPublicUrl(path);
        return data.publicUrl;
    }

    /** Best-effort removal of an avatars-bucket object given its public URL. */
    static async deleteByPublicUrl(url: string): Promise<void> {
        const marker = '/object/public/avatars/';
        const path = url.includes(marker) ? url.split(marker)[1] : null;
        if (!path) return;
        await supabase.storage.from('avatars').remove([path]);
    }

    static async deleteProfilePicture(uid: string): Promise<void> {
        const { data, error } = await supabase.storage
            .from('avatars')
            .list(`avatars/${uid}`);

        if (error || !data?.length) return;

        const paths = data.map(f => `avatars/${uid}/${f.name}`);
        await supabase.storage.from('avatars').remove(paths);
    }
}
