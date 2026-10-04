import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicNav } from '@/components/home/public-nav';
import { PLAY_GUIDE } from '@/lib/rules/play-guide';

export const metadata: Metadata = {
  title: 'Create, edit & fork · SwordWeave',
  description: 'Create your own rules in the Atelier, adapt Library ideas, and develop your character.',
};

export default function CreatingPage() {
  const topic = PLAY_GUIDE.find(topic => topic.id === 'creating')!;
  return <div className="sw-public-site sw-rules-page">
    <PublicNav />
    <header className="sw-rules-header"><p className="sw-public-kicker">Your ideas · Your rules</p><h1>{topic.title}</h1><p>{topic.summary}</p><Link href="/rules#creating">Open this chapter in the play guide →</Link></header>
    <section className="sw-public-section sw-creating-guide" aria-label="Creating guide">
      {topic.blocks.map((block, index) => <article key={block.title}>
        <p className="sw-public-kicker">{String(index + 1).padStart(2, '0')}</p><h2>{block.title}</h2><p>{block.body}</p>
        {block.example && <aside className="sw-play-guide-example"><strong>For example</strong><p>{block.example}</p></aside>}
      </article>)}
      <p><Link href="/atelier">Start in the Atelier →</Link></p>
    </section>
  </div>;
}
