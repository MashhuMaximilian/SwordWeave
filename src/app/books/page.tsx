import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicNav } from '@/components/home/public-nav';
import { BookCards } from '@/components/publications/book-cards';
import './books.css';

export const metadata: Metadata = { title: 'Free rulebooks · SwordWeave v0.1 alpha', description: "Read or download the free SwordWeave Player's Handbook, Game Master's Guide and SRD in light or dark editions." };
export default function BooksPage() {
  return <div className="sw-public-site sw-books-hub"><PublicNav/><header className="sw-books-intro"><p className="sw-public-kicker">One framework · Three ways into the game</p><h1>The SwordWeave books</h1><p>Learn to play, prepare a table, or build something of your own. Read in light or dark mode; keep the free PDF edition that feels right to you.</p><div><span className="sw-book-version">v0.1 alpha</span><span>Original text & diagrams · CC BY 4.0</span><Link href="/rules">Need a quick rule? →</Link></div></header><BookCards/><section className="sw-books-note"><h2>Made for your table</h2><p>The PHB teaches all player procedures. The GM Guide helps you apply them. The SRD states the same mechanics and base primitive families for reference and compatible creation. Finished monsters, heritages and community forks remain in the <Link href="/library/browse">Library</Link>; you can build your own without buying another book.</p><p><strong>One rule remains pending in this alpha:</strong> additional Vitality upkeep payments triggered by incoming damage. Its notice is marked in each book. Other agreed upkeep requirements remain usable.</p><p>Download, print for your table and share. <a href="https://buymeacoffee.com/mashhul" target="_blank" rel="noopener noreferrer">Buying the creator a coffee</a> is welcome and entirely optional.</p></section></div>;
}
