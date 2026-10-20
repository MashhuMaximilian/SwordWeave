import pages from './pages.json';
import catalogue from '@/lib/publications/catalogue.json';

export const SITE_URL = 'https://www.swordweave.quest';
export type PublicPage = { title: string; description: string; group: string };
export const PUBLIC_PAGES: Record<string, PublicPage> = {
  ...pages,
  ...Object.fromEntries(catalogue.map(book => [`/books/${book.slug}`, {
    title: `${book.title} · SwordWeave v0.1 alpha`, description: book.description, group: 'books',
  }])),
};
export const markdownPath = (path: string) => path === '/' ? '/index.md' : `${path}.md`;
export function isPublicPage(path: string) { return Object.hasOwn(PUBLIC_PAGES, path); }
export function isDiscoveryProduction() { return process.env['VERCEL_ENV'] !== 'preview' && process.env.NODE_ENV !== 'development'; }
