'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import React from 'react';

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [loggedIn, setLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (sessionId) {
      console.log('Subscription success:', sessionId);
      fetch('/api/confirm-subscription', { method: 'POST', body: JSON.stringify({ sessionId }) });
    }
  }, [sessionId]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        setLoggedIn(true);
        window.location.href = '/dashboard';
      } else {
        setError(data.message || 'Login failed—try again');
      }
    } catch (error) {
      setError('Network error—check connection and try again');
    }
  };

  if (loggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-white flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-600">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-6">
          <i className="fas fa-check-circle text-6xl text-red-500 mb-4"></i>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Subscription Success!</h1>
          <div className="bg-red-100 border border-red-200 rounded-full px-4 py-2 inline-block mb-4">
            <i className="fas fa-crown text-yellow-500 mr-2"></i>
            <span className="font-semibold text-red-800">Premium Unlocked</span>
          </div>
          <p className="text-gray-600">Batch geocoding ready. Log in to upload CSVs and get started.</p>
        </div>
        {error && (
          <div className="text-red-500 text-center mb-4 text-sm p-3 bg-red-50 rounded">
            {error}
            {error.includes('already exists') && (
              <p className="text-red-600 mt-1">
                <a href="/success" className="underline font-semibold">Log in instead</a>
              </p>
            )}
          </div>
        )}
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            required
          />
          <button type="submit" className="w-full bg-red-600 text-white p-3 rounded-lg hover:bg-red-700 font-semibold">
            Log In to Dashboard
          </button>
        </form>
        <p className="text-center mt-4 text-sm text-gray-500">
          No account? <a href="/signup" className="text-red-600 hover:underline font-semibold">Sign up</a>
        </p>
      </div>
    </div>
  );
}

export default function Success() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <SuccessContent />
    </Suspense>
  );
}