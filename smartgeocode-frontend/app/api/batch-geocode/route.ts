import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const email = formData.get('email');

    // 1. Force the URL that we KNOW works (The "Typo" URL)
    // We ignore the variable for a moment to GUARANTEE they match.
    const backendUrl = 'https://dev-smartgecode-saas-production.up.railway.app';

    console.log(`[Proxy] Uploading to: ${backendUrl}/api/batch-geocode`);

    // 2. Re-pack FormData (Next.js requires this to forward files correctly)
    const outgoingFormData = new FormData();
    if (file) outgoingFormData.append('file', file);
    if (email) outgoingFormData.append('email', email as string);

    const authHeader = req.headers.get('authorization');

    // 3. Send to Backend
    const backendRes = await fetch(`${backendUrl}/api/batch-geocode`, {
      method: 'POST',
      headers: {
        ...(authHeader && { 'Authorization': authHeader }),
      },
      body: outgoingFormData,
    });

    const data = await backendRes.json();
    console.log(`[Proxy] Upload Status: ${backendRes.status}`);

    return NextResponse.json(data, { status: backendRes.status });

  } catch (error: any) {
    console.error('[Proxy] Upload Error:', error);
    return NextResponse.json(
      { status: 'error', message: 'Proxy failed: ' + error.message },
      { status: 500 }
    );
  }
}