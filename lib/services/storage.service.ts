import {
    ref,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject,
    listAll,
} from 'firebase/storage';
import { storage } from '../core/config/firebase';

export class StorageService {
    /**
     * Upload a profile picture from a local URI.
     * - Stores at: avatars/{uid}/{timestamp}.jpg
     * - Deletes any previous avatar for the user first.
     * - Calls onProgress(0–100) during upload.
     * Returns the public download URL.
     */
    static async uploadProfilePicture(
        uid: string,
        localUri: string,
        onProgress?: (pct: number) => void,
    ): Promise<string> {
        // Convert local file URI → Blob via XHR (fetch() is unreliable for file:// URIs in Expo)
        const blob: Blob = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.onload = () => resolve(xhr.response);
            xhr.onerror = () => reject(new Error('Failed to read image file'));
            xhr.responseType = 'blob';
            xhr.open('GET', localUri, true);
            xhr.send(null);
        });

        // Delete previous avatar files so storage doesn't accumulate
        try {
            const folderRef = ref(storage, `avatars/${uid}`);
            const existing = await listAll(folderRef);
            await Promise.all(existing.items.map((item) => deleteObject(item)));
        } catch {
            // Folder may not exist yet — safe to ignore
        }

        const timestamp = Date.now();
        const storageRef = ref(storage, `avatars/${uid}/${timestamp}.jpg`);

        await new Promise<void>((resolve, reject) => {
            const task = uploadBytesResumable(storageRef, blob, { contentType: 'image/jpeg' });
            task.on(
                'state_changed',
                (snap) => {
                    const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
                    onProgress?.(pct);
                },
                reject,
                resolve,
            );
        });

        return getDownloadURL(storageRef);
    }

    /**
     * Delete all avatar files for a user from Storage.
     * Silently succeeds if none exist.
     */
    static async deleteProfilePicture(uid: string): Promise<void> {
        try {
            const folderRef = ref(storage, `avatars/${uid}`);
            const existing = await listAll(folderRef);
            await Promise.all(existing.items.map((item) => deleteObject(item)));
        } catch (e: any) {
            if (e?.code !== 'storage/object-not-found') throw e;
        }
    }
}
