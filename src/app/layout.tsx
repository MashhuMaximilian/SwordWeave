import type { Metadata, Viewport } from "next";
import { Magra, Teko } from "next/font/google";
import Script from "next/script";
import { ClerkProvider } from "@clerk/nextjs";
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
        </ClerkProvider>
      </body>
    </html>
  );
}
