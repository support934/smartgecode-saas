'use client';

import { useRouter } from 'next/navigation';

export default function Pricing() {
  const router = useRouter();

  const handleSubscribe = async (priceId: string) => {
    // If free, just scroll to top or go to dashboard
    if (priceId === 'free') {
      router.push('/signup'); // or dashboard if logged in
      return;
    }

    // For paid plans, redirect to your /api/checkout endpoint logic
    // You likely have this logic in your main page or a separate utility
    // For now, we'll just push to signup/login to capture them first
    router.push('/signup?plan=' + priceId);
  };

  return (
    <section className="py-20 bg-white" id="pricing">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          Choose Your Plan
        </h2>
        
        <div className="grid md:grid-cols-4 gap-8">
          {/* FREE TIER - Fixed Text */}
          <div className="border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-xl font-bold mb-2">Free</h3>
            <div className="text-3xl font-bold text-red-600 mb-4">$0<span className="text-sm text-gray-500 font-normal">/mo</span></div>
            <ul className="space-y-3 mb-8 text-gray-600 text-sm">
              <li className="flex items-center">✓ Single & Batch Uploads</li>
              <li className="flex items-center">✓ 500 lookups/mo limit</li>
              <li className="flex items-center">✓ Email results</li>
              <li className="flex items-center">✓ Map Preview</li>
            </ul>
            <button 
              onClick={() => handleSubscribe('free')}
              className="w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 font-semibold"
            >
              Get Started Free
            </button>
          </div>

          {/* PREMIUM TIER */}
          <div className="border-2 border-red-600 rounded-xl p-6 shadow-lg relative bg-white transform scale-105">
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-600 text-white px-4 py-1 rounded-full text-sm font-bold">
              Most Popular
            </div>
            <h3 className="text-xl font-bold mb-2 text-center">Premium</h3>
            <div className="text-3xl font-bold text-red-600 mb-4 text-center">$29<span className="text-sm text-gray-500 font-normal">/mo</span></div>
            <ul className="space-y-3 mb-8 text-gray-600 text-sm">
              <li className="flex items-center">✓ Batch CSV (10k/mo)</li>
              <li className="flex items-center">✓ Exports (CSV/JSON/KML)</li>
              <li className="flex items-center">✓ Priority processing</li>
              <li className="flex items-center">✓ No watermarks</li>
            </ul>
            <button 
              onClick={() => handleSubscribe('price_1Sd8JxA5JR9NQZvD0GCmjm6R')} // Use your real Stripe Price ID
              className="w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 font-semibold"
            >
              Upgrade Now
            </button>
          </div>

          {/* PRO TIER */}
          <div className="border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-xl font-bold mb-2">Pro</h3>
            <div className="text-3xl font-bold text-red-600 mb-4">$49<span className="text-sm text-gray-500 font-normal">/mo</span></div>
            <ul className="space-y-3 mb-8 text-gray-600 text-sm">
              <li className="flex items-center">✓ 50k lookups/mo</li>
              <li className="flex items-center">✓ Full API access</li>
              <li className="flex items-center">✓ Higher rate limits</li>
              <li className="flex items-center">✓ All Premium features</li>
            </ul>
            <button className="w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 font-semibold">
              Contact for Pro
            </button>
          </div>

          {/* UNLIMITED */}
          <div className="border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-xl font-bold mb-2">Unlimited</h3>
            <div className="text-2xl font-bold text-red-600 mb-4">Contact Us</div>
            <ul className="space-y-3 mb-8 text-gray-600 text-sm">
              <li className="flex items-center">✓ Unlimited lookups (fair use)</li>
              <li className="flex items-center">✓ Scalable API</li>
              <li className="flex items-center">✓ Dedicated support</li>
            </ul>
            <button className="w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 font-semibold">
              Contact for Unlimited
            </button>
          </div>

        </div>
      </div>
    </section>
  );
}