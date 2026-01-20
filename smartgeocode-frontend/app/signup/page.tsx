'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function SignupForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // 1. Auto-fill email from the link in the email
    const paramEmail = searchParams.get('email');
    if (paramEmail) setEmail(paramEmail);
  }, [searchParams]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const normalizedEmail = email.toLowerCase().trim();

    try {
      // PROXY call to backend
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        // SUCCESS: "Lead" converted to "User", or "New User" created.
        localStorage.setItem('email', normalizedEmail);
        localStorage.setItem('token', data.token); // Save token if backend sends it
        window.location.href = '/dashboard';
      } else {
        // ERROR HANDLING
        const msg = data.message?.toLowerCase() || '';
        
        // If Backend says "Email exists" (and not a lead), send to LOGIN
        if (msg.includes('email') && (msg.includes('exist') || msg.includes('taken'))) {
            router.push(`/login?email=${encodeURIComponent(normalizedEmail)}&error=exists`);
        } else {
            setError(data.message || 'Signup failed');
        }
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-center mb-6 text-red-600">
          {searchParams.get('email') ? 'Finish Account Setup' : 'Create Account'}
        </h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm font-semibold text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
             <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-red-500"
             />
          </div>
          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Set Password</label>
             <input
                type="password"
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-red-500"
             />
          </div>
          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-red-600 text-white p-3 rounded-lg font-bold hover:bg-red-700 transition disabled:opacity-50"
          >
            {loading ? 'Activating...' : 'Get Started'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/login" className="text-red-600 font-semibold hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

// Wrap in Suspense for Build Safety
export default function SignupPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignupForm />
    </Suspense>
  );
}