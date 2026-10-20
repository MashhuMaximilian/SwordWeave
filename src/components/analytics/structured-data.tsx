import { PUBLIC_PAGES, SITE_URL } from '@/lib/seo/public-pages';
import catalogue from '@/lib/publications/catalogue.json';
export function StructuredData({ path }: { path: string }) {
  const page = PUBLIC_PAGES[path];
  if (!page) return null;
  const book = catalogue.find(book => path === `/books/${book.slug}`);
  const data = [
    ...(path === '/' ? [{ '@type': 'WebSite', '@id': `${SITE_URL}/#website`, name: 'SwordWeave', url: SITE_URL, inLanguage: 'en', description: page.description }] : []),
    ...(path === '/about' ? [{ '@type': 'Person', '@id': `${SITE_URL}/about#mashu`, name: 'Marius Ion', alternateName: 'Mashu', url: `${SITE_URL}/about` }] : []),
    ...(book ? [{ '@type': 'Book', '@id': `${SITE_URL}${path}#book`, name: book.title, description: book.description, inLanguage: 'en', url: `${SITE_URL}${path}`, version: book.version, isAccessibleForFree: true, author: { '@type': 'Person', name: 'Marius Ion', alternateName: 'Mashu' } }] : []),
    ...(path === '/' ? [] : [{ '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'SwordWeave', item: SITE_URL },
      ...(book ? [{ '@type': 'ListItem', position: 2, name: 'Books', item: `${SITE_URL}/books` }] : []),
      { '@type': 'ListItem', position: book ? 3 : 2, name: page.title.split(' · ')[0], item: `${SITE_URL}${path}` },
    ] }]),
  ];
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@graph': data }).replace(/</g, '\\u003c') }} />;
}
