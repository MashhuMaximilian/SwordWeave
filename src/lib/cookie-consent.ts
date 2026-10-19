"use client";

import * as CookieConsent from "vanilla-cookieconsent";

let initialization: Promise<void> | undefined;
let analyticsAllowed = false;
const listeners = new Set<() => void>();

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
    revision: 0,
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
      analytics: { enabled: false },
    },
    language: {
      default: "en",
      translations: {
        en: {
          consentModal: {
            title: "Your privacy choices",
            description: "Essential storage keeps sign-in and your preferences working. Optional analytics help Mashu understand site visits and performance. You can change your choice at any time.",
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
              { title: "Usage & performance analytics", description: 'Vercel Web Analytics measures visits and page views; Speed Insights measures loading speed and responsiveness. Both are optional. <a href="https://vercel.com/docs/analytics/privacy-policy" target="_blank" rel="noopener noreferrer">Read about Vercel Analytics privacy</a>.', linkedCategory: "analytics" },
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
    url.search = "";
    url.hash = "";
    return { ...event, url: url.toString() };
  } catch {
    return null;
  }
}
