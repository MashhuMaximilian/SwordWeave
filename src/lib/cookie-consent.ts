"use client";

import { isPublicPage } from "@/lib/seo/public-pages";
import * as CookieConsent from "vanilla-cookieconsent";

let initialization: Promise<void> | undefined;
let analyticsAllowed = false;
const listeners = new Set<() => void>();
const hasVercelTelemetry = process.env["NEXT_PUBLIC_SW_HOSTING"] !== "hetzner";

export const analyticsConsent = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  getSnapshot: () => analyticsAllowed,
  getServerSnapshot: () => false,
};

function updateConsent() {
  analyticsAllowed = CookieConsent.acceptedCategory("analytics");
  listeners.forEach(listener => listener());
}

// Shared by React StrictMode mounts and the persistent preferences button.
// No remote scripts, consent service, or analytics request is needed to run it.
export function initializeCookieConsent() {
  initialization ??= CookieConsent.run({
    mode: "opt-in",
    revision: 1,
    manageScriptTags: false,
    cookie: { name: "sw_consent", expiresAfterDays: 180, sameSite: "Lax" },
    guiOptions: {
      consentModal: { layout: "box", position: "bottom left", equalWeightButtons: true },
      preferencesModal: { layout: "box", equalWeightButtons: true },
    },
    onConsent: updateConsent,
    onChange: updateConsent,
    categories: {
      necessary: { enabled: true, readOnly: true },
      analytics: { enabled: false, autoClear: { cookies: [{ name: /^_ga/ }, { name: "_gid" }, { name: /^_gat/ }] } },
    },
    language: {
      default: "en",
      translations: {
        en: {
          consentModal: {
            title: "Your privacy choices",
            description: hasVercelTelemetry
              ? "Essential storage keeps sign-in and your preferences working. Optional Google Analytics and Vercel tools help Mashu understand visits, useful actions, and performance. You can change your choice at any time."
              : "Essential storage keeps sign-in and your preferences working. Optional Google Analytics helps Mashu understand visits and how people use SwordWeave. You can change your choice at any time.",
            acceptAllBtn: "Accept analytics",
            acceptNecessaryBtn: "Essential only",
            showPreferencesBtn: "Choose preferences",
            footer: '<a href="/privacy">Privacy & cookies</a>',
          },
          preferencesModal: {
            title: "Privacy preferences",
            acceptAllBtn: "Accept analytics",
            acceptNecessaryBtn: "Essential only",
            savePreferencesBtn: "Save preferences",
            closeIconLabel: "Close preferences",
            sections: [
              { title: "Choose what you share", description: "Optional analytics stay off until you accept. Changing your choice does not affect access to the game tools." },
              { title: "Essential storage", description: "Clerk uses cookies for sign-in and account security. The site also remembers your theme, tool preferences, and this privacy choice. These are required for the features you use.", linkedCategory: "necessary" },
              {
                title: hasVercelTelemetry ? "Usage & performance analytics" : "Usage analytics",
                description: "Google Analytics measures visits, referral sources, and actions such as successful contact submissions, saved characters, downloads and Discord clicks. It uses pseudonymous browser identifiers." + (hasVercelTelemetry
                  ? ' Vercel Web Analytics measures visits and Speed Insights measures performance. All are optional. <a href="https://vercel.com/docs/analytics/privacy-policy" target="_blank" rel="noopener noreferrer">Read about Vercel Analytics privacy</a>.'
                  : " Google Analytics is optional."),
                linkedCategory: "analytics",
              },
              { title: "Questions?", description: '<a href="/contact">Contact Mashu</a> or read more about <a href="/privacy">privacy and cookies</a>.' },
            ],
          },
        },
      },
    },
  });
  return initialization;
}

export async function showCookiePreferences() {
  await initializeCookieConsent();
  CookieConsent.showPreferences();
}

// SDK listeners outlive their React components. Read the CURRENT choice for
// every event so withdrawing consent stops sends from an already-loaded SDK.
export function filterAnalyticsEvent<T extends { url: string }>(event: T): T | null {
  if (!analyticsAllowed) return null;
  try {
    const url = new URL(event.url);
    if (!isPublicPage(url.pathname)) return null;
    url.search = "";
    url.hash = "";
    return { ...event, url: url.toString() };
  } catch {
    return null;
  }
}
