import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const backendUrl = process.env.BACKEND_URL || 'https://api-java-production-fb09.up.railway.app';

  console.log('Proxying /api/create-portal-session for email:', body.email); // Debug

  try {
    const res = await fetch(`${backendUrl}/api/create-portal-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    console.log('Backend portal response:', data); // Debug response

    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('Portal proxy error:', err);
    return NextResponse.json({ error: 'Failed to create portal session' }, { status: 500 });
  }
}