import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
