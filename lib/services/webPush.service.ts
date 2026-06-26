/**
 * webPush.service — browser/PWA Web Push subscription (web only).
 *
 * On the Netlify-hosted web app, Expo push tokens don't exist, so background
 * notifications (app closed / tab unfocused) need the W3C Push API instead:
 *
 *   1. Ensure the service worker (public/sw.js) is registered.
 *   2. Ask for Notification permission.
 *   3. Subscribe via pushManager with our VAPID public key.
 *   4. Persist the subscription (endpoint + keys) in web_push_subscriptions.
 *
 * Delivery is handled server-side by netlify/functions/send-web-push.ts, which
 * looks the rows up by user and POSTs to each endpoint with the VAPID private key.
 *
 * Everything here is best-effort and a no-op off-web — callers never need to await.
 */
import { Platform } from 'react-native';
import { supabase } from '../core/config/supabase';

const TAG = '[WebPush]';

// Public key is safe to ship to the client (EXPO_PUBLIC_ prefix exposes it).
const VAPID_PUBLIC_KEY = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY || '';

/** Convert a base64url VAPID key to the Uint8Array applicationServerKey expects. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
}

export class WebPushService {
    /**
     * Subscribe this browser to push and save it for `uid`. Safe to call on every
     * login — re-subscribing returns the existing subscription and the upsert is
     * idempotent on the endpoint.
     */
    static async registerAndSave(uid: string): Promise<void> {
        if (Platform.OS !== 'web') return;

        try {
            if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
                console.log(`${TAG} push not supported in this browser — skipping`);
                return;
            }
            if (!VAPID_PUBLIC_KEY) {
                console.warn(`${TAG} EXPO_PUBLIC_VAPID_PUBLIC_KEY missing — cannot subscribe`);
                return;
            }

            // Permission — only prompt if not already decided.
            let permission = Notification.permission;
            if (permission === 'default') {
                permission = await Notification.requestPermission();
            }
            if (permission !== 'granted') {
                console.log(`${TAG} permission '${permission}' — skipping subscription`);
                return;
            }

            const reg = await navigator.serviceWorker.ready;

            // Reuse an existing subscription, else create one.
            let sub = await reg.pushManager.getSubscription();
            if (!sub) {
                sub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
                });
            }

            const json = sub.toJSON();
            const endpoint = json.endpoint;
            const p256dh = json.keys?.p256dh;
            const auth = json.keys?.auth;
            if (!endpoint || !p256dh || !auth) {
                console.warn(`${TAG} incomplete subscription — not saving`);
                return;
            }

            const { error } = await supabase
                .from('web_push_subscriptions')
                .upsert(
                    {
                        user_id: uid,
                        endpoint,
                        p256dh,
                        auth,
                        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
                        updated_at: new Date().toISOString(),
                    },
                    { onConflict: 'endpoint' },
                );

            if (error) console.warn(`${TAG} save failed:`, error.message);
            else console.log(`${TAG} subscription saved for uid`, uid);
        } catch (e) {
            console.warn(`${TAG} registration error:`, e);
        }
    }
}
