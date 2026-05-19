const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

app.post('/create-checkout-session', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: 'Raw1 Monthly Subscription' },
          unit_amount: 499,
          recurring: { interval: 'month' }
        },
        quantity: 1
      }],
      success_url: `${process.env.APP_URL || 'http://localhost:8081'}?payment=success`,
      cancel_url: `${process.env.APP_URL || 'http://localhost:8081'}?payment=cancelled`
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, () =>
  console.log('Stripe server running on port 3001'));
