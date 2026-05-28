// Netlify env vars required:
// STRIPE_SECRET_KEY        = sk_test_...
// SUPABASE_URL             = https://dyjfzuzrjgwjmhojhmjj.supabase.co
// SUPABASE_SERVICE_ROLE_KEY = eyJ...

/**
 * netlify/functions/verify-and-grant-credits.ts
 *
 * Safety-net fallback: verifies a recent Stripe Checkout Session for this user
 * and grants credits if the webhook missed it. Idempotent — safe to call
 * multiple times thanks to the unique index on stripe_payment_intent_id.
 *
 * Called from:
 *   1. HomeScreen on app launch when ?payment=success&credits=N is in the URL
 *   2. BuyCreditsModal after polling exhausts (manual "Add Credits" button)
 *
 * POST /.netlify/functions/verify-and-grant-credits
 * Headers: Authorization: Bearer <supabase_access_token>
 * Body: { userId: string, expectedCredits: number, paymentIntentId?: string }
 * Returns: { granted: boolean }
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

    const stripeKey   = process.env.STRIPE_SECRET_KEY;
    const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!stripeKey || !supabaseUrl || !serviceKey) {
        console.error('[verify-and-grant-credits] Missing env vars', {
            hasStripeKey: !!stripeKey,
            hasSupabaseUrl: !!supabaseUrl,
            hasServiceKey: !!serviceKey,
        });
        return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Server configuration error' }) };
    }

    let userId: string, expectedCredits: number, paymentIntentId: string | undefined;
    try {
        const body = JSON.parse(event.body ?? '{}');
        userId          = body.userId;
        expectedCredits = Number(body.expectedCredits ?? body.credits ?? 0);
        paymentIntentId = body.paymentIntentId ?? undefined;
        if (!userId || !expectedCredits) throw new Error('Missing fields');
    } catch {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid request body' }) };
    }

    const Stripe = require('stripe');
    const stripe = Stripe(stripeKey);
    const { createClient } = require('@supabase/supabase-js');
    // Use service role key so RLS doesn't block credit_transactions insert
    const supabase = createClient(supabaseUrl, serviceKey);

    try {
        let resolvedPaymentIntentId: string | null = paymentIntentId ?? null;
        let credits = expectedCredits;

        if (resolvedPaymentIntentId) {
            // Fast path: caller supplied the payment intent ID — verify it directly
            const pi = await stripe.paymentIntents.retrieve(resolvedPaymentIntentId);
            if (pi.status !== 'succeeded') {
                console.log('[verify-and-grant-credits] payment_intent not succeeded:', pi.status);
                return {
                    statusCode: 200,
                    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ granted: false }),
                };
            }
        } else {
            // Search path: find the most recent paid checkout session for this user
            const sessions = await stripe.checkout.sessions.list({ limit: 10 });
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

            resolvedPaymentIntentId = recentSession.payment_intent as string;
            credits = Number(recentSession.metadata?.credits ?? expectedCredits);
        }

        // Idempotency check — did webhook already grant this?
        if (resolvedPaymentIntentId) {
            const { data: existing } = await supabase
                .from('credit_transactions')
                .select('id')
                .eq('stripe_payment_intent_id', resolvedPaymentIntentId)
                .maybeSingle();

            if (existing) {
                console.log('[verify-and-grant-credits] Already granted for payment_intent:', resolvedPaymentIntentId);
                return {
                    statusCode: 200,
                    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ granted: true }),
                };
            }
        }

        // Grant credits via RPC
        const { error: rpcErr } = await supabase.rpc('increment_credits', {
            p_user_id:     userId,
            p_amount:      credits,
            p_description: `Purchased ${credits} credits (verified via Stripe API)`,
        });

        if (rpcErr) {
            console.error('[verify-and-grant-credits] increment_credits failed:', rpcErr.message);
            return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: rpcErr.message }) };
        }

        // Log transaction with payment_intent_id for idempotency
        if (resolvedPaymentIntentId) {
            await supabase.from('credit_transactions').insert({
                user_id:                  userId,
                amount:                   credits,
                type:                     'purchase',
                description:              'Credits purchase (verify-and-grant)',
                stripe_payment_intent_id: resolvedPaymentIntentId,
            });
        }

        console.log('[verify-and-grant-credits] credits granted for user:', userId, 'amount:', credits);

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
