import catalogue from '@/lib/publications/catalogue.json';
import { PUBLIC_PAGES, SITE_URL } from './public-pages';

type SchemaNode = { '@type': string; '@id': string; [key: string]: unknown };

const WEBSITE_ID = `${SITE_URL}/#website`;
const CREATOR = {
  '@type': 'Person',
  '@id': `${SITE_URL}/about#mashu`,
  name: 'Marius Ion',
  alternateName: 'Mashu',
  url: `${SITE_URL}/about`,
};

/** Describe the curated public page, never a private record or an arbitrary URL. */
export function publicPageStructuredData(path: string) {
  if (!Object.hasOwn(PUBLIC_PAGES, path)) return null;
  const page = PUBLIC_PAGES[path]!;
  const url = `${SITE_URL}${path === '/' ? '' : path}`;
  const pageId = `${url}#webpage`;
  const book = catalogue.find(book => path === `/books/${book.slug}`);
  const graph: SchemaNode[] = [];

  if (path === '/') graph.push({
    '@type': 'WebSite', '@id': WEBSITE_ID, name: 'SwordWeave', url: SITE_URL,
    inLanguage: 'en', description: page.description,
  });

  graph.push({
    '@type': path === '/about' ? 'AboutPage' : path === '/contact' ? 'ContactPage' : path === '/books' ? 'CollectionPage' : 'WebPage',
    '@id': pageId,
    name: page.title,
    description: page.description,
    url,
    inLanguage: 'en',
    isPartOf: { '@id': WEBSITE_ID },
    ...(path === '/' ? {} : { breadcrumb: { '@id': `${url}#breadcrumb` } }),
    ...(book ? { mainEntity: { '@id': `${url}#book` } } : {}),
    ...(path === '/about' ? { mainEntity: { '@id': CREATOR['@id'] } } : {}),
  });

  if (path === '/about') graph.push(CREATOR);
  if (book) graph.push({
    '@type': 'Book', '@id': `${url}#book`, name: book.title,
    description: book.description, inLanguage: 'en', url, version: book.version,
    isAccessibleForFree: true, author: CREATOR,
    mainEntityOfPage: { '@id': pageId },
  });

  if (path !== '/') graph.push({
    '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`, itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'SwordWeave', item: SITE_URL },
      ...(book ? [{ '@type': 'ListItem', position: 2, name: 'Books', item: `${SITE_URL}/books` }] : []),
      { '@type': 'ListItem', position: book ? 3 : 2, name: page.title.split(' · ')[0], item: url },
    ],
  });

  return { '@context': 'https://schema.org', '@graph': graph };
}

/** Keep JSON readable to crawlers without permitting an HTML script terminator. */
export function serializeStructuredData(data: Record<string, unknown>) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
