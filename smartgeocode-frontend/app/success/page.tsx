'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('session_id');
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [premiumMessage, setPremiumMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto-activate premium on Stripe success (if session_id present)
  useEffect(() => {
    if (sessionId) {
      activatePremium();
    }
  }, [sessionId]);

  const activatePremium = async () => {
    setLoading(true);
    setError('');
    try {
      // Get email from session (or prompt user if not available)
      const emailFromLocal = localStorage.getItem('email') || '';
      if (!emailFromLocal) {
        setError('Please log in to activate premium');
        return;
      }

      const res = await fetch('/api/set-premium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailFromLocal }),
      });
      const data = await res.json();
      if (res.ok) {
        setPremiumMessage('Premium activated successfully!');
        router.push('/dashboard'); // Redirect to dashboard
      } else {
        setError(data.message || 'Premium activation failed—contact support');
      }
    } catch (err) {
      setError('Network error—try again');
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setPremiumMessage('');
    const endpoint = mode === 'signup' ? '/api/signup' : '/api/login';
    const normalizedEmail = email.toLowerCase().trim();
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('userId', data.userId);
        localStorage.setItem('email', normalizedEmail);
        router.push('/dashboard');
      } else {
        if (data.message && data.message.includes('already exists')) {
          setMode('login');
          setError('Account exists—log in below');
        } else {
          setError(data.message || 'Invalid email or password');
        }
      }
    } catch (err) {
      setError('Network error—try again');
    } finally {
      setLoading(false);
    }
  };

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
          <p className="text-gray-600">
            {mode === 'signup' ? 'Create your account to start batch geocoding' : 'Welcome back! Log in to your dashboard'}
          </p>
          {premiumMessage && <p className="text-green-600 mt-4 font-semibold">{premiumMessage}</p>}
        </div>
        {error && (
          <div className="text-red-600 text-center mb-6 p-4 bg-red-50 rounded-lg font-semibold">
            {error}
          </div>
        )}
        <form onSubmit={handleAuth} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 text-white p-3 rounded-lg hover:bg-red-700 font-semibold disabled:opacity-50"
          >
            {loading ? 'Processing...' : mode === 'signup' ? 'Create Account & Access Dashboard' : 'Log In to Dashboard'}
          </button>
        </form>
        {mode === 'login' && (
          <p className="text-center mt-6 text-sm text-gray-500">
            Forgot password? <a href="/forgot-password" className="text-red-600 hover:underline font-semibold">Reset here</a>
          </p>
        )}
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