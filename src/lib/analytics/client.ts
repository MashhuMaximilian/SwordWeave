'use client';
import { analyticsConsent } from '@/lib/cookie-consent';
import { safePage, validEvent, type AnalyticsEvent } from './contract';

type Gtag = (...args: unknown[]) => void;
type AnalyticsWindow = Window & { dataLayer?: unknown[]; gtag?: Gtag; [key: `ga-disable-${string}`]: boolean };
const measurementId = process.env['NEXT_PUBLIC_GA_MEASUREMENT_ID'];
let initialized = false;
let lastPage = '';
const gaWindow = () => window as unknown as AnalyticsWindow;
function context() {
  const { public: _public, ...fields } = safePage(window.location.href, document.referrer);
  return { ...fields, debug_mode: ['localhost', '127.0.0.1'].includes(window.location.hostname) };
}
export function startGoogleAnalytics() {
  if (!measurementId || !/^G-[A-Z0-9]+$/.test(measurementId) || !analyticsConsent.getSnapshot()) return;
  const target = gaWindow();
  const wasDisabled = target[`ga-disable-${measurementId}`];
  target[`ga-disable-${measurementId}`] = false;
  if (initialized) {
    if (wasDisabled) target.gtag?.('config', measurementId, { ...context(), send_page_view: false });
    return;
  }
  initialized = true;
  target.dataLayer ??= [];
  target.gtag = function () { target.dataLayer!.push(arguments); };
  target.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  target.gtag('js', new Date());
  target.gtag('config', measurementId, { ...context(), send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false, transport_type: 'beacon', debug_mode: ['localhost', '127.0.0.1'].includes(window.location.hostname) });
  const script = document.createElement('script');
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  script.async = true;
  script.id = 'sw-google-analytics';
  document.head.appendChild(script);
}
export function stopGoogleAnalytics() {
  if (!measurementId) return;
  const target = gaWindow();
  target[`ga-disable-${measurementId}`] = true;
  // The first React render precedes consent restoration. Do not clear an
  // existing opted-in session merely because the local store is not ready yet.
  if (!initialized) return;
  // Stop pending analytics commands, too. Do not replay them on a later acceptance.
  if (target.dataLayer) target.dataLayer.length = 0;
  lastPage = '';
  try { sessionStorage.removeItem('sw-auth-measured'); sessionStorage.removeItem('sw-auth-pending'); } catch {}
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0]?.trim();
    if (!name || !/^_ga(?:_|$)|^_gid$|^_gat/.test(name)) continue;
    for (const domain of ['', window.location.hostname, '.swordweave.quest']) {
      document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax${domain ? `; domain=${domain}` : ''}`;
    }
  }
}
export function googlePageView() {
  if (!initialized || !analyticsConsent.getSnapshot()) return;
  const page = safePage(window.location.href, document.referrer);
  const { public: isPublic, ...fields } = page;
  gaWindow().gtag?.('set', fields);
  if (!isPublic) { lastPage = ''; return; }
  if (lastPage === page.page_location) return;
  lastPage = page.page_location;
  gaWindow().gtag?.('event', 'page_view', fields);
}
export function track(event: AnalyticsEvent) {
  try {
    if (!analyticsConsent.getSnapshot() || !validEvent(event)) return;
    startGoogleAnalytics();
    if (!initialized) return;
    gaWindow().gtag?.('event', event.name, { ...context(), ...event.params });
  } catch { /* Measurement never blocks a game action. */ }
}
