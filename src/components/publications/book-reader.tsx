'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, Download, Moon, Search, Sun, X } from 'lucide-react';
import { useGlobalControls } from '@/components/layout/global-controls';
import type { CoreBook, BookBlock } from '@/lib/publications/books';
import CORE_BOOKS from '@/lib/publications/catalogue.json';
import BOOK_FIGURES from '@/lib/publications/figures.json';

/** Render the deliberately small manuscript grammar as React text, never HTML. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\((?:https?:\/\/[^)]+|#[^)]+)\))/g);
  return <>{parts.map((part, i) => {
    if (part.startsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) return <a key={i} href={link[2]}>{link[1]}</a>;
    return <Fragment key={i}>{part}</Fragment>;
  })}</>;
}

function RenderBlock({ block }: { block: BookBlock }) {
  if (block.type === 'heading') { const H = block.level === 2 ? 'h2' : 'h3'; return <H id={block.id}><a href={`#${block.id}`}><Inline text={block.text}/></a></H>; }
  if (block.type === 'paragraph') return <p className={block.text.startsWith('**Alpha rule pending') ? 'sw-book-pending' : block.text.startsWith('**Default') ? 'sw-book-rule' : undefined}><Inline text={block.text}/></p>;
  if (block.type === 'list') { const List = block.ordered ? 'ol' : 'ul'; return <List>{block.items.map((text, i) => <li key={i}><Inline text={text}/></li>)}</List>; }
  if (block.type === 'aside') return <aside className="sw-book-example">{block.paragraphs.map((text, i) => <p key={i}><Inline text={text}/></p>)}</aside>;
  if (block.type === 'table') return <div className="sw-book-table-wrap" tabIndex={0} aria-label="Reference table, scroll horizontally if needed"><table><thead><tr>{block.rows[0]?.map((text, i) => <th key={i} scope="col"><Inline text={text}/></th>)}</tr></thead><tbody>{block.rows.slice(1).map((row, i) => <tr key={i}>{row.map((text, j) => j === 0 ? <th scope="row" key={j}><Inline text={text}/></th> : <td key={j}><Inline text={text}/></td>)}</tr>)}</tbody></table></div>;
  if (block.type === 'index') return null;
  const figure = (BOOK_FIGURES as Record<string, { title: string; caption: string }>)[block.name];
  if (!figure) return null;
  return <figure className="sw-book-figure"><div className="sw-book-figure-visual"><Image unoptimized className="sw-book-figure--light" src={`/books/figures/${block.name}-light.svg`} alt={figure.title} width={720} height={block.name === 'composition' ? 310 : 224}/><Image unoptimized className="sw-book-figure--dark" src={`/books/figures/${block.name}-dark.svg`} alt={figure.title} width={720} height={block.name === 'composition' ? 310 : 224}/></div><figcaption>{figure.caption} <span className="sw-book-figure-hint">Swipe the diagram to explore it.</span></figcaption></figure>;
}

export function BookReader({ book }: { book: CoreBook }) {
  const { dark, toggleDark } = useGlobalControls();
  const [query, setQuery] = useState(''); const [open, setOpen] = useState(false); const [active, setActive] = useState('');
  const [saved, setSaved] = useState(''); const contents = useRef<HTMLDetailsElement>(null);
  const chapters = book.headings.filter(h => h.level === 2);
  const searchable = useMemo(() => book.headings.map(heading => {
    const start = book.blocks.findIndex(b => b.type === 'heading' && b.id === heading.id);
    const end = book.blocks.findIndex((b, i) => i > start && b.type === 'heading');
    const text = book.blocks.slice(start, end < 0 ? undefined : end).map(b => b.type === 'paragraph' ? b.text : b.type === 'table' ? b.rows.flat().join(' ') : b.type === 'list' ? b.items.join(' ') : b.type === 'aside' ? b.paragraphs.join(' ') : '').join(' ');
    return { ...heading, searchText: (heading.text + ' ' + text).toLocaleLowerCase() };
  }), [book]);
  const results = query.trim() ? searchable.filter(h => h.searchText.includes(query.trim().toLocaleLowerCase())) : book.headings;
  useEffect(() => {
    const restore = requestAnimationFrame(() => { try { const last = localStorage.getItem(`sw-book-position:${book.slug}`); if (last && book.headings.some(h => h.id === last)) setSaved(last); } catch { /* Storage is optional. */ } });
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) { setActive(visible.target.id); try { localStorage.setItem(`sw-book-position:${book.slug}`, visible.target.id); } catch { /* Reading remains available. */ } }
    }, { rootMargin: '-90px 0px -65% 0px' });
    book.headings.forEach(h => { const node = document.getElementById(h.id); if (node) observer.observe(node); });
    return () => { cancelAnimationFrame(restore); observer.disconnect(); };
  }, [book]);
  useEffect(() => { const media = window.matchMedia('(min-width: 901px)'); const apply = () => setOpen(media.matches); const frame = requestAnimationFrame(apply); media.addEventListener('change', apply); return () => { cancelAnimationFrame(frame); media.removeEventListener('change', apply); }; }, []);
  useEffect(() => { if (!open) return; const escape = (e: KeyboardEvent) => { if (e.key === 'Escape' && window.matchMedia('(max-width: 900px)').matches) { setOpen(false); contents.current?.querySelector('summary')?.focus(); } }; window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape); }, [open]);
  const chapterIndex = Math.max(0, chapters.findIndex(h => h.id === active || book.blocks.findIndex(b => b.type === 'heading' && b.id === h.id) <= book.blocks.findIndex(b => b.type === 'heading' && b.id === active) && (!chapters[chapters.indexOf(h) + 1] || book.blocks.findIndex(b => b.type === 'heading' && b.id === chapters[chapters.indexOf(h) + 1]?.id) > book.blocks.findIndex(b => b.type === 'heading' && b.id === active))));
  return <div className="sw-book-reader">
    <header className="sw-book-toolbar"><Link href="/books"><ArrowLeft size={16} aria-hidden="true"/> All books</Link><span>{book.short} <small>v0.1 alpha</small></span><div><button type="button" onClick={toggleDark} aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`}>{dark ? <Sun size={17}/> : <Moon size={17}/>}</button><details className="sw-book-pdf-menu"><summary><Download size={16} aria-hidden="true"/><span>PDF</span><ChevronDown size={13} aria-hidden="true"/></summary><div><a href={book.lightPdf}>Light edition</a><a href={book.darkPdf}>Dark edition</a></div></details></div></header>
    <div className="sw-book-reader-layout">
      <details className="sw-book-contents" ref={contents} open={open} onToggle={e => setOpen(e.currentTarget.open)}><summary><BookOpen size={16} aria-hidden="true"/> Contents & search <ChevronDown size={15} aria-hidden="true"/></summary><div className="sw-book-contents-body"><nav aria-label="Core books" className="sw-book-switch">{CORE_BOOKS.map(b => <Link key={b.slug} href={`/books/${b.slug}`} aria-current={book.slug === b.slug ? 'page' : undefined}>{b.short}</Link>)}</nav><label className="sw-book-search"><Search size={15} aria-hidden="true"/><span className="sr-only">Search this book</span><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a rule or example…"/>{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear book search"><X size={14}/></button>}</label>{query && <p role="status">{results.length} matching sections</p>}<nav aria-label={`${book.title} contents`}>{results.map(h => <a key={h.id} className={h.level === 2 ? 'is-chapter' : undefined} href={`#${h.id}`} aria-current={active === h.id ? 'location' : undefined} onClick={() => { if (window.matchMedia('(max-width: 900px)').matches) setOpen(false); }}>{h.text}</a>)}</nav></div></details>
      <article className="sw-book-text">
        <header className={`sw-book-title sw-book-title--${book.accent}`}><p className="sw-book-kicker">SwordWeave · {book.version} · Free digital edition</p><h1>{book.title}</h1><p>{book.subtitle}</p><div className="sw-book-editions"><a href={book.lightPdf}><Download size={15} aria-hidden="true"/> Light PDF</a><a href={book.darkPdf}><Download size={15} aria-hidden="true"/> Dark PDF</a><span>Text & diagrams: CC BY 4.0</span></div>{saved && <a className="sw-book-resume" href={`#${saved}`}>Continue from {book.headings.find(h => h.id === saved)?.text} <ArrowRight size={14} aria-hidden="true"/></a>}</header>
        {book.blocks.map((block, i) => block.type === 'index' ? <nav key={i} className="sw-book-topic-index" aria-label="Alphabetical topic index">{book.headings.filter(h => h.id !== 'topic-index').sort((a, b) => a.text.localeCompare(b.text)).map(h => <a key={h.id} href={`#${h.id}`}>{h.text}</a>)}</nav> : <RenderBlock key={block.type === 'heading' ? block.id : i} block={block}/>)}
        <footer className="sw-book-end"><Link href="/books">Choose another book <ArrowRight size={16} aria-hidden="true"/></Link><Link href="/rules">Open the quick rules guide</Link><a href="https://buymeacoffee.com/mashhul" target="_blank" rel="noopener noreferrer">Support SwordWeave · optional</a></footer>
      </article>
    </div>
    <nav className="sw-book-chapter-nav" aria-label="Move between chapters"><a href={`#${chapters[Math.max(0, chapterIndex - 1)]?.id}`} aria-label="Previous chapter"><ArrowLeft size={16}/><span>Previous</span></a><span>{chapters[chapterIndex]?.text}</span><a href={`#${chapters[Math.min(chapters.length - 1, chapterIndex + 1)]?.id}`} aria-label="Next chapter"><span>Next</span><ArrowRight size={16}/></a></nav>
  </div>;
}
