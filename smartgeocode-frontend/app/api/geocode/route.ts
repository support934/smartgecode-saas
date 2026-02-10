import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  // 1. Validate Input
  if (!address) {
    return NextResponse.json({ status: 'error', message: 'Missing address param' }, { status: 400 });
  }

  // 2. Get Auth Token (CRITICAL for usage tracking)
  const authHeader = request.headers.get('authorization');

  // 3. Define Backend URL (Dynamic)
  // We check the variable first. If missing, we fall back to your DEV URL (with the typo).
  const baseUrl = process.env.BACKEND_URL || 
                  process.env.NEXT_PUBLIC_BACKEND_URL || 
                  'https://dev-smartgecode-saas-production.up.railway.app';

  const backendUrl = `${baseUrl}/api/geocode?address=${encodeURIComponent(address)}`;

  console.log(`[Proxy] Single Lookup: ${backendUrl}`);

  try {
    // 4. Forward Request with Auth
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        // Forward the token so the backend knows who to charge!
        ...(authHeader && { 'Authorization': authHeader }),
        'Content-Type': 'application/json',
      },
    });

    console.log(`[Proxy] Backend Status: ${response.status}`);

    // 5. Handle Errors Gracefully
    if (!response.ok) {
        // If limit reached (403) or Unauthorized (401), forward that status
        return NextResponse.json(
            { status: 'error', message: 'Backend lookup failed' }, 
            { status: response.status }
        );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 200 });

  } catch (error: any) {
    console.error('[Proxy] Single Lookup Error:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}