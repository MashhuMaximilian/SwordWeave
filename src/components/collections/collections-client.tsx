"use client";
import { useEffect, useState } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { BookmarkButton } from "./bookmark-button";
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
export function CollectionsClient({
  collectionId,
  ownerId,
}: {
  collectionId?: string;
  ownerId?: string;
}) {
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
    [visibility, setVisibility] = useState("PRIVATE");
  async function load() {
    setError("");
    try {
      const r = await fetch(
        collectionId
          ? `/api/collections/${collectionId}?page=${page}`
          : `/api/collections${ownerId ? `?owner=${encodeURIComponent(ownerId)}` : ""}`,
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      if (collectionId) {
        setCurrent(d.collection);
        setEntries(d.entries);
        setMore(d.hasMore);
        const own = await fetch(
          `/api/collections?owner=${encodeURIComponent(d.collection.owner_id)}`,
        ).then((r) => r.json());
        setRows(own.collections ?? []);
      } else setRows(d.collections);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load collections");
    }
  }
  useEffect(() => {
    void load();
  }, [collectionId, ownerId, page]);
  async function mutate(url: string, method: string, body: unknown) {
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok) {
      setError(d.error);
      return false;
    }
    await load();
    return true;
  }
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
      <a href="/collections" className="text-sm text-primary">
        Collections
      </a>
      <h1 className="text-2xl font-semibold">
        {current?.name ?? "Your collections"}
      </h1>
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
              <a
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
              </a>
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
          <a
            href={`/library/browse?type=ALL&collectionId=${current.id}`}
            className="inline-block text-sm text-primary"
          >
            Browse this collection in the Library
          </a>
          {current.parent_id &&
            rows.find((c) => c.id === current.parent_id) && (
              <a
                className="block text-sm text-primary"
                href={`/collections/${current.parent_id}`}
              >
                In {rows.find((c) => c.id === current.parent_id)?.name}
              </a>
            )}
          <div className="grid gap-2 sm:grid-cols-2">
            {rows
              .filter((c) => c.parent_id === current.id)
              .map((c) => (
                <a
                  key={c.id}
                  href={`/collections/${c.id}`}
                  className="rounded border p-3"
                >
                  {c.name}
                </a>
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
              <button
                className="rounded border p-2"
                onClick={() => {
                  const next = window.prompt("Collection name", current.name);
                  if (next)
                    void mutate(`/api/collections/${current.id}`, "PATCH", {
                      name: next,
                    });
                }}
              >
                Rename
              </button>
              <button
                className="rounded border p-2"
                onClick={async () => {
                  const choice = window.prompt(
                    "Delete collection? Entries remain intact. Type MOVE to move children to this collection's parent, or DELETE to delete its child collections.",
                  );
                  if (choice !== "MOVE" && choice !== "DELETE") return;
                  if (
                    await mutate(`/api/collections/${current.id}`, "DELETE", {
                      children: choice === "MOVE" ? "move" : "delete",
                    })
                  )
                    window.location.href = "/collections";
                }}
              >
                Delete collection
              </button>
            </div>
          )}
          <ul className="space-y-2">
            {entries.map((e) => (
              <li
                key={`${e.targetType}:${e.targetId}`}
                className="flex items-center justify-between rounded border bg-card p-3"
              >
                <a
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
                </a>
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
    </main>
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
