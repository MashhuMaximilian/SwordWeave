import type { Metadata, Viewport } from "next";
import { Magra, Teko } from "next/font/google";
import Script from "next/script";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AppShell } from "@/components/layout/app-shell";
import { FullscreenInit } from "@/components/layout/fullscreen-init";
import "./globals.css";

const teko = Teko({
  subsets: ["latin"],
  variable: "--font-sword-display",
  weight: ["400", "700"],
});

const magra = Magra({
  subsets: ["latin"],
  variable: "--font-sword-body",
  weight: ["400", "700"],
});

// Next.js 16: themeColor moved out of metadata. Putting it in metadata
// triggers "Unsupported metadata themeColor is configured in metadata
// export" on every route. Viewport exports go to a <meta name="viewport">
// tag instead, which is where the browser actually reads theme-color from.
export const metadata: Metadata = {
  title: "SwordWeave",
  description: "Open-source web engine for the SwordWeave TTRPG system.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SwordWeave",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Phase 18F (2026-07-14, perf): early-connect hints for
            third-party origins that gate the LCP path.

            Why each one matters:
            - clerk.swordweave.quest: Clerk's client bundle
              (clerk.browser.js + clerk-ui) is render-blocking for
              any signed-in route. Without preconnect the browser
              doesn't even START the DNS/TLS handshake until it
              sees a <script src=> pointing at it, adding ~150ms
              on Slow 4G. Three of them: dns-prefetch (cheap, runs
              in parallel), preconnect (does full handshake but
              parallelized with the rest of the HTML parse),
              preload (no — we don't preload because we don't know
              which Clerk script the user needs yet).
            - cdn.jsdelivr.net: the game-icons.net SVGs are proxied
              through jsDelivr's GitHub mirror at first-paint when
              a row of icons becomes visible (lazy-img under the
              fold). Preconnecting warms the connection so the first
              scroll triggers IO with no RTT penalty.
            - fonts.gstatic.com + fonts.googleapis.com: Teko and
              Magra come from next/font/google, which already
              self-hosts via next/font's optimization. The browser
              only ever contacts our domain for the static font
              files, so we don't need a hint here. Documented for
              the next person who reads this comment.

            Why we don't use crossOrigin="anonymous": preconnect
            without crossOrigin does the bare TCP/TLS handshake,
            which is the slow part. The actual GET comes later and
            will add its own headers if needed.
        */}
        <link rel="dns-prefetch" href="https://clerk.swordweave.quest" />
        <link rel="preconnect" href="https://clerk.swordweave.quest" />
        <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
      </head>
      <body className={`${teko.variable} ${magra.variable}`}>
        <Script id="swordweave-theme" strategy="beforeInteractive">
          {`
try {
  const storedTheme = window.localStorage.getItem("swordweave-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (storedTheme === "dark" || (!storedTheme && prefersDark)) {
    document.documentElement.classList.add("dark");
  }
} catch {}
          `}
        </Script>
        <ClerkProvider>
          <FullscreenInit />
          <AppShell>{children}</AppShell>
          {/* Vercel Web Analytics — tracks pageviews, custom events,
              and visitors. Per
              https://vercel.com/docs/analytics/quickstart?framework=nextjs,
              the Analytics component auto-handles route changes via
              the App Router. Drop it anywhere in the tree; we put it
              next to AppShell so it shares the clerk+theme context. */}
          <Analytics />
          {/* Vercel Speed Insights — tracks Core Web Vitals on real
              visits. Per
              https://vercel.com/docs/speed-insights/quickstart,
              the SpeedInsights component ships a tiny client script
              that records LCP/CLS/INP and reports them to the
              project's Speed Insights dashboard. Next.js v13.5+
              must use the /next subpath import (not /react) — the
              docs call this out explicitly because the /react
              subpath bypasses Next's app-router route detection. */}
          <SpeedInsights />
        </ClerkProvider>
      </body>
    </html>
  );
}
