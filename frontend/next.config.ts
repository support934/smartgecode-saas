/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NODE_ENV === 'production' 
          ? 'http://api-java.railway.internal:8080/api/:path*' // Prod internal + /api prefix
          : 'http://localhost:8080/api/:path*', // Local backend + /api prefix
      },
    ];
  },
};

module.exports = nextConfig;