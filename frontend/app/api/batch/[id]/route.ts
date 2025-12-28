import { NextRequest, NextResponse } from 'next/server';

export const GET = async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  const download = searchParams.get('download') === 'true';
  const backendUrl = process.env.BACKEND_URL || 'https://smartgeocode.io';

  try {
    let url = `${backendUrl}/api/batch/${id}?email=${encodeURIComponent(email || '')}`;
    if (download) url += '&download=true';

    const res = await fetch(url);
    if (download) {
      const blob = await res.blob();
      return new NextResponse(blob, {
        status: res.status,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="batch-${id}.csv"`,
        },
      });
    }
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ message: 'Batch load failed' }, { status: 500 });
  }
};