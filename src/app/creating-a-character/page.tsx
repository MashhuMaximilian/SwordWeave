import { QuickCoreDownloads } from '@/components/publications/quick-core-downloads';
import type { Metadata } from 'next';
import Link from 'next/link';
import { StructuredData } from '@/components/analytics/structured-data';
import { PublicNav } from '@/components/home/public-nav';
import { LearningGuide } from '@/components/rules/learning-guide';
import { ADVANCED_CHARACTER_GUIDE, ADVANCED_CHARACTER_INTRO } from '@/lib/rules/advanced-character-guide';
import { publicPageMetadata } from '@/lib/seo/metadata';
import '../books/books.css';

export const metadata: Metadata = publicPageMetadata('/creating-a-character');

export default function CreatingACharacterPage() {
  return <div className="sw-public-site sw-rules-page"><StructuredData path="/creating-a-character" />
    <PublicNav />
    <header className="sw-rules-header">
      <p className="sw-public-kicker">Your person · Your ingredients</p>
      <h1>{ADVANCED_CHARACTER_INTRO.title}</h1>
      <p>{ADVANCED_CHARACTER_INTRO.summary}</p>
      <div className="sw-rules-book-links">
        <Link href="/characters/new">Start your own character →</Link>
        <Link href="/character#build-example">Read Neris’s saved example →</Link>
        <Link href="/tutorials/create-a-primitive">Primitive editor tutorial →</Link>
        <Link href="/creating-a-character.md">Read as Markdown →</Link>
      </div>
    </header>
    <QuickCoreDownloads placement="character_guide" ids={['create']} title="Keep the character rules beside you" description="A compact PDF covering the foundation, primitive families, price anchors, equipment and one complete character. Use it with Play for the shared rules." />
    <LearningGuide
      topics={ADVANCED_CHARACTER_GUIDE}
      basePath="/creating-a-character"
      indexTitle="From an idea to your character"
      indexDescription="Follow the complete worked proposal or find the decision you are making."
      searchLabel="Search the character creation guide"
      searchPlaceholder="Find a trait, rule or step…"
      emptyHint="Try “scent”, “condition”, “ledger”, “Awareness”, or “Atelier”."
      sourceLabel="Continue reading"
      endLink={{ title: 'Start your own character', url: '/characters/new' }}
    />
  </div>;
}
