export default function Terms() {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
      <p>Last updated: January 2, 2026</p>

      <h2 className="text-2xl font-bold mt-8">1. Acceptance of Terms</h2>
      <p>By accessing or using SmartGeocode ("Service"), you agree to be bound by these Terms of Service.</p>

      <h2 className="text-2xl font-bold mt-8">2. Description of Service</h2>
      <p>SmartGeocode provides geocoding services using public data sources (e.g., OpenStreetMap/Nominatim). Free single lookups and premium unlimited batch processing are offered.</p>

      <h2 className="text-2xl font-bold mt-8">3. Subscription & Billing</h2>
      <p>Premium subscriptions are $29/month, recurring, billed via Stripe. You can cancel anytime via the Customer Portal. No refunds for partial months.</p>

      <h2 className="text-2xl font-bold mt-8">4. Limitation of Liability</h2>
      <p>Service is provided "as is". We are not liable for inaccurate geocoding results, downtime, or data loss. Use at your own risk.</p>

      <h2 className="text-2xl font-bold mt-8">5. Governing Law</h2>
      <p>These Terms are governed by New York law.</p>

      <p>Contact: support@smartgeocode.io</p>
    </div>
  );
}