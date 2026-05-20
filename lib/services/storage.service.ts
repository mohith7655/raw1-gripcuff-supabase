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

    static async deleteProfilePicture(uid: string): Promise<void> {
        const { data, error } = await supabase.storage
            .from('avatars')
            .list(`avatars/${uid}`);

        if (error || !data?.length) return;

        const paths = data.map(f => `avatars/${uid}/${f.name}`);
        await supabase.storage.from('avatars').remove(paths);
    }
}
