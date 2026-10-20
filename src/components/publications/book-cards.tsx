import Link from 'next/link';
import { ArrowRight, Download } from 'lucide-react';
import CORE_BOOKS from '@/lib/publications/catalogue.json';
import { TrackLink } from '@/components/analytics/track-link';
import { bookPdfDownloads, bookDownloadEvent } from '@/lib/publications/downloads';

export function BookCards({ placement = 'books' }: { placement?: 'books' | 'home' }) {
  return <div className="sw-books-cards">{CORE_BOOKS.map((book, index) => <article key={book.slug} className={`sw-book-card sw-book-card--${book.accent}`}>
    <div className="sw-book-card__stamp" aria-hidden="true"><span>{String(index + 1).padStart(2, '0')}</span><i /></div>
    <p className="sw-book-kicker">{book.short} · v0.1 alpha</p><h2><Link href={`/books/${book.slug}`}>{book.title}</Link></h2><p>{book.description}</p>
    <Link className="sw-book-read" href={`/books/${book.slug}`}>Read the book <ArrowRight size={16} aria-hidden="true" /></Link>
    <div className="sw-book-downloads" aria-label={`${book.title} PDF editions`}><Download size={14} aria-hidden="true"/>{bookPdfDownloads(book).map((pdf, i) => <span key={pdf.href}>{i > 0 && <span aria-hidden="true"> · </span>}<TrackLink event={bookDownloadEvent(book.slug, pdf.href, placement)} href={pdf.href} title={pdf.detail || undefined}>{pdf.label}</TrackLink></span>)}</div>
  </article>)}</div>;
}
