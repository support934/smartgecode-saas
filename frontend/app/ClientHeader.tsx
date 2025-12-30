'use client';

import { useState, useEffect } from 'react';

export default function ClientHeader() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('');

  const checkAuth = () => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      const storedEmail = localStorage.getItem('email');
      setIsLoggedIn(!!token);
      setEmail(storedEmail || '');
    }
  };

  useEffect(() => {
    checkAuth(); // Initial check

    // Listen for storage changes (fires on login from other tab/window)
    window.addEventListener('storage', checkAuth);

    // Poll every 500ms for immediate login redirect (catches /success → /dashboard)
    const interval = setInterval(checkAuth, 500);

    return () => {
      window.removeEventListener('storage', checkAuth);
      clearInterval(interval);
    };
  }, []);

  const logout = () => {
    localStorage.clear();
    window.location.href = 'https://smartgeocode.io'; // Redirect to landing
  };

  return (
    <header className="bg-red-600 text-white p-4 shadow-lg">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <h1 className="text-3xl font-bold">
          <a href='https://smartgeocode.io' className="hover:underline">Smartgeocode</a>
        </h1>
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
      </div>
    </header>
  );
}