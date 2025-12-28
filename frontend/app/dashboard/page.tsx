'use client';

import { useState, useEffect } from 'react';

export default function Dashboard() {
  const [subscription, setSubscription] = useState<'free' | 'premium' | 'loading'>('loading');
  const [email, setEmail] = useState('');
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

  if (subscription === 'loading') return <p className="text-center mt-8">Loading dashboard...</p>;

  if (subscription === 'free') {
    // Full free single lookup UI (your original)
    return (
      <div className="min-h-screen bg-white">
        <header className="bg-red-600 text-white p-4 shadow-lg">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-bold">smartgeocode</h1>
            <div className="space-x-4">
              <button onClick={handleUpsell} className="bg-white text-red-600 px-4 py-2 rounded-lg hover:bg-gray-100 font-semibold">
                Upgrade to Premium ($29/mo)
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

  // Premium batch UI (your full red/white theme)
  return (
    <div className="min-h-screen bg-white">
      <header className="bg-red-600 text-white p-4 shadow-lg">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Smartgeocode Premium Dashboard</h1>
          <p>Welcome, {email}!</p>
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-8">
        <div className="bg-gray-50 rounded-xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Upload CSV for Batch Geocoding</h2>
          <div className="mb-4 flex gap-4">
            <button onClick={downloadSample} className="text-red-600 underline font-semibold">
              Download Sample CSV
            </button>
            <button onClick={() => setShowHelp(true)} className="text-red-600 underline font-semibold">
              Help / Format Guide
            </button>
          </div>
          <form onSubmit={handleBatchUpload} className="space-y-4">
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
              className="w-full p-3 border border-gray-300 rounded-lg"
            />
            <button type="submit" disabled={loading} className="w-full bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 disabled:opacity-50">
              {loading ? 'Processing...' : 'Process Batch'}
            </button>
          </form>
          {error && <p className="text-red-600 mt-4 font-semibold">{error}</p>}
          {currentBatch && currentBatch.status === 'success' && (
            <div className="mt-8">
              <h3 className="text-xl font-bold mb-4 text-red-600">Preview (first 50 rows)</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead className="bg-red-100">
                    <tr>
                      <th className="border border-gray-300 p-2">Address</th>
                      <th className="border border-gray-300 p-2">Lat</th>
                      <th className="border border-gray-300 p-2">Lng</th>
                      <th className="border border-gray-300 p-2">Formatted</th>
                      <th className="border border-gray-300 p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentBatch.preview.map((row: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="border border-gray-300 p-2">{row.address || ''}</td>
                        <td className="border border-gray-300 p-2">{row.lat || ''}</td>
                        <td className="border border-gray-300 p-2">{row.lng || ''}</td>
                        <td className="border border-gray-300 p-2">{row.formatted_address || ''}</td>
                        <td className="border border-gray-300 p-2">{row.status || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={() => downloadBatch(currentBatch.batchId)} className="mt-6 bg-green-600 text-white py-3 px-6 rounded-lg font-bold hover:bg-green-700">
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
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead className="bg-red-100">
                  <tr>
                    <th className="border border-gray-300 p-2">ID</th>
                    <th className="border border-gray-300 p-2">Status</th>
                    <th className="border border-gray-300 p-2">Created</th>
                    <th className="border border-gray-300 p-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="border border-gray-300 p-2 text-center">{b.id}</td>
                      <td className="border border-gray-300 p-2 text-center">{b.status}</td>
                      <td className="border border-gray-300 p-2 text-center">{b.created_at}</td>
                      <td className="border border-gray-300 p-2 text-center">
                        <button onClick={() => downloadBatch(b.id)} className="text-red-600 underline font-semibold">
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-lg max-w-lg shadow-2xl">
              <h3 className="text-xl font-bold mb-4 text-red-600">CSV Format Help</h3>
              <p>Required: <strong>address</strong> column.</p>
              <p>Optional: name, city, state, zip, country.</p>
              <p>Blank or "N/A" skipped.</p>
              <p className="mt-4 font-semibold">Example:</p>
              <pre className="bg-gray-100 p-4 rounded mt-2 overflow-x-auto text-sm">
address,name,city,state,zip,country
1600 Pennsylvania Ave NW,White House,Washington DC,,20500,USA
Chennai,,Tamil Nadu,,,India
              </pre>
              <button onClick={() => setShowHelp(false)} className="mt-6 bg-red-600 text-white px-6 py-3 rounded font-bold hover:bg-red-700">
                Close
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}