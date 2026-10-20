import { StructuredData } from "@/components/analytics/structured-data";
import { publicPageMetadata } from "@/lib/seo/metadata";
import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicNav } from '@/components/home/public-nav';
import { LearningGuide } from '@/components/rules/learning-guide';
import { CREATING_GUIDE, CREATING_GUIDE_INTRO } from '@/lib/rules/creating-guide';
import '../books/books.css';

export const metadata: Metadata = publicPageMetadata("/creating");

export default function CreatingPage() {
  return <div className="sw-public-site sw-rules-page"><StructuredData path="/creating" />
    <PublicNav />
    <header className="sw-rules-header">
      <p className="sw-public-kicker">Your ideas · Your rules</p>
      <h1>{CREATING_GUIDE_INTRO.title}</h1><p>{CREATING_GUIDE_INTRO.summary}</p>
      <div className="sw-rules-book-links">
        <Link href="/rules#creating">This chapter in Rules →</Link>
        <Link href="/tutorials/create-a-primitive">Create your first primitive →</Link>
        <Link href="/atelier">Open the Atelier →</Link>
        <Link href="/creating.md">Read as Markdown →</Link>
      </div>
    </header>
    <LearningGuide topics={CREATING_GUIDE} basePath="/creating" indexTitle="Create, then explore" indexDescription="Follow the creation path or find help for the step you are on." searchLabel="Search the creating guide" searchPlaceholder="Find a step or example…" emptyHint="Try “fork”, “price”, “range”, or “visibility”." endLink={{ title: 'Create your first primitive', url: '/tutorials/create-a-primitive' }} />
  </div>;
}
