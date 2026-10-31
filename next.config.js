/** @type {import('next').NextConfig} */
module.exports = {
  experimental: {
    // Runs instrumentation.ts at startup (the JWT_SECRET check).
    instrumentationHook: true
  },
  images: {
    // next/image resizes and re-encodes these for phones (components/Img.tsx).
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'plus.unsplash.com' }
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 414, 640, 828, 1080, 1280],
    imageSizes: [48, 64, 96, 128, 256, 384]
  }
}
