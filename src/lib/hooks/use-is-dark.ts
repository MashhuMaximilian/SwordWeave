"use client";

import { useEffect, useState } from "react";

/**
 * True when the site is in dark mode. The app toggles a `.dark` class on
 * <html> (see ThemeToggle), not prefers-color-scheme, so we observe that
 * class directly rather than the OS media query.
 */
export function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}
