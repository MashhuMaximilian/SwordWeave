"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { BookmarkButton } from "./bookmark-button";
import Link from "next/link";
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
  if (!isLoaded) return props.embedded ? <div className="p-4" role="status">Loading account…</div> : <main className="p-4" role="status">Loading account…</main>;
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
    [parent, setParent] = useState(""),
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
    <Root className={`mx-auto max-w-5xl space-y-6 ${embedded ? "p-0" : "p-4 sm:p-8"}`}>
      {!embedded && <Link href="/collections" className="text-sm text-primary">
        Collections
      </Link>}
      <Heading className="text-2xl font-semibold">
        {current?.name ?? "Your collections"}
      </Heading>
      <p className="text-sm text-muted-foreground">
        Organize live references to your creations and community entries. Each
        collection has its own visibility.
      </p>
      {error && (
        <p role="alert" className="text-red-400">
          {error}
        </p>
      )}
      {!collectionId && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {rows.map((c) => (
              <Link
                key={c.id}
                href={`/collections/${c.id}`}
                className="rounded-lg border border-border bg-card p-4"
              >
                <strong>{c.name}</strong>
                <div className="text-xs text-muted-foreground">
                  {c.visibility.replaceAll("_", " ")}
                  {c.followed ? " · Saved collection" : ""}
                  {c.parent_id && rows.find((p) => p.id === c.parent_id)
                    ? ` · In ${rows.find((p) => p.id === c.parent_id)?.name}`
                    : ""}
                </div>
              </Link>
            ))}
          </div>
          {user && (
            <form
              className="space-y-3 rounded-lg border p-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await mutate("/api/collections", "POST", {
                    name,
                    parentId: parent || null,
                    visibility,
                  })
                )
                  setName("");
              }}
            >
              <h2 className="font-semibold">Create collection</h2>
              <input
                aria-label="Collection name"
                required
                maxLength={100}
                className="w-full rounded border bg-background p-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Collection name"
              />
              <select
                aria-label="Parent collection"
                className="rounded border bg-background p-2"
                value={parent}
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
              <button className="rounded bg-primary px-4 py-2 text-primary-foreground">
                Create
              </button>
            </form>
          )}
          {!user && (
            <button
              onClick={() => clerk.openSignIn()}
              className="rounded border p-2"
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
            className="inline-block text-sm text-primary"
          >
            Browse this collection in the Library
          </Link>
          {current.parent_id &&
            rows.find((c) => c.id === current.parent_id) && (
              <Link
                className="block text-sm text-primary"
                href={`/collections/${current.parent_id}`}
              >
                In {rows.find((c) => c.id === current.parent_id)?.name}
              </Link>
            )}
          <div className="grid gap-2 sm:grid-cols-2">
            {rows
              .filter((c) => c.parent_id === current.id)
              .map((c) => (
                <Link
                  key={c.id}
                  href={`/collections/${c.id}`}
                  className="rounded border p-3"
                >
                  {c.name}
                </Link>
              ))}
          </div>
          {user && current.owner_id !== user.id && (
            <button
              className="rounded border p-2"
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
            <div className="flex flex-wrap gap-2">
              <select
                aria-label="Move collection to parent"
                value={current.parent_id ?? ""}
                className="rounded border bg-background p-2"
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
              <button className="rounded border p-2" disabled={pending} onClick={() => setRenameDraft(current.name)}>Rename</button>
              <button className="rounded border p-2" disabled={pending} onClick={() => setDeleteReview(true)}>Delete collection</button>
              {renameDraft !== null && <form className="w-full space-y-2 rounded border p-3" onSubmit={async event => {
                event.preventDefault();
                if (await mutate(`/api/collections/${current.id}`, "PATCH", {name: renameDraft})) setRenameDraft(null);
              }}>
                <label className="block">Collection name<input required maxLength={100} className="ml-2 rounded border bg-background p-2" value={renameDraft} onChange={event => setRenameDraft(event.target.value)} /></label>
                <button disabled={pending} className="mr-3 rounded border p-2">Save name</button><button type="button" disabled={pending} className="rounded border p-2" onClick={() => setRenameDraft(null)}>Cancel rename</button>
              </form>}
              {deleteReview && <fieldset className="w-full space-y-2 rounded border border-destructive p-3">
                <legend>Delete {current.name}?</legend><p>Entries remain intact. Choose what happens to child collections.</p>
                <label className="block">Child collections<select className="ml-2 rounded border bg-background p-2" value={deleteChildren} onChange={event => setDeleteChildren(event.target.value as "move" | "delete")}>
                  <option value="move">Move to this collection’s parent</option><option value="delete">Delete child collections too</option>
                </select></label>
                <button disabled={pending} className="mr-3 rounded border border-destructive p-2 text-destructive" onClick={async () => {
                  if (await mutate(`/api/collections/${current.id}`, "DELETE", {children: deleteChildren})) window.location.href = "/collections";
                }}>Confirm delete collection</button>
                <button disabled={pending} className="rounded border p-2" onClick={() => setDeleteReview(false)}>Cancel deletion</button>
              </fieldset>}
            </div>
          )}
          <ul className="space-y-2">
            {entries.map((e) => (
              <li
                key={`${e.targetType}:${e.targetId}`}
                className="flex items-center justify-between rounded border bg-card p-3"
              >
                <Link
                  href={
                    e.targetType === "MONSTER"
                      ? `/monsters/${e.targetId}`
                      : `/library/item/${encodeURIComponent(`${e.targetType}:${e.targetId}`)}`
                  }
                  className="text-primary"
                >
                  {e.name}
                  <span className="ml-2 text-xs text-muted-foreground">
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
            <p className="text-muted-foreground">
              No accessible entries in this collection.
            </p>
          )}
          <div className="flex gap-3">
            <button disabled={!page} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span>Page {page + 1}</span>
            <button disabled={!more} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        </>
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
      className="rounded border bg-background p-2"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="PUBLIC">Public</option>
      <option value="FOLLOWERS_ONLY">Followers only</option>
      <option value="PRIVATE">Private</option>
    </select>
  );
}
