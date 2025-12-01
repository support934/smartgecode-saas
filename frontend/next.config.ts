/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NODE_ENV === 'production' 
          ? 'http://api-java.railway.internal:8080/:path*' // Prod internal (secure/low latency)
          : 'http://localhost:8080/:path*', // Local backend
      },
    ];
  },
};

module.exports = nextConfig;