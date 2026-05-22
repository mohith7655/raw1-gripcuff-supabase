import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../core/config/supabase';

const TAG = '[PushToken]';

export class PushTokenService {
    /**
     * Request permission, get the Expo push token, and upsert it into
     * user_push_tokens. No-op on web (Expo push tokens are native-only).
     */
    static async registerAndSave(uid: string): Promise<void> {
        if (Platform.OS === 'web') return;

        try {
            const { status: existing } = await Notifications.getPermissionsAsync();
            let finalStatus = existing;

            if (existing !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                console.log(`${TAG} permission not granted — skipping token save`);
                return;
            }

            const tokenData = await Notifications.getExpoPushTokenAsync();
            const token = tokenData.data;
            console.log(`${TAG} token obtained`, { uid, prefix: token.slice(0, 30) });

            const { error } = await supabase
                .from('user_push_tokens')
                .upsert(
                    { user_id: uid, token, platform: Platform.OS, updated_at: new Date().toISOString() },
                    { onConflict: 'user_id' },
                );

            if (error) {
                console.warn(`${TAG} save failed:`, error.message);
            } else {
                console.log(`${TAG} token saved for uid`, uid);
            }
        } catch (e) {
            console.warn(`${TAG} registration error:`, e);
        }
    }
}
