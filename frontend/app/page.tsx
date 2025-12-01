'use client';
import { useState } from 'react';

export default function Home() {
  const [address, setAddress] = useState<string>('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    const encodedAddr = encodeURIComponent(address);
    console.log('=== FRONTEND DEBUG: Submitted addr = ' + address + ', encoded = ' + encodedAddr); // Custom log: Input pass-through
    const backendUrl = process.env.NODE_ENV === 'production' 
      ? 'http://api-java.railway.internal:8080' 
      : 'http://localhost:8080'; // Local backend
    const fullUrl = `${backendUrl}/api/geocode?addr=${encodedAddr}`;
    console.log('=== FRONTEND DEBUG: Fetching URL = ' + fullUrl); // Custom log: Exact URL
    try {
      const res = await fetch(fullUrl);
      console.log('=== FRONTEND DEBUG: Response status = ' + res.status + ', ok = ' + res.ok); // Custom log: Status check
      if (!res.ok) {
        const errorText = await res.text();
        console.log('=== FRONTEND DEBUG: Error body = ' + errorText); // Custom log: Error details
        throw new Error(`HTTP error! status: ${res.status}, body: ${errorText}`);
      }
      const data = await res.json();
      console.log('=== FRONTEND DEBUG: Success data = ' + JSON.stringify(data)); // Custom log: Returned coords
      setResult(data);
    } catch (error) {
      console.error('=== FRONTEND DEBUG: Fetch error = ' + error); // Custom log: Catch details
      setResult({ error: 'Backend call failed—check proxy or backend logs: ' + (error as Error).message });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">$5k Geocode Blitz: Batch Your Leads</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input 
            value={address} 
            onChange={(e) => setAddress(e.target.value)} 
            className="geocode-input w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
            placeholder="Enter address (e.g., 350 5th Ave, NYC)..." 
            type="text" 
            required
          />
          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Geocoding...' : 'Geocode'}
          </button>
        </form>
        {result && (
          <div className="mt-4 p-4 bg-gray-100 rounded-md">
            <pre className="text-sm overflow-auto">{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}