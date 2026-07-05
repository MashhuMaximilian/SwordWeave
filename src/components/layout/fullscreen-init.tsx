"use client";

// =============================================================================
// FullscreenInit — Android fullscreen API helper.
//
// On Android Chrome (and other WebKit/Blink browsers), `document.documentElement`
// exposes a `requestFullscreen()` method. Calling it on first user gesture
// removes the address bar and (on Android) the system UI bars, giving the
// app a true fullscreen PWA feel.
//
// iOS Safari does NOT support the Fullscreen API for arbitrary elements —
// the manifest's `"display": "standalone"` is what bypasses iOS Safari UI
// there. So this helper is best-effort: it tries fullscreen on Android,
// silently no-ops on iOS / desktop / browsers that block it.
//
// Auto-engages on the FIRST user tap. We can't auto-call fullscreen on
// page load because the spec requires a user gesture.
// =============================================================================

import { useEffect } from "react";

const ENGAGED_KEY = "sw-fullscreen-engaged";

function tryFullscreen(): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement as HTMLElement & {
    requestFullscreen?: () => Promise<void>;
    webkitRequestFullscreen?: () => void;
  };
  const req =
    el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el);
  if (!req) return;
  try {
    const result = req();
    if (result && typeof (result as Promise<void>).catch === "function") {
      (result as Promise<void>).catch(() => {
        /* user denied or browser blocked — silent */
      });
    }
  } catch {
    /* silent */
  }
}

export function FullscreenInit() {
  useEffect(() => {
    // Only attempt on mobile-ish UA. Desktop browsers either support it
    // (rare) or don't, and engaging here is undesirable.
    if (typeof navigator === "undefined") return;
    const isMobile = /android|iphone|ipad|ipod|mobile/i.test(
      navigator.userAgent,
    );
    if (!isMobile) return;

    // Don't re-attempt within the same session — if the user denied once,
    // we shouldn't keep nagging on every navigation.
    if (sessionStorage.getItem(ENGAGED_KEY) === "1") return;

    const onFirstGesture = () => {
      sessionStorage.setItem(ENGAGED_KEY, "1");
      tryFullscreen();
      window.removeEventListener("pointerdown", onFirstGesture);
      window.removeEventListener("touchstart", onFirstGesture);
      window.removeEventListener("keydown", onFirstGesture);
    };
    window.addEventListener("pointerdown", onFirstGesture, { once: true });
    window.addEventListener("touchstart", onFirstGesture, { once: true });
    window.addEventListener("keydown", onFirstGesture, { once: true });

    return () => {
      window.removeEventListener("pointerdown", onFirstGesture);
      window.removeEventListener("touchstart", onFirstGesture);
      window.removeEventListener("keydown", onFirstGesture);
    };
  }, []);

  return null;
}