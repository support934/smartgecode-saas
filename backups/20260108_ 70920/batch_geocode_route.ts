import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const email = formData.get('email') as string | null;

    if (!file || !email) {
      return NextResponse.json({ status: 'error', message: 'Missing file or email' }, { status: 400 });
    }

    const backendFormData = new FormData();
    backendFormData.append('file', file);
    backendFormData.append('email', email);

    const backendUrl = process.env.BACKEND_URL || 'https://smartgeocode-backend.up.railway.app'; // Use correct backend URL

    console.log('Proxying batch to backend:', backendUrl + '/api/batch-geocode');

    const res = await fetch(`${backendUrl}/api/batch-geocode`, {
      method: 'POST',
      body: backendFormData,
    });

    console.log('Backend response status:', res.status);

    if (!res.ok) {
      const errorText = await res.text();
      console.error('Backend error:', errorText);
      throw new Error(`Backend failed: ${res.status} - ${errorText}`);
    }

    const data = await res.json();
    console.log('Backend response data:', data);

    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('Batch upload proxy error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ status: 'error', message: `Upload failed: ${message} — check connection` }, { status: 500 });
  }
}