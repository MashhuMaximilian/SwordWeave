import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Clerk user avatars (private bucket URLs)
      {
        protocol: "https",
        hostname: "img.clerk.com",
        pathname: "/**",
      },
      // Clerk fallback avatars
      {
        protocol: "https",
        hostname: "images.clerk.dev",
        pathname: "/**",
      },
      // placehold.co for placeholder content (Phase 7 seeding)
      {
        protocol: "https",
        hostname: "placehold.co",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;