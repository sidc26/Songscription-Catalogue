/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@tonejs/midi'],
experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
