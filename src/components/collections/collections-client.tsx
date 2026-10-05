"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { BookmarkButton } from "./bookmark-button";
import Link from "next/link";
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
type Entry = { targetType: string; targetId: string; name: string };
type CollectionPageProps = { collectionId?: string; ownerId?: string; embedded?: boolean };
export function CollectionsClient(props: CollectionPageProps) {
  const { user, isLoaded } = useUser();
  if (!isLoaded) return props.embedded ? <div className="sw-collections-loading" role="status">Loading account…</div> : <main className="sw-collections-loading" role="status">Loading account…</main>;
  return <AccountCollectionsClient key={`${user?.id ?? "anonymous"}:${props.collectionId ?? ""}:${props.ownerId ?? ""}:${props.embedded?"embedded":"page"}`} {...props} />;
}
function AccountCollectionsClient({collectionId, ownerId, embedded=false}: CollectionPageProps) {
  const { user } = useUser();
  const clerk = useClerk();
  const [rows, setRows] = useState<Collection[]>([]),
    [current, setCurrent] = useState<Collection | null>(null),
    [entries, setEntries] = useState<Entry[]>([]),
    [page, setPage] = useState(0),
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
  const load = useCallback(async () => {
    if (!alive.current) return;
    controller.current?.abort();
    const reading = new AbortController(); controller.current = reading;
    const currentRequest = () => alive.current && !reading.signal.aborted;
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
        setEntries(d.entries);
        setMore(d.hasMore);
        const own = await fetch(
          `/api/collections?owner=${encodeURIComponent(d.collection.owner_id)}`,
          {signal: reading.signal, cache: "no-store"},
        ).then((r) => r.json());
        if (currentRequest()) setRows(own.collections ?? []);
      } else setRows(d.collections);
    } catch (e) {
      if (currentRequest()) setError(e instanceof Error ? e.message : "Unable to load collections");
    }
  }, [collectionId, ownerId, page]);
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
  return (
    <Root className={`sw-collections ${embedded ? "sw-collections--embedded" : ""}`}>
      {!embedded && <Link href="/collections" className="sw-collections-breadcrumb">
        Collections
      </Link>}
      <header className="sw-collections-heading"><span className="sw-collections-medallion" aria-hidden="true">✦</span><div><p className="sw-collections-eyebrow">The collected chronicles</p><Heading>
        {current?.name ?? "Your collections"}
      </Heading></div></header>
      <p className="sw-collections-intro">
        Organize live references to your creations and community entries. Each
        collection has its own visibility.
      </p>
      {error && (
        <p role="alert" className="sw-collections-error">
          {error}
        </p>
      )}
      {!collectionId && (
        <>
          {rows.length === 0 && <p className="sw-collections-empty">Your chronicles begin here. Create a collection to gather entries for your next adventure.</p>}
          <div className="sw-collections-grid">
            {rows.map((c) => (
              <Link
                key={c.id}
                href={`/collections/${c.id}`}
                className="sw-collections-card"
              >
                <span className="sw-collections-card-seal" aria-hidden="true">✧</span><strong>{c.name}</strong>
                <div className="sw-collections-meta">
                  {c.visibility.replaceAll("_", " ")}
                  {c.followed ? " · Saved collection" : ""}
                  {c.parent_id && rows.find((p) => p.id === c.parent_id)
                    ? ` · In ${rows.find((p) => p.id === c.parent_id)?.name}`
                    : ""}
                </div>
              </Link>
            ))}
          </div>
          {!user && (
            <button
              onClick={() => clerk.openSignIn()}
              className="sw-collections-button"
            >
              Sign in to create collections
            </button>
          )}
        </>
      )}
      {current && (
        <>
          <Link
            href={`/library/browse?type=ALL&collectionId=${current.id}`}
            className="sw-collections-button sw-collections-button--primary sw-collections-library"
          >
            Browse this collection in the Library
          </Link>
          {current.parent_id &&
            rows.find((c) => c.id === current.parent_id) && (
              <Link
                className="sw-collections-breadcrumb"
                href={`/collections/${current.parent_id}`}
              >
                In {rows.find((c) => c.id === current.parent_id)?.name}
              </Link>
            )}
          {rows.some(c => c.parent_id === current.id) && <h2>Child collections</h2>}
          <div className="sw-collections-grid">
            {rows
              .filter((c) => c.parent_id === current.id)
              .map((c) => (
                <Link
                  key={c.id}
                  href={`/collections/${c.id}`}
                  className="sw-collections-card"
                >
                  <span className="sw-collections-card-seal" aria-hidden="true">✧</span><strong>{c.name}</strong>
                </Link>
              ))}
          </div>
          {user && current.owner_id !== user.id && (
            <button
              className="sw-collections-button"
              onClick={() =>
                void mutate(`/api/collections/${current.id}`, "PATCH", {
                  follow: !current.followed,
                })
              }
            >
              {current.followed ? "Unsave collection" : "Save this collection"}
            </button>
          )}
          {user && current.owner_id === user.id && current.system_kind && <Visibility value={current.visibility} onChange={v=>void mutate(`/api/collections/${current.id}`,"PATCH",{visibility:v})}/>}
          {user && current.owner_id === user.id && !current.system_kind && (
            <div className="sw-collections-manage sw-collections-panel">
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
                <option value="">No parent</option>
                {rows
                  .filter((c) => c.id !== current.id && !c.system_kind)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
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
              <button className="sw-collections-button" disabled={pending} onClick={() => setRenameDraft(current.name)}>Rename</button>
              <button className="sw-collections-button" disabled={pending} onClick={() => setDeleteReview(true)}>Delete collection</button>
              {renameDraft !== null && <form className="sw-collections-review" onSubmit={async event => {
                event.preventDefault();
                if (await mutate(`/api/collections/${current.id}`, "PATCH", {name: renameDraft})) setRenameDraft(null);
              }}>
                <label className="block">Collection name<input required maxLength={100} className="sw-collections-input" value={renameDraft} onChange={event => setRenameDraft(event.target.value)} /></label>
                <button disabled={pending} className="sw-collections-button">Save name</button><button type="button" disabled={pending} className="sw-collections-button" onClick={() => setRenameDraft(null)}>Cancel rename</button>
              </form>}
              {deleteReview && <fieldset className="sw-collections-review sw-collections-review--danger">
                <legend>Delete {current.name}?</legend><p>Entries remain intact. Choose what happens to child collections.</p>
                <label className="block">Child collections<select className="sw-collections-input" value={deleteChildren} onChange={event => setDeleteChildren(event.target.value as "move" | "delete")}>
                  <option value="move">Move to this collection’s parent</option><option value="delete">Delete child collections too</option>
                </select></label>
                <button disabled={pending} className="sw-collections-button sw-collections-button--danger" onClick={async () => {
                  if (await mutate(`/api/collections/${current.id}`, "DELETE", {children: deleteChildren})) window.location.href = "/collections";
                }}>Confirm delete collection</button>
                <button disabled={pending} className="sw-collections-button" onClick={() => setDeleteReview(false)}>Cancel deletion</button>
              </fieldset>}
            </div>
          )}
          <ul className="sw-collections-entries">
            {entries.map((e) => (
              <li
                key={`${e.targetType}:${e.targetId}`}
                className="sw-collections-entry"
              >
                <Link
                  href={
                    e.targetType === "MONSTER"
                      ? `/monsters/${e.targetId}`
                      : `/library/item/${encodeURIComponent(`${e.targetType}:${e.targetId}`)}`
                  }
                  className="sw-collections-entry-link"
                >
                  {e.name}
                  <span className="sw-collections-entry-kind">
                    {e.targetType.replaceAll("_TEMPLATE", "").toLowerCase()}
                  </span>
                </Link>
                <BookmarkButton
                  targetType={e.targetType}
                  targetId={e.targetId}
                />
              </li>
            ))}
          </ul>
          {entries.length === 0 && (
            <p className="sw-collections-empty">
              No accessible entries in this collection.
            </p>
          )}
          <div className="sw-collections-pagination">
            <button className="sw-collections-button" disabled={!page || pending} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span>Page {page + 1}</span>
            <button className="sw-collections-button" disabled={!more || pending} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        </>
      )}
          {user && (!collectionId || (current && current.owner_id === user.id)) && (
            <form
              className="sw-collections-create sw-collections-panel"
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await mutate("/api/collections", "POST", {
                    name,
                    parentId: current?.system_kind && parent === current.id ? null : parent || null,
                    visibility,
                  })
                )
                  setName("");
              }}
            >
              <p className="sw-collections-eyebrow">Begin a new chapter</p><h2>{current && !current.system_kind ? "Create a child collection" : "Create collection"}</h2>
              <input
                aria-label="Collection name"
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
                <option value="">No parent</option>
                {rows
                  .filter((c) => c.owner_id === user.id && !c.system_kind)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
              <Visibility value={visibility} onChange={setVisibility} />
              <button disabled={pending} className="sw-collections-button sw-collections-button--primary">
                {pending ? "Creating…" : "Create collection"}
              </button>
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
