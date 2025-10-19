/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@pablos/contracts'],
  env: {
    NEXT_PUBLIC_GATEWAY_URL: process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000',
    NEXT_PUBLIC_AI_URL: process.env.NEXT_PUBLIC_AI_URL || 'http://localhost:4001',
  },
};

module.exports = nextConfig;

