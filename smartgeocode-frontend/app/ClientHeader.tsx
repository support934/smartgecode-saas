'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ClientHeader() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    const checkAuth = () => {
        // Check for 'token' (matching Login/Dashboard)
        const token = localStorage.getItem('token');
        setIsLoggedIn(!!token);
        setEmail(localStorage.getItem('email') || '');
    };
    checkAuth();
    // Poll every second to sync login state across tabs
    const interval = setInterval(checkAuth, 1000);
    return () => clearInterval(interval);
  }, []);

  const logout = () => {
    localStorage.clear();
    window.location.href = '/';
  };

  return (
    <div className="flex items-center space-x-6">
      {isLoggedIn ? (
        <>
          {/* FIX: Text is now white to match the red header */}
          <span className="text-white font-medium hidden sm:inline border-r border-red-400 pr-4">
            {email}
          </span>
          
          <Link href="/dashboard" className="text-red-100 hover:text-white font-semibold transition">
            Dashboard
          </Link>

          <button
            onClick={logout}
            className="bg-white text-red-600 px-4 py-2 rounded-lg font-bold hover:bg-red-50 transition shadow-sm"
          >
            Log Out
          </button>
        </>
      ) : (
        <Link
          href="/login"
          className="bg-white text-red-600 px-6 py-2 rounded-lg font-bold hover:bg-red-50 transition shadow-sm"
        >
          Log In
        </Link>
      )}
    </div>
  );
}