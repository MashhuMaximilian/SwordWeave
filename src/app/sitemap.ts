import type { MetadataRoute } from 'next';
import { PUBLIC_PAGES, SITE_URL, isDiscoveryProduction } from '@/lib/seo/public-pages';
export default function sitemap(): MetadataRoute.Sitemap {
  return isDiscoveryProduction() ? Object.keys(PUBLIC_PAGES).map(path => ({ url: `${SITE_URL}${path === '/' ? '' : path}` })) : [];
}
