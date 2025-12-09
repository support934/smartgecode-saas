import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');
  if (!address) {
    console.log('Proxy: Missing address param');  // Terminal log
    return NextResponse.json({ status: 'error', message: 'Missing address param' }, { status: 400 });
  }

  const backendUrl = `https://smartgeocode.io/api/geocode?address=${encodeURIComponent(address)}`;
  console.log('Proxy: Starting fetch to URL:', backendUrl);  // Terminal log
  let response;
  try {
    console.log('Proxy: Calling fetch...');  // Before fetch
    response = await fetch(backendUrl);
    console.log('Proxy: Fetch completed, status:', response.status);  // After fetch
  } catch (fetchError) {
    console.error('Proxy: Fetch threw error:', fetchError);  // Terminal log
    console.error('Proxy: Fetch error message:', (fetchError as Error).message);  // Terminal log
    return NextResponse.json({ status: 'error', message: 'Fetch failed: ' + (fetchError as Error).message }, { status: 500 });
  }

  let text;
  try {
    console.log('Proxy: Calling response.text()...');  // Before text
    text = await response.text();
    console.log('Proxy: Text length:', text.length);  // Terminal log
  } catch (textError) {
    console.error('Proxy: Text extraction error:', textError);  // Terminal log
    return NextResponse.json({ status: 'error', message: 'Response body error: ' + (textError as Error).message }, { status: 500 });
  }

  let data;
  try {
    console.log('Proxy: Calling JSON.parse...');  // Before parse
    data = JSON.parse(text);
    console.log('Proxy: Parsed data status:', data.status);  // Terminal log
  } catch (parseError) {
    console.error('Proxy: JSON parse error:', parseError);  // Terminal log
    console.error('Proxy: Raw text snippet:', text.substring(0, 200));  // Terminal log
    return NextResponse.json({ status: 'error', message: 'Invalid backend JSON' }, { status: 500 });
  }

  console.log('Proxy: Returning data:', data);  // Terminal log
  return NextResponse.json(data, { status: response.status });
}