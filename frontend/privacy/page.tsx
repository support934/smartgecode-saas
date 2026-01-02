export default function Privacy() {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
      <p>Last updated: January 2, 2026</p>

      <h2 className="text-2xl font-bold mt-8">1. Information We Collect</h2>
      <p>We collect email addresses for results delivery and billing (via Stripe). Batch CSV data is processed but not stored long-term.</p>

      <h2 className="text-2xl font-bold mt-8">2. How We Use Information</h2>
      <p>Email is used for geocode results and subscription management. We do not sell your data.</p>

      <h2 className="text-2xl font-bold mt-8">3. Third-Party Services</h2>
      <p>We use Stripe for payments and Nominatim/OpenStreetMap for geocoding. See their privacy policies.</p>

      <h2 className="text-2xl font-bold mt-8">4. Data Security</h2>
      <p>We use industry-standard security. You are responsible for securing your account.</p>

      <h2 className="text-2xl font-bold mt-8">5. Your Rights</h2>
      <p>Contact support@smartgeocode.io to delete your data. We comply with applicable privacy laws (including CCPA for California users).</p>

      <p>Questions? Email support@smartgeocode.io</p>
    </div>
  );
}