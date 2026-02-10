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

    // 3. FORCE DEV URL (The Debug Fix) 
    // We are temporarily hardcoding this to rule out any variable issues.
    const backendUrl = 'https://dev-smartgeocode-saas-production.up.railway.app';

    console.log(`[Proxy] Polling Batch #${batchId} from: ${backendUrl}`);

    // 4. Forward Request to Java Backend
    const backendRes = await fetch(`${backendUrl}/api/batch/${batchId}?email=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: {
        ...(authHeader && { 'Authorization': authHeader }),
        'Content-Type': 'application/json',
      },
    });

    // 5. Handle Response
    if (!backendRes.ok) {
        console.warn(`[Proxy] Backend returned ${backendRes.status}`);
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