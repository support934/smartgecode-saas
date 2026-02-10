import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const batchId = params.id;
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    // 1. Validation
    if (!email) {
      return NextResponse.json({ status: 'error', message: 'Email required' }, { status: 400 });
    }

    // 2. Auth Header
    const authHeader = req.headers.get('authorization');

    // 3. DYNAMIC BACKEND SELECTION (The Safe Way) 🛡️
    // We look for the variable. If missing, we DO NOT fall back to Dev. We throw an error.
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;

    if (!backendUrl) {
        console.error("❌ CRITICAL ERROR: BACKEND_URL variable is not set in Vercel!");
        return NextResponse.json({ status: 'error', message: 'Server Configuration Error' }, { status: 500 });
    }

    console.log(`[Proxy] Polling Batch #${batchId} from: ${backendUrl}`);

    // 4. Forward to Backend
    const backendRes = await fetch(`${backendUrl}/api/batch/${batchId}?email=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: {
        ...(authHeader && { 'Authorization': authHeader }),
        'Content-Type': 'application/json',
      },
    });

    // 5. Handle Response
    if (!backendRes.ok) {
        // If the backend returns 404, it means the batch doesn't exist (yet)
        // We forward that status so the frontend knows to keep waiting or show an error
        return NextResponse.json(
            { status: 'error', message: 'Backend lookup failed' }, 
            { status: backendRes.status }
        );
    }

    const data = await backendRes.json();
    return NextResponse.json(data, { status: 200 });

  } catch (error: any) {
    console.error('[Proxy] Polling Error:', error);
    return NextResponse.json(
      { status: 'error', message: 'Proxy failed to contact backend.' },
      { status: 500 }
    );
  }
}