// =============================================================================
// /library/item/[id]/versions — version history page
//
// Renders a chronological list of every published version of a target.
// Each row shows: version #, delta kind, publisher, timestamp, change stats.
// Click expands to show the reconstructed payload (key fields).
//
// URL accepts the same composite format as the detail page: <TYPE>:<id>
// Currently supports: PRIMITIVE, CAPABILITY, CHARACTER, *_TEMPLATE.
// =============================================================================

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  GitCommit,
  GitCompareArrows,
  GitMerge,
  History,
  Wrench,
} from "lucide-react";
import {
  getVersionHistory,
  type VersionEntry,
  type VersionTargetType,
} from "@/lib/versions/version-history";
import { RestoreButton } from "@/components/library/restore-button";
import { VersionPreviewButton } from "@/components/library/version-preview-button";
import { db } from "@/db/client";
import { primitives, effects, capabilities } from "@/db/schema";
import { inArray } from "drizzle-orm";

interface PageProps {
  params: Promise<{ id: string }>;
}

function parseCompositeId(raw: string): {
  type: VersionTargetType;
  id: string;
} | null {
  const idx = raw.indexOf(":");
  if (idx < 1) return null;
  const type = raw.slice(0, idx);
  const id = raw.slice(idx + 1);
  const supported: VersionTargetType[] = [
    "PRIMITIVE",
    "CAPABILITY",
    "CHARACTER",
    "RACE_TEMPLATE",
    "BACKGROUND_TEMPLATE",
    "ARCHETYPE_TEMPLATE",
  ];
  if (!supported.includes(type as VersionTargetType)) return null;
  return { type: type as VersionTargetType, id };
}

export default async function VersionHistoryPage({ params }: PageProps) {
  const { id: rawId } = await params;
  const parsed = parseCompositeId(decodeURIComponent(rawId));
  if (!parsed) notFound();

  const result = await getVersionHistory(parsed.type, parsed.id);
  if (!result) notFound();

  // Collect all referenced entity IDs from all version payloads so we
  // can bulk-resolve their names for the preview modal.
  const referencedPrimitiveIds = new Set<number>();
  const referencedEffectIds = new Set<string>();
  const referencedCapabilityIds = new Set<string>();

  for (const v of result.versions) {
    const p = v.payload;
    // primitiveSlots (effects + capabilities)
    if (Array.isArray(p["primitiveSlots"])) {
      for (const s of p["primitiveSlots"] as Array<Record<string, unknown>>) {
        const pid = Number(s["primitiveId"]);
        if (Number.isFinite(pid)) referencedPrimitiveIds.add(pid);
      }
    }
    // primitiveIds (templates + items)
    if (Array.isArray(p["primitiveIds"])) {
      for (const pid of p["primitiveIds"] as number[]) {
        if (Number.isFinite(pid)) referencedPrimitiveIds.add(pid);
      }
    }
    // effectIds (capabilities + items)
    if (Array.isArray(p["effectIds"])) {
      for (const eid of p["effectIds"] as string[]) {
        referencedEffectIds.add(eid);
      }
    }
    // capabilityIds (templates + items)
    if (Array.isArray(p["capabilityIds"])) {
      for (const cid of p["capabilityIds"] as string[]) {
        referencedCapabilityIds.add(cid);
      }
    }
  }

  // Bulk-fetch names from DB. Wrapped in try/catch so a failure just
  // means we fall back to ID-based labels instead of crashing.
  const nameMap: Record<string, string> = {};
  try {
    const [primRows, effRows, capRows] = await Promise.all([
      referencedPrimitiveIds.size > 0
        ? db.select({ id: primitives.id, name: primitives.name }).from(primitives).where(inArray(primitives.id, [...referencedPrimitiveIds]))
        : Promise.resolve([]),
      referencedEffectIds.size > 0
        ? db.select({ id: effects.id, name: effects.name }).from(effects).where(inArray(effects.id, [...referencedEffectIds]))
        : Promise.resolve([]),
      referencedCapabilityIds.size > 0
        ? db.select({ id: capabilities.id, name: capabilities.name }).from(capabilities).where(inArray(capabilities.id, [...referencedCapabilityIds]))
        : Promise.resolve([]),
    ]);
    for (const r of primRows) nameMap[`primitive:${r.id}`] = r.name;
    for (const r of effRows) nameMap[`effect:${r.id}`] = r.name;
    for (const r of capRows) nameMap[`capability:${r.id}`] = r.name;
  } catch (err) {
    console.error("[versions page] name resolution failed:", err);
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8">
      <Link
        href={`/library/item/${parsed.type}:${parsed.id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to{" "}
        {result.targetName}
      </Link>

      <header className="border-b border-border pb-4">
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          {parsed.type.replace(/_/g, " ")}
        </p>
        <h1 className="mt-1 break-words text-3xl font-semibold">
          {result.targetName}
        </h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <History className="size-4" />
          {result.versions.length}{" "}
          {result.versions.length === 1 ? "version" : "versions"} published
        </p>
        {/* P5R-8: discoverability for the diff page. The per-row
            "Compare with v[N-1]" link is small and easy to miss. This
            header CTA is the obvious entry point — "Compare the latest
            two versions". Shown only when there are 2+ versions. */}
        {result.versions.length >= 2 ? (
          <div className="mt-3">
            <Link
              href={`/library/item/${parsed.type}:${parsed.id}/versions/compare?from=${result.versions.length - 1}&to=${result.versions.length}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              title="Open the side-by-side diff view for the latest two versions"
            >
              <GitCompareArrows className="size-3.5" />
              Compare latest two versions →
            </Link>
          </div>
        ) : null}
      </header>

      {result.versions.length === 0 ? (
        <div className="mt-10 flex flex-col items-center justify-center rounded-md border border-dashed border-border bg-card/40 px-6 py-12 text-center">
          <History className="size-10 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">No versions published yet</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {parsed.type === "PRIMITIVE" ||
            parsed.type === "CAPABILITY" ||
            parsed.type === "CHARACTER" ||
            parsed.type === "RACE_TEMPLATE" ||
            parsed.type === "BACKGROUND_TEMPLATE" ||
            parsed.type === "ARCHETYPE_TEMPLATE"
              ? "This entry has never been published to the Library. Edits stay in your sandbox until you publish the first version."
              : "No published versions for this entry."}
          </p>
          <Link
            href={`/library/item/${parsed.type}:${parsed.id}`}
            className="mt-5 inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:border-primary hover:text-primary"
          >
            Back to the entry
          </Link>
        </div>
      ) : (
      <ol className="mt-6 space-y-3" data-testid="version-history">
        {result.versions.map((v, i) => {
          const previous = i > 0 ? result.versions[i - 1] : null;
          return (
            <VersionRow
              key={v.id}
              version={v}
              previousVersionNumber={previous?.versionNumber ?? null}
              isLatest={i === result.versions.length - 1}
              targetType={parsed.type}
              targetId={parsed.id}
              nameMap={nameMap}
            />
          );
        })}
      </ol>
      )}
    </div>
  );
}

