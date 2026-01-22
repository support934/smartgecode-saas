import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    
    // Check if the backend URL is configured
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api-java-production-fb09.up.railway.app';
    
    // Get the auth token from the incoming request headers
    const authHeader = req.headers.get('authorization');

    console.log(`[Proxy] Forwarding batch upload to: ${backendUrl}/api/batch-geocode`);

    // Forward the request to the Java Backend
    const backendRes = await fetch(`${backendUrl}/api/batch-geocode`, {
      method: 'POST',
      headers: {
        // Forward the Authorization header (Bearer token)
        ...(authHeader && { 'Authorization': authHeader }),
      },
      body: formData, // Forward the multipart form data directly
    });

    // Parse the response from the backend
    const data = await backendRes.json();

    // CRITICAL FIX: Do NOT throw an error for non-200 statuses (like 403).
    // Instead, forward the exact status code and body to the frontend.
    console.log(`[Proxy] Backend responded with status: ${backendRes.status}`);
    
    return NextResponse.json(data, { status: backendRes.status });

  } catch (error: any) {
    console.error('[Proxy] Fatal Error:', error);
    return NextResponse.json(
      { status: 'error', message: 'Proxy failed to contact backend.' },
      { status: 500 }
    );
  }
}