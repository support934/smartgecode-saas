'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isExistingUser, setIsExistingUser] = useState(false); // NEW STATE
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setIsExistingUser(false);

    const normalizedEmail = email.toLowerCase().trim();

    try {
      const res = await fetch('https://smartgeocode.railway.internal/api/signup', { // Ensure this URL matches your setup (e.g., /api/signup if using proxy)
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        localStorage.setItem('email', normalizedEmail);
        router.push('/success');
      } else {
        // INTELLIGENT ERROR HANDLING
        const msg = data.message || '';
        if (msg.toLowerCase().includes('email exists') || msg.toLowerCase().includes('already exists')) {
            setIsExistingUser(true);
            setError('Account already exists. Please log in.');
        } else {
            setError(msg || 'Signup failed—try again');
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
        <h2 className="text-2xl font-bold text-center mb-6 text-red-600">
          {isExistingUser ? 'Welcome Back' : 'Sign Up'}
        </h2>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg mb-4 text-center text-sm font-semibold">
            {error}
          </div>
        )}

        {/* If user exists, show BIG Login Button instead of form */}
        {isExistingUser ? (
          <div className="space-y-4">
            <Link 
              href={`/success?email=${encodeURIComponent(email)}`} // Reuse your Login page (often at /success or /login)
              className="block w-full bg-red-600 text-white text-center p-3 rounded-lg hover:bg-red-700 font-bold"
            >
              Log In with {email}
            </Link>
            <button 
              onClick={() => setIsExistingUser(false)} 
              className="block w-full text-gray-500 text-sm hover:underline"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSignup} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all"
            />
            <button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-red-600 text-white p-3 rounded-lg hover:bg-red-700 font-semibold disabled:opacity-50 transition-colors"
            >
              {loading ? 'Creating Account...' : 'Sign Up'}
            </button>
          </form>
        )}

        <p className="text-center mt-6 text-sm text-gray-500">
          Already have an account?{' '}
          <Link href="/success" className="text-red-600 hover:underline font-semibold">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}