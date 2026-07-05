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
import { ArrowLeft, GitCommit, GitCompareArrows, GitMerge, History } from "lucide-react";
import {
  getVersionHistory,
  type VersionEntry,
  type VersionTargetType,
} from "@/lib/versions/version-history";

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
            />
          );
        })}
      </ol>
      )}
    </div>
  );
}

function VersionRow({
  version,
  previousVersionNumber,
  isLatest,
  targetType,
  targetId,
}: {
  version: VersionEntry;
  previousVersionNumber: number | null;
  isLatest: boolean;
  targetType: VersionTargetType;
  targetId: string;
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
        {isLatest && (
          <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
            latest
          </span>
        )}
        {previousVersionNumber !== null && (
          <Link
            href={`/library/item/${targetType}:${targetId}/versions/compare?from=${previousVersionNumber}&to=${version.versionNumber}`}
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <GitCompareArrows className="size-3" />
            Compare with v{previousVersionNumber}
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