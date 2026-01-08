
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Force fresh loads in development
  devIndicators: {
    buildActivity: true,
  },
  async redirects() {
  return [
    {
      source: '/',
      destination: '/dashboard',
      permanent: true,
    },
  ];
},
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
    ];
  },
};

export default nextConfig;