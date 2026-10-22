import type { Metadata } from 'next';
import { PUBLIC_PAGES, SITE_URL, markdownPath, isDiscoveryProduction, PUBLIC_MARKDOWN_MEDIA_TYPE } from './public-pages';

export function publicPageMetadata(path: string): Metadata {
  const page = PUBLIC_PAGES[path];
  if (!page) return { robots: { index: false, follow: true } };
  const url = `${SITE_URL}${path === '/' ? '' : path}`;
  return {
    title: page.title, description: page.description,
    alternates: { canonical: url, types: { [PUBLIC_MARKDOWN_MEDIA_TYPE]: `${SITE_URL}${markdownPath(path)}` } },
    robots: { index: isDiscoveryProduction(), follow: true },
    openGraph: { type: 'website', locale: 'en_US', siteName: 'SwordWeave', title: page.title, description: page.description, url,
      images: [{ url: `${SITE_URL}/opengraph-image`, width: 1200, height: 630, alt: 'SwordWeave — A TTRPG for your table' }] },
    twitter: { card: 'summary_large_image', title: page.title, description: page.description, images: [`${SITE_URL}/opengraph-image`] },
  };
}
