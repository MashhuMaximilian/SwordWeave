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
  // The unified sandbox now lives at /sandbox/atelier. The legacy
  // /sandbox/grammar and /sandbox/blueprint routes are folded into it
  // (the unified client selects the active tab from ?build=). Redirect
  // the old paths here so bookmarks / old links keep working. Next
  // preserves the incoming query string (e.g. ?build=effect) across
  // the redirect, so the correct tab still opens.
  async redirects() {
    return [
      {
        source: "/sandbox/grammar",
        destination: "/sandbox/atelier",
        permanent: false,
      },
      {
        source: "/sandbox/blueprint",
        destination: "/sandbox/atelier",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;