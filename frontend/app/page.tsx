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

  if (subscription === 'loading') return <p className="text-center mt-8">Loading dashboard...</p>;

  if (subscription === 'free') {
    // Your free single lookup UI
    return (
      <div className="min-h-screen bg-white">
        {/* Your single lookup form */}
      </div>
    );
  }

  // Premium batch UI (red/white theme)
  return (
    <div className="min-h-screen bg-white">
      <header className="bg-red-600 text-white p-4 shadow-lg">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Smartgecode Premium Dashboard</h1>
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