/**
 * netlify/functions/create-checkout-session.ts
 *
 * Creates a Stripe Checkout session for the Raw1 monthly subscription.
 *
 * POST /.netlify/functions/create-checkout-session
 * Body: { userId: string }
 * Returns: { url: string }
 *
 * Required env var (set in Netlify dashboard):
 *   STRIPE_SECRET_KEY  – Stripe secret key (sk_live_… or sk_test_…)
 *
 * Netlify auto-sets URL to the site's primary domain (used for redirect URLs).
 */

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const handler = async (event: any): Promise<any> => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: CORS_HEADERS, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: 'Method not allowed. Use POST.' }),
        };
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
        console.error('[create-checkout-session] STRIPE_SECRET_KEY env var is not set');
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: 'Server configuration error: missing STRIPE_SECRET_KEY.' }),
        };
    }

    let userId: string | undefined;
    try {
        const body = JSON.parse(event.body ?? '{}');
        userId = body.userId;
    } catch {
        return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: 'Invalid JSON body.' }),
        };
    }

    // Netlify sets process.env.URL to the site's primary domain in production.
    // Fall back to the request origin for local netlify dev.
    const appUrl =
        process.env.URL ||
        event.headers?.origin ||
        'http://localhost:8081';

    try {
        // Dynamic import so esbuild can tree-shake on non-Node runtimes
        const Stripe = require('stripe');
        const stripe = Stripe(stripeKey);

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'subscription',
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: { name: 'Raw1 Monthly Subscription' },
                        unit_amount: 499,
                        recurring: { interval: 'month' },
                    },
                    quantity: 1,
                },
            ],
            metadata: { userId: userId ?? '' },
            success_url: `${appUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${appUrl}?payment=cancelled`,
        });

        return {
            statusCode: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: session.url }),
        };
    } catch (err: any) {
        console.error('[create-checkout-session] Stripe error:', err?.message ?? err);
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: err?.message ?? 'Stripe error' }),
        };
    }
};
