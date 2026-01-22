'use client';

import { useState, useEffect, useRef } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { loadStripe } from '@stripe/stripe-js';

// Load Stripe promise (ensure your ENV variable is set)
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function Dashboard() {
  // ==========================================
  // 1. STATE MANAGEMENT
  // ==========================================

  // User Authentication & Subscription State
  const [subscription, setSubscription] = useState<'free' | 'premium' | 'loading'>('loading');
  const [email, setEmail] = useState<string>('');
  
  // Batch Processing State
  const [batches, setBatches] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentBatch, setCurrentBatch] = useState<any>(null);
  
  // UI Interaction State
  const [error, setError] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('batch');

  // Single Lookup State
  const [address, setAddress] = useState('');
  const [singleResults, setSingleResults] = useState<any>(null);
  const [singleLoading, setSingleLoading] = useState(false);
  const lastAddressRef = useRef<string>('');

  // Usage Stats State (Credits)
  const [usage, setUsage] = useState({ used: 0, limit: 500 });
  const [usageLoading, setUsageLoading] = useState(true);

  // ==========================================
  // 2. LIVE POLLING CONFIGURATION
  // ==========================================
  // We use 'pollingBatchId' to control the loop. If it's set, we poll. If null, we stop.
  const [pollingBatchId, setPollingBatchId] = useState<number | null>(null);
  
  // Refs to access latest state inside intervals without closures issues
  const emailRef = useRef(''); 
  const notifiedRef = useRef<Set<number>>(new Set()); // Tracks batches we have already toasted

  // ==========================================
  // 3. INITIALIZATION EFFECTS
  // ==========================================
  useEffect(() => {
    // Ensure we are running on the client
    if (typeof window !== 'undefined') {
      const storedEmail = (localStorage.getItem('email') || '').toLowerCase().trim();
      setEmail(storedEmail);
      emailRef.current = storedEmail; // Sync ref immediately
      
      const token = localStorage.getItem('token'); 

      if (storedEmail) {
        // Fetch User Subscription Status
        fetch(`/api/me?email=${encodeURIComponent(storedEmail)}`)
          .then(res => {
              if (!res.ok) throw new Error("Failed to fetch user details");
              return res.json();
          })
          .then(data => {
            const status = data.subscription_status || 'free';
            setSubscription(status);
            // Load Batch History
            loadBatches(storedEmail);
          })
          .catch((err) => {
              console.error("Auth check failed:", err);
              setSubscription('free');
          });
      } else {
        setSubscription('free');
      }

      // Fetch Usage Stats
      if (token) {
        fetchUsage(token);
      } else {
        setUsageLoading(false);
      }
    }
  }, []);

  // ==========================================
  // 4. THE ROBUST POLLING ENGINE
  // ==========================================
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    // Only start the interval if we have a valid Batch ID to watch
    if (pollingBatchId !== null) {
        console.log(`[Polling Engine] Starting watch for Batch #${pollingBatchId}`);
        
        intervalId = setInterval(async () => {
            const currentEmail = emailRef.current || localStorage.getItem('email') || '';
            const token = localStorage.getItem('token'); 

            try {
                // Poll the Batch Status Endpoint
                const res = await fetch(`/api/batch/${pollingBatchId}?email=${encodeURIComponent(currentEmail)}`);
                
                if (!res.ok) {
                    console.warn("Poll request failed", res.status);
                    return;
                }

                const data = await res.json();
                
                // Update the UI with the latest progress
                setCurrentBatch((prev: any) => ({
                    ...prev,
                    status: data.status,
                    processedRows: data.processedRows,
                    totalRows: data.totalRows,
                    preview: data.preview || [] 
                }));

                // CRITICAL: Refresh Usage Counter Live on every tick
                // This connects the backend increment to the frontend UI
                if (token) {
                    fetchUsage(token);
                }

                // Check for Stop Conditions (Complete or Failed)
                if (data.status === 'complete' || data.status === 'failed') {
                    console.log(`[Polling Engine] Batch ${pollingBatchId} finished. Stopping.`);
                    
                    // Stop the loop by clearing state
                    setPollingBatchId(null); 
                    
                    // Refresh the history list
                    loadBatches(currentEmail);

                    // Notification Logic (Prevent Toast Spam)
                    if (!notifiedRef.current.has(pollingBatchId)) {
                        if (data.status === 'complete') {
                            toast.success('Batch Processing Complete!');
                        } else {
                            toast.error('Batch Failed - Check file format.');
                        }
                        notifiedRef.current.add(pollingBatchId);
                    }
                }
            } catch (e) { 
                console.error("[Polling Engine] Network error tick:", e);
            }
        }, 2000); // Poll every 2 seconds
    }

    // Cleanup function: React runs this when component unmounts OR when pollingBatchId changes
    return () => {
        if (intervalId) {
            console.log("[Polling Engine] Cleanup triggered. Clearing interval.");
            clearInterval(intervalId);
        }
    };
  }, [pollingBatchId]);

  // ==========================================
  // 5. HELPER FUNCTIONS & HANDLERS
  // ==========================================

  // Fetch Usage with Cache Busting
  const fetchUsage = (token: string) => {
      // We append ?t=... to force the browser to ignore cache and get fresh DB values
      fetch(`/api/usage?t=${Date.now()}`, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
      })
      .then(res => {
          if (res.status === 401) {
              toast.error("Session expired. Please log in again.");
              // Optional: Redirect to login
              return null;
          }
          if (!res.ok) throw new Error("Usage fetch failed");
          return res.json();
      })
      .then(data => {
          if (data) {
              setUsage({ used: data.used || 0, limit: data.limit || 500 });
              setUsageLoading(false);
          }
      })
      .catch(err => {
          console.error("Usage Error:", err);
          setUsageLoading(false);
      });
  };

  const loadBatches = async (userEmail: string) => {
    try {
      const res = await fetch(`/api/batches?email=${encodeURIComponent(userEmail)}`);
      const data = await res.json();
      if (Array.isArray(data)) {
          setBatches(data);
      } else {
          setBatches([]);
      }
    } catch (err) {
      console.error('Load batches error:', err);
      setBatches([]);
    }
  };

  const handleBatchUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !email) {
        toast.error("Please select a file and ensure you are logged in.");
        return;
    }

    setLoading(true);
    setError('');
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('email', email);
    
    const token = localStorage.getItem('token');
    if (!token) {
        toast.error("Session expired. Please log in again.");
        setLoading(false);
        return;
    }

    try {
      const res = await fetch('/api/batch-geocode', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        // Specific Limit Error Handling
        if (res.status === 403) {
            throw new Error(errData.message || "Monthly limit reached. Please upgrade to continue.");
        }
        throw new Error(errData.message || `HTTP error: ${res.status}`);
      }

      const data = await res.json();
      if (data.status === 'success') {
        // Initialize the Batch UI immediately
        setCurrentBatch({
            batchId: data.batchId,
            status: 'processing',
            totalRows: data.totalRows || 0,
            processedRows: 0,
            preview: [] 
        });
        
        loadBatches(email);
        toast.success('Batch started! Processing in background...');
        
        // TRIGGER POLLING via State Change
        setPollingBatchId(data.batchId);
      } else {
        setError(data.message || 'Batch processing failed');
        toast.error('Batch failed to start');
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
    // Generates a sample CSV on the fly with proper headers
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
    
    const headers: HeadersInit = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`, {
          headers: headers
      });
      
      if (!res.ok) {
          if (res.status === 403) throw new Error("Limit Reached: Please upgrade your plan.");
          if (res.status === 401) throw new Error("Unauthorized: Please log in again.");
          throw new Error("Geocode failed: " + res.statusText);
      }

      const data = await res.json();
      setSingleResults(data);
      
      if (data.status === 'success') {
        lastAddressRef.current = address;
        
        // Optional: Send email in background (Fire & Forget)
        fetch('/api/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, address, result: data }),
        }).catch(err => console.error("Email send failed (non-critical):", err));

        // Update Usage Counter Immediately
        if(token) fetchUsage(token);
        
        toast.success('Result found!');
      } else {
        toast.error(data.message || 'Geocode failed');
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Connection error - check your network.');
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

  // --- RENDER LOADING STATE ---
  if (subscription === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
            <p className="text-xl font-semibold text-gray-700 animate-pulse">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // --- RENDER MAIN DASHBOARD ---
  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />

      {/* DASHBOARD TOOLBAR */}
      {/* Designed to sit below the Global Header without duplication */}
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
                <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden border border-gray-300 relative">
                    <div 
                        className={`h-full transition-all duration-500 ${usage.used >= usage.limit ? 'bg-red-500' : 'bg-green-500'}`} 
                        style={{ width: `${Math.min((usage.used / usage.limit) * 100, 100)}%` }}
                    />
                </div>
              </div>
            )}

            {subscription === 'free' && (
               <button 
                onClick={handleUpsell} 
                className="bg-yellow-400 text-red-900 px-4 py-2 rounded text-sm font-bold hover:bg-yellow-300 shadow-sm transition transform hover:scale-105"
               >
                Upgrade to Pro
              </button>
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
                className="text-red-600 text-sm font-semibold hover:underline cursor-pointer"
              >
                Manage Plan
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-6 md:p-10">
        
        {/* TABS SELECTION */}
        <div className="flex justify-center mb-8">
            <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-200 inline-flex">
                <button
                    onClick={() => setActiveTab('batch')}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                        activeTab === 'batch' 
                        ? 'bg-red-600 text-white shadow-md' 
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                >
                    Batch Upload
                </button>
                <button
                    onClick={() => setActiveTab('single')}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                        activeTab === 'single' 
                        ? 'bg-red-600 text-white shadow-md' 
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                >
                    Single Lookup
                </button>
            </div>
        </div>

        {/* ======================= */}
        {/* BATCH UPLOAD VIEW    */}
        {/* ======================= */}
        {activeTab === 'batch' && (
          <div className="grid lg:grid-cols-3 gap-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Left Column: Upload & Live Results */}
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
                            <button onClick={downloadSample} className="text-red-600 hover:text-red-800 flex items-center gap-1 cursor-pointer">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                Sample CSV
                            </button>
                            <button onClick={() => setShowHelp(true)} className="text-gray-500 hover:text-gray-700 cursor-pointer">Help?</button>
                        </div>
                    </div>

                    {/* Upload Form */}
                    <form onSubmit={handleBatchUpload}>
                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-gray-50 transition cursor-pointer relative group mb-6">
                            <input 
                                type="file" 
                                accept=".csv" 
                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                            />
                            <div className="pointer-events-none">
                                <div className="text-5xl text-gray-300 group-hover:text-red-400 mb-4 transition-colors">☁️</div>
                                <p className="text-lg font-medium text-gray-700">
                                    {file ? <span className="text-green-600 font-bold">{file.name}</span> : "Click to Upload CSV"}
                                </p>
                                <p className="text-sm text-gray-400 mt-2">Drag and drop supported</p>
                            </div>
                        </div>
                        <button 
                            type="submit" 
                            disabled={loading || !file}
                            className="w-full bg-red-600 text-white py-3 rounded-xl font-bold text-lg hover:bg-red-700 disabled:opacity-50 shadow-md transition transform hover:-translate-y-0.5 active:translate-y-0"
                        >
                            {loading ? 'Processing...' : 'Start Batch Process'}
                        </button>
                    </form>
                    
                    {error && (
                        <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg font-medium border border-red-200 flex items-start gap-2">
                            <span>⚠️</span>
                            <span>{error}</span>
                        </div>
                    )}

                    {/* SUCCESS BANNER (Shown when batch starts) */}
                    {currentBatch && currentBatch.status === 'processing' && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                             <div className="bg-green-100 p-2 rounded-full text-green-600">🚀</div>
                             <div>
                                 <h4 className="font-bold text-green-900 text-sm">Batch #{currentBatch.batchId} Started</h4>
                                 <p className="text-xs text-green-800">Your file is being processed in the background. You can close this window.</p>
                             </div>
                        </div>
                    )}

                    {/* LIVE RESULTS TABLE */}
                    {currentBatch && (
                        <div className="bg-white p-6 rounded-2xl shadow border border-gray-100 mt-8 animate-in slide-in-from-bottom-4">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-lg text-gray-800">
                                    Results ({currentBatch.processedRows}/{currentBatch.totalRows || '?'})
                                </h3>
                                <span className={`px-3 py-1 rounded font-bold text-sm ${currentBatch.status === 'complete' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {currentBatch.status ? currentBatch.status.toUpperCase() : "UNKNOWN"}
                                </span>
                            </div>
                            
                            {/* Live Progress Bar */}
                            {currentBatch.status === 'processing' && (
                                <div className="mb-4">
                                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                        <div 
                                            className="bg-blue-600 h-2 transition-all duration-500 ease-out" 
                                            style={{ width: `${(currentBatch.processedRows / (currentBatch.totalRows || 1)) * 100}%` }}
                                        ></div>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1 text-center animate-pulse">Syncing with server...</p>
                                </div>
                            )}

                            {/* Live Table */}
                            {currentBatch.preview && currentBatch.preview.length > 0 ? (
                                <div className="overflow-x-auto border rounded-lg max-h-80">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 sticky top-0 z-10">
                                            <tr>
                                                <th className="p-3 font-semibold text-gray-700 bg-gray-50 border-b">Address</th>
                                                <th className="p-3 font-semibold text-gray-700 bg-gray-50 border-b">Lat/Lng</th>
                                                <th className="p-3 font-semibold text-gray-700 bg-gray-50 border-b">Status</th>
                                                <th className="p-3 font-semibold text-gray-700 bg-gray-50 border-b">Map</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentBatch.preview.map((row: any, i: number) => (
                                                <tr key={i} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                                                    <td className="p-3 truncate max-w-xs text-gray-700">{row.address}</td>
                                                    <td className="p-3 font-mono text-xs text-gray-600">{row.lat ? `${row.lat}, ${row.lng}` : '-'}</td>
                                                    <td className="p-3 font-bold text-green-600">{row.status}</td>
                                                    {/* NEW: Map Pin Link */}
                                                    <td className="p-3">
                                                        {row.lat && (
                                                            <a 
                                                                href={`https://www.google.com/maps/search/?api=1&query=${row.lat},${row.lng}`} 
                                                                target="_blank" 
                                                                rel="noreferrer"
                                                                className="text-xl hover:scale-110 block transition-transform text-center"
                                                                title="View on Google Maps"
                                                            >
                                                                📍
                                                            </a>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-400 italic text-sm bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                    Waiting for first result...
                                </div>
                            )}
                            
                            {(currentBatch.status === 'complete' || currentBatch.status === 'processing') && (
                                <button 
                                    onClick={() => downloadBatch(currentBatch.batchId)} 
                                    className="mt-6 w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 shadow-md transition"
                                >
                                    Download Full CSV
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Column: History & Tips */}
            <div className="space-y-6">
                {/* Pro Tip Box */}
                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 shadow-sm">
                    <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2"><span>💡</span> Pro Tip</h4>
                    <p className="text-sm text-blue-800 leading-relaxed">
                        For best results, ensure your CSV has these columns: <br/>
                        <code className="bg-blue-100 px-1 rounded mx-1 text-blue-900 font-bold">address</code> (required)<br/>
                        <code className="bg-blue-100 px-1 rounded mx-1 text-blue-900 font-bold">city</code> 
                        <code className="bg-blue-100 px-1 rounded mx-1 text-blue-900 font-bold">state</code> 
                        <code className="bg-blue-100 px-1 rounded mx-1 text-blue-900 font-bold">country</code>
                    </p>
                </div>

                {/* History Table */}
                <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 h-fit max-h-96 overflow-y-auto">
                    <h3 className="font-bold text-lg mb-4 text-gray-800">History</h3>
                    {batches.length === 0 ? (
                        <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                            <p className="text-gray-400 text-sm italic">No batches yet.</p> 
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {batches.map(b => (
                                <div key={b.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-sm text-gray-800">Batch #{b.id}</p>
                                            {b.status === 'processing' && <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>}
                                        </div>
                                        <p className="text-xs text-gray-500">{new Date(b.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => downloadBatch(b.id)} 
                                            className="text-red-600 text-xs font-bold border border-red-200 px-3 py-1 rounded hover:bg-red-50 transition"
                                        >
                                            Download
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
          </div>
        )}

        {/* ======================= */}
        {/* SINGLE LOOKUP VIEW    */}
        {/* ======================= */}
        {activeTab === 'single' && (
             <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
                 <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Single Lookup</h2>
                 <form onSubmit={handleSingleSubmit} className="space-y-4">
                    <input 
                        type="text" 
                        value={address} 
                        onChange={e => setAddress(e.target.value)} 
                        placeholder="Enter full address (e.g. 123 Main St, New York)" 
                        className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-lg shadow-sm" 
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
                    <div className="mt-8 animate-in fade-in slide-in-from-bottom-2">
                        <div className="p-6 bg-green-50 rounded-xl border border-green-200 mb-6 shadow-sm">
                            <h3 className="font-bold text-green-900 mb-2 text-lg">✅ Result Found</h3>
                            <div className="grid grid-cols-2 gap-4 text-sm text-gray-700">
                                <div>
                                    <p className="font-bold text-gray-900">Latitude</p>
                                    <p className="font-mono text-gray-600">{singleResults.lat}</p>
                                </div>
                                <div>
                                    <p className="font-bold text-gray-900">Longitude</p>
                                    <p className="font-mono text-gray-600">{singleResults.lng}</p>
                                </div>
                                <div className="col-span-2 border-t pt-2 mt-2">
                                    <p className="font-bold text-gray-900">Formatted Address</p>
                                    <p className="text-gray-600">{singleResults.formatted_address}</p>
                                </div>
                            </div>
                        </div>
                        
                        {/* VISUAL MAP PREVIEW (OpenStreetMap) */}
                        {singleResults.lat && (
                            <div className="rounded-xl overflow-hidden border border-gray-300 shadow-lg h-64 relative group mt-6">
                                <iframe
                                    width="100%"
                                    height="100%"
                                    frameBorder="0"
                                    scrolling="no"
                                    marginHeight={0}
                                    marginWidth={0}
                                    title="Map Preview"
                                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(singleResults.lng)-0.005}%2C${parseFloat(singleResults.lat)-0.005}%2C${parseFloat(singleResults.lng)+0.005}%2C${parseFloat(singleResults.lat)+0.005}&layer=mapnik&marker=${singleResults.lat}%2C${singleResults.lng}`}
                                ></iframe>
                                <a 
                                    href={`https://www.google.com/maps/search/?api=1&query=${singleResults.lat},${singleResults.lng}`} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="absolute bottom-4 right-4 bg-white text-blue-600 px-4 py-2 rounded-lg font-bold shadow-md hover:bg-blue-50 transition text-sm"
                                >
                                    Open in Google Maps ↗
                                </a>
                            </div>
                        )}
                    </div>
                 )}
             </div>
        )}

        {/* HELP MODAL */}
        {showHelp && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white p-8 rounded-2xl max-w-lg w-full relative shadow-2xl animate-in zoom-in-95">
                    <button 
                        onClick={() => setShowHelp(false)} 
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center transition"
                    >
                        ×
                    </button>
                    <h3 className="font-bold text-2xl mb-4 text-gray-900">CSV Formatting Guide</h3>
                    <p className="text-gray-600 mb-4">Upload a standard CSV file with headers. The more details, the better the accuracy.</p>
                    
                    <div className="bg-gray-800 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto mb-6 shadow-inner">
                        <code className="block mb-2 text-green-400"># Recommended Structure</code>
                        <div className="whitespace-pre">
                            address,city,state,country,landmark<br/>
                            "1600 Penn Ave",Washington,DC,USA,"White House"<br/>
                            ,Tokyo,,Japan,"Tokyo Tower"
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => setShowHelp(false)} 
                        className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition shadow-md mt-4"
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