'use client';

import { useEffect } from 'react';
import Script from 'next/script';
import { analyticsEnabled, GA_MEASUREMENT_ID, initializeAnalytics } from '@/lib/analytics';

export default function GoogleAnalytics() {
  useEffect(() => { initializeAnalytics(); }, []);
  if (!analyticsEnabled) return null;
  return <Script
    id="google-analytics"
    src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
    strategy="afterInteractive"
  />;
}
