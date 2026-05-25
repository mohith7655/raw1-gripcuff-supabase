/**
 * netlify/functions/stripe-webhook.ts
 *
 * Receives Stripe webhook events and writes access records to Supabase.
 * This is the authoritative server-side confirmation that payment succeeded —
 * required for native apps where URL redirect detection is unreliable.
 *
 * Stripe Dashboard → Developers → Webhooks → Add endpoint:
 *   URL:    https://<your-site>.netlify.app/.netlify/functions/stripe-webhook
 *   Events: checkout.session.completed, customer.subscription.deleted
 *
 * Required environment variables (Netlify Dashboard → Site → Environment Variables):
 *   STRIPE_SECRET_KEY        – sk_test_… or sk_live_…
 *   STRIPE_WEBHOOK_SECRET    – whsec_… (from Stripe webhook page, optional but recommended)
 *   SUPABASE_URL             – https://xxx.supabase.co  (same as EXPO_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY – service_role key (Settings → API, NOT the anon key)
 */

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, stripe-signature',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const handler = async (event: any): Promise<any> => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: CORS_HEADERS, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers: CORS_HEADERS, body: 'Method Not Allowed' };
    }

    // ── Validate env vars ────────────────────────────────────────────────────────

    const stripeKey    = process.env.STRIPE_SECRET_KEY;
    const webhookSec   = process.env.STRIPE_WEBHOOK_SECRET;     // optional but strongly recommended
    const supabaseUrl  = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
    const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!stripeKey || !supabaseUrl || !serviceKey) {
        console.error('[stripe-webhook] Missing env vars:', {
            hasStripeKey: !!stripeKey,
            hasSupabaseUrl: !!supabaseUrl,
            hasServiceKey: !!serviceKey,
        });
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: 'Server configuration error.' }),
        };
    }

    // ── Parse and verify Stripe event ────────────────────────────────────────────

    const Stripe     = require('stripe');
    const stripe     = Stripe(stripeKey);
    const { createClient } = require('@supabase/supabase-js');
    const supabase   = createClient(supabaseUrl, serviceKey);

    let stripeEvent: any;
    try {
        if (webhookSec) {
            const sig = event.headers['stripe-signature'];
            // Stripe requires the raw body string for signature verification
            stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSec);
        } else {
            // Without webhook secret, parse as JSON (less secure — use only for local dev)
            console.warn('[stripe-webhook] STRIPE_WEBHOOK_SECRET not set — skipping signature verification');
            stripeEvent = JSON.parse(event.body);
        }
    } catch (err: any) {
        console.error('[stripe-webhook] Signature verification failed:', err.message);
        return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: `Webhook error: ${err.message}` }),
        };
    }

    console.log('[stripe-webhook] event received:', stripeEvent.type);

    // ── Handle events ────────────────────────────────────────────────────────────

    try {
        if (stripeEvent.type === 'checkout.session.completed') {
            const session = stripeEvent.data.object;
            const userId  = session.metadata?.userId;

            if (!userId) {
                console.warn('[stripe-webhook] checkout.session.completed: no userId in metadata — skipping');
                return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ received: true }) };
            }

            console.log('[stripe-webhook] granting subscription access for user:', userId);

            // Write to user_access (source of truth — Realtime notifies the app)
            const { error: uaErr } = await supabase.from('user_access').upsert({
                user_id:                userId,
                access_type:            'subscription',
                stripe_customer_id:     session.customer      ?? null,
                stripe_subscription_id: session.subscription  ?? null,
                stripe_session_id:      session.id            ?? null,
                is_active:              true,
                granted_at:             new Date().toISOString(),
                updated_at:             new Date().toISOString(),
            }, { onConflict: 'user_id' });

            if (uaErr) {
                console.error('[stripe-webhook] user_access upsert failed:', uaErr.message);
                return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: uaErr.message }) };
            }

            // Mirror on users table for fast boot-time check
            const { error: usrErr } = await supabase
                .from('users')
                .update({ has_access: true, access_type: 'subscription' })
                .eq('id', userId);

            if (usrErr) console.error('[stripe-webhook] users.has_access update failed:', usrErr.message);

            console.log('[stripe-webhook] ✓ subscription access granted for user:', userId);

        } else if (stripeEvent.type === 'customer.subscription.deleted') {
            const sub = stripeEvent.data.object;

            console.log('[stripe-webhook] subscription cancelled:', sub.id);

            const { error } = await supabase
                .from('user_access')
                .update({
                    is_active:  false,
                    updated_at: new Date().toISOString(),
                })
                .eq('stripe_subscription_id', sub.id);

            if (error) console.error('[stripe-webhook] user_access cancel failed:', error.message);

            // Mirror on users table
            const { data: row } = await supabase
                .from('user_access')
                .select('user_id')
                .eq('stripe_subscription_id', sub.id)
                .maybeSingle();

            if (row?.user_id) {
                await supabase
                    .from('users')
                    .update({ has_access: false, access_type: null })
                    .eq('id', row.user_id);
            }

        } else {
            console.log('[stripe-webhook] unhandled event type:', stripeEvent.type);
        }
    } catch (err: any) {
        console.error('[stripe-webhook] handler error:', err?.message ?? err);
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: err?.message ?? 'Internal error' }),
        };
    }

    return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ received: true }),
    };
};
