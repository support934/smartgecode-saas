import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const payload = await request.json();

  try {
    const res = await fetch('https://smartgeocode.io/api/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    if (res.ok) {
      return NextResponse.json({ status: 'success', message: 'Email sent' });
    } else {
      return NextResponse.json({ status: 'error', message: 'Email failed: ' + text }, { status: res.status });
    }
  } catch (error) {
    console.error('Email proxy error:', error);
    return NextResponse.json({ status: 'error', message: 'Network error' }, { status: 500 });
  }
}