import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  const backendUrl = process.env.BACKEND_URL || 'https://smartgecode.io';

  try {
    const res = await fetch(`${backendUrl}/api/me?email=${encodeURIComponent(email || '')}`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}