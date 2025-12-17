'use client';
import { useState } from 'react';

export default function Dashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [email, setEmail] = useState('');

  const handleUpload = async () => {
    if (!file || !email) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('email', email);
    const res = await fetch('/api/batch-geocode', {
      method: 'POST',
      body: formData,
    });
    if (res.ok) {
      alert('Batch processed! Check your email for results.');
    } else {
      alert('Upload failed—try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-blue-600 text-white p-4 shadow-lg">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">smartgeocode Dashboard</h1>
          <div className="flex items-center space-x-4">
            <span className="bg-green-500 px-3 py-1 rounded-full text-sm">Premium</span>
            <button className="bg-white text-blue-600 px-4 py-2 rounded hover:bg-gray-100">Logout</button>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Welcome Back!</h2>
          <p className="text-gray-600">Upload CSV for batch geocoding. Results emailed instantly.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-xl shadow-md">
            <h3 className="text-xl font-semibold mb-4">Upload CSV</h3>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}  // Null-safe optional chaining
              className="w-full p-2 border rounded mb-4"
            />
            <input
              type="email"
              placeholder="Email for results"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border rounded mb-4"
            />
            <button
              onClick={handleUpload}
              disabled={!file || !email}
              className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Process Batch
            </button>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-md">
            <h3 className="text-xl font-semibold mb-4">Past Batches</h3>
            <div className="space-y-2">
              <div className="flex justify-between p-3 bg-gray-50 rounded">
                <span>Batch 1 - 50 addresses</span>
                <span className="text-green-600">Complete</span>
              </div>
              <div className="flex justify-between p-3 bg-gray-50 rounded">
                <span>Batch 2 - 100 addresses</span>
                <span className="text-yellow-600">Processing</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}