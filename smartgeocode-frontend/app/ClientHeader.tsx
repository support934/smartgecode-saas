'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link'; // Use Next.js Link for speed

export default function ClientHeader() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    const checkAuth = () => {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        const storedEmail = localStorage.getItem('email');
        const loggedIn = !!token;
        setIsLoggedIn(loggedIn);
        setEmail(storedEmail || '');
      }
    };

    checkAuth();

    window.addEventListener('storage', checkAuth);
    const interval = setInterval(checkAuth, 1000); // Relaxed poll to 1s

    return () => {
      window.removeEventListener('storage', checkAuth);
      clearInterval(interval);
    };
  }, []);

  const logout = () => {
    localStorage.clear();
    // Redirect to home page after logout
    window.location.href = '/'; 
  };

  return (
    <div className="flex items-center space-x-6">
      {isLoggedIn ? (
        <>
          <Link href="/success" className="text-lg font-medium hover:underline">
             Dashboard ({email})
          </Link>
          <button
            onClick={logout}
            className="bg-white text-red-600 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition"
          >
            Log Out
          </button>
        </>
      ) : (
        // FIXED: Points to /signup instead of /success for login
        <Link
          href="/signup"
          className="bg-white text-red-600 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition"
        >
          Log In
        </Link>
      )}
    </div>
  );
}