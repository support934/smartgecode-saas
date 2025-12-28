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

    const backendUrl = process.env.BACKEND_URL || 'https://smartgecode.io';

    const res = await fetch(`${backendUrl}/api/batch-geocode`, {
      method: 'POST',
      body: backendFormData,
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('Batch upload proxy error:', error);
    return NextResponse.json({ status: 'error', message: 'Upload failed—check connection' }, { status: 500 });
  }
}