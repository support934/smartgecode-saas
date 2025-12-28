import { NextRequest, NextResponse } from 'next/server';

export const GET = async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  const backendUrl = process.env.BACKEND_URL || 'https://smartgeocode.io';

  try {
    const res = await fetch(`${backendUrl}/api/batches?email=${encodeURIComponent(email || '')}`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json([], { status: 500 });
  }
};