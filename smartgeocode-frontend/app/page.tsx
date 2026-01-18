'use client';

import React, { useState } from 'react';
import Pricing from './components/Pricing';

export default function Home() {
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGeocode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim() || !email.trim()) return;

    setLoading(true);
    setError('');
    setResults(null);

    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
      const data = await res.json();
      if (data.status === 'success') {
        setResults(data);
        await fetch('/api/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, address, result: data }),
        });
      } else {
        setError(data.message || 'Geocoding failed. Please try again.');
      }
    } catch (err) {
      setError('Network error—please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', background: 'white' }}>
      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)', color: '#333', padding: '80px 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.8em', marginBottom: '15px', color: '#ef4444' }}>Accurate Geocoding, Made Simple</h1>
        <p style={{ fontSize: '1.3em', marginBottom: '30px' }}>
          Get precise lat/lng instantly. Free single lookups — batch from $29/mo. For real estate, logistics, marketing & apps. Try a free lookup below!
        </p>
        <a href="#lookup-form" style={{ background: '#ef4444', color: 'white', padding: '14px 40px', borderRadius: '50px', fontSize: '1.1em', fontWeight: 'bold', textDecoration: 'none' }}>
          Start Free Trial
        </a>
      </section>

      {/* Pricing Section - NOW REPLACED WITH COMPONENT */}
      <Pricing />

      {/* Single Lookup Form - integrated for free trial */}
      <section id="lookup-form" style={{ padding: '60px 20px', background: '#f8f9fa', textAlign: 'center' }}>
        <h2 style={{ fontSize: '2em', marginBottom: '30px', color: '#ef4444' }}>Try a Free Single Lookup</h2>
        <form onSubmit={handleGeocode} style={{ maxWidth: '500px', margin: '0 auto' }}>
          <input
            type="text"
            placeholder="Enter address (e.g., 123 Main St, East Meadow, NY)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
            required
          />
          <input
            type="email"
            placeholder="Your email for results"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
            required
          />
          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', background: '#ef4444', color: 'white', padding: '12px', borderRadius: '6px', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}
          >
            {loading ? 'Geocoding...' : 'Get Results Now'}
          </button>
        </form>
        {error && <p style={{ color: '#ef4444', marginTop: '10px' }}>{error}</p>}
        {results && (
          <div style={{ marginTop: '20px', padding: '20px', background: '#e6ffe6', borderRadius: '6px' }}>
            <h3>Results</h3>
            <p>Latitude: {results.lat}</p>
            <p>Longitude: {results.lng}</p>
            <p>Formatted Address: {results.formatted_address}</p>
            <p style={{ fontSize: '0.9em', color: '#666' }}>Emailed to you. Upgrade for batch!</p>
          </div>
        )}
      </section>

      {/* Features */}
      <section style={{ padding: '60px 20px', background: '#f8f9fa' }}>
        <h2 style={{ textAlign: 'center', fontSize: '2.2em', marginBottom: '40px', color: '#ef4444' }}>Why Smartgeocode?</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '25px', maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ padding: '25px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', textAlign: 'center' }}>
            <i className="fas fa-bolt" style={{ fontSize: '3em', color: '#ef4444', marginBottom: '15px' }}></i>
            <h3 style={{ fontSize: '1.5em', marginBottom: '10px' }}>Blazing Fast</h3>
            <p>Get accurate coordinates in seconds.</p>
          </div>
          <div style={{ padding: '25px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', textAlign: 'center' }}>
            <i className="fas fa-envelope-open" style={{ fontSize: '3em', color: '#ef4444', marginBottom: '15px' }}></i>
            <h3 style={{ fontSize: '1.5em', marginBottom: '10px' }}>Instant Email</h3>
            <p>Results emailed for easy access.</p>
          </div>
          <div style={{ padding: '25px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', textAlign: 'center' }}>
            <i className="fas fa-rocket" style={{ fontSize: '3em', color: '#ef4444', marginBottom: '15px' }}></i>
            <h3 style={{ fontSize: '1.5em', marginBottom: '10px' }}>Effortless Scaling</h3>
            <p>Upgrade for batch, API, unlimited.</p>
          </div>
        </div>
      </section>
    </main>
  );
}