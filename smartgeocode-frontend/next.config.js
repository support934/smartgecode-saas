/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. Force fresh loads in dev (Keep existing settings)
  devIndicators: {
    buildActivity: true,
  },

  // ❌ DELETED: The 'rewrites' section.
  // We removed it so Next.js will use your actual API files (app/api/...)
  // which we spent all day fixing.

  // 3. Caching Headers (Keep existing settings)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
    ];
  },
};

export default nextConfig;