// =============================================================================
// Helpers — sandbox deep-link
// =============================================================================
//
// "Slot this version into build" sends the user to the sandbox with
// `?edit=<id>&version=<N>`. The sandbox page (grammar / blueprint) reads
// that, fetches the reconstructed payload, and pre-fills the form. The
// user can then edit + save — saving creates a new version row.
//
// We only support the targets that have a sandbox editor (primitive /
// effect / capability / templates / items). Items don't have a version
// history table yet (deferred to a follow-up sprint).

/**
 * Map the version history's VersionTargetType to the API's restore
 * targetType. The version history splits templates into RACE / BACKGROUND /
 * ARCHETYPE; the API accepts them all as TEMPLATE.
 *
 * CHARACTER restore is not supported yet (deferred) — returns null in
 * that case so the caller can hide the button.
 */
function mapToApiType(
  t: VersionTargetType,
): "PRIMITIVE" | "EFFECT" | "CAPABILITY" | "ITEM" | "TEMPLATE" | null {
  if (
    t === "RACE_TEMPLATE" ||
    t === "BACKGROUND_TEMPLATE" ||
    t === "ARCHETYPE_TEMPLATE"
  ) {
    return "TEMPLATE";
  }
  if (t === "CHARACTER") return null;
  return t as "PRIMITIVE" | "CAPABILITY" | "TEMPLATE";
}

function buildSandboxSlotUrl(
  targetType: VersionTargetType,
  targetId: string,
  versionNumber: number,
): string | null {
  switch (targetType) {
    case "PRIMITIVE":
      return `/sandbox/grammar?build=primitive&edit=${encodeURIComponent(targetId)}&version=${versionNumber}`;
    case "CAPABILITY":
      return `/sandbox/grammar?build=capability&edit=${encodeURIComponent(targetId)}&version=${versionNumber}`;
    case "CHARACTER":
      return `/sandbox/builds?edit=${encodeURIComponent(targetId)}&version=${versionNumber}`;
    case "RACE_TEMPLATE":
      return `/sandbox/blueprint?build=template&kind=RACE&edit=${encodeURIComponent(targetId)}&version=${versionNumber}`;
    case "BACKGROUND_TEMPLATE":
      return `/sandbox/blueprint?build=template&kind=BACKGROUND&edit=${encodeURIComponent(targetId)}&version=${versionNumber}`;
    case "ARCHETYPE_TEMPLATE":
      return `/sandbox/blueprint?build=template&kind=ARCHETYPE&edit=${encodeURIComponent(targetId)}&version=${versionNumber}`;
    default:
      return null;
  }
}

