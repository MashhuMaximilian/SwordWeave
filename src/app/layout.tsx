import type { Metadata } from "next";
import Script from "next/script";
import { Magra, Teko } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { AppShell } from "@/components/layout/app-shell";
import "./globals.css";

const teko = Teko({
  subsets: ["latin"],
  variable: "--font-sword-display",
  weight: ["500", "600", "700"],
});

const magra = Magra({
  subsets: ["latin"],
  variable: "--font-sword-body",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "SwordWeave",
  description: "Open-source web engine for the SwordWeave TTRPG system.",
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
          <AppShell>{children}</AppShell>
        </ClerkProvider>
      </body>
    </html>
  );
}
