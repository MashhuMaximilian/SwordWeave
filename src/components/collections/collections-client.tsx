"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { LibraryCatalogueCard, LibraryCatalogueSurface } from "@/components/library/library-catalogue-card";
import { useRouter } from "next/navigation";
import { CatalogueQuickLook } from "@/components/library/catalogue-quick-look";
import { ColumnSearchBar } from "@/components/library/column-search-bar";
import { PHONE_RECORD_TYPES } from "@/components/library/phone-type-choices";
import type { LibraryItem } from "@/lib/publishing/library-query";
import Link from "next/link";
import { FolderTree, Folder, BookOpen, Bookmark, Hammer, GitFork, Plus, ArrowLeft } from "lucide-react";
import { useModalStack } from "@/components/ui/modal-stack";
import { EmptyState } from "@/components/ui/empty-state";
import { CollectionEntryPreview } from "./collection-entry-preview";
import "./collections.css";
type Collection = {
  id: string;
  name: string;
  parent_id: string | null;
  owner_id: string;
  visibility: string;
  system_kind: string | null;
  followed?: boolean;
};
type CollectionPageProps = { collectionId?: string; ownerId?: string; embedded?: boolean; startCreating?: boolean };
export function CollectionsClient(props: CollectionPageProps) {
  const { user, isLoaded } = useUser();
  if (!isLoaded) return props.embedded ? <div className="sw-collections-loading" role="status">Loading account…</div> : <main className="sw-collections-loading" role="status">Loading account…</main>;
  return <AccountCollectionsClient key={`${user?.id ?? "anonymous"}:${props.collectionId ?? ""}:${props.ownerId ?? ""}:${props.embedded?"embedded":"page"}:${Boolean(props.startCreating)}`} {...props} />;
}
function AccountCollectionsClient({collectionId, ownerId, embedded=false, startCreating=false}: CollectionPageProps) {
  const { user } = useUser();
  const clerk = useClerk();
  const router = useRouter();
  const stack = useModalStack();
  const [rows, setRows] = useState<Collection[]>([]),
    [current, setCurrent] = useState<Collection | null>(null),
    [entries, setEntries] = useState<LibraryItem[]>([]),
    [creating, setCreating] = useState(startCreating),
    [entryView, setEntryView] = useState<"GRID" | "LIST">("GRID"),
    [page, setPage] = useState(0),
    [search, setSearch] = useState(""),
    [filtersOpen, setFiltersOpen] = useState(false),
    [collectionKind, setCollectionKind] = useState("all"),
    [collectionVisibility, setCollectionVisibility] = useState(""),
    [entryType, setEntryType] = useState("ALL"),
    [entryOrigin, setEntryOrigin] = useState("all"),
    [entrySort, setEntrySort] = useState("RECENT"),
    [loading, setLoading] = useState(false),
    [more, setMore] = useState(false),
    [error, setError] = useState(""),
    [name, setName] = useState(""),
    [parent, setParent] = useState(collectionId ?? ""),
    [visibility, setVisibility] = useState("PRIVATE"),
    [renameDraft, setRenameDraft] = useState<string | null>(null),
    [deleteReview, setDeleteReview] = useState(false),
    [deleteChildren, setDeleteChildren] = useState<"move" | "delete">("move"),
    [pending, setPending] = useState(false);
  const alive = useRef(true);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; controller.current?.abort(); }; }, []);
  const catalogueSearch = collectionId ? search : "";
  const load = useCallback(async () => {
    if (!alive.current) return;
    controller.current?.abort();
    const reading = new AbortController(); controller.current = reading;
    const currentRequest = () => alive.current && !reading.signal.aborted;
    setLoading(true);
    try {
      const r = await fetch(
        collectionId
          ? `/api/collections/${collectionId}?page=${page}`
          : `/api/collections${ownerId ? `?owner=${encodeURIComponent(ownerId)}` : ""}`,
        {signal: reading.signal, cache: "no-store"},
      );
      const d = await r.json();
      if (!currentRequest()) return;
      setError("");
      if (!r.ok) throw new Error(d.error);
      if (collectionId) {
        setCurrent(d.collection);
        const query = new URLSearchParams({ collectionId, limit: "24", offset: String(page * 24), sort: entrySort, q: catalogueSearch, targetType: entryType, origin: entryOrigin });
        const catalogue = await fetch(`/api/library?${query}`, {signal: reading.signal, cache: "no-store"});
        const library = await catalogue.json();
        if (!currentRequest()) return;
        if (!catalogue.ok) throw new Error(library.error ?? "Unable to load collected entries");
        setEntries(library.items ?? []);
        setMore((page + 1) * 24 < library.total);
        const own = await fetch(
          `/api/collections?owner=${encodeURIComponent(d.collection.owner_id)}`,
          {signal: reading.signal, cache: "no-store"},
        ).then((r) => r.json());
        if (currentRequest()) setRows(own.collections ?? []);
      } else setRows(d.collections);
    } catch (e) {
      if (currentRequest()) setError(e instanceof Error ? e.message : "Unable to load collections");
    } finally {
      if (currentRequest()) setLoading(false);
    }
  }, [collectionId, ownerId, page, entrySort, entryType, entryOrigin, catalogueSearch]);
  useEffect(() => {
    // Schedule the account/page read after the committed render.
    void Promise.resolve().then(load);
  }, [load]);
  async function mutate(url: string, method: string, body: unknown) {
    if (pending || !alive.current) return false;
    setPending(true);
    try {
      const r = await fetch(url, {method, headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)});
      const d = await r.json();
      if (!alive.current) return false;
      if (!r.ok) throw new Error(d.error ?? "Unable to save collection");
      await load();
      return alive.current;
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : "Unable to save collection");
      return false;
    } finally {
      if (alive.current) setPending(false);
    }
  }
  const Root = embedded ? "div" : "main";
  const Heading = embedded ? "h2" : "h1";
  const changeSearch = useCallback((value: string) => { setSearch(value); setPage(0); }, []);
  const activeFilters = collectionId ? Boolean(entryType !== "ALL" || entryOrigin !== "all" || entrySort !== "RECENT") : Boolean(collectionKind !== "all" || collectionVisibility);
  const clearFilters = () => { setSearch(""); setCollectionKind("all"); setCollectionVisibility(""); setEntryType("ALL"); setEntryOrigin("all"); setEntrySort("RECENT"); setPage(0); };
  const matchedRows = rows.filter(c => c.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()) && (!collectionVisibility || c.visibility === collectionVisibility) && (collectionKind === "all" || (collectionKind === "automatic" ? Boolean(c.system_kind) : !c.system_kind)));
  const branchIds = new Set(matchedRows.flatMap(c => [c.id, ...collectionAncestors(c, rows).map(ancestor => ancestor.id)]));
  const indexRows = rows.filter(c => branchIds.has(c.id));
  const children = current ? rows.filter(c => c.parent_id === current.id && !c.system_kind) : [];
  return (
    <Root className={`sw-collections ${embedded ? "sw-collections--embedded" : ""}`}>
      {collectionId && <Link href="/collections" className="sw-metal-button sw-collections-button sw-collections-back"><ArrowLeft size={14} />Back to collections</Link>}
      <header className="sw-collections-heading"><span className="v12-entry-glyph sw-collections-medallion" aria-hidden="true"><FolderTree size={24} /></span><div><p className="sw-collections-eyebrow">Collection index</p><Heading>
        {current?.name ?? "Your collections"}
      </Heading></div></header>
      <p className="sw-collections-intro">
        Your authored, forked, and saved entries. Organize them into collection branches.
      </p>
      {!collectionId && <Link href="/library/collections" className="sw-metal-button sw-collections-button sw-collections-back"><BookOpen size={14} />Discover public collections</Link>}
      {error && (
        <p role="alert" className="sw-collections-error">
          {error}
        </p>
      )}
      <div className="sw-collections-search">
        <ColumnSearchBar search={search} onSearchChange={changeSearch} onOpenFilters={() => setFiltersOpen(open => !open)} hasActiveFilters={activeFilters} placeholder={collectionId ? "Search collected entries…" : "Search collections…"} view={entryView} onViewChange={setEntryView} />
        {filtersOpen && <div className="sw-collections-filters sw-discovery-filters sw-discovery-filters__basics">
          {collectionId ? <>
            <label className="sw-discovery-field"><span>Entry type</span><select value={entryType} onChange={event => { setEntryType(event.target.value); setPage(0); }}>{[...PHONE_RECORD_TYPES].sort((a,b) => Number(b.value === "ALL") - Number(a.value === "ALL")).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label className="sw-discovery-field"><span>Origin</span><select value={entryOrigin} onChange={event => { setEntryOrigin(event.target.value); setPage(0); }}><option value="all">All origins</option><option value="system">System</option><option value="community">Community</option></select></label>
            <label className="sw-discovery-field"><span>Sort entries</span><select value={entrySort} onChange={event => { setEntrySort(event.target.value); setPage(0); }}><option value="RECENT">Newest</option><option value="ALPHABETICAL">Name A–Z</option><option value="ALPHABETICAL_DESC">Name Z–A</option><option value="BU">BU: low to high</option><option value="BU_DESC">BU: high to low</option><option value="LIKES">Most liked</option><option value="FORKS">Most adapted</option></select></label>
          </> : <>
            <label className="sw-discovery-field"><span>Collection kind</span><select value={collectionKind} onChange={event => setCollectionKind(event.target.value)}><option value="all">All collections</option><option value="automatic">Automatic collections</option><option value="branches">Collection branches</option></select></label>
            <label className="sw-discovery-field"><span>Visibility</span><select value={collectionVisibility} onChange={event => setCollectionVisibility(event.target.value)}><option value="">All visibility</option><option value="PUBLIC">Public</option><option value="FOLLOWERS_ONLY">Followers only</option><option value="PRIVATE">Private</option></select></label>
          </>}
          <button type="button" className="sw-metal-button sw-collections-button" onClick={clearFilters} disabled={!activeFilters && !search}>Clear filters</button>
        </div>}
      </div>
      {!collectionId && (
        <>
          {indexRows.some(c => c.system_kind) && <section className="sw-collections-section"><p className="sw-collections-eyebrow">Automatic collections</p><div className={entryView === "LIST" ? "sw-catalogue-list" : "sw-collections-grid v12-creation-grid"}>{indexRows.filter(c => c.system_kind).map(c => <LibraryCatalogueSurface className={entryView === "LIST" ? "sw-catalogue-row" : ""} key={c.id} title={c.name} onSelect={() => router.push(`/collections/${c.id}`)} glyph={c.system_kind?.includes("FORK") ? <GitFork size={24} /> : c.system_kind === "ORIGINAL" ? <Hammer size={24} /> : <Bookmark size={24} />} badge={<span className="v12-tag">{c.visibility.replaceAll("_", " ").toLowerCase()}</span>}><p className="v12-entry-summary">{c.system_kind?.includes("FORK") ? "Forks of existing entries" : c.system_kind === "ORIGINAL" ? "Entries you authored" : "Entries you saved"}</p></LibraryCatalogueSurface>)}</div></section>}
          <section className="sw-collections-section"><div className="sw-collections-section-heading"><h2>Collection branches</h2>{user && <a href="#create-collection" className="sw-metal-button sw-metal-button--primary sw-collections-button" onClick={() => {setParent("");setCreating(true);}}><Plus size={14} /> Create collection</a>}</div><div className={entryView === "GRID" ? "sw-collections-branch-grid" : ""}><CollectionTree rows={indexRows.filter(c => !c.system_kind)} /></div>{!rows.some(c => !c.system_kind) && !search && !activeFilters && <EmptyState compact icon={FolderTree} title="Start a collection branch" description="Create a root for a campaign, theme, or project. Add child collections to organize its entries." />}</section>
          {!indexRows.length && (search || activeFilters) && <EmptyState compact icon={FolderTree} title="No matching collections" description="Try another name or clear the collection filters." />}
          {!user && (
            <button
              onClick={() => clerk.openSignIn()}
              className="sw-metal-button sw-collections-button"
            >
              Sign in to create collections
            </button>
          )}
        </>
      )}
      {current && (
        <>
          <div className="sw-collections-actions"><Link
            href={`/library/browse?type=ALL&collectionId=${current.id}`}
            className="sw-metal-button sw-collections-button sw-metal-button--primary sw-collections-library"
          >
            Browse in Library
          </Link>
          {user && current.owner_id === user.id && <a className="sw-metal-button sw-collections-button" href="#create-collection" onClick={() => {setParent(current.system_kind ? "" : current.id);setCreating(true);}}>＋ {current.system_kind ? "Create collection" : "Add child collection"}</a>}</div>
          <nav aria-label="Collection path" className="sw-collections-path"><Link href="/collections">Collections</Link>{collectionAncestors(current, rows).map(c => <span key={c.id}><span aria-hidden="true"> / </span><Link href={`/collections/${c.id}`}>{c.name}</Link></span>)}<span aria-hidden="true"> / </span><strong>{current.name}</strong></nav>
          {children.length > 0 && <details className="sw-collections-branch-panel sw-collections-panel" open><summary>Child collections <span className="v12-tag">{children.length}</span></summary><CollectionTree rows={rows.filter(c => !c.system_kind)} parentId={current.id} /></details>}

          {user && current.owner_id !== user.id && (
            <button
              className="sw-metal-button sw-collections-button"
              onClick={() =>
                void mutate(`/api/collections/${current.id}`, "PATCH", {
                  follow: !current.followed,
                })
              }
            >
              {current.followed ? "Unsave collection" : "Save this collection"}
            </button>
          )}
          {user && current.owner_id === user.id && current.system_kind && <details className="sw-collections-management"><summary>Manage collection</summary><div className="sw-collections-manage"><Visibility value={current.visibility} onChange={v=>void mutate(`/api/collections/${current.id}`,"PATCH",{visibility:v})}/></div></details>}
          {user && current.owner_id === user.id && !current.system_kind && (
            <details className="sw-collections-management"><summary>Manage collection</summary><div className="sw-collections-manage">
              <select
                aria-label="Move collection to parent"
                value={current.parent_id ?? ""}
                className="sw-collections-input"
                onChange={(e) =>
                  void mutate(`/api/collections/${current.id}`, "PATCH", {
                    parentId: e.target.value || null,
                  })
                }
              >
                <option value="">Root collection</option>
                {rows
                  .filter((c) => c.owner_id === user.id && !c.system_kind && !isDescendant(c, current.id, rows))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {collectionLabel(c, rows)}
                    </option>
                  ))}
              </select>
              <Visibility
                value={current.visibility}
                onChange={(v) =>
                  void mutate(`/api/collections/${current.id}`, "PATCH", {
                    visibility: v,
                  })
                }
              />
              <button className="sw-metal-button sw-collections-button" disabled={pending} onClick={() => setRenameDraft(current.name)}>Rename</button>
              <button className="sw-metal-button sw-collections-button" disabled={pending} onClick={() => setDeleteReview(true)}>Delete collection</button>
              {renameDraft !== null && <form className="sw-collections-review" onSubmit={async event => {
                event.preventDefault();
                if (await mutate(`/api/collections/${current.id}`, "PATCH", {name: renameDraft})) setRenameDraft(null);
              }}>
                <label className="block">Collection name<input required maxLength={100} className="sw-collections-input" value={renameDraft} onChange={event => setRenameDraft(event.target.value)} /></label>
                <button disabled={pending} className="sw-metal-button sw-collections-button">Save name</button><button type="button" disabled={pending} className="sw-metal-button sw-collections-button" onClick={() => setRenameDraft(null)}>Cancel rename</button>
              </form>}
              {deleteReview && <fieldset className="sw-collections-review sw-collections-review--danger">
                <legend>Delete {current.name}?</legend><p>Entries remain intact. Choose what happens to child collections.</p>
                <label className="block">Child collections<select className="sw-collections-input" value={deleteChildren} onChange={event => setDeleteChildren(event.target.value as "move" | "delete")}>
                  <option value="move">Move to this collection’s parent</option><option value="delete">Delete child collections too</option>
                </select></label>
                <button disabled={pending} className="sw-metal-button sw-collections-button sw-collections-button--danger" onClick={async () => {
                  if (await mutate(`/api/collections/${current.id}`, "DELETE", {children: deleteChildren})) window.location.href = "/collections";
                }}>Confirm delete collection</button>
                <button disabled={pending} className="sw-metal-button sw-collections-button" onClick={() => setDeleteReview(false)}>Cancel deletion</button>
              </fieldset>}
            </div></details>
          )}
          <div className="sw-collections-section-heading"><h2>Collected entries</h2><small>Choose an entry to open its full preview.</small></div>
          <div className={`sw-collections-catalogue ${entryView === "GRID" ? "v12-creation-grid" : "v12-cluster-list"}`}>
            {loading ? <p className="sw-collections-intro" role="status">Loading collected entries…</p> : entries.length ? <section className={`v12-catalogue-collection ${entryView === "LIST" ? "is-list sw-catalogue-list" : "is-mosaic"}`}>{entries.map(item => <LibraryCatalogueCard key={item.id} item={item} view={entryView} currentUserInternalId={null} onSelect={selected => {
              if (stack.canPush) stack.push({ key: `collection-entry:${selected.targetType}:${selected.targetId}`, label: selected.name, category: selected.targetType, content: <CollectionEntryPreview targetType={selected.targetType} targetId={selected.targetId} /> });
            }} />)}</section> : <EmptyState compact icon={BookOpen} title={search || activeFilters ? "No matching entries" : "No collected entries yet"} description={search || activeFilters ? "Try another search or clear the entry filters." : "Save an entry from the Library or My Creations and choose this collection. Only entries you can access appear here."} />}
          </div>
          {(page > 0 || more) && <div className="sw-collections-pagination">
            <button className="sw-metal-button sw-collections-button" disabled={!page || pending || loading} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span>Page {page + 1}</span>
            <button className="sw-metal-button sw-collections-button" disabled={!more || pending || loading} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>}
        </>
      )}
          {user && creating && (!collectionId || (current && current.owner_id === user.id)) && (
            <form
              id="create-collection" className="sw-collections-create sw-collections-panel"
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await mutate("/api/collections", "POST", {
                    name,
                    parentId: current?.system_kind && parent === current.id ? null : parent || null,
                    visibility,
                  })
                ) {
                  setName("");
                  setCreating(false);
                }
              }}
            >
              <p className="sw-collections-eyebrow">Collection setup</p><h2>{current && !current.system_kind ? "Create a child collection" : "Create collection"}</h2>
              <input
                aria-label="Collection name"
                autoFocus
                required
                maxLength={100}
                className="sw-collections-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Collection name"
              />
              <select
                aria-label="Parent collection"
                className="sw-collections-input"
                value={current?.system_kind && parent === current.id ? "" : parent}
                onChange={(e) => setParent(e.target.value)}
              >
                <option value="">Root collection</option>
                {rows
                  .filter((c) => c.owner_id === user.id && !c.system_kind)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {collectionLabel(c, rows)}
                    </option>
                  ))}
              </select>
              <Visibility value={visibility} onChange={setVisibility} />
              <button disabled={pending} className="sw-metal-button sw-collections-button sw-metal-button--primary">
                {pending ? "Creating…" : "Create collection"}
              </button>
              <button type="button" className="sw-metal-button sw-collections-button" disabled={pending} onClick={() => setCreating(false)}>Cancel</button>
            </form>
          )}
    </Root>
  );
}
function Visibility({
  value,
  onChange,
}: {
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <select
      aria-label="Visibility"
      className="sw-collections-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="PUBLIC">Public</option>
      <option value="FOLLOWERS_ONLY">Followers only</option>
      <option value="PRIVATE">Private</option>
    </select>
  );
}

