import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CORE_BOOKS } from '@/lib/publications/books';
import { BookReader } from '@/components/publications/book-reader';
import '../books.css';

export function generateStaticParams() { return CORE_BOOKS.map(book => ({ slug: book.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params; const book = CORE_BOOKS.find(b => b.slug === slug);
  return { title: book ? `${book.title} · SwordWeave v0.1 alpha` : 'Book not found', description: book?.description };
}
export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const book = CORE_BOOKS.find(b => b.slug === slug); if (!book) notFound();
  return <BookReader book={book}/>;
}
