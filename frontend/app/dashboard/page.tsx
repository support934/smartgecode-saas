'use client';

import { useState, useEffect } from 'react';

export default function Dashboard() {
  const [subscription, setSubscription] = useState<'free' | 'premium' | 'loading'>('loading');
  const [email, setEmail] = useState<string>('');
  const [batches, setBatches] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentBatch, setCurrentBatch] = useState<any>(null);
  const [error, setError] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  // Single lookup for free UI
  const [address, setAddress] = useState('');
  const [singleResults, setSingleResults] = useState<any>(null);
  const [singleLoading, setSingleLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedEmail = localStorage.getItem('email') || '';
      setEmail(storedEmail);
      if (storedEmail) {
        fetch(`/api/me?email=${encodeURIComponent(storedEmail)}`)
          .then(res => res.json())
          .then(data => {
            const status = data.subscription_status || 'free';
            setSubscription(status);
            if (status === 'premium') {
              loadBatches(storedEmail);
            }
          })
          .catch(() => setSubscription('free'));
      } else {
        setSubscription('free');
      }
    }
  }, []);

  const loadBatches = async (userEmail: string) => {
    try {
      const res = await fetch(`/api/batches?email=${encodeURIComponent(userEmail)}`);
      const data = await res.json();
      setBatches(data);
    } catch (err) {
      console.error('Load batches error:', err);
    }
  };

  const handleBatchUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !email) return;

    setLoading(true);
    setError('');
    setCurrentBatch(null); // Force clear old data

    const formData = new FormData();
    formData.append('file', file);
    formData.append('email', email);

    try {
      const res = await fetch('/api/batch-geocode', {
        method: 'POST',
        body: formData,
        cache: 'no-store', // Prevent caching stale responses
      });
      const data = await res.json();
      console.log('RAW BATCH RESPONSE FROM BACKEND:', JSON.stringify(data, null, 2)); // Debug log

      if (res.ok && data.status === 'success' && Array.isArray(data.preview)) {
        setCurrentBatch(data);
        loadBatches(email);
      } else {
        setError(data.message || 'Upload failed - check console for details');
      }
    } catch (err) {
      setError('Upload failed—check connection');
      console.error('Upload error:', err);
    } finally {
      setLoading(false);
    }
  };

  const downloadBatch = (id: number) => {
    window.open(`/api/batch/${id}?download=true&email=${encodeURIComponent(email)}`);
  };

  const downloadSample = () => {
    const csv = "address,name,city,state,zip,country\n" +
                "1600 Pennsylvania Ave NW,White House,Washington DC,,20500,USA\n" +
                "Chennai,,Tamil Nadu,,,India\n" +
                "1251 Avenue of the Americas,,New York,NY,10020,USA\n";
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-addresses.csv';
    a.click();
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSingleLoading(true);
    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
      const data = await res.json();
      setSingleResults(data);
      if (data.status === 'success') {
        await fetch('/api/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, address, result: data }),
        });
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setSingleLoading(false);
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

  const logout = () => {
    localStorage.clear();
    window.location.href = '/';
  };

  if (subscription === 'loading') {
    return <p className="text-center mt-20 text-xl font-semibold text-gray-700">Loading dashboard...</p>;
  }

  if (subscription === 'free') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
        <header className="bg-red-600 text-white p-5 shadow-lg">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <h1 className="text-3xl font-bold">smartgeocode</h1>
            <div className="space-x-4">
              <button
                onClick={handleUpsell}
                className="bg-white text-red-600 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition"
              >
                Upgrade to Premium ($29/mo)
              </button>
              <button
                onClick={logout}
                className="bg-white text-red-600 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition"
              >
                Log Out
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto p-8">
          <section className="text-center mb-12">
            <h2 className="text-5xl font-extrabold text-gray-900 mb-6 leading-tight">
              Stop Wasting Time on Address Validation
            </h2>
            <p className="text-xl text-gray-700 max-w-3xl mx-auto">
              Get precise lat/lng coordinates in seconds. Free trial for single lookups, premium for unlimited batch processing at $29/mo.
            </p>
          </section>

          <div className="bg-white rounded-2xl shadow-xl p-10 mb-12 border border-gray-100">
            <h3 className="text-3xl font-bold text-center mb-8 text-red-700">Try Free Single Lookup</h3>
            <form onSubmit={handleSingleSubmit} className="space-y-6 max-w-lg mx-auto">
              <input
                type="text"
                placeholder="Enter full address (e.g., Chennai, India)"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent text-lg"
                required
              />
              <input
                type="email"
                placeholder="Your email for results"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent text-lg"
                required
              />
              <button
                type="submit"
                disabled={singleLoading}
                className="w-full bg-red-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-red-700 transition disabled:opacity-60"
              >
                {singleLoading ? 'Geocoding...' : 'Get Results Now'}
              </button>
            </form>

            {singleResults && (
              <div className="mt-10 p-6 bg-green-50 rounded-xl border border-green-200">
                <h4 className="text-xl font-bold mb-4 text-green-800">Your Results</h4>
                <div className="space-y-3 text-gray-800">
                  <p><strong>Status:</strong> {singleResults.status}</p>
                  {singleResults.status === 'success' && (
                    <>
                      <p><strong>Latitude:</strong> {singleResults.lat}</p>
                      <p><strong>Longitude:</strong> {singleResults.lng}</p>
                      <p><strong>Formatted Address:</strong> {singleResults.formatted_address}</p>
                      <p className="text-sm text-gray-600 mt-4">
                        Results emailed to you. Ready for batches? Upgrade now!
                      </p>
                      <button
                        onClick={handleUpsell}
                        className="mt-4 bg-green-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-green-700 transition"
                      >
                        Upgrade to Batch ($29/mo)
                      </button>
                    </>
                  )}
                  {singleResults.status === 'error' && (
                    <p className="text-red-600 font-medium">{singleResults.message}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="text-center mb-12">
            <a
              href="/success"
              className="bg-red-600 text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-red-700 transition shadow-lg"
            >
              Log In (Premium Dashboard)
            </a>
          </div>

          <section className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-lg text-center border border-gray-100 hover:shadow-xl transition">
              <i className="fas fa-bolt text-5xl text-red-500 mb-6"></i>
              <h3 className="text-xl font-bold mb-3">Lightning-Fast Results</h3>
              <p className="text-gray-600">Accurate lat/lng in seconds—no API limits for free trials. Save your team hours on manual work.</p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-lg text-center border border-gray-100 hover:shadow-xl transition">
              <i className="fas fa-envelope-open text-5xl text-red-500 mb-6"></i>
              <h3 className="text-xl font-bold mb-3">Lead Generation Built-In</h3>
              <p className="text-gray-600">Capture emails with every lookup—grow your list effortlessly and convert visitors to customers.</p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-lg text-center border border-gray-100 hover:shadow-xl transition">
              <i className="fas fa-rocket text-5xl text-red-500 mb-6"></i>
              <h3 className="text-xl font-bold mb-3">Scale with Premium</h3>
              <p className="text-gray-600">Unlimited CSV batch processing for $29/mo—power your business with fast, reliable geocoding.</p>
            </div>
          </section>
        </main>
      </div>
    );
  }

  // Premium batch UI (red/white theme)
  return (
    <div className="min-h-screen bg-white">
      <header className="bg-red-600 text-white p-5 shadow-lg">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-3xl font-bold">Smartgeocode Premium Dashboard</h1>
          <div className="flex items-center space-x-6">
            <p className="text-lg font-medium">Welcome, {email}!</p>
            <button
              onClick={() => {
                localStorage.clear();
                window.location.href = '/';
              }}
              className="bg-white text-red-600 px-6 py-3 rounded-xl font-bold hover:bg-gray-100 transition shadow"
            >
              Log Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-10">
        {/* Batch Upload */}
        <div className="bg-gray-50 rounded-3xl shadow-2xl p-10 mb-12 border border-gray-100">
          <h2 className="text-3xl font-bold text-red-700 mb-8 text-center">Upload CSV for Batch Geocoding</h2>
          <div className="mb-8 flex flex-wrap gap-6 justify-center">
            <button
              onClick={downloadSample}
              className="text-red-600 underline font-semibold text-lg hover:text-red-800 transition"
            >
              Download Sample CSV
            </button>
            <button
              onClick={() => setShowHelp(true)}
              className="text-red-600 underline font-semibold text-lg hover:text-red-800 transition"
            >
              Help / Format Guide
            </button>
          </div>

          <form onSubmit={handleBatchUpload} className="space-y-6 max-w-2xl mx-auto">
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
              className="w-full p-5 border-2 border-gray-300 rounded-2xl text-lg file:mr-6 file:py-3 file:px-8 file:rounded-xl file:border-0 file:text-base file:font-bold file:bg-red-50 file:text-red-700 hover:file:bg-red-100 transition"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 text-white py-5 rounded-2xl font-bold text-xl hover:bg-red-700 transition disabled:opacity-60 disabled:cursor-not-allowed shadow-lg"
            >
              {loading ? 'Processing...' : 'Process Batch'}
            </button>
          </form>

          {error && (
            <p className="text-red-600 mt-6 font-semibold text-center text-lg">{error}</p>
          )}

          {currentBatch && currentBatch.status === 'success' && currentBatch.preview && (
            <div className="mt-12">
              <h3 className="text-2xl font-bold mb-6 text-red-700 text-center">Preview (first 50 rows)</h3>
              <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-inner">
                <table className="w-full border-collapse">
                  <thead className="bg-red-50">
                    <tr>
                      <th className="border border-gray-300 p-4 text-left font-semibold text-red-800">Address</th>
                      <th className="border border-gray-300 p-4 text-left font-semibold text-red-800">Lat</th>
                      <th className="border border-gray-300 p-4 text-left font-semibold text-red-800">Lng</th>
                      <th className="border border-gray-300 p-4 text-left font-semibold text-red-800">Formatted</th>
                      <th className="border border-gray-300 p-4 text-left font-semibold text-red-800">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentBatch.preview.map((row: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="border border-gray-300 p-4">{row.address || '-'}</td>
                        <td className="border border-gray-300 p-4 font-medium">{row.lat || 'N/A'}</td>
                        <td className="border border-gray-300 p-4 font-medium">{row.lng || 'N/A'}</td>
                        <td className="border border-gray-300 p-4">{row.formatted_address || 'N/A'}</td>
                        <td className="border border-gray-300 p-4 font-bold text-green-600">{row.status || 'error'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={() => downloadBatch(currentBatch.batchId)}
                className="mt-8 bg-green-600 text-white py-4 px-10 rounded-2xl font-bold text-lg hover:bg-green-700 transition shadow-lg block mx-auto"
              >
                Download Full CSV ({currentBatch.totalRows} rows)
              </button>
            </div>
          )}
        </div>

        {/* Past Batches */}
        <div className="bg-gray-50 rounded-3xl shadow-2xl p-10 border border-gray-100">
          <h2 className="text-3xl font-bold text-red-700 mb-8 text-center">Past Batches</h2>
          {batches.length === 0 ? (
            <p className="text-gray-700 text-center text-lg">No batches yet — upload your first CSV!</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-inner">
              <table className="w-full border-collapse">
                <thead className="bg-red-50">
                  <tr>
                    <th className="border border-gray-300 p-4 text-left font-semibold text-red-800">ID</th>
                    <th className="border border-gray-300 p-4 text-left font-semibold text-red-800">Status</th>
                    <th className="border border-gray-300 p-4 text-left font-semibold text-red-800">Created</th>
                    <th className="border border-gray-300 p-4 text-left font-semibold text-red-800">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                      <td className="border border-gray-300 p-4 font-medium">{b.id}</td>
                      <td className="border border-gray-300 p-4 font-medium text-green-600">{b.status}</td>
                      <td className="border border-gray-300 p-4">{b.created_at}</td>
                      <td className="border border-gray-300 p-4">
                        <button
                          onClick={() => downloadBatch(b.id)}
                          className="text-red-600 underline hover:text-red-800 font-semibold transition"
                        >
                          Download CSV
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Help Modal */}
        {showHelp && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-6">
            <div className="bg-white p-10 rounded-3xl max-w-3xl w-full shadow-2xl relative">
              <button
                onClick={() => setShowHelp(false)}
                className="absolute top-6 right-6 text-gray-600 hover:text-gray-900 text-3xl font-bold transition"
              >
                ×
              </button>
              <h3 className="text-3xl font-bold mb-8 text-red-700 text-center">CSV Format Help</h3>
              <p className="mb-4 text-lg"><strong>Required:</strong> <span className="font-bold">address</span> column.</p>
              <p className="mb-4 text-lg"><strong>Optional:</strong> name, city, state, zip, country (strongly recommended for best accuracy).</p>
              <p className="mb-6 text-lg">Blank or "N/A" rows will be skipped automatically.</p>
              <p className="font-bold text-xl mt-8 mb-4 text-gray-800">Example Format:</p>
              <pre className="bg-gray-50 p-6 rounded-2xl overflow-x-auto text-sm font-mono border border-gray-200 whitespace-pre-wrap">
{`address,name,city,state,zip,country
1600 Pennsylvania Ave NW,White House,Washington DC,,20500,USA
Chennai,,Tamil Nadu,,,India
1251 Avenue of the Americas,,New York,NY,10020,USA`}
              </pre>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}