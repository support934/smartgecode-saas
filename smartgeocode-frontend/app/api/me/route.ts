import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let email = searchParams.get('email');

  if (!email) {
    return NextResponse.json({ message: 'Missing email parameter' }, { status: 400 });
  }

  // Normalize email
  email = email.toLowerCase().trim();

  // Basic email validation (optional but good for security)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ message: 'Invalid email format' }, { status: 400 });
  }

  const backendUrl = process.env.BACKEND_URL || 'https://smartgeocode-backend.up.railway.app';

  try {
    console.log(`Proxying /api/me request for email: ${email}`);

    const res = await fetch(`${backendUrl}/api/me?email=${encodeURIComponent(email)}`, {
      cache: 'no-store', // Prevent caching backend response
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Backend /me failed with status ${res.status}: ${errorText}`);
      return NextResponse.json({ message: 'Backend error - please try again' }, { status: res.status });
    }

    const data = await res.json();
    console.log(`Backend /me response for ${email}:`, data); // Debug log

    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    console.error('Proxy error for /api/me:', err);
    return NextResponse.json({ message: 'Failed to fetch user data - check connection' }, { status: 500 });
  }
}