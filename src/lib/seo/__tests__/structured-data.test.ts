import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';
import catalogue from '@/lib/publications/catalogue.json';
import { StructuredData } from '@/components/analytics/structured-data';
import { PUBLIC_PAGES, SITE_URL } from '../public-pages';
import { publicPageMetadata } from '../metadata';
import { publicPageStructuredData, serializeStructuredData } from '../structured-data';

describe('public structured data', () => {
  it('server renders parseable canonical page descriptions on every curated route', () => {
    for (const [path, page] of Object.entries(PUBLIC_PAGES)) {
      const html = renderToStaticMarkup(createElement(StructuredData, { path }));
      const $ = load(html);
      const scripts = $('script[type="application/ld+json"]');
      expect(scripts).toHaveLength(1);
      const data = JSON.parse(scripts.text());
      const url = publicPageMetadata(path).alternates?.canonical;
      expect(data['@context']).toBe('https://schema.org');
      expect(data['@graph']).toContainEqual(expect.objectContaining({
        '@id': `${url}#webpage`, name: page.title, description: page.description,
        url, inLanguage: 'en', isPartOf: { '@id': `${SITE_URL}/#website` },
      }));
      const ids = data['@graph'].map((node: { '@id': string }) => node['@id']);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.every((id: string) => new URL(id).origin === SITE_URL && !new URL(id).search)).toBe(true);
    }
  });

  it('identifies the home site once and uses content-supported page types', () => {
    for (const path of Object.keys(PUBLIC_PAGES)) {
      const graph = publicPageStructuredData(path)!['@graph'];
      const websites = graph.filter(node => node['@type'] === 'WebSite');
      expect(websites).toHaveLength(path === '/' ? 1 : 0);
      if (path === '/') expect(websites[0]).toMatchObject({ name: 'SwordWeave', url: SITE_URL });
    }
    expect(publicPageStructuredData('/about')!['@graph'][0]?.['@type']).toBe('AboutPage');
    expect(publicPageStructuredData('/contact')!['@graph'][0]?.['@type']).toBe('ContactPage');
    expect(publicPageStructuredData('/books')!['@graph'][0]?.['@type']).toBe('CollectionPage');
    expect(publicPageStructuredData('/creating')!['@graph'][0]?.['@type']).toBe('WebPage');
  });

  it('links each book to its own page and the same identified creator without conflating PDF revisions', () => {
    const creator = publicPageStructuredData('/about')!['@graph'].find(node => node['@type'] === 'Person');
    expect(creator).toMatchObject({ name: 'Marius Ion', alternateName: 'Mashu' });
    for (const book of catalogue) {
      const path = `/books/${book.slug}`;
      const graph = publicPageStructuredData(path)!['@graph'];
      const bookNode = graph.find(node => node['@type'] === 'Book');
      expect(bookNode).toMatchObject({
        name: book.title, version: book.version, isAccessibleForFree: true,
        author: creator, mainEntityOfPage: { '@id': `${SITE_URL}${path}#webpage` },
      });
      expect(graph[0]?.['mainEntity']).toEqual({ '@id': bookNode?.['@id'] });
      expect(bookNode).not.toHaveProperty('encoding');
      expect(bookNode).not.toHaveProperty('numberOfPages');
      expect(bookNode).not.toHaveProperty('bookEdition');
    }
  });

  it('retains complete ordered breadcrumb trails with canonical destinations', () => {
    for (const path of Object.keys(PUBLIC_PAGES)) {
      const graph = publicPageStructuredData(path)!['@graph'];
      const breadcrumb = graph.find(node => node['@type'] === 'BreadcrumbList');
      if (path === '/') { expect(breadcrumb).toBeUndefined(); continue; }
      const items = breadcrumb?.['itemListElement'] as { position: number; name: string; item: string }[];
      const isBook = catalogue.some(book => path === `/books/${book.slug}`);
      expect(items).toHaveLength(isBook ? 3 : 2);
      expect(items.map(item => item.position)).toEqual(isBook ? [1, 2, 3] : [1, 2]);
      expect(items[0]).toMatchObject({ name: 'SwordWeave', item: SITE_URL });
      if (isBook) expect(items[1]).toMatchObject({ name: 'Books', item: `${SITE_URL}/books` });
      expect(items.at(-1)?.item).toBe(`${SITE_URL}${path}`);
      expect(graph[0]?.['breadcrumb']).toEqual({ '@id': breadcrumb?.['@id'] });
    }
  });

  it.each(['/characters/private', '/api/library', '/missing', '/rules?draft=1', 'constructor', '__proto__'])('does not mark up non-curated path %s', path => {
    expect(publicPageStructuredData(path)).toBeNull();
    expect(renderToStaticMarkup(createElement(StructuredData, { path }))).toBe('');
  });

  it('serializes embedded text as data without a script breakout', () => {
    const text = '</script><script>alert("x")</script> & SwordWeave';
    const json = serializeStructuredData({ name: text });
    expect(json).not.toContain('<');
    expect(JSON.parse(json)).toEqual({ name: text });
    expect(load(`<script type="application/ld+json">${json}</script>`)('script')).toHaveLength(1);
  });
});
