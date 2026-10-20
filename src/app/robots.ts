import type { MetadataRoute } from 'next';
import { SITE_URL, isDiscoveryProduction } from '@/lib/seo/public-pages';

export default function robots(): MetadataRoute.Robots {
  // Search crawlers inherit the same public access. Training policy is unchanged.
  // Keep noindex pages crawlable so crawlers can see the directive. Auth is enforced separately.
  return { rules: isDiscoveryProduction()
    ? [{ userAgent: '*', allow: '/', disallow: ['/api/'] }]
    : [{ userAgent: '*', disallow: '/' }], sitemap: `${SITE_URL}/sitemap.xml` };
}
