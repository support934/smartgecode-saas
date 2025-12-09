/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [];  // Disable all rewrites/proxies (no local reroute)
  },
  async redirects() {
    return [];  // Disable redirects
  },
};

module.exports = nextConfig;