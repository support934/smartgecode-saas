import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const { email, address } = await request.json();
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeKey) {
    console.error('STRIPE_SECRET_KEY missing');
    return NextResponse.json({ status: 'error', message: 'Stripe key not configured' }, { status: 500 });
  }

  const stripe = new Stripe(stripeKey, {
    apiVersion: '2023-10-16'
  });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: 'price_12345', quantity: 1 }],  // Replace with your Stripe price ID (sandbox for test)
      customer_email: email,
      success_url: 'https://geocode-frontend.smartgeocode.io/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://geocode-frontend.smartgeocode.io/?canceled=true',
      metadata: { email, address },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Stripe error:', error);
    return NextResponse.json({ status: 'error', message: 'Checkout failed' }, { status: 500 });
  }
}