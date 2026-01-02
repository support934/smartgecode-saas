import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

// Handle OPTIONS pre-flight (CORS) requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',  // Or your frontend domain
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
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
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: 'price_1Sd8JxA5JR9NQZvD0GCmjm6R',  // Your live $29/mo recurring Price ID
          quantity: 1,
        },
      ],
      customer_email: email,
      success_url: 'https://geocode-frontend.smartgeocode.io/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://geocode-frontend.smartgeocode.io?cancelled=true',
      metadata: { email, address },
    });

    console.log('Session created:', session.id);

    // Call backend to store customer ID (adjust URL to your Railway backend)
    await fetch('https://smartgeocode-backend.up.railway.app/api/set-customer-id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        customerId: session.customer, // from session
      }),
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Checkout error:', error.message, error.stack);
    return NextResponse.json(
      { error: error.message || 'Checkout failed' },
      { status: error.statusCode || 500 }
    );
  }
}