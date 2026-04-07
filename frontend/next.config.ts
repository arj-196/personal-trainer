import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
};

export default nextConfig;

module.exports = {
  allowedDevOrigins: ['*.ngrok-free.app'],
};
