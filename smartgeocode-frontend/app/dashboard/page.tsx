'use client';

import { useState, useEffect, useRef } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { loadStripe } from '@stripe/stripe-js';

// Load Stripe promise
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
  
  // LIVE POLLING STATE
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  // Ref is critical for setInterval to see the current email
  const emailRef = useRef('');

  // Tabs State
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('batch');

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
      emailRef.current = storedEmail; // Sync ref immediately
      
      const token = localStorage.getItem('token'); 

      if (storedEmail) {
        // 1. Fetch Subscription & Load Batches
        fetch(`/api/me?email=${encodeURIComponent(storedEmail)}`)
          .then(res => res.json())
          .then(data => {
            const status = data.subscription_status || 'free';
            setSubscription(status);
            loadBatches(storedEmail);
          })
          .catch(() => setSubscription('free'));
      } else {
        setSubscription('free');
      }

      // 2. Fetch Usage
      if (token) {
        fetchUsage(token);
      } else {
        setUsageLoading(false);
      }
    }
    // Cleanup polling on unmount
    return () => stopPolling();
  }, []);

  const fetchUsage = (token: string) => {
      fetch('/api/usage', {
          headers: { 'Authorization': `Bearer ${token}` },
      })
      .then(res => res.json())
      .then(data => {
          setUsage(data);
          setUsageLoading(false);
      })
      .catch(console.error);
  };

  // --- LIVE POLLING LOGIC ---
  const startPolling = (batchId: number) => {
    stopPolling(); // Clear existing
    
    // Use REF to get email inside interval
    const currentEmail = emailRef.current || localStorage.getItem('email') || '';
    if (!currentEmail) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/batch/${batchId}?email=${encodeURIComponent(currentEmail)}`);
        const data = await res.json();
        
        // 1. Update UI with latest stats and preview rows
        setCurrentBatch((prev: any) => ({
            ...prev,
            status: data.status,
            processedRows: data.processedRows,
            totalRows: data.totalRows,
            preview: data.preview || [] // This populates the table LIVE
        }));

        // 2. Update Usage Counter LIVE
        const token = localStorage.getItem('token');
        if (token) fetchUsage(token);

        // 3. Stop if done
        if (data.status === 'complete' || data.status === 'failed') {
            stopPolling();
            loadBatches(currentEmail); // Refresh history list
            toast.success(data.status === 'complete' ? 'Batch Complete!' : 'Batch Failed');
        }
      } catch (e) { 
          // Ignore transient network errors during polling
      }
    }, 2000); // Poll every 2 seconds
    setPollInterval(interval);
  };

  const stopPolling = () => {
    if (pollInterval) clearInterval(pollInterval);
    setPollInterval(null);
  };

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
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('email', email);
    
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
        if (res.status === 403) throw new Error(errData.message || "Monthly limit reached. Please upgrade.");
        throw new Error(errData.message || `HTTP error: ${res.status}`);
      }

      const data = await res.json();
      if (data.status === 'success') {
        // Init UI immediately
        setCurrentBatch({
            batchId: data.batchId,
            status: 'processing',
            totalRows: data.totalRows || 0,
            processedRows: 0,
            preview: [] 
        });
        
        loadBatches(email);
        toast.success('Batch started! Processing...');
        
        // START POLLING
        startPolling(data.batchId);
        
      } else {
        setError(data.message || 'Batch processing failed');
        toast.error('Batch failed');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const downloadBatch = (id: number) => {
    window.open(`/api/batch/${id}/download?email=${encodeURIComponent(email)}`);
  };

  const downloadSample = () => {
    const csv = `address,landmark,city,state,country\n` +
                `1600 Pennsylvania Ave NW,White House,Washington,DC,USA\n` +
                `Empire State Building,,New York,NY,USA\n` +
                `10 Downing Street,,London,,UK\n`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'smartgeocode_sample.csv';
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
        await fetch('/api/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, address, result: data }),
        });
        if(token) fetchUsage(token);
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
      if (data.url) window.location.href = data.url;
    } catch (error) { toast.error('Upgrade failed'); }
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

      {/* DASHBOARD TOOLBAR */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center space-x-4 mb-3 md:mb-0">
            <h2 className="text-lg font-bold text-gray-800">My Dashboard</h2>
            <span className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider ${subscription === 'premium' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-700'}`}>
                {subscription === 'premium' ? 'Premium Plan' : 'Free Plan'}
            </span>
          </div>

          <div className="flex items-center space-x-6">
            {!usageLoading && (
              <div className="flex items-center gap-4">
                <div className="text-right">
                    <p className="text-xs text-gray-500 uppercase font-bold">Usage</p>
                    <p className="text-sm font-bold text-gray-800">{usage.used} / {usage.limit}</p>
                </div>
                <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                        className={`h-full transition-all duration-500 ${usage.used >= usage.limit ? 'bg-red-500' : 'bg-green-500'}`} 
                        style={{ width: `${Math.min((usage.used / usage.limit) * 100, 100)}%` }}
                    />
                </div>
              </div>
            )}

            {subscription === 'premium' ? (
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
                className="text-red-600 text-sm font-semibold hover:underline"
              >
                Manage Plan
              </button>
            ) : (
               <button
                onClick={handleUpsell}
                className="bg-yellow-400 text-red-900 px-4 py-2 rounded text-sm font-bold hover:bg-yellow-300 transition shadow-sm"
              >
                Upgrade to Pro
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-6 md:p-10">
        
        {/* TABS */}
        <div className="flex justify-center mb-8">
            <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-200 inline-flex">
                <button
                    onClick={() => setActiveTab('batch')}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                        activeTab === 'batch' ? 'bg-red-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-900'
                    }`}
                >
                    Batch Upload
                </button>
                <button
                    onClick={() => setActiveTab('single')}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                        activeTab === 'single' ? 'bg-red-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-900'
                    }`}
                >
                    Single Lookup
                </button>
            </div>
        </div>

        {/* --- BATCH UPLOAD VIEW --- */}
        {activeTab === 'batch' && (
          <div className="grid lg:grid-cols-3 gap-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Left: Upload */}
            <div className="lg:col-span-2 space-y-8">
                <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800">Batch Geocoding</h2>
                            {subscription === 'free' && (
                                <p className="text-xs text-red-600 font-medium mt-1">Free Plan Limit: 500 rows/mo</p>
                            )}
                        </div>
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

                    {error && (
                        <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
                            <strong>Error:</strong> {error}
                            {subscription === 'free' && error.includes('limit') && (
                                <div className="mt-2">
                                    <button onClick={handleUpsell} className="text-red-900 underline font-bold hover:text-red-700">
                                        Upgrade to Premium for Unlimited
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* LIVE PROGRESS & RESULTS */}
                    {currentBatch && (
                        <div className="bg-white p-8 rounded-2xl shadow border border-gray-100 animate-in slide-in-from-bottom-4 mt-8">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold">
                                    {currentBatch.status === 'processing' ? 'Processing...' : 'Batch Results'}
                                </h3>
                                <span className={`px-3 py-1 rounded font-bold text-sm ${currentBatch.status === 'complete' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {currentBatch.status ? currentBatch.status.toUpperCase() : 'PENDING'}
                                </span>
                            </div>

                            {currentBatch.status === 'processing' && (
                                <div className="mb-6">
                                    <div className="flex justify-between text-sm mb-1 font-medium text-gray-600">
                                        <span>Progress</span>
                                        <span>{currentBatch.processedRows || 0} / {currentBatch.totalRows || '?'}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                        <div 
                                            className="bg-blue-600 h-3 transition-all duration-500 ease-out" 
                                            style={{ width: `${(currentBatch.processedRows / (currentBatch.totalRows || 1)) * 100}%` }}
                                        ></div>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-2 text-center animate-pulse">Do not close this tab while processing...</p>
                                </div>
                            )}

                            {currentBatch.preview && currentBatch.preview.length > 0 && (
                                <div className="overflow-x-auto border rounded-lg max-h-96">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 sticky top-0">
                                            <tr>
                                                <th className="p-3 border-b">Address</th>
                                                <th className="p-3 border-b">Result</th>
                                                <th className="p-3 border-b">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentBatch.preview.map((row: any, i: number) => (
                                                <tr key={i} className="hover:bg-gray-50 border-b last:border-0">
                                                    <td className="p-3 max-w-xs truncate" title={row.address}>{row.address}</td>
                                                    <td className="p-3 font-mono text-xs">{row.lat ? `${row.lat}, ${row.lng}` : '-'}</td>
                                                    <td className="p-3 font-bold text-green-600">{row.status}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            
                            {(currentBatch.status === 'complete' || currentBatch.status === 'processing') && (
                                <button onClick={() => downloadBatch(currentBatch.batchId)} className="mt-6 w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 shadow-md">
                                    Download Full CSV
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Right: History Column */}
            <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100 h-fit">
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
        )}

        {/* --- SINGLE LOOKUP VIEW --- */}
        {activeTab === 'single' && (
             <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow border border-gray-100 animate-in fade-in">
                 <h2 className="text-2xl font-bold mb-6 text-center">Single Lookup</h2>
                 <form onSubmit={handleSingleSubmit} className="space-y-4">
                    <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Enter Address" className="w-full p-3 border rounded-lg" required />
                    <button type="submit" disabled={singleLoading} className="w-full bg-red-600 text-white py-3 rounded-lg font-bold">{singleLoading ? 'Searching...' : 'Lookup'}</button>
                 </form>
                 {singleResults && (
                    <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
                        <p><strong>Lat/Lng:</strong> {singleResults.lat}, {singleResults.lng}</p>
                        <p><strong>Addr:</strong> {singleResults.formatted_address}</p>
                    </div>
                 )}
             </div>
        )}

        {/* Help Modal */}
        {showHelp && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-white p-8 rounded-2xl max-w-md w-full relative shadow-2xl animate-in zoom-in-95">
                    <button onClick={() => setShowHelp(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center transition">×</button>
                    <h3 className="font-bold text-xl mb-4 text-gray-900">CSV Format</h3>
                    <p className="text-gray-600 mb-4">Required header: <code>address</code></p>
                    <div className="bg-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
                        address,city,zip<br/>123 Main St,NY,10001
                    </div>
                </div>
            </div>
        )}
      </main>
    </div>
  );
}