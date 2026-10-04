'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BookOpen, ChevronLeft, ChevronRight, ExternalLink, Search, X } from 'lucide-react';
import { PLAY_GUIDE, searchGuide, type GuideBlock } from '@/lib/rules/play-guide';

function BlockContent({ block, searching }: { block: GuideBlock; searching: boolean }) {
  return <>
    {block.body && <p>{block.body}</p>}
    {block.rules && <ul className="sw-play-guide-mechanics">{block.rules.map(rule => <li key={rule}>{rule}</li>)}</ul>}
    {block.example && <aside className="sw-play-guide-example"><strong>At the table</strong><p>{block.example}</p></aside>}
    {block.details && <div className="sw-play-guide-details"><p className="sw-play-guide-detail-label">Explore the details when you need them</p>{block.details.map(detail => <details key={detail.title} open={searching || undefined}><summary><span>{detail.title}</span><ChevronRight size={16} aria-hidden="true" /></summary><div className="sw-play-guide-detail-body"><BlockContent block={detail} searching={searching} /></div></details>)}</div>}
  </>;
}

/** One teaching and reference surface shared by the public page and sheet modal. */
export function PlayGuide({ embedded = false }: { embedded?: boolean }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('start');
  const reading = useRef<HTMLElement>(null);
  const matches = searchGuide(query);
  const topic = matches.find(t => t.id === selected) ?? matches[0];
  const chapterIndex = topic ? PLAY_GUIDE.indexOf(topic) : -1;

  useEffect(() => {
    if (embedded) return;
    const readHash = () => {
      const id = window.location.hash.slice(1);
      if (PLAY_GUIDE.some(t => t.id === id)) setSelected(id);
    };
    readHash();
    window.addEventListener('hashchange', readHash);
    return () => window.removeEventListener('hashchange', readHash);
  }, [embedded]);

  const choose = (id: string) => {
    setSelected(id);
    reading.current?.scrollTo({ top: 0 });
    if (!embedded) {
      window.history.replaceState(null, '', `/rules#${id}`);
      reading.current?.scrollIntoView({ block: 'start' });
    }
  };
  const chapter = (offset: number) => {
    const next = PLAY_GUIDE[chapterIndex + offset];
    if (!next) return;
    setQuery('');
    choose(next.id);
  };

  return <div className={`sw-play-guide${embedded ? ' sw-play-guide--embedded' : ''}`}>
    <aside className="sw-play-guide-index">
      <div className="sw-play-guide-index-intro"><BookOpen size={20} aria-hidden="true" /><div><strong>Learn, then explore</strong><p>Start at the beginning, or find help for this moment.</p></div></div>
      <label className="sw-play-guide-search"><Search size={18} aria-hidden="true" /><span className="sr-only">Search the play guide</span><input aria-label="Search the play guide" value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a rule or example…" type="search" />{query && <button type="button" aria-label="Clear guide search" onClick={() => setQuery('')}><X size={16} /></button>}</label>
      <p className="sw-play-guide-index-label" aria-live="polite">{query ? `${matches.length} matching topics` : 'Contents'}<span className="sw-play-guide-phone-hint"> · Swipe topics</span></p>
      <nav aria-label="Play guide topics">{matches.map(t => <button type="button" key={t.id} aria-current={topic?.id === t.id ? 'page' : undefined} onClick={() => choose(t.id)}><span className="sw-play-guide-chapter-number" aria-hidden="true">{String(PLAY_GUIDE.indexOf(t) + 1).padStart(2, '0')}</span><span>{t.title}</span><ChevronRight size={16} aria-hidden="true" /></button>)}</nav>
      {embedded && <a className="sw-play-guide-page-link" href={`/rules#${topic?.id ?? 'start'}`} target="_blank" rel="noopener noreferrer">Open full play guide <ExternalLink size={14} aria-hidden="true" /></a>}
    </aside>
    <article className="sw-play-guide-reading" ref={reading} aria-label={topic?.title ?? 'Guide search results'}>
      {topic ? <>
        <header className="sw-play-guide-topic-head"><span><BookOpen size={16} aria-hidden="true" /> Chapter {chapterIndex + 1} / {PLAY_GUIDE.length}</span><h2>{topic.title}</h2><p>{topic.summary}</p></header>
        <div className="sw-play-guide-blocks">{topic.blocks.map((block, i) => <section key={block.title} className="sw-play-guide-block"><div className="sw-play-guide-block-head"><span aria-hidden="true">{String(i + 1).padStart(2, '0')}</span><h3>{block.title}</h3></div><BlockContent block={block} searching={Boolean(query.trim())} /></section>)}</div>
        {topic.sources && <details className="sw-play-guide-sources"><summary>Source notes</summary><p>This guide follows current SwordWeave rulings and the app’s progression reference. Older source examples can use earlier terminology or formulas.</p>{topic.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.title} <ExternalLink size={13} aria-hidden="true" /></a>)}</details>}
        <footer className="sw-play-guide-next" aria-label="Continue through the guide">
          {chapterIndex > 0 && <button type="button" onClick={() => chapter(-1)}><ChevronLeft size={16} aria-hidden="true" /><span><small>Previous chapter</small>{PLAY_GUIDE[chapterIndex - 1]!.title}</span></button>}
          {chapterIndex < PLAY_GUIDE.length - 1 ? <button type="button" className="sw-play-guide-next-primary" onClick={() => chapter(1)}><span><small>Continue learning</small>{PLAY_GUIDE[chapterIndex + 1]!.title}</span><ChevronRight size={16} aria-hidden="true" /></button> : <Link className="sw-play-guide-next-primary" href="/characters/new">Create a character <ChevronRight size={16} aria-hidden="true" /></Link>}
        </footer>
      </> : <div className="sw-play-guide-empty" role="status"><BookOpen size={30} /><h2>No matching topics</h2><p>Try a term such as “upkeep”, “DC”, “poisoned”, or “slots”.</p><button type="button" onClick={() => setQuery('')}>Show all topics</button></div>}
    </article>
  </div>;
}
