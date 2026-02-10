import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params; 
    const batchId = resolvedParams.id;

    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ status: 'error', message: 'Email required' }, { status: 400 });
    }

    const authHeader = req.headers.get('authorization');
    
    // ✅ CRITICAL: Using the variable logic. 
    // If these variables are empty, it falls back to the typo-url (the one that works).
    const backendUrl = process.env.BACKEND_URL || 
                       process.env.NEXT_PUBLIC_BACKEND_URL || 
                       'https://dev-smartgecode-saas-production.up.railway.app'; 
                       // ^^^ NOTE: 'smartgecode' (The actual working URL)

    // ✅ REVERT TO SINGULAR: '/api/batch/' (Not batches)
    console.log(`[Proxy] Polling Batch #${batchId} from: ${backendUrl}/api/batch/${batchId}`);

    const backendRes = await fetch(`${backendUrl}/api/batch/${batchId}?email=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: {
        ...(authHeader && { 'Authorization': authHeader }),
        'Content-Type': 'application/json',
      },
    });

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