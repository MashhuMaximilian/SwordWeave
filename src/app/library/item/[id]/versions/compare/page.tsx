// =============================================================================
// /library/item/[id]/versions/compare — side-by-side diff view
//
// URL: /library/item/<TYPE>:<id>/versions/compare?from=N&to=M
// Defaults: from=v1, to=latest.
// =============================================================================

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, GitCompareArrows } from "lucide-react";
import {
  getVersionHistory,
  type VersionTargetType,
} from "@/lib/versions/version-history";
import { diffPayloads, type FieldDiff } from "@/lib/versions/compare";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
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
    "EFFECT",
    "ITEM",
    "RACE_TEMPLATE",
    "BACKGROUND_TEMPLATE",
    "ARCHETYPE_TEMPLATE",
  ];
  if (!supported.includes(type as VersionTargetType)) return null;
  return { type: type as VersionTargetType, id };
}

export default async function VersionComparePage({
  params,
  searchParams,
}: PageProps) {
  const { id: rawId } = await params;
  const { from, to } = await searchParams;

  const parsed = parseCompositeId(decodeURIComponent(rawId));
  if (!parsed) notFound();

  const history = await getVersionHistory(parsed.type, parsed.id);
  if (!history || history.versions.length < 2) notFound();

  // Resolve which versions to compare
  const totalVersions = history.versions.length;
  const fromNum = clampInt(from, 1, totalVersions, 1);
  const toNum = clampInt(to, 1, totalVersions, totalVersions);

  const fromVer = history.versions[fromNum - 1];
  const toVer = history.versions[toNum - 1];
  if (!fromVer || !toVer) notFound();

  // Safety: if from > to, swap so diff makes sense (newer on right)
  const [leftVer, rightVer] = fromVer.versionNumber < toVer.versionNumber
    ? [fromVer, toVer]
    : [toVer, fromVer];

  const left = leftVer.payload as Record<string, unknown>;
  const right = rightVer.payload as Record<string, unknown>;
  const { fields, summary } = diffPayloads(left, right);

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8">
      <Link
        href={`/library/item/${parsed.type}:${parsed.id}/versions`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to version history
      </Link>

      <header className="border-b border-border pb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Compare versions
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold uppercase tracking-wide">
          {history.targetName}
        </h1>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <GitCompareArrows className="size-4" aria-hidden="true" />
          v{leftVer.versionNumber} → v{rightVer.versionNumber}
        </p>
      </header>

      {/* Summary chips */}
      <div className="mt-4 flex flex-wrap gap-2">
        {summary.added > 0 && (
          <SummaryChip label="added" count={summary.added} tone="add" />
        )}
        {summary.removed > 0 && (
          <SummaryChip label="removed" count={summary.removed} tone="remove" />
        )}
        {summary.modified > 0 && (
          <SummaryChip label="modified" count={summary.modified} tone="modify" />
        )}
        {summary.unchanged > 0 && (
          <SummaryChip label="unchanged" count={summary.unchanged} tone="neutral" />
        )}
      </div>

      {/* Diff table */}
      <div className="mt-6 overflow-hidden rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-card text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-semibold">Field</th>
              <th className="px-3 py-2 font-semibold">v{leftVer.versionNumber}</th>
              <th className="px-3 py-2 font-semibold">v{rightVer.versionNumber}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {fields.map((f) => (
              <DiffRow key={f.key} field={f} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function clampInt(
  raw: string | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function SummaryChip({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "add" | "remove" | "modify" | "neutral";
}) {
  const cls =
    tone === "add"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : tone === "remove"
        ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300"
        : tone === "modify"
          ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          : "border-border bg-card text-muted-foreground";
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-xs font-mono font-semibold ${cls}`}
    >
      +{count} {label}
    </span>
  );
}

function DiffRow({ field }: { field: FieldDiff }) {
  const rowCls =
    field.status === "ADDED"
      ? "bg-emerald-500/5"
      : field.status === "REMOVED"
        ? "bg-rose-500/5"
        : field.status === "MODIFIED"
          ? "bg-amber-500/5"
          : "";

  const labelCls =
    field.status === "ADDED"
      ? "text-emerald-700 dark:text-emerald-300"
      : field.status === "REMOVED"
        ? "text-rose-700 dark:text-rose-300"
        : field.status === "MODIFIED"
          ? "text-amber-700 dark:text-amber-300"
          : "text-foreground";

  return (
    <tr className={rowCls}>
      <td className="px-3 py-2 align-top">
        <p className={`font-mono text-xs font-semibold ${labelCls}`}>
          {field.key}
        </p>
        <p className="mt-0.5 text-xs uppercase text-muted-foreground">
          {field.status}
        </p>
      </td>
      <td className="px-3 py-2 align-top">
        {field.status === "ADDED" ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <ValueCell value={field.before} muted />
        )}
      </td>
      <td className="px-3 py-2 align-top">
        {field.status === "REMOVED" ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <ValueCell value={field.after} muted={false} />
        )}
      </td>
    </tr>
  );
}

function ValueCell({
  value,
  muted,
}: {
  value: unknown;
  muted: boolean;
}) {
  const cls = muted ? "text-muted-foreground line-through" : "text-foreground";
  if (value === undefined || value === null) {
    return (
      <span className="font-mono text-xs italic text-muted-foreground">
        null
      </span>
    );
  }
  if (typeof value === "string") {
    return (
      <p className={`break-words font-mono text-xs ${cls}`}>
        {value || <span className="italic text-muted-foreground">(empty)</span>}
      </p>
    );
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return (
      <span className={`font-mono text-xs ${cls}`}>{String(value)}</span>
    );
  }
  // Object/array — pretty-print
  return (
    <pre
      className={`overflow-x-auto rounded bg-muted/50 p-2 font-mono text-[10px] leading-tight ${cls}`}
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}