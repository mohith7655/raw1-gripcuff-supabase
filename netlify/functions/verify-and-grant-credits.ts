/**
 * netlify/functions/verify-and-grant-credits.ts
 *
 * Safety-net fallback: verifies a recent Stripe Checkout Session for this user
 * and grants credits if the webhook missed it. Idempotent — safe to call
 * multiple times thanks to the unique index on stripe_payment_intent_id.
 *
 * POST /.netlify/functions/verify-and-grant-credits
 * Headers: Authorization: Bearer <supabase_access_token>
 * Body: { userId: string, expectedCredits: number }
 * Returns: { granted: boolean }
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY         – sk_test_… or sk_live_…
 *   SUPABASE_URL              – https://xxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY – service_role key (NOT anon key)
 */

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const handler = async (event: any): Promise<any> => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: CORS_HEADERS, body: '' };
    }
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    const stripeKey  = process.env.STRIPE_SECRET_KEY;
    const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!stripeKey || !supabaseUrl || !serviceKey) {
        console.error('[verify-and-grant-credits] Missing env vars');
        return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Server configuration error' }) };
    }

    let userId: string, expectedCredits: number;
    try {
        const body = JSON.parse(event.body ?? '{}');
        userId = body.userId;
        expectedCredits = Number(body.expectedCredits);
        if (!userId || !expectedCredits) throw new Error('Missing fields');
    } catch {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid request body' }) };
    }

    const Stripe = require('stripe');
    const stripe = Stripe(stripeKey);
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, serviceKey);

    try {
        // List the 5 most recent checkout sessions and find one paid in the last 10 min
        const sessions = await stripe.checkout.sessions.list({ limit: 5 });
        const tenMinutesAgo = Math.floor(Date.now() / 1000) - 600;

        const recentSession = sessions.data.find((s: any) =>
            s.metadata?.userId === userId &&
            s.metadata?.type === 'credits_purchase' &&
            s.payment_status === 'paid' &&
            s.created > tenMinutesAgo
        );

        if (!recentSession) {
            console.log('[verify-and-grant-credits] No recent paid session found for user:', userId);
            return {
                statusCode: 200,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
                body: JSON.stringify({ granted: false }),
            };
        }

        const paymentIntentId = recentSession.payment_intent as string;
        const credits = Number(recentSession.metadata.credits);

        // Idempotency check — did webhook already grant this?
        const { data: existing } = await supabase
            .from('credit_transactions')
            .select('id')
            .eq('stripe_payment_intent_id', paymentIntentId)
            .maybeSingle();

        if (existing) {
            // Already granted — tell client credits are there (may need a UI refresh)
            console.log('[verify-and-grant-credits] Already granted for payment_intent:', paymentIntentId);
            return {
                statusCode: 200,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
                body: JSON.stringify({ granted: true }),
            };
        }

        // Grant credits via RPC
        const { error: rpcErr } = await supabase.rpc('increment_credits', {
            p_user_id:     userId,
            p_amount:      credits,
            p_description: `Credits purchase (manual verify, session: ${recentSession.id})`,
        });

        if (rpcErr) {
            console.error('[verify-and-grant-credits] increment_credits failed:', rpcErr.message);
            return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: rpcErr.message }) };
        }

        // Log with payment_intent_id for idempotency on future calls
        await supabase.from('credit_transactions').insert({
            user_id:                   userId,
            amount:                    credits,
            type:                      'purchase',
            description:               'Credits purchase (manual verify)',
            stripe_payment_intent_id:  paymentIntentId,
        });

        console.log('[verify-and-grant-credits] ✓ credits granted for user:', userId, 'amount:', credits);

        return {
            statusCode: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            body: JSON.stringify({ granted: true }),
        };
    } catch (err: any) {
        console.error('[verify-and-grant-credits] error:', err?.message ?? err);
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: err?.message ?? 'Internal error' }),
        };
    }
};
