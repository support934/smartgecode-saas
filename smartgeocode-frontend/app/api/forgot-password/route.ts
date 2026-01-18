import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { email } = body;

    if (!email) {
      return NextResponse.json({ message: 'Missing email' }, { status: 400 });
    }

    // Normalize email to lowercase and trim
    email = email.toLowerCase().trim();

    const backendUrl = process.env.BACKEND_URL || 'https://api-java-production-fb09.up.railway.app';

    console.log(`Proxying forgot-password for email: ${email}`);

    const res = await fetch(`${backendUrl}/api/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();

    console.log('Backend forgot-password response:', data);

    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('Forgot-password proxy error:', err);
    return NextResponse.json({ message: 'Network error—try again' }, { status: 500 });
  }
}