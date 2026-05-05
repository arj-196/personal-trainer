import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: ['@personal-trainer/shared'],
  allowedDevOrigins: ['*.ngrok-free.app'],
};

export default nextConfig;
