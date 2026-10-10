"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Plus, Swords } from "lucide-react";
import { ColumnSearchBar } from "@/components/library/column-search-bar";
import { useModalStack } from "@/components/ui/modal-stack";
import type { LibraryView } from "@/lib/preferences/library-prefs";
import type { EncounterDirectoryEntry } from "@/lib/encounters/directory";
import { EncounterCard } from "./encounter-card";
import { EncounterPreview } from "./encounter-preview";
import "./encounters.css";

export function EncounterArchive({
  onCount,
  discovery = false,
}: {
  onCount?: (count: number) => void;
  discovery?: boolean;
}) {
  const { userId } = useAuth();
  return (
    <AccountEncounterArchive
      key={`${userId ?? "anonymous"}:${discovery}`}
      discovery={discovery}
      {...(onCount ? { onCount } : {})}
    />
  );
}
function AccountEncounterArchive({
  onCount,
  discovery,
}: {
  onCount?: (count: number) => void;
  discovery: boolean;
}) {
  const [rows, setRows] = useState<EncounterDirectoryEntry[]>([]),
    [search, setSearch] = useState(""),
    [view, setView] = useState<LibraryView>("GRID"),
    [filter, setFilter] = useState("all"),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [offset, setOffset] = useState(0),
    [more, setMore] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null),
    countCallback = useRef(onCount);
  useEffect(() => {
    countCallback.current = onCount;
  }, [onCount]);
  const stack = useModalStack();
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        setLoading(true);
        setError("");
        const url = discovery
          ? `/api/encounters/directory?q=${encodeURIComponent(search)}&offset=${offset}`
          : "/api/encounters";
        fetch(url, { signal: controller.signal, cache: "no-store" })
          .then(async (response) => {
            const data = await response.json();
            if (!response.ok)
              throw new Error(data.error ?? "Could not load encounters.");
            if (controller.signal.aborted) return;
            setRows((previous) =>
              discovery && offset > 0
                ? [
                    ...new Map(
                      [...previous, ...data.encounters].map((row) => [
                        row.id,
                        row,
                      ]),
                    ).values(),
                  ]
                : data.encounters,
            );
            setMore(!!data.hasMore);
            if (!discovery) countCallback.current?.(data.encounters.length);
          })
          .catch((reason) => {
            if (!controller.signal.aborted) setError(reason.message);
          })
          .finally(() => {
            if (!controller.signal.aborted) setLoading(false);
          });
      },
      discovery ? 180 : 0,
    );
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [discovery, search, offset]);
  useEffect(() => {
    const element = sentinel.current;
    if (!element || !more || loading || error) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setOffset((n) => n + 24);
      },
      { rootMargin: "300px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [more, loading, error]);
  const visible = rows.filter(
    (row) =>
      (discovery ||
        `${row.name} ${row.note} ${row.creatures.map((c) => c.name).join(" ")}`
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (filter === "all" ||
        (filter === "played" && row.runCount > 0) ||
        (filter === "ready" && row.creatureCount > 0 && !row.unavailable) ||
        filter === row.visibility),
  );
  return (
    <section
      className="sw-encounters sw-encounter-archive"
      aria-label={discovery ? "Accessible encounters" : "Your encounters"}
    >
      <header className="sw-encounter-section-heading">
        <div>
          <p className="v12-kicker">
            {discovery
              ? "Discover a table-ready scene"
              : "Your table · preparation & play"}
          </p>
          <h2>Encounters</h2>
          <p className="sw-encounter-help">
            {discovery
              ? "Public encounters, your own preparation, and follower-only encounters shared with you."
              : "Inspect the opposition, fine-tune preparation, or bring fresh creature sheets to your table."}
          </p>
        </div>
        <Link className="sw-metal-button" href="/encounters?new=1">
          <Plus size={16} />
          New encounter
        </Link>
      </header>
      <ColumnSearchBar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          if (discovery) {
            setOffset(0);
            setRows([]);
          }
        }}
        placeholder={
          discovery ? "Search encounters…" : "Search encounters or creatures…"
        }
        view={view}
        onViewChange={setView}
      />
      <div className="sw-encounter-directory-tools">
        <label>
          Show
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All encounters</option>
            <option value="ready">Ready to start</option>
            <option value="played">Played at your table</option>
            <option value="PUBLIC">Public</option>
            <option value="FOLLOWERS_ONLY">Followers only</option>
            <option value="PRIVATE">Private</option>
          </select>
        </label>
        <span>
          {visible.length} {discovery && more ? "loaded" : "encounters"}
        </span>
      </div>
      {error && (
        <p role="alert" className="sw-encounter-notice">
          {error}
          <button
            className="sw-metal-button"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </p>
      )}
      {!loading && !error && !visible.length && (
        <div className="sw-encounter-directory-empty">
          <Swords size={32} />
          <h3>
            {search || filter !== "all"
              ? "No matching encounters"
              : "Your next scene starts here"}
          </h3>
          <p>
            {search || filter !== "all"
              ? "Try another search or show all encounters."
              : "Set a party budget, assemble creatures, and keep preparation ready for your next session."}
          </p>
          {!discovery && !search && filter === "all" && (
            <Link
              className="sw-metal-button sw-metal-button--primary"
              href="/encounters?new=1"
            >
              <Plus size={16} />
              Prepare an encounter
            </Link>
          )}
        </div>
      )}
      <div
        className={`sw-encounter-directory-results ${view === "GRID" ? "is-grid" : "is-list"}`}
      >
        {visible.map((row) => (
          <EncounterCard
            key={row.id}
            row={row}
            view={view}
            onPreview={() => {
              if (stack.canPush)
                stack.push({
                  key: `encounter:${row.id}`,
                  label: row.name,
                  category: "ENCOUNTER",
                  content: <EncounterPreview id={row.id} />,
                });
            }}
          />
        ))}
      </div>
      {loading && (
        <p role="status" className="sw-encounter-help">
          Loading encounters…
        </p>
      )}
      <div ref={sentinel} aria-hidden="true" />
    </section>
  );
}
