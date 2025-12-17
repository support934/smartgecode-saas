import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const { email, address } = payload;

  // Lazy load Stripe inside POST (runtime only)
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-11-17.clover' });

  // Quick key validation fallback (logs if missing)
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.startsWith('sk_live_') && process.env.NODE_ENV === 'development') {
    console.error('Stripe key missing or live in test mode');
    return NextResponse.json({ status: 'error', message: 'Configuration error' }, { status: 500 });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: 'price_1SdTlhA5JR9NQZvDky89Qo7u', quantity: 1 }],  // Your Price ID
      customer_email: email,
      success_url:'https://geocode-frontend.smartgeocode.io/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://geocode-frontend.smartgeocode.io?cancelled=true',
      metadata: { email, address },  // For webhook
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Stripe error:', error);
    return NextResponse.json({ status: 'error', message: 'Stripe failed' }, { status: 500 });
  }
}