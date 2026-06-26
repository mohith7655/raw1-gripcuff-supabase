/**
 * netlify/functions/send-web-push.ts
 *
 * Delivers a Web Push notification to every browser/PWA the recipient has
 * subscribed (web_push_subscriptions). Called by NotificationService.insert on
 * the sender's client right after the in-app notification row is written.
 *
 * POST /.netlify/functions/send-web-push
 * Body: { toUid: string, title: string, body: string, data?: object }
 * Returns: { delivered: number, removed: number }
 *
 * Required env vars (Netlify Dashboard → Environment variables):
 *   SUPABASE_URL              – same value as EXPO_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY – service-role key (server-only; bypasses RLS)
 *   VAPID_PUBLIC_KEY          – VAPID public key  (same as EXPO_PUBLIC_VAPID_PUBLIC_KEY)
 *   VAPID_PRIVATE_KEY         – VAPID private key (server-only, secret)
 *   VAPID_SUBJECT             – contact URI, e.g. "mailto:raman@raw1.us"
 */

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (statusCode: number, payload: any) => ({
    statusCode,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
});

export const handler = async (event: any): Promise<any> => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: CORS_HEADERS, body: '' };
    }
    if (event.httpMethod !== 'POST') {
        return json(405, { error: 'Method not allowed' });
    }

    const supabaseUrl  = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
    const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const vapidPublic  = process.env.VAPID_PUBLIC_KEY || process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:raman@raw1.us';

    if (!supabaseUrl || !serviceKey || !vapidPublic || !vapidPrivate) {
        console.error('[send-web-push] Missing env vars', {
            hasSupabaseUrl: !!supabaseUrl,
            hasServiceKey: !!serviceKey,
            hasVapidPublic: !!vapidPublic,
            hasVapidPrivate: !!vapidPrivate,
        });
        return json(500, { error: 'Server configuration error' });
    }

    let toUid: string, title: string, body: string, data: any;
    try {
        const parsed = JSON.parse(event.body ?? '{}');
        toUid = parsed.toUid;
        title = parsed.title ?? 'RAW1';
        body  = parsed.body ?? '';
        data  = parsed.data ?? {};
        if (!toUid) throw new Error('Missing toUid');
    } catch {
        return json(400, { error: 'Invalid request body' });
    }

    const webpush = require('web-push');
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, serviceKey);

    // Look up the recipient's browser subscriptions (service role → bypasses RLS).
    const { data: rows, error } = await supabase
        .from('web_push_subscriptions')
        .select('id, endpoint, p256dh, auth')
        .eq('user_id', toUid);

    if (error) {
        console.error('[send-web-push] subscription lookup failed:', error.message);
        return json(500, { error: 'Lookup failed' });
    }
    if (!rows || rows.length === 0) {
        return json(200, { delivered: 0, removed: 0 });
    }

    const payload = JSON.stringify({
        title,
        body,
        url: '/',
        tag: data?.chatId ? `chat:${data.chatId}` : data?.type || 'raw1',
        ...data,
    });

    let delivered = 0;
    const deadIds: string[] = [];

    await Promise.all(
        rows.map(async (row: any) => {
            const subscription = {
                endpoint: row.endpoint,
                keys: { p256dh: row.p256dh, auth: row.auth },
            };
            try {
                await webpush.sendNotification(subscription, payload);
                delivered++;
            } catch (err: any) {
                const status = err?.statusCode;
                // 404/410 → subscription is gone; prune it so we stop trying.
                if (status === 404 || status === 410) {
                    deadIds.push(row.id);
                } else {
                    console.warn('[send-web-push] send failed:', status, err?.body ?? err?.message);
                }
            }
        }),
    );

    if (deadIds.length > 0) {
        await supabase.from('web_push_subscriptions').delete().in('id', deadIds);
    }

    return json(200, { delivered, removed: deadIds.length });
};
