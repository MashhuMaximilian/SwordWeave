"use client";

// =============================================================================
// SharedCharacterCard — PLAN Eilxina Part B (Mashu 2026-09-09).
//
// Card for the "Shared with me" tab on /characters. Lightweight
// preview — no BU aggregation (the BU depends on the character's
// slotted primitives which the viewer might not fully resolve).
// Just enough info to identify the character and click through.
//
// Permissions marker:
// - "Can edit" badge when canEdit=true (the granting user gave
//   edit rights — view-only otherwise).
// - Future Part C will wire the edit affordance directly from this
//   card; for Part B it only opens the sheet (which Part B also
//   gates via the same isShared check).

import Link from "next/link";
import { Eye, Pencil, User as UserIcon } from "lucide-react";
import type { SharedCharacterRow } from "@/lib/character/list-shared-characters";

interface SharedCharacterCardProps {
  row: SharedCharacterRow;
}

export function SharedCharacterCard({ row }: SharedCharacterCardProps) {
  const portrait = row.portraitUrl;
  return (
    <div className="group relative flex flex-col rounded-md border border-border bg-card p-5 transition-colors hover:border-primary">
      <div className="flex items-start gap-3">
        {portrait ? (
          <img
            src={portrait}
            alt={row.name}
            className="size-14 rounded-md border border-border object-cover"
          />
        ) : (
          <div className="flex size-14 items-center justify-center rounded-md border border-border bg-background text-2xl font-bold text-muted-foreground">
            {row.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold">{row.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="rounded-full bg-secondary px-2 py-0.5 font-mono font-bold text-secondary-foreground">
              L{row.level}
            </span>
            <span>{row.size}</span>
            {row.lineageName && <span>· {row.lineageName}</span>}
            {row.manifestName && <span>· {row.manifestName}</span>}
          </div>
        </div>
      </div>

      {/* Granter attribution — who shared this with you? */}
      <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <UserIcon className="size-3.5" />
        <span>
          Shared by{" "}
          <span className="font-medium text-foreground">
            {row.grantedByDisplayName ?? row.grantedByUsername ?? "unknown"}
          </span>
        </span>
      </div>

      {/* Stats grid */}
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        <Stat label="P" value={row.attrPhysical} />
        <Stat label="M" value={row.attrMental} />
        <Stat label="Mg" value={row.attrMagical} />
      </div>

      {/* Permissions badge + actions */}
      <div className="mt-5 flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            row.canEdit
              ? "bg-emerald-500/15 text-emerald-700 ring-1 ring-inset ring-emerald-500/30 dark:text-emerald-300"
              : "bg-secondary text-secondary-foreground"
          }`}
          title={
            row.canEdit
              ? "You can edit this character directly"
              : "View-only access"
          }
        >
          {row.canEdit ? (
            <Pencil className="size-3" />
          ) : (
            <Eye className="size-3" />
          )}
          {row.canEdit ? "Can edit" : "View only"}
        </span>
        <Link
          href={`/characters/${row.id}`}
          className="flex-1 rounded-md bg-primary px-3 py-1.5 text-center text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          Open Sheet
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-background px-2 py-1.5">
      <div className="text-[10px] font-semibold uppercase text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-sm font-bold">
        {value >= 0 ? `+${value}` : value}
      </div>
    </div>
  );
}
