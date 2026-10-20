import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicNav } from '@/components/home/public-nav';
import { StructuredData } from '@/components/analytics/structured-data';
import { LearningGuide } from '@/components/rules/learning-guide';
import { PRIMITIVE_TUTORIAL, PRIMITIVE_TUTORIAL_INTRO } from '@/lib/rules/primitive-tutorial';
import { publicPageMetadata } from '@/lib/seo/metadata';
import '../../books/books.css';

export const metadata: Metadata = publicPageMetadata('/tutorials/create-a-primitive');

export default function PrimitiveTutorialPage() {
  return <div className="sw-public-site sw-rules-page">
    <StructuredData path="/tutorials/create-a-primitive" />
    <PublicNav />
    <header className="sw-rules-header">
      <p className="sw-public-kicker">Atelier · A guided example</p>
      <h1>{PRIMITIVE_TUTORIAL_INTRO.title}</h1>
      <p>{PRIMITIVE_TUTORIAL_INTRO.summary}</p>
      <p>{PRIMITIVE_TUTORIAL_INTRO.editionNote}</p>
      <div className="sw-rules-book-links">
        <Link href="/atelier?build=primitive">Open the Atelier →</Link>
        <Link href="/rules#creating">Keep the Rules guide nearby →</Link>
        <Link href="/tutorials/create-a-primitive.md">Read as Markdown →</Link>
      </div>
    </header>
    <LearningGuide topics={PRIMITIVE_TUTORIAL} basePath="/tutorials/create-a-primitive" indexTitle="Create your first primitive" indexDescription="Follow the steps, then check the rule you saved." searchLabel="Search the primitive tutorial" searchPlaceholder="Find a field or step…" emptyHint="Try “Use number”, “Recipient”, “stacking”, or “Private”." endLink={{ title: 'Open the Atelier', url: '/atelier?build=primitive' }} />
  </div>;
}
