import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text(); // Read raw first
    console.log('Raw request body:', rawBody);

    const payload = JSON.parse(rawBody);
    console.log('Parsed payload:', payload);

    const { email, address } = payload;

    if (!email) {
      console.error('Missing email in request');
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!address) {
      console.error('Missing address in request');
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    // Validate email format (basic)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error('Invalid email format:', email);
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      console.error('STRIPE_SECRET_KEY missing');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-11-17.clover',
    });

    console.log('Creating Stripe session for:', { email, address });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',  // Changed back to recurring for $29/mo
      payment_method_types: ['card'],
      line_items: [
        {
          price: 'price_1Sd8JxA5JR9NQZvD0GCmjm6R',  // ← YOUR LIVE $29/mo RECURRING PRICE ID
          quantity: 1,
        },
      ],
      customer_email: email,
      success_url: 'https://geocode-frontend.smartgeocode.io/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://geocode-frontend.smartgeocode.io?cancelled=true',
      metadata: { email, address },  // For webhook
    });

    console.log('Session created:', session.id);

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Checkout error:', error.message, error.stack);
    return NextResponse.json(
      { error: error.message || 'Checkout failed' },
      { status: error.statusCode || 500 }
    );
  }
}