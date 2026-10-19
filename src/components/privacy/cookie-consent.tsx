"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { analyticsConsent, filterAnalyticsEvent, initializeCookieConsent, showCookiePreferences } from "@/lib/cookie-consent";

export function CookieConsentManager() {
  const allowed = useSyncExternalStore(analyticsConsent.subscribe, analyticsConsent.getSnapshot, analyticsConsent.getServerSnapshot);
  useEffect(() => {
    // Fail closed if the manager cannot initialize: analytics stays off.
    void initializeCookieConsent().catch(() => {});
  }, []);
  return allowed ? <>
    <Analytics beforeSend={filterAnalyticsEvent} />
    <SpeedInsights beforeSend={filterAnalyticsEvent} />
  </> : null;
}

export function CookiePreferencesButton() {
  const [failed, setFailed] = useState(false);
  return <>
    <button type="button" className="sw-cookie-preferences hover:text-foreground hover:underline" onClick={() => {
      void showCookiePreferences().then(() => setFailed(false)).catch(() => setFailed(true));
    }}>Cookie preferences</button>
    {failed && <span role="alert">Preferences could not open. Please refresh and try again.</span>}
  </>;
}
