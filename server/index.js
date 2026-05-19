require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const app = express();

app.use(cors());
app.use(express.json());

app.post('/create-checkout-session', async (req, res) => {
  const { successUrl, cancelUrl } = req.body;

  if (!successUrl) {
    return res.status(400).json({ error: 'successUrl is required' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Raw1 Fitness Training',
              description: 'Unlimited workouts, stretch & rehab programs, new content every week.',
            },
            unit_amount: 499, // $4.99 in cents
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
      success_url: `${successUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || successUrl,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Raw1 payment server running on http://localhost:${PORT}`);
});
