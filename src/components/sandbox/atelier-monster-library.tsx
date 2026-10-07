"use client";

import { useEffect, useState } from "react";
import type { LibraryItem } from "@/lib/publishing/library-query";
import { LibraryTable } from "@/components/library/library-table";
import { MonsterTemplatePreview } from "@/components/monsters/monster-template-preview";
import { useModalStack } from "@/components/ui/modal-stack";
import { ColumnSearchBar } from "@/components/library/column-search-bar";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";

/** Creature previews share the source column's stack and destination footer. */
export function AtelierMonsterLibrary({ onLoad, currentUserInternalId }: {
  onLoad: (id: string) => void;
  currentUserInternalId: string | null;
}) {
  const stack = useModalStack();
  const phone = useIsMobile();
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener("sw:library-changed", refresh);
    return () => window.removeEventListener("sw:library-changed", refresh);
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      void fetch(`/api/library?targetType=MONSTER&limit=24&offset=${offset}&q=${encodeURIComponent(search)}`, { signal: abort.signal })
        .then(async response => {
          const body = await response.json();
          if (!response.ok) throw new Error(body.error ?? "Unable to load creatures.");
          if (!abort.signal.aborted) { setItems(body.items ?? []); setTotal(body.total ?? 0); setError(""); }
        }).catch(reason => { if (!abort.signal.aborted) setError(reason.message); })
        .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    }, 200);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [search, offset, revision]);
  function preview(item: LibraryItem) {
    stack.push({ key: `monster:${item.targetId}`, label: item.name, category: "Creature template", content:
      <MonsterTemplatePreview id={item.targetId} compact actions={{
        workspace: { label: phone ? "Replace primary build" : "Edit in middle workspace", description: "Load this creature into the Atelier editor.", onClick: () => onLoad(item.targetId) },
        buildModal: { label: "Replace modal build", description: "Load this creature into the independent Build & Preview workspace.", onClick: () => {
          window.dispatchEvent(new CustomEvent("sw-replace-secondary-monster", { detail: { id: item.targetId, name: item.name } }));
          stack.clear();
        } },
        openSourceHref: `/monsters/${item.targetId}`,
      }}/>
    });
  }
  return <section className="v12-source-browser v12-monster-source-library">
    <div className="v12-source-search"><ColumnSearchBar search={search} onSearchChange={value => { setSearch(value); setOffset(0); }}/></div>
    {error && <p role="alert">{error}</p>}
    <div className="v12-monster-source-results">
      <LibraryTable surface="atelier" compact={phone} view="LIST" engagement={{reactions:{},following:{}}} items={items} currentUserInternalId={currentUserInternalId} onSelect={preview} showClearFilters={false}/>
      {loading && <p role="status">Loading creatures…</p>}
      {total > 24 && <nav className="monster-actions" aria-label="Creature pages"><button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 24))}>Previous</button><button disabled={offset + 24 >= total} onClick={() => setOffset(offset + 24)}>Next</button></nav>}
    </div>
  </section>;
}
