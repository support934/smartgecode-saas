'use client';

import { useState, useEffect } from 'react';

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

    checkAuth(); // Initial check

    // Listen for cross-tab changes
    window.addEventListener('storage', checkAuth);

    // Short poll for immediate redirect (from /success)
    const interval = setInterval(checkAuth, 500);

    return () => {
      window.removeEventListener('storage', checkAuth);
      clearInterval(interval);
    };
  }, []);

  const logout = () => {
    localStorage.clear();
    window.location.href = 'https://smartgeocode.io';
  };

  return (
    <div className="flex items-center space-x-6">
      {isLoggedIn ? (
        <>
          <p className="text-lg font-medium">Welcome, {email}!</p>
          <button
            onClick={logout}
            className="bg-white text-red-600 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition"
          >
            Log Out
          </button>
        </>
      ) : (
        <a
          href="/success"
          className="bg-white text-red-600 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition"
        >
          Log In
        </a>
      )}
    </div>
  );
}