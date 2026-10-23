/** Current illustrated books supersede their light PDFs; earlier dark editions remain available. */
export function bookPdfDownloads(book: { slug: string; lightPdf: string; darkPdf: string }) {
  if (book.slug === 'players-handbook') return [
    { href: book.lightPdf, label: 'Illustrated PDF (25.7 MB)', detail: '268 pages · Interwoven edition' },
    { href: '/books/v0.1-alpha/players-handbook-full.pdf', label: 'High-resolution PDF (202 MB)', detail: '268 pages · Interwoven edition' },
    { href: book.darkPdf, label: 'Earlier dark PDF', detail: 'Previous edition' },
  ];
  if (book.slug === 'game-masters-guide') return [
    { href: book.lightPdf, label: 'Illustrated PDF (76.5 MB)', detail: '268 pages · Organic-edge revision' },
    { href: '/books/v0.1-alpha/game-masters-guide-full.pdf', label: 'High-resolution PDF (309 MB)', detail: '268 pages · Organic-edge revision' },
    { href: book.darkPdf, label: 'Earlier dark PDF', detail: 'Previous edition' },
  ];
  if (book.slug === 'srd') return [
    { href: book.lightPdf, label: 'Reference PDF (14.5 MB)', detail: '78 pages · Reference edition' },
    { href: book.darkPdf, label: 'Earlier dark PDF', detail: 'Previous edition' },
  ];
  return [
    { href: book.lightPdf, label: 'Light PDF', detail: '' },
    { href: book.darkPdf, label: 'Dark PDF', detail: '' },
  ];
}

export function bookDownloadEvent(slug: string, href: string, placement: 'home' | 'books' | 'reader' | 'press') {
  const book_id = slug === 'players-handbook' ? 'phb' : slug === 'game-masters-guide' ? 'gm_guide' : 'srd';
  const edition = slug === 'players-handbook'
    ? (href.endsWith('-full.pdf') ? 'interwoven_full' : href.includes('-dark') ? 'earlier_dark' : 'interwoven')
    : slug === 'game-masters-guide'
      ? (href.endsWith('-full.pdf') ? 'gm_organic_full' : href.includes('-dark') ? 'earlier_dark' : 'gm_organic')
      : href.includes('-dark') ? 'earlier_dark' : 'srd_reference';
  return { name: 'file_download', params: { book_id, edition, release_version: 'v0.1-alpha', placement } } as const;
}
