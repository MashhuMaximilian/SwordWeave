import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PublicNav } from '@/components/home/public-nav';
import { StructuredData } from '@/components/analytics/structured-data';
import { publicPageMetadata } from '@/lib/seo/metadata';
import { CoreBookShelf, CompactGuideShelf, CompanionShelf, CharacterSheetShelf } from '@/components/publications/publication-gallery';

export const metadata: Metadata = publicPageMetadata('/books');

export default function BooksPage() {
  return <div className="sw-public-site sw-download-page sw-books-library">
    <StructuredData path="/books" /><PublicNav prefetch={false} />
    <div id="main-content">
      <header className="sw-download-masthead"><h1>Books &amp;<br /><span>table essentials.</span></h1><div><p>The complete rules, a shorter way in, and pages to make your own. Every PDF is free. Preview it here, read online, or take a copy to your table.</p><p className="sw-publication-meta">SwordWeave · v0.1 alpha · No account needed</p><Link prefetch={false} className="sw-publication-text-link" href="/start">Playing for the first time? Start here <ArrowRight size={17} aria-hidden="true" /></Link></div></header>
      <nav className="sw-download-index" aria-label="Books and downloads"><a href="#books">Core books</a><a href="#quick-core">Quick guides</a><a href="#materials">Fillable companions</a><a href="#character-sheets">Character sheets</a><Link prefetch={false} href="/rules">Online rules <ArrowRight size={14} aria-hidden="true" /></Link></nav>
      <CoreBookShelf placement="books" />
      <CompactGuideShelf placement="books" />
      <CompanionShelf placement="books" />
      <CharacterSheetShelf placement="books" />
      <section className="sw-publication-closing" aria-labelledby="books-table-note"><div><h2 id="books-table-note">Made for your table.<br />Still taking shape.</h2><p>Download, print for your table and share. The PHB teaches player procedures, the GM Guide helps you run them, and the SRD is the reference for compatible creation.</p><Link prefetch={false} className="sw-publication-text-link" href="/library/browse">Explore monsters, heritages and community creations <ArrowRight size={17} aria-hidden="true" /></Link></div><div><h3>Know which edition you’re using</h3><p>Online readers may differ from revised PDF editions. The PHB, GM Guide and SRD are not yet a synchronized final set; identify the book and edition when quoting a rule.</p><p>One rule remains pending: additional Vitality upkeep payments triggered by incoming damage. Its notice is marked in each book. Other agreed upkeep requirements remain usable.</p><p>Designated original text and diagrams use CC BY 4.0. Artwork, branding, fonts and third-party assets keep their separate notices. See each book’s credits.</p><a className="sw-publication-text-link" href="https://buymeacoffee.com/mashhul" target="_blank" rel="noopener noreferrer">Support development, entirely optionally <ArrowRight size={16} aria-hidden="true" /></a></div></section>
    </div>
  </div>;
}
