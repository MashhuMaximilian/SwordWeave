"use client";

import { usePathname } from "next/navigation";
import { cssSurface } from "@/lib/ui/css-surface";

// Render the same marker on the server and during client navigation. Keeping
// it on html also covers body-level portals, without CSS :has() or a delayed
// effect that could briefly select the previous route's theme.
export function RootHtml({ children }: { children: React.ReactNode }) {
  return <html lang="en" className="dark" data-sw-css-surface={cssSurface(usePathname())} suppressHydrationWarning>{children}</html>;
}
