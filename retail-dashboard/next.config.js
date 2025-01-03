/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
  },
  output: 'standalone',
  basePath: '/retail', // Aggiunto per configurare il prefisso del percorso
}

module.exports = nextConfig;

