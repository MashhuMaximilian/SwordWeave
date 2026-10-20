'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { analyticsConsent } from '@/lib/cookie-consent';
import { googlePageView, startGoogleAnalytics, stopGoogleAnalytics } from '@/lib/analytics/client';

export function GoogleAnalytics({ allowed }: { allowed: boolean }) {
  const path = usePathname();
  useEffect(() => analyticsConsent.subscribe(() => {
    if (!analyticsConsent.getSnapshot()) stopGoogleAnalytics();
  }), []);
  useEffect(() => {
    if (allowed) { startGoogleAnalytics(); googlePageView(); }
    else stopGoogleAnalytics();
  }, [allowed, path]);
  return null;
}
