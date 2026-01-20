'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ClientHeader() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    // Check local storage for token
    const checkAuth = () => {
        const token = localStorage.getItem('token');
        setIsLoggedIn(!!token);
        setEmail(localStorage.getItem('email') || '');
    };
    checkAuth();
    // Use interval to catch login state changes from other tabs/pages
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
          <span className="text-gray-700 font-medium hidden sm:inline">{email}</span>
          <button
            onClick={logout}
            className="text-red-600 font-semibold hover:underline"
          >
            Log Out
          </button>
        </>
      ) : (
        // FIXED: Points to /login
        <Link
          href="/login"
          className="bg-white text-red-600 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition shadow-sm border border-red-100"
        >
          Log In
        </Link>
      )}
    </div>
  );
}