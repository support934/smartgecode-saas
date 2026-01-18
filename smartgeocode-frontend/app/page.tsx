'use client';

import React, { useState } from 'react';

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

      {/* Pricing */}
      <section style={{ padding: '60px 20px', background: 'white' }}>
        <h2 style={{ textAlign: 'center', fontSize: '2.2em', marginBottom: '40px', color: '#ef4444' }}>Choose Your Plan</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '25px', maxWidth: '1200px', margin: '0 auto' }}>
          {/* Free */}
          <div style={{ padding: '25px', border: '1px solid #ddd', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.5em', marginBottom: '10px' }}>Free</h3>
            <p style={{ fontSize: '2em', color: '#ef4444', fontWeight: 'bold' }}>$0/mo</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 20px' }}>
              <li style={{ margin: '5px 0' }}>Manual single lookups</li>
              <li style={{ margin: '5px 0' }}>500/mo limit</li>
              <li style={{ margin: '5px 0' }}>Email results</li>
              <li style={{ margin: '5px 0', textDecoration: 'line-through', color: '#aaa' }}>Batch & API</li>
            </ul>
            <a href="/signup" style={{ display: 'block', background: '#ef4444', color: 'white', padding: '10px', borderRadius: '6px', textAlign: 'center', textDecoration: 'none', fontWeight: 'bold' }}>Get Started Free</a>
          </div>
          {/* Premium */}
          <div style={{ padding: '25px', border: '2px solid #ef4444', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', textAlign: 'center', position: 'relative' }}>
            <span style={{ position: 'absolute', top: '-15px', left: '50%', transform: 'translateX(-50%)', background: '#ef4444', color: 'white', padding: '5px 15px', borderRadius: '20px', fontSize: '0.8em', fontWeight: 'bold' }}>Most Popular</span>
            <h3 style={{ fontSize: '1.5em', marginBottom: '10px' }}>Premium</h3>
            <p style={{ fontSize: '2em', color: '#ef4444', fontWeight: 'bold' }}>$29/mo</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 20px' }}>
              <li style={{ margin: '5px 0' }}>Batch CSV (10k/mo)</li>
              <li style={{ margin: '5px 0' }}>Exports (CSV/JSON/KML)</li>
              <li style={{ margin: '5px 0' }}>Priority processing</li>
              <li style={{ margin: '5px 0' }}>No watermarks</li>
            </ul>
            <a href="/signup?plan=premium" style={{ display: 'block', background: '#ef4444', color: 'white', padding: '10px', borderRadius: '6px', textAlign: 'center', textDecoration: 'none', fontWeight: 'bold' }}>Upgrade Now</a>
          </div>
          {/* Pro */}
          <div style={{ padding: '25px', border: '1px solid #ddd', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.5em', marginBottom: '10px' }}>Pro</h3>
            <p style={{ fontSize: '2em', color: '#ef4444', fontWeight: 'bold' }}>$49/mo</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 20px' }}>
              <li style={{ margin: '5px 0' }}>50k lookups/mo</li>
              <li style={{ margin: '5px 0' }}>Full API access</li>
              <li style={{ margin: '5px 0' }}>Higher rate limits</li>
              <li style={{ margin: '5px 0' }}>All Premium features</li>
            </ul>
            <a href="mailto:support@smartgeocode.io?subject=Interest%20in%20SmartGeocode%20Pro%20Plan&body=Hi%20team%2C%0A%0AI%27m%20interested%20in%20Pro.%20Use%20case%3A%20...%0AVolume%3A%20...%0AThanks!" style={{ display: 'block', background: '#ef4444', color: 'white', padding: '10px', borderRadius: '6px', textAlign: 'center', textDecoration: 'none', fontWeight: 'bold' }}>Contact for Pro</a>
          </div>
          {/* Unlimited */}
          <div style={{ padding: '25px', border: '1px solid #ddd', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.5em', marginBottom: '10px' }}>Unlimited</h3>
            <p style={{ fontSize: '2em', color: '#ef4444', fontWeight: 'bold' }}>Contact Us</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 20px' }}>
              <li style={{ margin: '5px 0' }}>Unlimited lookups (fair use)</li>
              <li style={{ margin: '5px 0' }}>Scalable API</li>
              <li style={{ margin: '5px 0' }}>Dedicated support</li>
            </ul>
            <a href="mailto:support@smartgeocode.io?subject=SmartGeocode%20Unlimited%20Inquiry&body=Hi%20team%2C%0A%0AInterested%20in%20Unlimited.%20Volume%3A%20...%0AUse%20case%3A%20...%0AThanks!" style={{ display: 'block', background: '#ef4444', color: 'white', padding: '10px', borderRadius: '6px', textAlign: 'center', textDecoration: 'none', fontWeight: 'bold' }}>Contact for Unlimited</a>
          </div>
        </div>
      </section>

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