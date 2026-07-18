"use client";

import { useEffect, useState } from "react";

/**
 * True when the viewport is "mobile" — i.e. narrower than the sandbox's
 * MOBILE_BREAKPOINT_PX (768px). On mobile the sandbox collapses the build +
 * preview into a bottom split panel / drawer; on tablet/desktop those live
 * in the inline 3-column layout, so the Build & Preview *drawer* must never
 * open there (it would overlay the already-visible inline build column).
 *
 * Keep the breakpoint in sync with SandboxLayout.MOBILE_BREAKPOINT_PX.
 */
const MOBILE_BREAKPOINT_PX = 768;

export function useIsMobile(): boolean {
  // Default to false (desktop) for SSR/first paint so the drawer never
  // auto-opens on a server-rendered desktop view.
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`);
    const apply = () => setIsMobile(mql.matches);
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);

  return isMobile;
}
