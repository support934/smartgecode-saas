import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // 1. Parse the incoming form data
    const incomingFormData = await req.formData();
    const file = incomingFormData.get('file');
    const email = incomingFormData.get('email');

    // 2. DEBUG LOGGING (Check Vercel Logs for this!)
    console.log(`[Proxy] Received Upload Request.`);
    console.log(`[Proxy] File Present: ${!!file}`);
    console.log(`[Proxy] Email Present: ${email}`);

    // 3. Validate before forwarding
    if (!email) {
      console.error("[Proxy] Error: Email is missing from request.");
      return NextResponse.json({ status: 'error', message: 'Email missing in request' }, { status: 400 });
    }

    // 4. Config & Auth
    // Uses the BACKEND_URL variable we set earlier
    const backendUrl = process.env.BACKEND_URL || 
                       process.env.NEXT_PUBLIC_BACKEND_URL || 
                       'https://dev-smartgeocode-saas-production.up.railway.app';
    
    const authHeader = req.headers.get('authorization');

    console.log(`[Proxy] Forwarding to: ${backendUrl}/api/batch-geocode`);

    // 5. Re-Construct FormData (The Fix)
    // We create a FRESH FormData object to ensure boundaries are set correctly
    const outgoingFormData = new FormData();
    outgoingFormData.append('file', file as Blob);
    outgoingFormData.append('email', email as string);

    // 6. Forward to Java Backend
    const backendRes = await fetch(`${backendUrl}/api/batch-geocode`, {
      method: 'POST',
      headers: {
        ...(authHeader && { 'Authorization': authHeader }),
        // NOTE: Do NOT set Content-Type header manually here; fetch does it automatically
      },
      body: outgoingFormData,
    });

    // 7. Handle Response
    console.log(`[Proxy] Backend responded with status: ${backendRes.status}`);
    
    // Safely parse JSON
    let data;
    try {
        data = await backendRes.json();
    } catch (e) {
        console.error("[Proxy] Failed to parse backend JSON", e);
        data = { message: "Backend error (non-JSON response)" };
    }

    return NextResponse.json(data, { status: backendRes.status });

  } catch (error: any) {
    console.error('[Proxy] Fatal Error:', error);
    return NextResponse.json(
      { status: 'error', message: 'Proxy failed to contact backend.' },
      { status: 500 }
    );
  }
}