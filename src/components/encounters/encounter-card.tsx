"use client";
import {TargetEngagement} from "@/components/engagement/target-engagement";
import { useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import {
  Swords,
  Play,
  Pencil,
  ArrowUpRight,
  Users,
  Shield,
  LockKeyhole,
  Globe,
  Eye,
} from "lucide-react";
import { CatalogueQuickLook } from "@/components/library/catalogue-quick-look";
import type { EncounterDirectoryEntry } from "@/lib/encounters/directory";
import type { LibraryView } from "@/lib/preferences/library-prefs";
import { browserUuid } from "@/lib/browser-uuid";
import "./encounters.css";

export const encounterVisibilityLabel = (v: string) =>
  v === "PUBLIC"
    ? "Public"
    : v === "FOLLOWERS_ONLY"
      ? "Followers only"
      : "Private";
export function EncounterActions({
  row,
}: {
  row: Pick<
    EncounterDirectoryEntry,
    | "id"
    | "revision"
    | "isOwner"
    | "creatureCount"
    | "unavailable"
    | "latestRunId"
  >;
}) {
  const { userId } = useAuth();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const operation = useRef<string | null>(null);
  async function start() {
    if (busy) return;
    setBusy(true);
    setError("");
    operation.current ??= browserUuid();
    try {
      const response = await fetch(`/api/encounters/${row.id}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revision: row.revision,
          opId: operation.current,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Could not start encounter.");
      window.location.assign(`/encounters/runs/${result.id}`);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not start encounter.",
      );
      setBusy(false);
    }
  }
  return (
    <div
      className={`sw-encounter-entry-actions${row.isOwner ? " has-edit" : ""}`}
      onClick={(e) => e.stopPropagation()}
    >
      {row.isOwner && (
        <Link className="sw-metal-button" href={`/encounters/${row.id}`}>
          <Pencil size={15} />
          Edit encounter
        </Link>
      )}
      {userId ? (
        <button
          type="button"
          className="sw-metal-button sw-metal-button--primary"
          disabled={busy || !row.creatureCount || row.unavailable}
          onClick={() => void start()}
        >
          <Play size={15} />
          {busy ? "Starting…" : "Start encounter"}
        </button>
      ) : (
        <Link className="sw-metal-button" href="/sign-in">
          Sign in to start
        </Link>
      )}

      {row.latestRunId && (
        <Link
          className="sw-metal-button"
          href={`/encounters/runs/${row.latestRunId}`}
        >
          Resume run
          <ArrowUpRight size={14} />
        </Link>
      )}
      {error && (
        <p role="alert" className="sw-encounter-entry-error">
          {error}
        </p>
      )}
    </div>
  );
}
export function EncounterCard({
  row,
  view = "GRID",
  onPreview,
}: {
  row: EncounterDirectoryEntry;
  view?: LibraryView;
  onPreview: () => void;
}) {
  const VisibilityIcon =
    row.visibility === "PUBLIC"
      ? Globe
      : row.visibility === "FOLLOWERS_ONLY"
        ? Users
        : LockKeyhole;
  return (
    <article
      className={`sw-encounter-directory-card ${view === "LIST" ? "is-list" : "is-grid"}`}
      aria-label={row.name}
    >
      <button
        type="button"
        className="sw-encounter-entry-opener"
        data-catalogue-row="true"
        data-quick-look-opener="true"
        onClick={onPreview}
        aria-label={`Preview ${row.name}`}
      >
        <CatalogueQuickLook name={row.name}>
          <p>
            {encounterVisibilityLabel(row.visibility)} · {row.creatureCount}{" "}
            creatures · {row.enemyBu} creature BU
            {row.enemyItemBu === null ? "" : ` + ${row.enemyItemBu} Item BU`}
          </p>
          {row.note && <p data-copy-role="narrative">{row.note}</p>}
          <ul className="sw-encounter-quick-roster">
            {row.creatures.slice(0, 8).map((creature, index) => (
              <li key={index}>
                <strong>
                  {creature.quantity} × {creature.name}
                </strong>
                <span>
                  {creature.budget} BU
                  {creature.role ? ` · ${creature.role}` : ""}
                  {creature.environment ? ` · ${creature.environment}` : ""}
                </span>
              </li>
            ))}
          </ul>
          {row.creatures.length > 8 && (
            <p>Open preview for the full opposition.</p>
          )}
          <p>
            Party: {row.partyBu === null ? "BU not set" : `${row.partyBu} BU`}
            {row.partyItemBu === null ? "" : ` + ${row.partyItemBu} Item BU`}
            {row.partySize ? ` · ${row.partySize} characters` : ""}.
          </p>
        </CatalogueQuickLook>
        <span className="sw-encounter-entry-glyph">
          <Swords size={23} />
        </span>
        <span className="sw-encounter-entry-copy">
          <span className="sw-encounter-entry-title">{row.name}</span>
          <span className="sw-encounter-entry-note">
            {row.note ||
              "Open preparation to inspect the opposition and party budgets."}
          </span>
          <span className="sw-encounter-entry-meta">
            <span>
              <VisibilityIcon size={12} />
              {encounterVisibilityLabel(row.visibility)}
            </span>
            <span>
              <Users size={12} />
              {row.creatureCount} creatures
            </span>
            <span>
              {row.isOwner
                ? "Your preparation"
                : row.authorIsAdmin
                  ? "System"
                  : (row.authorDisplayName ??
                    row.authorUsername ??
                    "Community")}
            </span>
            {row.runCount > 0 && (
              <span>
                {row.runCount} {row.runCount === 1 ? "run" : "runs"} at your
                table
              </span>
            )}
          </span>
        </span>
        <span className="sw-encounter-entry-budget">
          <strong>
            {row.unavailable ? "—" : row.enemyBu}
            <small> BU</small>
          </strong>
          <span>
            {row.enemyItemBu === null
              ? "Item BU in preview"
              : `+ ${row.enemyItemBu} Item BU`}
          </span>
          <Eye size={15} />
        </span>
      </button>
      <div className="sw-encounter-entry-bottom">
        <span className="sw-encounter-entry-party">
          <Shield size={13} />
          Party {row.partyBu ?? "—"} BU · items {row.partyItemBu ?? "—"}
        </span>
        <EncounterActions row={row} />
      </div>
      <div className="sw-encounter-entry-engagement"><TargetEngagement targetType="ENCOUNTER" targetId={row.id}/></div>
      {row.unavailable && (
        <p className="sw-encounter-entry-error">
          A template is no longer accessible. Review preparation before
          starting.
        </p>
      )}
    </article>
  );
}
