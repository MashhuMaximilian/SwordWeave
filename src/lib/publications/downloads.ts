/** The illustrated PHB supersedes its light PDF; the earlier dark edition remains available. */
export function bookPdfDownloads(book: { slug: string; lightPdf: string; darkPdf: string }) {
  if (book.slug === 'players-handbook') return [
    { href: book.lightPdf, label: 'Illustrated PDF (25.7 MB)', detail: '268 pages · Interwoven edition' },
    { href: '/books/v0.1-alpha/players-handbook-full.pdf', label: 'High-resolution PDF (202 MB)', detail: '268 pages · Interwoven edition' },
    { href: book.darkPdf, label: 'Earlier dark PDF', detail: 'Previous edition' },
  ];
  return [
    { href: book.lightPdf, label: 'Light PDF', detail: '' },
    { href: book.darkPdf, label: 'Dark PDF', detail: '' },
  ];
}

export function bookDownloadEvent(slug: string, href: string, placement: 'home' | 'books' | 'reader') {
  const book_id = slug === 'players-handbook' ? 'phb' : slug === 'game-masters-guide' ? 'gm_guide' : 'srd';
  const edition = slug === 'players-handbook' ? (href.endsWith('-full.pdf') ? 'interwoven_full' : href.includes('-dark') ? 'earlier_dark' : 'interwoven') : href.includes('-dark') ? 'dark' : 'light';
  return { name: 'file_download', params: { book_id, edition, release_version: 'v0.1-alpha', placement } } as const;
}
