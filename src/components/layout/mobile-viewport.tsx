"use client";

import { useEffect } from "react";

/** Keep phone and tablet sheets within the visible area when the keyboard/browser chrome opens. */
export function MobileViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    const media = window.matchMedia("(max-width: 1279px)");
    const update = () => {
      // Preserve browser pinch zoom; do not resize sheets while someone magnifies text.
      if (viewport && viewport.scale !== 1) return;
      if (media.matches) {
        document.documentElement.style.setProperty("--sw-visible-height", `${viewport?.height ?? window.innerHeight}px`);
        document.documentElement.style.setProperty("--sw-visible-top", `${viewport?.offsetTop ?? 0}px`);
      } else {
        document.documentElement.style.removeProperty("--sw-visible-height");
        document.documentElement.style.removeProperty("--sw-visible-top");
      }
    };
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.documentElement.style.removeProperty("--sw-visible-height");
      document.documentElement.style.removeProperty("--sw-visible-top");
    };
  }, []);
  return null;
}
