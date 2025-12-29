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
      console.error('Load batches error');
    }
  };

  const handleBatchUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !email) return;

    setLoading(true);
    setError('');
    setCurrentBatch(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('email', email);

    try {
      const res = await fetch('/api/batch-geocode', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentBatch(data);
        loadBatches(email);
      } else {
        setError(data.message || 'Upload failed');
      }
    } catch (err) {
      setError('Upload failed—check connection');
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
      const res = await fetch('/api/geocode?address=' + encodeURIComponent(address));
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
    }
    setSingleLoading(false);
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

  if (subscription === 'loading') return <p className="text-center mt-8 text-xl font-semibold">Loading dashboard...</p>;

  if (subscription === 'free') {
    // Full free single lookup UI
    return (
      <div className="min-h-screen bg-white">
        <header className="bg-red-600 text-white p-4 shadow-lg">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-bold">Smartgeocode</h1>
            <div className="space-x-4">
              <button onClick={handleUpsell} className="bg-white text-red-600 px-4 py-2 rounded-lg hover:bg-gray-100 font-semibold">
                Upgrade to Premium ($29/mo)
              </button>
              <button onClick={logout} className="bg-white text-red-600 px-4 py-2 rounded-lg hover:bg-gray-100 font-semibold">
                Log Out
              </button>
            </div>
          </div>
        </header>
        <main className="max-w-4xl mx-auto p-8">
          <section className="text-center mb-8">
            <h2 className="text-4xl font-bold text-gray-800 mb-4">Stop Wasting Time on Address Validation</h2>
            <p className="text-xl text-gray-600 mb-6">Get precise lat/lng coordinates in seconds. Save your team hours—free trial for singles, premium for unlimited batches at $29/mo.</p>
          </section>
          <div className="bg-gray-50 rounded-xl shadow-lg p-8 mb-8">
            <h3 className="text-2xl font-bold text-center mb-6 text-red-600">Try Free Single Lookup</h3>
            <form onSubmit={handleSingleSubmit} className="space-y-4 max-w-md mx-auto">
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
              <button type="submit" disabled={singleLoading} className="w-full bg-red-600 text-white p-3 rounded-lg hover:bg-red-700 font-semibold disabled:opacity-50">
                {singleLoading ? 'Geocoding...' : 'Get Results Now'}
              </button>
            </form>
            {singleResults && (
              <div className="mt-6 p-4 bg-green-50 rounded-lg">
                <h3 className="font-semibold mb-2">Your Results</h3>
                <p><strong>Status:</strong> {singleResults.status}</p>
                {singleResults.status === 'success' && (
                  <div className="mt-4 space-y-2">
                    <p><strong>Latitude:</strong> {singleResults.lat}</p>
                    <p><strong>Longitude:</strong> {singleResults.lng}</p>
                    <p><strong>Formatted Address:</strong> {singleResults.formatted_address}</p>
                    <p className="text-sm text-gray-500">Results emailed to you. Ready for batches? Upgrade and save time on hundreds of addresses.</p>
                    <button onClick={handleUpsell} className="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                      Upgrade to Batch ($29/mo)
                    </button>
                  </div>
                )}
                {singleResults.status === 'error' && <p className="text-red-500">{singleResults.message}</p>}
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
            <div className="bg-white p-6 rounded-xl shadow-md text-center">
              <i className="fas fa-envelope-open text-3xl text-red-500 mb-4"></i>
              <h3 className="font-semibold mb-2">Lead Generation Built-In</h3>
              <p className="text-gray-600">Capture emails with every lookup—grow your list effortlessly and convert visitors to customers.</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-md text-center">
              <i className="fas fa-rocket text-3xl text-red-500 mb-4"></i>
              <h3 className="font-semibold mb-2">Scale with Premium</h3>
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
      <header className="bg-red-600 text-white p-4 shadow-lg">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Smartgeocode Premium Dashboard</h1>
          <div className="flex items-center space-x-6">
            <p className="font-medium">Welcome, {email}!</p>
            <button
              onClick={() => {
                localStorage.clear();
                window.location.href = '/';
              }}
              className="bg-white text-red-600 px-5 py-2 rounded-lg font-semibold hover:bg-gray-100 transition"
            >
              Log Out
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-8">
        <div className="bg-gray-50 rounded-xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Upload CSV for Batch Geocoding</h2>
          <div className="mb-4 flex gap-4">
            <button onClick={downloadSample} className="text-red-600 underline font-semibold hover:text-red-800">
              Download Sample CSV
            </button>
            <button onClick={() => setShowHelp(true)} className="text-red-600 underline font-semibold hover:text-red-800">
              Help / Format Guide
            </button>
          </div>
          <form onSubmit={handleBatchUpload} className="space-y-4">
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
              className="w-full p-3 border border-gray-300 rounded-lg text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Process Batch'}
            </button>
          </form>
          {error && <p className="text-red-600 mt-4 font-semibold text-center">{error}</p>}
          {currentBatch && currentBatch.status === 'success' && (
            <div className="mt-10">
              <h3 className="text-xl font-bold mb-4 text-red-600">Preview (first 50 rows)</h3>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full border-collapse">
                  <thead className="bg-red-50">
                    <tr>
                      <th className="border border-gray-300 p-3 text-left font-semibold text-red-800">Address</th>
                      <th className="border border-gray-300 p-3 text-left font-semibold text-red-800">Lat</th>
                      <th className="border border-gray-300 p-3 text-left font-semibold text-red-800">Lng</th>
                      <th className="border border-gray-300 p-3 text-left font-semibold text-red-800">Formatted</th>
                      <th className="border border-gray-300 p-3 text-left font-semibold text-red-800">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentBatch.preview.map((row: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-50 transition">
                        <td className="border border-gray-300 p-3">{row.address || '-'}</td>
                        <td className="border border-gray-300 p-3">{row.lat || '-'}</td>
                        <td className="border border-gray-300 p-3">{row.lng || '-'}</td>
                        <td className="border border-gray-300 p-3">{row.formatted_address || '-'}</td>
                        <td className="border border-gray-300 p-3 font-medium text-green-600">{row.status || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={() => downloadBatch(currentBatch.batchId)}
                className="mt-6 bg-green-600 text-white py-3 px-8 rounded-lg font-bold hover:bg-green-700 transition"
              >
                Download Full CSV ({currentBatch.totalRows} rows)
              </button>
            </div>
          )}
        </div>

        <div className="bg-gray-50 rounded-xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Past Batches</h2>
          {batches.length === 0 ? (
            <p className="text-gray-600">No batches yet—upload your first!</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full border-collapse">
                <thead className="bg-red-50">
                  <tr>
                    <th className="border border-gray-300 p-3 text-left font-semibold text-red-800">ID</th>
                    <th className="border border-gray-300 p-3 text-left font-semibold text-red-800">Status</th>
                    <th className="border border-gray-300 p-3 text-left font-semibold text-red-800">Created</th>
                    <th className="border border-gray-300 p-3 text-left font-semibold text-red-800">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50 transition">
                      <td className="border border-gray-300 p-3">{b.id}</td>
                      <td className="border border-gray-300 p-3 font-medium text-green-600">{b.status}</td>
                      <td className="border border-gray-300 p-3">{b.created_at}</td>
                      <td className="border border-gray-300 p-3">
                        <button onClick={() => downloadBatch(b.id)} className="text-red-600 underline hover:text-red-800 font-semibold">
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

        {showHelp && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-xl max-w-2xl w-full shadow-2xl relative">
              <button onClick={() => setShowHelp(false)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl">
                ×
              </button>
              <h3 className="text-2xl font-bold mb-6 text-red-600">CSV Format Help</h3>
              <p className="mb-4"><strong>Required:</strong> <span className="font-semibold">address</span> column.</p>
              <p className="mb-4"><strong>Optional:</strong> name, city, state, zip, country (highly recommended for accuracy).</p>
              <p className="mb-4">Blank or "N/A" rows will be skipped.</p>
              <p className="font-semibold mt-6 mb-2">Example:</p>
              <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono whitespace-pre-wrap">
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