'use client';
import { useState } from 'react';

interface GeocodeResult {
  status: 'success' | 'error';
  lat?: string;
  lng?: string;
  formatted_address?: string;
  message?: string;
}

export default function Home() {
  const [address, setAddress] = useState<string>('');
  const [email, setEmail] = useState<string>('');  // Email for lead capture
  const [result, setResult] = useState<GeocodeResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email) {
      setResult({ status: 'error', message: 'Email required for results' });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
      const text = await res.text();
      let data: GeocodeResult;
      try {
        data = JSON.parse(text) as GeocodeResult;
      } catch {
        setResult({ status: 'error', message: 'Invalid response format' });
        setLoading(false);
        return;
      }
      setResult(data);
      if (data.status === 'success') {
        // Email capture (lead gen)
        await fetch('/api/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, address, result: data })
        });
      }
    } catch (error) {
      setResult({ status: 'error', message: 'Network error: ' + (error as Error).message });
    }
    setLoading(false);
  };

  const handleUpgrade = async () => {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, address })
    });
    const { url } = await res.json();
    window.location.href = url;  // Redirect to Stripe
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 space-y-6">
        {/* Logo Placeholder */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg mb-4">
            <span className="text-white text-2xl font-bold">S</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Smartgeocode Blitz</h1>
          <p className="text-gray-600 text-sm mt-1">Free single geocode. Email for results. Upgrade for batch ($29/mo).</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g., Paris, France"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email (for results)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white p-3 rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 transition-all"
          >
            {loading ? 'Geocoding...' : 'Geocode Free Trial'}
          </button>
        </form>

        {result && (
          <div className="space-y-3">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-bold text-gray-900 mb-2">Results</h3>
              <p><strong>Status:</strong> <span className={result.status === 'success' ? 'text-green-600' : 'text-red-600'}>{result.status}</span></p>
              {result.status === 'success' && (
                <div className="space-y-1 text-sm">
                  <p><strong>Latitude:</strong> {result.lat}</p>
                  <p><strong>Longitude:</strong> {result.lng}</p>
                  <p><strong>Full Address:</strong> {result.formatted_address}</p>
                </div>
              )}
              {result.status === 'error' && <p className="text-red-600"><strong>Error:</strong> {result.message}</p>}
            </div>
            {result.status === 'success' && (
              <button
                onClick={handleUpgrade}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white p-3 rounded-lg font-medium hover:from-green-600 hover:to-emerald-700 transition-all"
              >
                Unlock Batch Geocoding ($29/mo)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}