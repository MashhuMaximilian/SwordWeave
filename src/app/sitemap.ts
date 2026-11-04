import type { MetadataRoute } from 'next';
import { PUBLIC_PAGES, SITE_URL } from '@/lib/seo/public-pages';
import { isDiscoveryProduction } from '@/lib/seo/discovery-policy';
import { connection } from 'next/server';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  return isDiscoveryProduction() ? Object.keys(PUBLIC_PAGES).map(path => ({ url: `${SITE_URL}${path === '/' ? '' : path}` })) : [];
}
