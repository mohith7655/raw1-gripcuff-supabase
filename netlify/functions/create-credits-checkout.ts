/**
 * netlify/functions/create-credits-checkout.ts
 *
 * Creates a Stripe Checkout Session for purchasing RAW1 credits (one-time payment).
 *
 * POST /.netlify/functions/create-credits-checkout
 * Body: { userId: string, credits: number, priceInCents: number }
 * Returns: { checkoutUrl: string }
 *
 * Required env vars (Netlify Dashboard → Site → Environment Variables):
 *   STRIPE_SECRET_KEY  – sk_test_… or sk_live_…
 *   URL                – auto-set by Netlify to the site's primary domain
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

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
        console.error('[create-credits-checkout] STRIPE_SECRET_KEY is not set');
        return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Server configuration error' }) };
    }

    let userId: string, credits: number, priceInCents: number;
    try {
        const body = JSON.parse(event.body ?? '{}');
        userId = body.userId;
        credits = Number(body.credits);
        priceInCents = Number(body.priceInCents);
        if (!userId || !credits || !priceInCents) throw new Error('Missing fields');
    } catch {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid request body' }) };
    }

    const appUrl =
        process.env.URL ||
        event.headers?.origin ||
        'https://raw1-supabase.netlify.app';

    try {
        const Stripe = require('stripe');
        const stripe = Stripe(stripeKey);

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    unit_amount: priceInCents,
                    product_data: {
                        name: `${credits} RAW1 Credits`,
                        description: `Add ${credits} credits to your RAW1 account`,
                    },
                },
                quantity: 1,
            }],
            metadata: {
                userId,
                credits: String(credits),
                type: 'credits_purchase',
            },
            success_url: `${appUrl}?payment=success&credits=${credits}`,
            cancel_url:  `${appUrl}?payment=cancelled`,
        });

        return {
            statusCode: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            body: JSON.stringify({ checkoutUrl: session.url }),
        };
    } catch (err: any) {
        console.error('[create-credits-checkout] Stripe error:', err?.message ?? err);
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: err?.message ?? 'Stripe error' }),
        };
    }
};