function collectionAncestors(collection: Collection, rows: Collection[]) {
  const path: Collection[] = [], seen = new Set([collection.id]);
  let parentId = collection.parent_id;
  while (parentId && !seen.has(parentId)) {
    const parent = rows.find(c => c.id === parentId);
    if (!parent) break;
    seen.add(parent.id); path.unshift(parent); parentId = parent.parent_id;
  }
  return path;
}
function collectionLabel(collection: Collection, rows: Collection[]) {
  return [...collectionAncestors(collection, rows), collection].map(c => c.name).join(" / ");
}
function isDescendant(collection: Collection, id: string, rows: Collection[]) {
  return collection.id === id || collectionAncestors(collection, rows).some(c => c.id === id);
}
function CollectionTree({ rows, parentId = null, seen = [] }: { rows: Collection[]; parentId?: string | null; seen?: string[] }) {
  const children = rows.filter(c => !seen.includes(c.id) && (parentId ? c.parent_id === parentId : !c.parent_id || !rows.some(p => p.id === c.parent_id)));
  if (!children.length) return null;
  return <ul className="sw-collections-tree">{children.map(c => {
    const hasChildren = rows.some(child => child.parent_id === c.id && !seen.includes(child.id));
    const heading = <><Link href={`/collections/${c.id}`} data-catalogue-row="true" className="sw-collections-tree-link"><CatalogueQuickLook name={c.name}><p>{c.visibility.replaceAll("_", " ").toLowerCase()} collection{c.followed ? " · saved" : ""}</p><p>Explore its entries and child branches.</p></CatalogueQuickLook><span className="v12-entry-glyph sw-collections-branch-glyph" aria-hidden="true"><Folder size={18} /></span><strong>{c.name}</strong></Link><span className="sw-collections-tree-visibility">{c.visibility.replaceAll("_", " ").toLowerCase()}{c.followed ? " · saved" : ""}</span></>;
    return <li key={c.id} className="sw-collections-tree-node" data-library-surface="atelier">{hasChildren ? <details open><summary><span className="sw-collections-tree-toggle" aria-hidden="true">›</span>{heading}</summary><CollectionTree rows={rows} parentId={c.id} seen={[...seen, c.id]} /></details> : <div className="sw-collections-tree-leaf"><span className="sw-collections-tree-toggle" aria-hidden="true">·</span>{heading}</div>}</li>;
  })}</ul>;
}
