"use client";

import { useEffect, useState } from "react";

/**
 * True when the viewport is "mobile" — i.e. narrower than the sandbox's
 * MOBILE_BREAKPOINT_PX (768px). On mobile the sandbox collapses the build +
 * preview into a bottom split panel / drawer; on tablet/desktop those live
 * in the inline 3-column layout, so the Build & Preview *drawer* must never
 * open there (it would overlay the already-visible inline build column).
 *
 * With workbench=true, short landscape phones use the three desktop columns,
 * matching SandboxLayout. Generic phone surfaces retain the width breakpoint.
 * Keep both queries in sync with SandboxLayout.
 */
const MOBILE_BREAKPOINT_PX = 768;

export function useIsMobile(workbench = false): boolean {
  // Default to false (desktop) for SSR/first paint so the drawer never
  // auto-opens on a server-rendered desktop view.
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`);
    const landscape = window.matchMedia("(min-width: 640px) and (max-height: 499px) and (orientation: landscape)");
    const apply = () => setIsMobile(mql.matches && !(workbench && landscape.matches));
    apply();
    mql.addEventListener("change", apply);
    landscape.addEventListener("change", apply);
    return () => {
      mql.removeEventListener("change", apply);
      landscape.removeEventListener("change", apply);
    };
  }, [workbench]);

  return isMobile;
}
