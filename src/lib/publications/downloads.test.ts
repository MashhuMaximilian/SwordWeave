import { describe, expect, it } from 'vitest';
import { bookDownloadEvent, bookPdfDownloads } from './downloads';
import { validEvent } from '@/lib/analytics/contract';

describe('current GM Guide publication downloads', () => {
  const book = { slug: 'game-masters-guide', lightPdf: '/books/v0.1-alpha/game-masters-guide.pdf', darkPdf: '/books/v0.1-alpha/game-masters-guide-dark.pdf' };
  it('offers reading and full-resolution organic PDFs and keeps the older dark edition', () => {
    const downloads = bookPdfDownloads(book);
    expect(downloads.map(pdf => pdf.href)).toEqual([book.lightPdf, '/books/v0.1-alpha/game-masters-guide-full.pdf', book.darkPdf]);
    expect(downloads.map(pdf => pdf.label)).toEqual(['Illustrated PDF (76.5 MB)', 'High-resolution PDF (309 MB)', 'Earlier dark PDF']);
    expect(downloads[0]?.detail).toContain('268 pages');
  });
  it('reports actual release editions rather than light/dark or PHB editions', () => {
    const events = bookPdfDownloads(book).map(pdf => bookDownloadEvent(book.slug, pdf.href, 'books'));
    expect(events.map(event => event.params.edition)).toEqual(['gm_organic', 'gm_organic_full', 'earlier_dark']);
    expect(events.every(event => event.params.book_id === 'gm_guide' && validEvent(event))).toBe(true);
  });
  it('preserves the existing PHB and earlier SRD delivery definitions', () => {
    expect(bookDownloadEvent('players-handbook', '/books/v0.1-alpha/players-handbook.pdf', 'reader').params.edition).toBe('interwoven');
    expect(bookDownloadEvent('srd', '/books/v0.1-alpha/srd-dark.pdf', 'books').params.edition).toBe('dark');
  });
});
