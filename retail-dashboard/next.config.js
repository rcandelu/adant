/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,
    experimental: {
      serverActions: true,
    },
    output: 'standalone'
  }
  
  module.exports = nextConfig