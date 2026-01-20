'use client';

import { useState, useEffect, useRef } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { loadStripe } from '@stripe/stripe-js';

// Load Stripe promise (Used in handleUpsell if needed, though we use direct checkout links mostly)
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function Dashboard() {
  const [subscription, setSubscription] = useState<'free' | 'premium' | 'loading'>('loading');
  const [email, setEmail] = useState<string>('');
  const [batches, setBatches] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentBatch, setCurrentBatch] = useState<any>(null);
  const [error, setError] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  
  // Single Lookup State
  const [address, setAddress] = useState('');
  const [singleResults, setSingleResults] = useState<any>(null);
  const [singleLoading, setSingleLoading] = useState(false);
  const lastAddressRef = useRef<string>('');

  // Usage State
  const [usage, setUsage] = useState({ used: 0, limit: 500 });
  const [usageLoading, setUsageLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedEmail = (localStorage.getItem('email') || '').toLowerCase().trim();
      setEmail(storedEmail);

      // FIX: Use 'token' (not authToken) to match Login Page
      const token = localStorage.getItem('token'); 

      // 1. Fetch Subscription
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

      // 2. Fetch Usage (Authorized)
      if (token) {
        fetch('/api/usage', {
          headers: { 'Authorization': `Bearer ${token}` },
        })
          .then(res => {
            if (!res.ok) throw new Error('Failed to fetch usage');
            return res.json();
          })
          .then(data => {
            setUsage(data);
            setUsageLoading(false);
          })
          .catch(err => {
            console.error(err);
            setUsageLoading(false);
          });
      } else {
        setUsageLoading(false);
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
    setCurrentBatch(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('email', email);
    
    // Auth header for backend limits
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/api/batch-geocode', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}` 
        },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP error: ${res.status}`);
      }

      const data = await res.json();
      if (data.status === 'success') {
        // Show immediate success state with preview if available
        setCurrentBatch({
            batchId: data.batchId,
            status: 'processing',
            totalRows: data.totalRows || 0, 
            preview: data.preview || [] // Ensure preview is captured if sent
        });
        
        loadBatches(email); // Refresh history
        
        // Trigger email notification
        await fetch('/api/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: email,
              address: `Batch #${data.batchId} - ${data.totalRows} rows`,
              result: {
                message: `Batch processed successfully! Total rows: ${data.totalRows}. Download full results from dashboard.`,
                preview: data.preview ? data.preview.slice(0, 3) : []
              },
            }),
        });

        toast.success('Batch processing started! We will email you when done.');
      } else {
        setError(data.message || 'Batch processing failed');
        toast.error('Batch failed');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError('Upload failed: ' + errorMessage);
      toast.error('Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const downloadBatch = (id: number) => {
    window.open(`/api/batch/${id}/download?email=${encodeURIComponent(email)}`);
  };

  const downloadSample = () => {
    const csv = `# Smartgeocode Batch Sample CSV - Instructions:\n` +
                `# Required: 'address' column (street or place name)\n` +
                `# Optional but recommended: 'landmark' (e.g. Building name), 'city', 'state', 'zip', 'country' (improves accuracy a lot!)\n` +
                `# Blank or "N/A" rows are skipped automatically\n` +
                `# Save as .csv and upload below\n\n` +
                `address,landmark,city,state,zip,country\n` +
                `1600 Pennsylvania Ave NW,White House,Washington DC,,20500,USA\n` +
                `Chennai,,Tamil Nadu,,,India\n` +
                `1251 Avenue of the Americas,,New York,NY,10020,USA\n` +
                `Ahmedabad,,Gujarat,,,India\n` +
                `350 Fifth Avenue,Empire State Building,New York,NY,10118,USA\n` +
                `Tokyo Tower,,Minato City,Tokyo,,Japan\n`;
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
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setSingleResults(data);
      
      if (data.status === 'success') {
        lastAddressRef.current = address;
        
        // Trigger email
        await fetch('/api/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, address, result: data }),
        });
        
        // Refresh usage immediately
        if(token) {
             fetch('/api/usage', { headers: { 'Authorization': `Bearer ${token}` } })
                .then(r => r.json()).then(d => setUsage(d));
        }

        toast.success('Results sent to your email!');
      } else {
        toast.error(data.message || 'Geocode failed');
      }
    } catch (error) {
      toast.error('Geocode failed - check connection');
    } finally {
      setSingleLoading(false);
    }
  };

  const handleUpsell = async () => {
    try {
      const payload = {
        email,
        address: lastAddressRef.current || 'Premium Upgrade',
      };

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error('Could not initiate checkout');
      }
    } catch (error) {
      toast.error('Upgrade failed');
    }
  };

  const logout = () => {
    localStorage.clear();
    window.location.href = '/';
  };

  if (subscription === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl font-semibold text-gray-700 animate-pulse">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />

      {/* Header */}
      <header className="bg-red-600 text-white p-5 shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold tracking-tight">Smartgeocode Dashboard</h1>
            <span className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider ${subscription === 'premium' ? 'bg-yellow-400 text-red-900' : 'bg-red-800 text-red-100'}`}>
                {subscription === 'premium' ? 'Premium' : 'Free Plan'}
            </span>
          </div>

          <div className="flex items-center space-x-6">
            {!usageLoading && (
              <div className="hidden md:block text-sm font-medium">
                <div className="flex justify-between mb-1">
                    <span>Usage</span>
                    <span>{usage.used} / {usage.limit}</span>
                </div>
                <div className="w-32 h-2 bg-red-800 rounded-full overflow-hidden">
                    <div 
                        className={`h-full transition-all duration-500 ${usage.used >= usage.limit ? 'bg-yellow-400' : 'bg-white'}`} 
                        style={{ width: `${Math.min((usage.used / usage.limit) * 100, 100)}%` }}
                    />
                </div>
              </div>
            )}

            {subscription === 'premium' && (
              <button
                onClick={async () => {
                  try {
                    const res = await fetch('/api/create-portal-session', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email }),
                    });
                    const data = await res.json();
                    if (data.url) window.location.href = data.url;
                  } catch(e) { toast.error('Error opening billing portal'); }
                }}
                className="bg-white text-red-600 px-4 py-2 rounded text-sm font-bold hover:bg-gray-100 transition shadow-sm"
              >
                Manage Plan
              </button>
            )}
            
            <button onClick={logout} className="text-white hover:text-red-200 text-sm font-semibold transition">
                Log Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6 md:p-10">
        
        {/* FREE USER VIEW */}
        {subscription === 'free' ? (
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-4xl font-extrabold text-gray-900 mb-4">Single Address Lookup</h2>
              <p className="text-gray-600 text-lg">
                You are on the Free Plan. Lookup addresses one by one. <br/>
                For bulk CSV processing, <button onClick={handleUpsell} className="text-red-600 font-bold underline hover:text-red-800">upgrade to Premium</button>.
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
              <form onSubmit={handleSingleSubmit} className="space-y-6">
                <input
                  type="text"
                  placeholder="Enter address (e.g. 123 Main St, New York)"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-lg transition shadow-sm"
                  required
                />
                <button
                  type="submit"
                  disabled={singleLoading}
                  className="w-full bg-red-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-red-700 transition disabled:opacity-50 shadow-md"
                >
                  {singleLoading ? 'Searching...' : 'Get Coordinates'}
                </button>
              </form>

              {singleResults && (
                <div className="mt-8 p-6 bg-green-50 rounded-xl border border-green-100 animate-in fade-in slide-in-from-bottom-4">
                  <h4 className="text-lg font-bold text-green-800 mb-3 flex items-center">
                    <span className="bg-green-200 text-green-800 rounded-full w-6 h-6 flex items-center justify-center mr-2 text-sm">✓</span>
                    Result Found
                  </h4>
                  <div className="text-gray-700 space-y-2 bg-white p-4 rounded-lg border border-green-100 shadow-sm">
                    <p><span className="font-semibold text-gray-900">Lat:</span> {singleResults.lat}</p>
                    <p><span className="font-semibold text-gray-900">Lng:</span> {singleResults.lng}</p>
                    <p><span className="font-semibold text-gray-900">Address:</span> {singleResults.formatted_address}</p>
                  </div>
                  
                  <div className="mt-6 pt-6 border-t border-green-200 text-center">
                    <p className="text-green-800 font-medium mb-3">Need to process thousands?</p>
                    <button
                      onClick={handleUpsell}
                      className="bg-green-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-green-700 transition shadow-lg transform hover:scale-105"
                    >
                      Upgrade to Batch ($29/mo)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* PREMIUM USER VIEW */
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left: Upload */}
            <div className="lg:col-span-2 space-y-8">
                <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-gray-800">Batch Geocoding</h2>
                        <div className="space-x-4 text-sm font-medium">
                            <button onClick={downloadSample} className="text-red-600 hover:text-red-800 flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                Sample CSV
                            </button>
                            <button onClick={() => setShowHelp(true)} className="text-gray-500 hover:text-gray-700">Help?</button>
                        </div>
                    </div>

                    <form onSubmit={handleBatchUpload} className="space-y-6">
                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:bg-gray-50 transition cursor-pointer relative group">
                            <input 
                                type="file" 
                                accept=".csv"
                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                            />
                            <div className="pointer-events-none">
                                <div className="text-5xl text-gray-300 group-hover:text-red-400 mb-4 transition-colors">☁️</div>
                                <p className="text-lg font-medium text-gray-700">
                                    {file ? <span className="text-green-600 font-bold">{file.name}</span> : "Drag & drop CSV or click to browse"}
                                </p>
                                <p className="text-sm text-gray-400 mt-2">Max 10,000 rows per file</p>
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={loading || !file}
                            className="w-full bg-red-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                        >
                            {loading ? 'Processing...' : 'Start Batch Process'}
                        </button>
                    </form>

                    {/* CURRENT BATCH PREVIEW (NEW: Added missing feature) */}
                    {currentBatch && currentBatch.status === 'success' && currentBatch.preview && (
                      <div className="mt-8">
                        <h3 className="text-lg font-bold mb-4 text-gray-800">Batch Preview</h3>
                        <div className="overflow-x-auto rounded-xl border border-gray-200">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 font-semibold text-gray-700">
                              <tr>
                                <th className="p-3">Address</th>
                                <th className="p-3">Lat/Lng</th>
                                <th className="p-3">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {currentBatch.preview.map((row: any, i: number) => (
                                <tr key={i}>
                                  <td className="p-3">{row.address}</td>
                                  <td className="p-3">{row.lat ? `${row.lat}, ${row.lng}` : '-'}</td>
                                  <td className="p-3 text-green-600 font-medium">{row.status}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                </div>

                {/* History Table */}
                <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
                    <h3 className="text-xl font-bold text-gray-800 mb-6">Recent Batches</h3>
                    {batches.length === 0 ? (
                        <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                            <p className="text-gray-500 italic">No batches processed yet.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold">
                                    <tr>
                                        <th className="p-4 rounded-tl-lg">ID</th>
                                        <th className="p-4">Date</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4 rounded-tr-lg text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-sm">
                                    {batches.map((b) => (
                                        <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-4 font-medium text-gray-900">#{b.id}</td>
                                            <td className="p-4 text-gray-600">{new Date(b.created_at).toLocaleDateString()}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${b.status === 'complete' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                    {b.status ? b.status.toUpperCase() : 'PENDING'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <button 
                                                    onClick={() => downloadBatch(b.id)}
                                                    className="text-red-600 hover:text-red-800 font-semibold text-sm bg-red-50 hover:bg-red-100 px-3 py-1 rounded transition"
                                                >
                                                    Download
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Right: Quick Stats or Tips */}
            <div className="space-y-6">
                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 shadow-sm">
                    <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                        <span>💡</span> Pro Tip
                    </h4>
                    <p className="text-sm text-blue-800 leading-relaxed">
                        For best results, ensure your CSV has these columns:
                        <br/><span className="font-mono bg-blue-100 px-1 rounded text-blue-900">address</span> (required)
                        <br/><span className="font-mono bg-blue-100 px-1 rounded text-blue-900">city</span>, <span className="font-mono bg-blue-100 px-1 rounded text-blue-900">state</span>, <span className="font-mono bg-blue-100 px-1 rounded text-blue-900">country</span>
                    </p>
                </div>
                
                {currentBatch && (
                    <div className="bg-green-50 p-6 rounded-2xl border border-green-100 shadow-sm animate-in slide-in-from-right">
                        <h4 className="font-bold text-green-900 mb-2 flex items-center gap-2">
                            <span>🚀</span> Batch #{currentBatch.batchId} Started
                        </h4>
                        <p className="text-sm text-green-800 mb-4">
                            Your file is being processed in the background. You can close this window; we will email you when it is done.
                        </p>
                        <button onClick={() => loadBatches(email)} className="text-green-700 text-sm font-semibold underline hover:text-green-900">
                            Refresh Status
                        </button>
                    </div>
                )}
            </div>
          </div>
        )}

        {/* Help Modal */}
        {showHelp && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-2xl p-8 max-w-lg w-full relative shadow-2xl animate-in zoom-in-95">
                    <button 
                        onClick={() => setShowHelp(false)}
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center transition"
                    >
                        ×
                    </button>
                    <h3 className="text-2xl font-bold text-gray-900 mb-4">CSV Formatting Guide</h3>
                    <p className="text-gray-600 mb-4">Upload a standard CSV file with headers.</p>
                    
                    <div className="bg-gray-800 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto mb-6 shadow-inner">
                        address,city,zip<br/>
                        123 Main St,New York,10001<br/>
                        456 Elm Ave,Boston,02110
                    </div>
                    
                    <button 
                        onClick={() => setShowHelp(false)}
                        className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition shadow-md"
                    >
                        Got it, thanks!
                    </button>
                </div>
            </div>
        )}
      </main>
    </div>
  );
}