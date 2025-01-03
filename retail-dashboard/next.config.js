/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
      serverActions: true,
  },
  output: 'standalone',
  basePath: '/retail', // Aggiunto per configurare il prefisso del percorso
}

module.exports = nextConfig;

