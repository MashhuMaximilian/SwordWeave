'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { BookOpen, ChevronLeft, ChevronRight, ExternalLink, Search, X } from 'lucide-react';
import { searchTopics } from '@/lib/rules/guide-search';
import type { GuideBlock, GuideTopic } from '@/lib/rules/play-guide';

type GuideLink = { title: string; url: string };
type GuideLocation = { topicId: string; blockId: string | null };

function linkUrl(url: string, basePath: string): string {
  return url.startsWith('#') ? `${basePath}${url}` : url;
}

export type LearningGuideProps = {
  topics: GuideTopic[];
  basePath: string;
  initialTopicId?: string;
  embedded?: boolean;
  sourceLinks?: Record<string, GuideLink[]>;
  endLink?: GuideLink;
  indexTitle?: string;
  indexDescription?: string;
  searchLabel?: string;
  searchPlaceholder?: string;
  emptyHint?: string;
  sourceLabel?: string;
};

function containsBlock(block: GuideBlock, id: string): boolean {
  return block.id === id || Boolean(block.details?.some(detail => containsBlock(detail, id)));
}

/** Resolve only authored topic/block anchors; malformed or unknown hashes are harmless. */
export function resolveGuideAnchor(topics: GuideTopic[], hash: string): GuideLocation | null {
  let id: string;
  try {
    id = decodeURIComponent(hash.replace(/^#/, ''));
  } catch {
    return null;
  }
  if (!id) return null;
  const chapter = topics.find(topic => topic.id === id);
  if (chapter) return { topicId: chapter.id, blockId: null };
  const chapterForBlock = topics.find(topic => topic.blocks.some(block => containsBlock(block, id)));
  return chapterForBlock ? { topicId: chapterForBlock.id, blockId: id } : null;
}

type BlockContentProps = {
  block: GuideBlock;
  searching: boolean;
  targetBlockId: string | null;
  basePath: string;
  embedded: boolean;
  onLinkClick: (event: MouseEvent<HTMLAnchorElement>, url: string) => void;
};

function BlockContent({ block, searching, targetBlockId, basePath, embedded, onLinkClick }: BlockContentProps) {
  return <>
    {block.body && <p>{block.body}</p>}
    {block.paragraphs?.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
    {block.rules && <ul className="sw-play-guide-mechanics">{block.rules.map((rule, index) => <li key={index}>{rule}</li>)}</ul>}
    {block.ordered && <ol className="sw-play-guide-ordered">{block.ordered.map((step, index) => <li key={index}>{step}</li>)}</ol>}
    {block.table && <div className="sw-play-guide-table" role="region" aria-label={block.table.caption} tabIndex={0}>
      <table><caption>{block.table.caption}</caption><thead><tr>{block.table.headers.map((header, index) => <th key={index} scope="col">{header}</th>)}</tr></thead><tbody>{block.table.rows.map((row, index) => <tr key={index}>{row.map((cell, column) => <td key={column}>{cell}</td>)}</tr>)}</tbody></table>
    </div>}
    {block.example && <aside className="sw-play-guide-example"><strong>At the table</strong><p>{block.example}</p></aside>}
    {block.links && <ul className="sw-play-guide-links">{block.links.map((link, index) => <li key={index}><Link href={linkUrl(link.url, basePath)} onClick={event => onLinkClick(event, linkUrl(link.url, basePath))} target={embedded ? '_blank' : undefined} rel={embedded ? 'noopener noreferrer' : undefined}>{link.title} <ExternalLink size={13} aria-hidden="true" /></Link></li>)}</ul>}
    {block.details && <div className="sw-play-guide-details"><p className="sw-play-guide-detail-label">Explore the details when you need them</p>{block.details.map((detail, index) => <details key={detail.id ?? index} id={detail.id} data-guide-block-id={detail.id} tabIndex={detail.id ? -1 : undefined} open={searching || Boolean(targetBlockId && containsBlock(detail, targetBlockId)) || undefined}><summary><span>{detail.title}</span><ChevronRight size={16} aria-hidden="true" /></summary><div className="sw-play-guide-detail-body"><BlockContent block={detail} searching={searching} targetBlockId={targetBlockId} basePath={basePath} embedded={embedded} onLinkClick={onLinkClick} /></div></details>)}</div>}
  </>;
}

/** The Rules reader, also reusable for focused learning guides and sheet overlays. */
export function LearningGuide({
  topics,
  basePath,
  initialTopicId,
  embedded = false,
  sourceLinks,
  endLink,
  indexTitle = 'Learn, then explore',
  indexDescription = 'Start at the beginning, or find help for this moment.',
  searchLabel = 'Search the guide',
  searchPlaceholder = 'Find a rule or example…',
  emptyHint = 'Try another word from this guide.',
  sourceLabel = 'Read more',
}: LearningGuideProps) {
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState(() => ({
    topicId: topics.find(topic => topic.id === initialTopicId)?.id ?? topics[0]?.id ?? '',
    blockId: null as string | null,
    request: 0,
  }));
  const reading = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const matches = searchTopics(topics, query);
  const topic = matches.find(candidate => candidate.id === selection.topicId) ?? matches[0];
  const chapterIndex = topic ? topics.indexOf(topic) : -1;
  const references = topic ? sourceLinks?.[topic.id] ?? topic.sources ?? [] : [];

  useEffect(() => {
    if (embedded) return;
    const readHash = () => {
      const location = resolveGuideAnchor(topics, window.location.hash);
      if (!location) return;
      setQuery('');
      setSelection(current => ({ ...location, request: current.request + 1 }));
    };
    readHash();
    window.addEventListener('hashchange', readHash);
    return () => window.removeEventListener('hashchange', readHash);
  }, [topics, embedded]);

  useEffect(() => {
    if (!selection.request || !reading.current) return;
    const container = reading.current;
    const block = selection.blockId
      ? Array.from(container.querySelectorAll<HTMLElement>('[data-guide-block-id]')).find(element => element.dataset['guideBlockId'] === selection.blockId)
      : null;
    const destination = block ?? heading.current;
    if (!destination) return;
    if (embedded) {
      const top = block ? block.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop : 0;
      container.scrollTo({ top });
    } else {
      container.scrollTo({ top: 0 });
      (block ?? container).scrollIntoView({ block: 'start' });
    }
    destination.focus({ preventScroll: true });
  }, [selection, embedded]);

  const choose = (location: GuideLocation) => {
    setSelection(current => ({ ...location, request: current.request + 1 }));
    if (!embedded) {
      const anchor = location.blockId ?? location.topicId;
      window.history.replaceState(window.history.state, '', `${basePath}#${encodeURIComponent(anchor)}`);
    }
  };

  const followLink = (event: MouseEvent<HTMLAnchorElement>, url: string) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.currentTarget.target === '_blank') return;
    const destination = new URL(url, window.location.href);
    const guideUrl = new URL(basePath, window.location.origin);
    if (destination.origin !== guideUrl.origin || destination.pathname !== guideUrl.pathname) return;
    const location = resolveGuideAnchor(topics, destination.hash);
    if (!location) return;
    event.preventDefault();
    setQuery('');
    choose(location);
  };

  const chapter = (offset: number) => {
    const next = topics[chapterIndex + offset];
    if (!next) return;
    setQuery('');
    choose({ topicId: next.id, blockId: null });
  };

  const currentAnchor = topic?.id === selection.topicId && selection.blockId ? selection.blockId : topic?.id ?? topics[0]?.id ?? '';

  return <div className={`sw-play-guide${embedded ? ' sw-play-guide--embedded' : ''}`}>
    <aside className="sw-play-guide-index">
      <div className="sw-play-guide-index-intro"><BookOpen size={20} aria-hidden="true" /><div><strong>{indexTitle}</strong><p>{indexDescription}</p></div></div>
      <label className="sw-play-guide-search"><Search size={18} aria-hidden="true" /><span className="sr-only">{searchLabel}</span><input aria-label={searchLabel} value={query} onChange={event => setQuery(event.target.value)} placeholder={searchPlaceholder} type="search" />{query && <button type="button" aria-label="Clear guide search" onClick={() => setQuery('')}><X size={16} /></button>}</label>
      <p className="sw-play-guide-index-label" aria-live="polite">{query ? `${matches.length} matching topics` : 'Contents'}<span className="sw-play-guide-phone-hint"> · Swipe topics</span></p>
      <nav aria-label="Guide topics">{matches.map(candidate => <button type="button" key={candidate.id} aria-current={topic?.id === candidate.id ? 'page' : undefined} onClick={() => choose({ topicId: candidate.id, blockId: null })}><span className="sw-play-guide-chapter-number" aria-hidden="true">{String(topics.indexOf(candidate) + 1).padStart(2, '0')}</span><span>{candidate.title}</span><ChevronRight size={16} aria-hidden="true" /></button>)}</nav>
      {embedded && <a className="sw-play-guide-page-link" href={`${basePath}#${encodeURIComponent(currentAnchor)}`} target="_blank" rel="noopener noreferrer">Open full guide <ExternalLink size={14} aria-hidden="true" /></a>}
    </aside>
    <article className="sw-play-guide-reading" ref={reading} aria-label={topic?.title ?? 'Guide search results'}>
      {topic ? <>
        <header className="sw-play-guide-topic-head"><span><BookOpen size={16} aria-hidden="true" /> Chapter {chapterIndex + 1} / {topics.length}</span><h2 ref={heading} tabIndex={-1}>{topic.title}</h2><p>{topic.summary}</p></header>
        <div className="sw-play-guide-blocks">{topic.blocks.map((block, index) => <section key={block.id ?? index} id={block.id} data-guide-block-id={block.id} tabIndex={block.id ? -1 : undefined} aria-label={block.title} className="sw-play-guide-block">{!(topic.blocks.length === 1 && block.title === topic.title) && <div className="sw-play-guide-block-head"><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><h3>{block.title}</h3></div>}<BlockContent block={block} searching={Boolean(query.trim())} targetBlockId={selection.blockId} basePath={basePath} embedded={embedded} onLinkClick={followLink} /></section>)}</div>
        {references.length > 0 && <aside className="sw-play-guide-sources" aria-label="Further reading"><strong>{sourceLabel}</strong>{references.map((link, index) => <Link key={index} href={linkUrl(link.url, basePath)} onClick={event => followLink(event, linkUrl(link.url, basePath))} target={embedded ? '_blank' : undefined} rel={embedded ? 'noopener noreferrer' : undefined}>{link.title} <ExternalLink size={13} aria-hidden="true" /></Link>)}</aside>}
        {(chapterIndex > 0 || chapterIndex < topics.length - 1 || endLink) && <footer className="sw-play-guide-next" aria-label="Continue through the guide">
          {chapterIndex > 0 && <button type="button" onClick={() => chapter(-1)}><ChevronLeft size={16} aria-hidden="true" /><span><small>Previous chapter</small>{topics[chapterIndex - 1]!.title}</span></button>}
          {chapterIndex < topics.length - 1 ? <button type="button" className="sw-play-guide-next-primary" onClick={() => chapter(1)}><span><small>Continue learning</small>{topics[chapterIndex + 1]!.title}</span><ChevronRight size={16} aria-hidden="true" /></button> : endLink && <Link className="sw-play-guide-next-primary" href={linkUrl(endLink.url, basePath)} onClick={event => followLink(event, linkUrl(endLink.url, basePath))}>{endLink.title} <ChevronRight size={16} aria-hidden="true" /></Link>}
        </footer>}
      </> : <div className="sw-play-guide-empty" role="status"><BookOpen size={30} /><h2>No matching topics</h2><p>{emptyHint}</p><button type="button" onClick={() => setQuery('')}>Show all topics</button></div>}
    </article>
  </div>;
}
