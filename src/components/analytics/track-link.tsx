'use client';
import type { ComponentProps } from 'react';
import { track } from '@/lib/analytics/client';
import type { AnalyticsEvent } from '@/lib/analytics/contract';
export function TrackLink({ event, onClick, ...props }: ComponentProps<'a'> & { event: AnalyticsEvent }) {
  return <a {...props} onClick={click => { track(event); onClick?.(click); }} />;
}
