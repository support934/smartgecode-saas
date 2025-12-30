'use client';

import { useState } from 'react';

export default function Home() {
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGeocode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim() || !email.trim()) return;

    setLoading(true);
    setError('');
    setResults(null);

    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
      const data = await res.json();
      if (data.status === 'success') {
        setResults(data);
        await fetch('/api/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, address, result: data }),
        });
      } else {
        setError(data.message || 'Geocode failed');
      }
    } catch (err) {
      setError('Network error—check connection');
    } finally {
      setLoading(false);
    }
  };

  const handleUpsell = async () => {
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Upsell error:', error);
    }
  };

  return (
    <main className="min-h-screen bg-white">
            <div className="max-w-4xl mx-auto p-8">
        <section className="text-center mb-8">
          <h2 className="text-4xl font-bold text-gray-800 mb-4">Stop Wasting Time on Address Validation</h2>
          <p className="text-xl text-gray-600 mb-6">Get precise lat/lng coordinates in seconds. Save your team hours—free trial for singles, premium for unlimited batches at $29/mo.</p>
        </section>

        <div className="bg-gray-50 rounded-xl shadow-lg p-8 mb-8">
          <h3 className="text-2xl font-bold text-center mb-6 text-red-600">Try Free Single Lookup</h3>
          <form onSubmit={handleGeocode} className="space-y-4 max-w-md mx-auto">
            <input
              type="text"
              placeholder="Enter address (e.g., Chennai, India)"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              required
            />
            <input
              type="email"
              placeholder="Your email for results"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 text-white p-3 rounded-lg hover:bg-red-700 font-semibold disabled:opacity-50"
            >
              {loading ? 'Geocoding...' : 'Get Results Now'}
            </button>
          </form>

          {error && <p className="text-red-600 text-center mt-4 font-semibold">{error}</p>}

          {results && (
            <div className="mt-6 p-4 bg-green-50 rounded-lg">
              <h3 className="font-semibold mb-2">Your Results</h3>
              <p><strong>Status:</strong> {results.status}</p>
              {results.status === 'success' && (
                <div className="mt-4 space-y-2">
                  <p><strong>Latitude:</strong> {results.lat}</p>
                  <p><strong>Longitude:</strong> {results.lng}</p>
                  <p><strong>Formatted Address:</strong> {results.formatted_address}</p>
                  <p className="text-sm text-gray-500">Results emailed to you. Ready for batches? Upgrade and save time on hundreds of addresses.</p>
                  <button onClick={handleUpsell} className="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                    Upgrade to Batch ($29/mo)
                  </button>
                </div>
              )}
              {results.status === 'error' && <p className="text-red-500">{results.message}</p>}
            </div>
          )}
        </div>

        <div className="text-center mb-8">
          <a href="/success" className="bg-white text-red-600 px-6 py-3 rounded-lg font-bold hover:bg-gray-100">
            Log In (Premium Dashboard)
          </a>
        </div>

        <section className="grid md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-md text-center">
            <i className="fas fa-bolt text-3xl text-red-500 mb-4"></i>
            <h3 className="font-semibold mb-2">Lightning-Fast Results</h3>
            <p className="text-gray-600">Accurate lat/lng in seconds—no API limits for free trials. Save your team hours on manual work.</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-md text-center border border-gray-100 hover:shadow-xl transition">
            <i className="fas fa-envelope text-5xl text-red-500 mb-6"></i>
           <h3 className="text-xl font-bold mb-3">Email Results Instantly</h3>
            <p className="text-gray-600">Results sent straight to your inbox—no more copying/pasting<br />Every lookup is emailed automatically so you can reference it anytime.</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-md text-center">
            <i className="fas fa-rocket text-3xl text-red-500 mb-4"></i>
            <h3 className="font-semibold mb-2">Scale with Premium</h3>
            <p className="text-gray-600">Unlimited CSV batch processing for $29/mo—power your business with fast, reliable geocoding.</p>
          </div>
        </section>
      </div>
    </main>
  );
}