'use client';

import { useState, useEffect } from 'react';

export default function ClientHeader() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      const storedEmail = localStorage.getItem('email');
      setIsLoggedIn(!!token);
      setEmail(storedEmail || '');
    }
  }, []);

  return (
    <header className="bg-red-600 text-white p-4 shadow-lg">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        <h1 className="text-2xl font-bold">Smartgeocode</h1>
        <div className="space-x-4">
          {isLoggedIn ? (
            <span>Welcome, {email}!</span>
          ) : (
            <a href="/success" className="bg-white text-red-600 px-4 py-2 rounded-lg font-semibold">
              Log In
            </a>
          )}
        </div>
      </div>
    </header>
  );
}