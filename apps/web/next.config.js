/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true, // Required for static export
  },
  output: 'export', // Static export for Cloudflare Pages
  distDir: 'out',
}

module.exports = nextConfig
