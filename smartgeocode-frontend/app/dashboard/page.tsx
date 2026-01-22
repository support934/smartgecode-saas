'use client';

import { useState, useEffect, useRef } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { loadStripe } from '@stripe/stripe-js';

// Load Stripe promise (ensure your ENV variable is set correctly)
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function Dashboard() {
  // =========================================================================================
  // 1. STATE MANAGEMENT
  // =========================================================================================

  // User Identity & Subscription Status
  const [subscription, setSubscription] = useState<'free' | 'premium' | 'loading'>('loading');
  const [email, setEmail] = useState<string>('');
  
  // Batch Processing Data
  const [batches, setBatches] = useState<any[]>([]);
  const [currentBatch, setCurrentBatch] = useState<any>(null);
  
  // File Upload State
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Single Lookup State
  const [address, setAddress] = useState('');
  const [singleResults, setSingleResults] = useState<any>(null);
  const [singleLoading, setSingleLoading] = useState(false);
  const lastAddressRef = useRef<string>('');

  // Usage & Credit System
  const [usage, setUsage] = useState({ used: 0, limit: 500 });
  const [usageLoading, setUsageLoading] = useState(true);

  // UI Toggles & Errors
  const [error, setError] = useState('');
  const [limitReached, setLimitReached] = useState(false); // Tracks 403 Errors specifically
  const [showHelp, setShowHelp] = useState(false);
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('batch');

  // =========================================================================================
  // 2. ROBUST POLLING STATE
  // =========================================================================================
  // We track the *ID* of the batch we are currently polling. 
  // If this is null, polling is OFF. If it is a number, polling is ON.
  const [pollingBatchId, setPollingBatchId] = useState<number | null>(null);
  
  // Refs are used to access the latest state inside intervals/timeouts without closure staleness
  const emailRef = useRef(''); 
  const notifiedRef = useRef<Set<number>>(new Set()); // Prevents duplicate "Success" toasts

  // =========================================================================================
  // 3. INITIALIZATION & AUTH CHECK
  // =========================================================================================
  useEffect(() => {
    // Ensure code only runs on the client-side
    if (typeof window !== 'undefined') {
      const storedEmail = (localStorage.getItem('email') || '').toLowerCase().trim();
      setEmail(storedEmail);
      emailRef.current = storedEmail; // Sync ref immediately
      
      const token = localStorage.getItem('token'); 

      if (storedEmail) {
        // 1. Fetch Subscription Status
        fetch(`/api/me?email=${encodeURIComponent(storedEmail)}`)
          .then(res => {
              if (!res.ok) throw new Error("Failed to fetch user details");
              return res.json();
          })
          .then(data => {
            const status = data.subscription_status || 'free';
            setSubscription(status);
            // 2. Load Batch History
            loadBatches(storedEmail);
          })
          .catch((err) => {
              console.error("Auth check failed:", err);
              // Default to free if check fails (failsafe)
              setSubscription('free');
          });
      } else {
        setSubscription('free');
      }

      // 3. Fetch Usage Stats
      if (token) {
        fetchUsage(token);
      } else {
        setUsageLoading(false);
      }
    }
  }, []);

  // =========================================================================================
  // 4. USAGE DATA FETCHER
  // =========================================================================================
  const fetchUsage = (token: string) => {
      // Append timestamp (?t=) to force browser to skip cache and get fresh DB values
      fetch(`/api/usage?t=${Date.now()}`, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
      })
      .then(res => {
          // SAFETY VALVE: If token is invalid (Backend restarted?), log out user to prevent "Stuck" state
          if (res.status === 401) {
              console.warn("Session expired (401). Redirecting to login...");
              toast.error("Session expired. Please log in again.");
              localStorage.removeItem('token');
              localStorage.removeItem('email');
              setTimeout(() => window.location.href = '/login', 1500);
              return null;
          }
          if (!res.ok) throw new Error("Usage fetch failed");
          return res.json();
      })
      .then(data => {
          if (data) {
              setUsage({ 
                  used: data.used || 0, 
                  limit: data.limit || 500 
              });
              setUsageLoading(false);
          }
      })
      .catch(err => {
          console.error("Usage Error:", err);
          setUsageLoading(false);
      });
  };

  // =========================================================================================
  // 5. THE POLLING ENGINE (useEffect Implementation)
  // =========================================================================================
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (pollingBatchId !== null) {
        console.log(`[Polling Engine] Starting poll for Batch #${pollingBatchId}`);
        
        intervalId = setInterval(async () => {
            const currentEmail = emailRef.current || localStorage.getItem('email') || '';
            const token = localStorage.getItem('token'); 

            try {
                // Poll Batch Status
                const res = await fetch(`/api/batch/${pollingBatchId}?email=${encodeURIComponent(currentEmail)}`);
                
                // Handle session expiry during polling
                if (res.status === 401) {
                    setPollingBatchId(null);
                    localStorage.removeItem('token');
                    window.location.href = '/login';
                    return;
                }

                if (!res.ok) {
                    console.warn(`[Polling Engine] Poll failed: ${res.status}`);
                    return;
                }

                const data = await res.json();
                
                // UPDATE UI: Sync local state with server progress
                setCurrentBatch((prev: any) => ({
                    ...prev,
                    status: data.status,
                    processedRows: data.processedRows,
                    totalRows: data.totalRows,
                    preview: data.preview || [] 
                }));

                // UPDATE USAGE: Fetch fresh counter from DB
                // This connects the backend increment to the frontend UI
                if (token) {
                    fetchUsage(token);
                }

                // STOP CONDITION: Is the batch done?
                if (data.status === 'complete' || data.status === 'failed') {
                    console.log(`[Polling Engine] Batch ${pollingBatchId} finished. Stopping Loop.`);
                    
                    // 1. Kill the loop state
                    setPollingBatchId(null); 
                    
                    // 2. Refresh History List
                    loadBatches(currentEmail);

                    // 3. Notify User (Once only)
                    if (!notifiedRef.current.has(pollingBatchId)) {
                        if (data.status === 'complete') {
                            toast.success('Batch Processing Complete!');
                        } else {
                            toast.error('Batch Failed - Please check file format.');
                        }
                        notifiedRef.current.add(pollingBatchId);
                    }
                }
            } catch (e) {
                console.error("[Polling Engine] Network tick error:", e);
            }
        }, 2000); // Poll frequency: 2 seconds
    }

    // Cleanup: React runs this when component unmounts OR when pollingBatchId changes
    return () => {
        if (intervalId) {
            console.log("[Polling Engine] Cleaning up interval.");
            clearInterval(intervalId);
        }
    };
  }, [pollingBatchId]);

  // =========================================================================================
  // 6. ACTION HANDLERS
  // =========================================================================================

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
    
    // Validation
    if (!file) {
        toast.error("Please select a CSV file first.");
        return;
    }
    if (!email) {
        toast.error("User email not found. Please log in again.");
        return;
    }

    setLoading(true);
    setError('');
    setLimitReached(false); // Reset limit state
    
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
      // Send Upload Request
      const res = await fetch('/api/batch-geocode', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      // Handle Errors
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        
        // --- CRITICAL FIX: UPSELL TRIGGER ---
        // If we get a 403, we STOP here and trigger the Banner.
        // We do NOT throw an Error, because that would show the generic red box.
        if (res.status === 403) {
            setLimitReached(true); 
            setLoading(false);
            return; // Exit function gracefully
        }
        
        // For other errors (500, 400), throw as usual
        throw new Error(errData.message || `Upload failed with status: ${res.status}`);
      }

      // Handle Success
      const data = await res.json();
      if (data.status === 'success') {
        // Initialize UI State
        setCurrentBatch({
            batchId: data.batchId,
            status: 'processing',
            totalRows: data.totalRows || 0,
            processedRows: 0,
            preview: [] 
        });
        
        loadBatches(email);
        toast.success('Batch started! Processing in background...');
        
        // CRITICAL: Start Polling Loop via State
        setPollingBatchId(data.batchId);
      } else {
        setError(data.message || 'Batch processing failed to start.');
        toast.error('Batch failed to start');
      }
    } catch (err: unknown) {
      // This block runs ONLY for non-403 errors now
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      // Ensure loading state is cleared (unless we hit 403 and returned early)
      if (!limitReached) {
          setLoading(false);
      }
    }
  };

  const downloadBatch = (id: number) => {
    // Direct link to download endpoint
    window.open(`/api/batch/${id}/download?email=${encodeURIComponent(email)}`);
  };

  const downloadSample = () => {
    // Generate Sample CSV on the fly with proper headers
    const csvContent = `address,landmark,city,state,country\n` +
                       `1600 Pennsylvania Ave NW,White House,Washington,DC,USA\n` +
                       `Empire State Building,,New York,NY,USA\n` +
                       `10 Downing Street,,London,,UK\n`;
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'smartgeocode_sample.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSingleLoading(true);
    setLimitReached(false);
    const token = localStorage.getItem('token');
    
    const headers: HeadersInit = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`, {
          headers: headers
      });
      
      // Detailed Error Handling
      if (!res.ok) {
          if (res.status === 403) {
              setLimitReached(true); // Trigger UI Banner
              throw new Error("Monthly limit reached."); // Throw to exit, caught below
          }
          if (res.status === 401) {
              localStorage.removeItem('token');
              window.location.href = '/login';
              throw new Error("Unauthorized: Session expired.");
          }
          throw new Error(`Geocode failed: ${res.statusText}`);
      }

      const data = await res.json();
      setSingleResults(data);
      
      if (data.status === 'success') {
        lastAddressRef.current = address;
        
        // Fire & Forget Email (Optional)
        fetch('/api/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, address, result: data }),
        }).catch(err => console.error("Email send warning:", err));

        // Immediate Usage Update
        if(token) fetchUsage(token);
        
        toast.success('Result found!');
      } else {
        toast.error(data.message || 'Geocode failed - No result found.');
      }
    } catch (error: any) {
      // Don't show toast for limit reached, let the Banner handle it
      if (error.message !== "Monthly limit reached.") {
          toast.error(error.message || 'Connection error. Please try again.');
      }
    } finally {
      setSingleLoading(false);
    }
  };

  const handleUpsell = async () => {
    try {
      const payload = {
        email,
        address: lastAddressRef.current || 'Premium Upgrade Request',
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
          toast.error("Could not initiate checkout.");
      }
    } catch (error) { 
        toast.error('Upgrade failed. Please try again later.'); 
    }
  };

  const handleEnterpriseContact = () => {
      // Placeholder for Enterprise contact logic
      window.location.href = "mailto:sales@smartgeocode.io?subject=Enterprise%20Plan%20Inquiry";
  };

  // =========================================================================================
  // 7. RENDER (UI)
  // =========================================================================================

  if (subscription === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
            <p className="text-xl font-semibold text-gray-700 animate-pulse">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <Toaster position="top-right" />

      {/* --- DASHBOARD HEADER / TOOLBAR --- */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between">
          
          {/* Title Area */}
          <div className="flex items-center space-x-4 mb-3 md:mb-0">
            <h2 className="text-xl font-bold text-gray-800">My Dashboard</h2>
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                subscription === 'premium' 
                ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' 
                : 'bg-gray-100 text-gray-700 border border-gray-200'
            }`}>
                {subscription === 'premium' ? 'Premium Plan' : 'Free Plan'}
            </span>
          </div>

          {/* Actions Area */}
          <div className="flex items-center space-x-6">
            {!usageLoading && (
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wide">Usage Credits</p>
                    <p className="text-sm font-bold text-gray-800">{usage.used} / {usage.limit}</p>
                </div>
                {/* Usage Bar */}
                <div className="w-32 h-3 bg-gray-200 rounded-full overflow-hidden border border-gray-300 relative shadow-inner">
                    <div 
                        className={`h-full transition-all duration-500 ease-out ${
                            usage.used >= usage.limit ? 'bg-red-500' : 'bg-green-500'
                        }`} 
                        style={{ width: `${Math.min((usage.used / usage.limit) * 100, 100)}%` }}
                    />
                </div>
              </div>
            )}

            {/* Upgrade Button */}
            {subscription === 'free' && (
               <button 
                onClick={handleUpsell} 
                className="bg-yellow-400 text-red-900 px-5 py-2 rounded-lg text-sm font-bold hover:bg-yellow-300 shadow-md transition transform hover:-translate-y-0.5 active:translate-y-0 border border-yellow-500"
               >
                Upgrade to Pro
              </button>
            )}
            
            {/* Manage Plan Button */}
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
        
        {/* --- TABS SELECTION --- */}
        <div className="flex justify-center mb-10">
            <div className="bg-white p-1.5 rounded-xl shadow-sm border border-gray-200 inline-flex">
                <button
                    onClick={() => setActiveTab('batch')}
                    className={`px-8 py-3 rounded-lg text-sm font-bold transition-all duration-200 ${
                        activeTab === 'batch' 
                        ? 'bg-red-600 text-white shadow-md' 
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                >
                    Batch Upload
                </button>
                <button
                    onClick={() => setActiveTab('single')}
                    className={`px-8 py-3 rounded-lg text-sm font-bold transition-all duration-200 ${
                        activeTab === 'single' 
                        ? 'bg-red-600 text-white shadow-md' 
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                >
                    Single Lookup
                </button>
            </div>
        </div>

        {/* ==================================================================== */}
        {/* BATCH UPLOAD VIEW                                                    */}
        {/* ==================================================================== */}
        {activeTab === 'batch' && (
          <div className="grid lg:grid-cols-3 gap-8 animate-in fade-in zoom-in-95 duration-300">
            
            {/* LEFT COLUMN: Upload & Results */}
            <div className="lg:col-span-2 space-y-8">
                
                {/* Main Card */}
                <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800">Batch Geocoding</h2>
                            {subscription === 'free' && (
                                <p className="text-xs text-red-600 font-medium mt-1">Free Plan Limit: 500 rows/mo</p>
                            )}
                        </div>
                        <div className="flex items-center space-x-4 text-sm font-medium">
                            <button 
                                onClick={downloadSample} 
                                className="text-red-600 hover:text-red-800 flex items-center gap-1 cursor-pointer transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                Sample CSV
                            </button>
                            <button 
                                onClick={() => setShowHelp(true)} 
                                className="text-gray-500 hover:text-gray-800 cursor-pointer transition-colors"
                            >
                                Help?
                            </button>
                        </div>
                    </div>

                    {/* Drag & Drop Upload Zone */}
                    <form onSubmit={handleBatchUpload}>
                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center hover:bg-gray-50 transition-all cursor-pointer relative group mb-6 hover:border-red-300">
                            <input 
                                type="file" 
                                accept=".csv" 
                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                            />
                            <div className="pointer-events-none">
                                <div className="text-6xl text-gray-300 group-hover:text-red-400 mb-4 transition-colors">☁️</div>
                                <p className="text-xl font-medium text-gray-700">
                                    {file ? <span className="text-green-600 font-bold">{file.name}</span> : "Click to Upload CSV"}
                                </p>
                                <p className="text-sm text-gray-400 mt-2">or drag and drop file here</p>
                            </div>
                        </div>
                        <button 
                            type="submit" 
                            disabled={loading || !file}
                            className="w-full bg-red-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-red-700 disabled:opacity-50 shadow-md transition transform hover:-translate-y-0.5 active:translate-y-0"
                        >
                            {loading ? 'Starting Process...' : 'Start Batch Process'}
                        </button>
                    </form>
                    
                    {/* TIER-AWARE LIMIT BANNER (Replaces Generic Error) */}
                    {limitReached && (
                        <div className="mt-6 p-6 bg-red-50 rounded-2xl border-l-8 border-red-500 shadow-md animate-in slide-in-from-left-2">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-2xl font-bold text-red-800 mb-2">🚫 Monthly Limit Reached</h3>
                                    
                                    {subscription === 'free' ? (
                                        <>
                                            <p className="text-red-700 mb-4 leading-relaxed">
                                                You have hit the limit on the Free Plan. 
                                                Upgrade to Pro to process more addresses.
                                            </p>
                                            <ul className="list-disc list-inside text-red-800 text-sm mb-6 space-y-1">
                                                <li>Increase limit to 10,000 lookups</li>
                                                <li>Priority Processing</li>
                                                <li>Only <strong>$29/month</strong></li>
                                            </ul>
                                            <button 
                                                onClick={handleUpsell} 
                                                className="w-full bg-red-600 text-white font-bold py-4 rounded-xl hover:bg-red-700 transition shadow-lg text-lg flex items-center justify-center gap-2"
                                            >
                                                Upgrade to Pro Now ⚡
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-red-700 mb-4 leading-relaxed">
                                                You have hit the 10,000 lookup limit on your Premium Plan.
                                            </p>
                                            <button 
                                                onClick={handleEnterpriseContact} 
                                                className="w-full bg-blue-700 text-white font-bold py-4 rounded-xl hover:bg-blue-800 transition shadow-lg text-lg flex items-center justify-center gap-2"
                                            >
                                                Contact Sales for Enterprise 🏢
                                            </button>
                                        </>
                                    )}
                                </div>
                                <div className="text-4xl">🛑</div>
                            </div>
                        </div>
                    )}
                    
                    {/* Generic Error Message Display (Only if NOT limit reached) */}
                    {error && !limitReached && (
                        <div className="mt-6 p-4 bg-red-50 text-red-700 rounded-xl font-medium border border-red-200 flex items-start gap-3 shadow-sm">
                            <span className="text-xl">⚠️</span>
                            <div>
                                <p className="font-bold">Error Processing Batch</p>
                                <p className="text-sm">{error}</p>
                            </div>
                        </div>
                    )}

                    {/* Success / Processing Banner */}
                    {currentBatch && currentBatch.status === 'processing' && (
                        <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 shadow-sm">
                             <div className="bg-green-100 p-2 rounded-full text-green-600 text-xl">🚀</div>
                             <div>
                                 <h4 className="font-bold text-green-900 text-sm">Batch #{currentBatch.batchId} Started</h4>
                                 <p className="text-xs text-green-800">Your file is being processed in the background. Results will appear below.</p>
                             </div>
                        </div>
                    )}

                    {/* LIVE RESULTS SECTION */}
                    {currentBatch && (
                        <div className="bg-white p-6 rounded-2xl shadow border border-gray-100 mt-8 animate-in slide-in-from-bottom-4">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                    Results 
                                    <span className="text-sm font-normal text-gray-500">
                                        ({currentBatch.processedRows} / {currentBatch.totalRows || '?'})
                                    </span>
                                </h3>
                                <span className={`px-3 py-1 rounded-full font-bold text-xs uppercase tracking-wide ${
                                    currentBatch.status === 'complete' 
                                    ? 'bg-green-100 text-green-700' 
                                    : 'bg-blue-100 text-blue-700'
                                }`}>
                                    {currentBatch.status ? currentBatch.status : "PENDING"}
                                </span>
                            </div>
                            
                            {/* Animated Progress Bar */}
                            {currentBatch.status === 'processing' && (
                                <div className="mb-6">
                                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
                                        <div 
                                            className="bg-blue-600 h-full transition-all duration-500 ease-out rounded-full relative"
                                            style={{ width: `${(currentBatch.processedRows / (currentBatch.totalRows || 1)) * 100}%` }}
                                        >
                                            <div className="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-2 text-center animate-pulse">Syncing data with server...</p>
                                </div>
                            )}

                            {/* Live Preview Table */}
                            {currentBatch.preview && currentBatch.preview.length > 0 ? (
                                <div className="overflow-x-auto border rounded-xl max-h-96 shadow-sm">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                                            <tr>
                                                <th className="p-4 font-semibold text-gray-700 bg-gray-50 border-b">Address</th>
                                                <th className="p-4 font-semibold text-gray-700 bg-gray-50 border-b">Lat/Lng</th>
                                                <th className="p-4 font-semibold text-gray-700 bg-gray-50 border-b">Status</th>
                                                <th className="p-4 font-semibold text-gray-700 bg-gray-50 border-b text-center">Map</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {currentBatch.preview.map((row: any, i: number) => (
                                                <tr key={i} className="hover:bg-gray-50 transition-colors">
                                                    <td className="p-4 truncate max-w-xs text-gray-700 font-medium">{row.address}</td>
                                                    <td className="p-4 font-mono text-xs text-gray-500">{row.lat ? `${row.lat}, ${row.lng}` : '-'}</td>
                                                    <td className="p-4 font-bold text-green-600">{row.status}</td>
                                                    {/* Map Pin Link */}
                                                    <td className="p-4 text-center">
                                                        {row.lat && (
                                                            <a 
                                                                href={`https://www.google.com/maps/search/?api=1&query=${row.lat},${row.lng}`} 
                                                                target="_blank" 
                                                                rel="noreferrer"
                                                                className="text-xl hover:scale-125 block transition-transform duration-200"
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
                                <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400 italic">
                                    Waiting for first result...
                                </div>
                            )}
                            
                            {/* Download Button (Shows when processing or complete) */}
                            {(currentBatch.status === 'complete' || currentBatch.status === 'processing') && (
                                <button 
                                    onClick={() => downloadBatch(currentBatch.batchId)} 
                                    className="mt-6 w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 shadow-md transition transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
                                >
                                    <span>Download Full CSV</span>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT COLUMN: History & Tips */}
            <div className="space-y-6">
                
                {/* Pro Tip Box */}
                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 shadow-sm">
                    <h4 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                        <span className="text-xl">💡</span> Pro Tip
                    </h4>
                    <p className="text-sm text-blue-800 leading-relaxed">
                        To improve geocoding accuracy, add these extra columns to your CSV file:
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <code className="bg-white px-2 py-1 rounded border border-blue-200 text-blue-900 font-mono text-xs">landmark</code> 
                        <code className="bg-white px-2 py-1 rounded border border-blue-200 text-blue-900 font-mono text-xs">city</code> 
                        <code className="bg-white px-2 py-1 rounded border border-blue-200 text-blue-900 font-mono text-xs">state</code> 
                        <code className="bg-white px-2 py-1 rounded border border-blue-200 text-blue-900 font-mono text-xs">country</code>
                    </div>
                </div>

                {/* History Table */}
                <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 h-fit max-h-[600px] overflow-y-auto">
                    <h3 className="font-bold text-lg mb-4 text-gray-800 flex items-center gap-2">
                        <span>📂</span> History
                    </h3>
                    
                    {batches.length === 0 ? (
                        <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                            <p className="text-gray-400 text-sm italic">No batches yet.</p> 
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {batches.map(b => (
                                <div key={b.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-100 hover:bg-gray-100 hover:border-gray-300 transition-all duration-200">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-sm text-gray-800">Batch #{b.id}</p>
                                            {b.status === 'processing' ? (
                                                <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse" title="Processing"></span>
                                            ) : (
                                                <span className="inline-block w-2 h-2 rounded-full bg-green-500" title="Complete"></span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">{new Date(b.created_at).toLocaleDateString()} at {new Date(b.created_at).toLocaleTimeString()}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => downloadBatch(b.id)} 
                                            className="text-red-600 text-xs font-bold border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 hover:border-red-300 transition-all"
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

        {/* ==================================================================== */}
        {/* SINGLE LOOKUP VIEW                                                   */}
        {/* ==================================================================== */}
        {activeTab === 'single' && (
             <div className="max-w-2xl mx-auto bg-white p-10 rounded-2xl shadow-xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
                 <h2 className="text-3xl font-bold mb-8 text-center text-gray-800">Single Address Lookup</h2>
                 <form onSubmit={handleSingleSubmit} className="space-y-6">
                    <div className="relative">
                        <input 
                            type="text" 
                            value={address} 
                            onChange={e => setAddress(e.target.value)} 
                            placeholder="Enter full address (e.g. 123 Main St, New York, NY)" 
                            className="w-full p-5 border border-gray-300 rounded-xl focus:ring-4 focus:ring-red-100 focus:border-red-500 outline-none text-lg shadow-sm transition-all" 
                            required 
                        />
                        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400">📍</div>
                    </div>
                    
                    <button 
                        type="submit" 
                        disabled={singleLoading} 
                        className="w-full bg-red-600 text-white py-4 rounded-xl font-bold text-xl hover:bg-red-700 transition transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    >
                        {singleLoading ? 'Searching...' : 'Get Coordinates'}
                    </button>
                 </form>
                 
                 {/* Upsell Logic for Single Lookup */}
                 {limitReached && (
                    <div className="mt-6 p-6 bg-red-50 rounded-2xl border-l-8 border-red-500 shadow-md animate-in slide-in-from-left-2">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-2xl font-bold text-red-800 mb-2">🚫 Monthly Limit Reached</h3>
                                <p className="text-red-700 mb-4">You have hit the limit on the Free Plan. Upgrade to continue.</p>
                            </div>
                        </div>
                        <button onClick={handleUpsell} className="w-full bg-red-600 text-white font-bold py-4 rounded-xl hover:bg-red-700 transition shadow-lg text-lg">
                            Upgrade to Pro Now ⚡
                        </button>
                    </div>
                 )}
                 
                 {/* Single Result Display */}
                 {singleResults && (
                    <div className="mt-10 animate-in fade-in slide-in-from-bottom-2">
                        <div className="p-6 bg-green-50 rounded-2xl border border-green-200 mb-6 shadow-sm">
                            <h3 className="font-bold text-green-900 mb-4 text-xl flex items-center gap-2">
                                ✅ Result Found
                            </h3>
                            <div className="grid grid-cols-2 gap-6 text-sm text-gray-700">
                                <div className="bg-white p-3 rounded-lg border border-green-100 shadow-sm">
                                    <p className="font-bold text-gray-900 uppercase text-xs tracking-wide text-gray-500 mb-1">Latitude</p>
                                    <p className="font-mono text-lg text-green-800 font-bold">{singleResults.lat}</p>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-green-100 shadow-sm">
                                    <p className="font-bold text-gray-900 uppercase text-xs tracking-wide text-gray-500 mb-1">Longitude</p>
                                    <p className="font-mono text-lg text-green-800 font-bold">{singleResults.lng}</p>
                                </div>
                                <div className="col-span-2 bg-white p-4 rounded-lg border border-green-100 shadow-sm">
                                    <p className="font-bold text-gray-900 uppercase text-xs tracking-wide text-gray-500 mb-1">Formatted Address</p>
                                    <p className="text-gray-800 text-lg">{singleResults.formatted_address}</p>
                                </div>
                            </div>
                        </div>
                        
                        {/* VISUAL MAP PREVIEW (OpenStreetMap) */}
                        {singleResults.lat && (
                            <div className="rounded-2xl overflow-hidden border border-gray-300 shadow-lg h-80 relative group mt-8">
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
                                <div className="absolute bottom-4 right-4 flex gap-2">
                                    <a 
                                        href={`https://www.google.com/maps/search/?api=1&query=${singleResults.lat},${singleResults.lng}`} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="bg-white text-blue-600 px-4 py-2 rounded-lg font-bold shadow-md hover:bg-blue-50 transition text-sm flex items-center gap-2"
                                    >
                                        <span>Open Google Maps</span>
                                        <span>↗</span>
                                    </a>
                                </div>
                            </div>
                        )}
                    </div>
                 )}
             </div>
        )}

        {/* ==================================================================== */}
        {/* HELP MODAL OVERLAY                                                   */}
        {/* ==================================================================== */}
        {showHelp && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white p-8 rounded-2xl max-w-lg w-full relative shadow-2xl animate-in zoom-in-95 duration-200">
                    <button 
                        onClick={() => setShowHelp(false)} 
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl font-bold bg-gray-100 rounded-full w-10 h-10 flex items-center justify-center transition"
                    >
                        ×
                    </button>
                    
                    <h3 className="font-bold text-2xl mb-4 text-gray-900">CSV Formatting Guide</h3>
                    <p className="text-gray-600 mb-6 leading-relaxed">
                        To get the best geocoding results, please ensure your CSV file follows this structure. 
                        The <strong>address</strong> column is mandatory.
                    </p>
                    
                    <div className="bg-gray-900 text-gray-100 p-5 rounded-xl font-mono text-xs overflow-x-auto mb-8 shadow-inner border border-gray-700">
                        <code className="block mb-2 text-green-400 font-bold"># Recommended Header Structure</code>
                        <div className="whitespace-pre text-gray-300">
                            address,landmark,city,state,country<br/>
                            "1600 Penn Ave",,"Washington","DC","USA"<br/>
                            ,,"Tokyo",,"Japan"
                        </div>
                    </div>
                    
                    <div className="space-y-3">
                        <button 
                            onClick={() => setShowHelp(false)} 
                            className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition shadow-md text-lg"
                        >
                            Got it, thanks!
                        </button>
                        <button 
                            onClick={downloadSample}
                            className="w-full bg-white text-gray-600 border border-gray-300 py-3 rounded-xl font-bold hover:bg-gray-50 transition"
                        >
                            Download Sample File
                        </button>
                    </div>
                </div>
            </div>
        )}
      </main>
    </div>
  );
}