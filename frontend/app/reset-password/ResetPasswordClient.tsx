'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState } from 'react';

export default function ResetPasswordClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('Invalid link');
      return;
    }

    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message || 'Password reset! Redirecting to login...');
        setTimeout(() => router.push('/success'), 2000);
      } else {
        setError(data.message || 'Reset failed');
      }
    } catch (err) {
      setError('Network error—try again');
    }
  };

  if (!token) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-red-600">Invalid reset link</p></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold text-center mb-6 text-red-600">Reset Password</h2>
        {message && <p className="text-green-600 text-center mb-4">{message}</p>}
        {error && <p className="text-red-600 text-center mb-4">{error}</p>}
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="New Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full p-3 border rounded mb-4"
          />
          <button
            type="submit"
            className="w-full bg-red-600 text-white py-3 rounded font-bold hover:bg-red-700"
          >
            Reset Password
          </button>
        </form>
        <p className="text-center mt-4">
          <a href="/success" className="text-red-600">Back to Login</a>
        </p>
      </div>
    </div>
  );
}