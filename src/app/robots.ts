import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo/public-pages';
import { isDiscoveryProduction } from '@/lib/seo/discovery-policy';
import { connection } from 'next/server';

export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  // Search crawlers inherit the same public access. Training policy is unchanged.
  // Keep noindex pages crawlable so crawlers can see the directive. Auth is enforced separately.
  return { rules: isDiscoveryProduction()
    ? [{ userAgent: '*', allow: '/', disallow: ['/api/'] }]
    : [{ userAgent: '*', disallow: '/' }], sitemap: `${SITE_URL}/sitemap.xml` };
}
