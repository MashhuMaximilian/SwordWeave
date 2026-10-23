import { CharacterSheetDownloads } from '@/components/publications/character-sheet-downloads';
import { QuickCoreDownloads } from '@/components/publications/quick-core-downloads';
import { StructuredData } from "@/components/analytics/structured-data";
import { publicPageMetadata } from "@/lib/seo/metadata";
import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicNav } from '@/components/home/public-nav';
import { BookCards } from '@/components/publications/book-cards';
import './books.css';

export const metadata: Metadata = publicPageMetadata("/books");
export default function BooksPage() {
  return <div className="sw-public-site sw-books-hub"><StructuredData path="/books" /><PublicNav prefetch={false}/><header className="sw-books-intro"><p className="sw-public-kicker">One framework · Three ways into the game</p><h1>The SwordWeave books</h1><p>Start with the compact Play, Run and Create PDFs, or read the Create & Publish guide to sharing and selling your work. The full PHB, GM Guide and SRD offer more explanation, examples and reference detail. All four guides and all three books are free.</p><div><span className="sw-book-version">v0.1 alpha</span><span>Original text & diagrams · CC BY 4.0</span><Link prefetch={false} href="/rules">Need a quick rule? →</Link></div></header><QuickCoreDownloads placement="books" /><BookCards prefetch={false}/><CharacterSheetDownloads placement="books" /><section className="sw-books-note"><h2>Made for your table</h2><p>Current online readers may differ from revised PDF editions. These books are not yet a synchronized final set; identify the book and edition when quoting a rule.</p><p>The PHB teaches all player procedures. The GM Guide helps you apply them. The SRD states the same mechanics and base primitive families for reference and compatible creation. Finished monsters, heritages and community forks remain in the <Link prefetch={false} href="/library/browse">Library</Link>; you can build your own without buying another book.</p><p><strong>One rule remains pending in this alpha:</strong> additional Vitality upkeep payments triggered by incoming damage. Its notice is marked in each book. Other agreed upkeep requirements remain usable.</p><p>Download, print for your table and share. <a href="https://buymeacoffee.com/mashhul" target="_blank" rel="noopener noreferrer">Buying the creator a coffee</a> is welcome and entirely optional.</p></section></div>;
}
