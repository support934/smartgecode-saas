import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    // 1. Get Auth Header (Optional, but good for security later)
    const authHeader = request.headers.get('authorization');

    // 2. Define Backend URL (Dynamic)
    // We check the variable first. If missing, we fall back to your DEV URL (with the typo).
    const baseUrl = process.env.BACKEND_URL || 
                    process.env.NEXT_PUBLIC_BACKEND_URL || 
                    'https://dev-smartgecode-saas-production.up.railway.app';

    console.log(`[Proxy] Sending Email via: ${baseUrl}/api/email`);

    // 3. Forward Request to Backend
    const res = await fetch(`${baseUrl}/api/email`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(authHeader && { 'Authorization': authHeader }),
      },
      body: JSON.stringify(payload)
    });

    const text = await res.text();

    if (res.ok) {
      return NextResponse.json({ status: 'success', message: 'Email sent' });
    } else {
      console.error(`[Proxy] Email failed: ${res.status} - ${text}`);
      return NextResponse.json(
        { status: 'error', message: 'Email failed: ' + text }, 
        { status: res.status }
      );
    }
  } catch (error: any) {
    console.error('[Proxy] Email proxy error:', error);
    return NextResponse.json(
      { status: 'error', message: 'Network error: ' + error.message }, 
      { status: 500 }
    );
  }
}