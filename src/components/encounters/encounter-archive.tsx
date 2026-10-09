"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Plus, Swords, ArrowUpRight } from "lucide-react";
import { ColumnSearchBar } from "@/components/library/column-search-bar";
import type { LibraryView } from "@/lib/preferences/library-prefs";
import "./encounters.css";

export function EncounterArchive({
  onCount,
}: {
  onCount?: (count: number) => void;
}) {
  const { userId } = useAuth();
  return (
    <AccountEncounterArchive
      key={userId ?? "anonymous"}
      {...(onCount ? { onCount } : {})}
    />
  );
}
function AccountEncounterArchive({
  onCount,
}: {
  onCount?: (count: number) => void;
}) {
  const [rows, setRows] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<LibraryView>("LIST");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/encounters", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error ?? "Could not load encounters.");
        if (!controller.signal.aborted) {
          setRows(data.encounters);
          onCount?.(data.encounters.length);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [onCount]);
  const visible = rows.filter((row) =>
    row.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section
      className="sw-encounters sw-encounter-archive"
      aria-label="Your encounters"
    >
      <header className="sw-encounter-section-heading">
        <div>
          <p className="v12-kicker">Your table</p>
          <h2>Encounters</h2>
        </div>
        <Link className="sw-metal-button" href="/encounters?new=1">
          <Plus size={16} />
          New encounter
        </Link>
      </header>
      <ColumnSearchBar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search your encounters…"
        view={view}
        onViewChange={setView}
      />
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p role="status">Loading encounters…</p>
      ) : !visible.length ? (
        <p className="sw-encounter-help">
          {search
            ? "No matching encounters."
            : "No encounters yet. Prepare the opposition for your next session."}
        </p>
      ) : (
        <div
          className={`sw-encounter-archive-results ${view === "GRID" ? "is-grid" : "is-list"}`}
        >
          {visible.map((row) => (
            <Link
              className="sw-encounter-list-row"
              key={row.id}
              href={`/encounters/${row.id}`}
            >
              <Swords size={22} />
              <span>
                <strong>{row.name}</strong>
                <small>Private encounter · Preparation & runs</small>
              </span>
              <ArrowUpRight size={16} />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