function VersionRow({
  version,
  previousVersionNumber,
  isLatest,
  targetType,
  targetId,
  nameMap,
}: {
  version: VersionEntry;
  previousVersionNumber: number | null;
  isLatest: boolean;
  targetType: VersionTargetType;
  targetId: string;
  nameMap: Record<string, string>;
}) {
  const summary = buildSummary(version);
  return (
    <li className="rounded-md border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-lg font-semibold">
          v{version.versionNumber}
        </span>
        {version.deltaKind === "FULL" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            <GitCommit className="size-3" />
            FULL snapshot
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
            <GitMerge className="size-3" />
            DELTA
          </span>
        )}
        {/* BU cost — read from the reconstructed payload. Only meaningful
            for entity types that have a buyPrice / buCost in their data
            (currently primitives + capabilities). For DELTAs where the
            buCost was changed, the reconstructed value reflects that. */}
        <BuCostBadge payload={version.payload} />
        {isLatest && (
          <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
            latest
          </span>
        )}
        {/* Slot this version into build — sends the user to the sandbox
            with this exact version's payload pre-filled. Editing + saving
            creates a new version (or fork if not owner). The button only
            shows for entity types that have a sandbox editor. */}
        {(() => {
          const slotUrl = buildSandboxSlotUrl(
            targetType,
            targetId,
            version.versionNumber,
          );
          if (!slotUrl) return null;
          return (
            <Link
              href={slotUrl}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
              title={`Slot v${version.versionNumber} into your build sandbox`}
            >
              <Wrench className="size-3" />
              Slot into build
            </Link>
          );
        })()}
        <VersionPreviewButton
          targetType={targetType}
          targetId={targetId}
          versionNumber={version.versionNumber}
          payload={version.payload}
          nameMap={nameMap}
        />
        {(() => {
          const apiType: "PRIMITIVE" | "EFFECT" | "CAPABILITY" | "ITEM" | "TEMPLATE" | null = mapToApiType(targetType);
          if (!apiType) return null;
          return (
            <RestoreButton
              targetType={apiType}
              targetId={targetId}
              versionNumber={version.versionNumber}
              isLatest={isLatest}
            />
          );
        })()}
        {previousVersionNumber !== null && (
          <Link
            href={`/library/item/${targetType}:${targetId}/versions/compare?from=${previousVersionNumber}&to=${version.versionNumber}`}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
            title={`Compare v${previousVersionNumber} with v${version.versionNumber}`}
          >
            <GitCompareArrows className="size-3" />
            Diff v{previousVersionNumber}↔v{version.versionNumber}
          </Link>
        )}
        {!previousVersionNumber && (
          <span className="ml-auto text-xs text-muted-foreground">
            {formatDate(version.publishedAt)}
          </span>
        )}
      </div>

      <div className="mt-2 text-sm text-muted-foreground">
        {version.publishedByUsername ? (
          <Link
            href={`/u/${encodeURIComponent(version.publishedByUsername)}`}
            className="font-medium text-foreground hover:underline"
          >
            @{version.publishedByUsername}
          </Link>
        ) : (
          <span className="italic">system / unpublished</span>
        )}
        {version.deltaKind === "DELTA" && (
          <ChangeStatsBadge
            added={version.changeStats.added}
            modified={version.changeStats.modified}
            removed={version.changeStats.removed}
          />
        )}
      </div>

      <p className="mt-2 text-sm text-foreground/90">{summary}</p>

      <details className="mt-3 group">
        <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground hover:text-foreground">
          Show reconstructed payload
        </summary>
        <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-secondary/50 p-3 font-mono text-xs leading-relaxed">
          {JSON.stringify(stripPayloadMeta(version.payload), null, 2)}
        </pre>
      </details>
    </li>
  );
}

/**
 * BuCostBadge — small "N BU" pill extracted from the reconstructed
 * payload. Returns null if the payload has no numeric `buCost` field
 * (e.g. for entity types that don't model cost: characters, items,
 * effects, templates).
 */
function BuCostBadge({
  payload,
}: {
  payload: Record<string, unknown>;
}) {
  const raw = payload["buCost"];
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 font-mono text-xs font-medium text-amber-700 dark:text-amber-300"
      title={`BU cost of this version: ${raw}`}
    >
      {raw} BU
    </span>
  );
}

function ChangeStatsBadge({
  added,
  modified,
  removed,
}: {
  added: number;
  modified: number;
  removed: number;
}) {
  const parts: string[] = [];
  if (added > 0) parts.push(`+${added}`);
  if (modified > 0) parts.push(`~${modified}`);
  if (removed > 0) parts.push(`−${removed}`);
  if (parts.length === 0) return null;
  return (
    <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 font-mono text-xs">
      {parts.join(" ")}
    </span>
  );
}

function buildSummary(v: VersionEntry): string {
  if (v.deltaKind === "FULL") {
    return "Initial publication — full snapshot of the content.";
  }
  const { added, modified, removed } = v.changeStats;
  const total = added + modified + removed;
  if (total === 0) {
    return "Metadata-only update (no field changes detected).";
  }
  const pieces: string[] = [];
  if (added > 0) pieces.push(`${added} added`);
  if (modified > 0) pieces.push(`${modified} modified`);
  if (removed > 0) pieces.push(`${removed} removed`);
  return `Updated — ${pieces.join(", ")}.`;
}

/**
 * Drop internal versioning metadata (`kind`) before displaying the payload
 * to the user — it's noise.
 */
function stripPayloadMeta(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (k === "kind") continue;
    out[k] = v;
  }
  return out;
}

function formatDate(d: Date): string {
  const date = new Date(d);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}