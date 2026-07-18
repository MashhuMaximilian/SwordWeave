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
  // The unified sandbox now lives at /atelier (formerly /sandbox/atelier,
  // and before that the per-type /sandbox/grammar + /sandbox/blueprint
  // routes). Redirect every legacy path here so bookmarks / old links
  // keep working. Next preserves the incoming query string
  // (e.g. ?build=effect) across the redirect, so the correct tab still
  // opens on /atelier.
  //
  // The bare /sandbox index was a workshops hub whose cards all pointed at
  // /atelier or the still-lived /sandbox/builds + /sandbox/characters
  // sub-routes. It is now orphaned (the FAB links straight to /atelier),
  // so we redirect the exact "/sandbox" segment to /atelier while leaving
  // its /sandbox/builds and /sandbox/characters sub-routes intact.
  async redirects() {
    return [
      {
        source: "/sandbox/grammar",
        destination: "/atelier",
        permanent: false,
      },
      {
        source: "/sandbox/blueprint",
        destination: "/atelier",
        permanent: false,
      },
      {
        source: "/sandbox/atelier",
        destination: "/atelier",
        permanent: false,
      },
      {
        source: "/sandbox",
        destination: "/atelier",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;