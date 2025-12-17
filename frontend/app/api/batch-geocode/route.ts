import { NextRequest, NextResponse } from 'next/server';
import FormData from 'form-data';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const email = formData.get('email') as string;

    if (!file || !email) {
      return NextResponse.json({ status: 'error', message: 'Missing file or email' }, { status: 400 });
    }

    const backendFormData = new FormData();
    backendFormData.append('file', file);
    backendFormData.append('email', email);

    const res = await fetch('https://smartgeocode.io/api/batch-geocode', {
      method: 'POST',
      body: backendFormData as unknown as BodyInit,  // Double cast for strict TS
    });

    const data = await res.json();
    if (res.ok) {
      return NextResponse.json(data);
    } else {
      return NextResponse.json(data, { status: res.status });
    }
  } catch (error) {
    console.error('Batch upload proxy error:', error);
    return NextResponse.json({ status: 'error', message: 'Upload failed' }, { status: 500 });
  }
}