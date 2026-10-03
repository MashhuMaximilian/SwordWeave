"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { LibraryItem } from "@/lib/publishing/library-query";

/** Keep only nearby result blocks mounted; measured spacers preserve the scroll position. */
function ResultBlock({ children, initial }: { children: ReactNode; initial: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(initial);
  const [height, setHeight] = useState(600);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => { if (entry) setVisible(entry.isIntersecting || element.contains(document.activeElement)); }, { rootMargin: "1200px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible || !ref.current) return;
    const element = ref.current;
    const measure = () => { const next = element.getBoundingClientRect().height; if (next) setHeight(previous => Math.abs(previous - next) > 1 ? next : previous); };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element); return () => observer.disconnect();
  }, [visible, children]);
  return <div ref={ref} style={visible ? undefined : { height }} data-library-block={visible ? "mounted" : "spacer"}>{visible ? children : null}</div>;
}

export function InfiniteLibraryResults({ items, render, hasMore, loading, error, loadMore, retry }: {
  items: LibraryItem[]; render: (items: LibraryItem[]) => ReactNode;
  hasMore: boolean; loading: boolean; error?: string; loadMore: () => void; retry: () => void;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hasMore || loading || error || !sentinel.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => { if (entry?.isIntersecting) loadMore(); }, { rootMargin: "500px 0px" });
    observer.observe(sentinel.current); return () => observer.disconnect();
  }, [hasMore, loading, error, loadMore, items.length]);
  const blocks = Array.from({ length: Math.ceil(items.length / 30) }, (_, index) => items.slice(index * 30, (index + 1) * 30));
  return <div aria-busy={loading}>
    {!loading && !error && items.length === 0 ? <div className="v12-empty-state" role="status"><h3>No entries match these filters.</h3><p>Try a broader search or clear filters.</p></div> : null}
    {blocks.map((block, index) => <ResultBlock key={block[0]!.id} initial={index < 2}>{render(block)}</ResultBlock>)}
    <div ref={sentinel} className="sheet-library-status">
      {error ? <p role="alert">{error} <button type="button" onClick={retry}>Retry</button></p> : loading ? <p role="status">Finding entries…</p> : hasMore ? <button type="button" onClick={loadMore}>Show more entries</button> : items.length > 0 ? <p role="status">All matching entries shown.</p> : null}
    </div>
  </div>;
}
