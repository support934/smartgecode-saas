/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. Force fresh loads in dev (Keep existing settings)
  devIndicators: {
    buildActivity: true,
  },

  // 2. THE BRIDGE (Fixes Network Error)
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        // PROXY TARGET: This must be your PUBLIC Railway URL
        destination: 'https://api-java-production-fb09.up.railway.app/api/:path*', 
      },
    ];
  },

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