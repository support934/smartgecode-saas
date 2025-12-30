import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  try {
    // Parse request body safely
    const payload = await request.json();
    const { email, address } = payload;

    // Required fields validation
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Check for Stripe secret key
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      console.error('STRIPE_SECRET_KEY is missing in environment variables');
      return NextResponse.json(
        { error: 'Server configuration error: Missing Stripe key' },
        { status: 500 }
      );
    }

    // Initialize Stripe
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-11-17.clover',
    });

    console.log(`Creating checkout session for email: ${email}`);

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription', // Use 'subscription' for recurring, 'payment' for one-time
      payment_method_types: ['card'],
      line_items: [
        {
          price: 'price_1SdTlhA5JR9NQZvDky89Qo7u',  // Your $29 recurring Price ID
          quantity: 1  
        },
      ],
      customer_email: email,
      success_url: 'https://geocode-frontend.smartgeocode.io/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://geocode-frontend.smartgeocode.io?cancelled=true',
      metadata: { email, address }, // Useful for webhooks
    });

    console.log(`Checkout session created: ${session.id}`);

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    // Detailed error logging
    console.error('Checkout route error:', {
      message: error.message,
      stack: error.stack,
      type: error.type,
      code: error.code,
    });

    // Return meaningful error to frontend
    const status = error.statusCode || 500;
    const message = error.message || 'An unexpected error occurred during checkout';

    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}