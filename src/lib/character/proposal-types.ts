// =============================================================================
// proposal-types — PLAN Eilxina Part C (Mashu 2026-09-09).
//
// Shared types for the proposal flow. Imported by:
//   - compute-proposal-diff.ts (server-side diff builder)
//   - proposal-review-screen.tsx (review screen client component)
//   - /api/characters/[id]/proposals/* routes
//
// Why a leaf module: the FieldChange shape is consumed by both
// server and client code. Putting it in a server-only module
// would re-create the "Module not found: fs" client-bundle trap
// (per the codebase's §6k lesson).
// =============================================================================

export type ProposalTargetKind = "PRIMITIVE" | "CAPABILITY" | "ITEM";

export type ProposalStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "APPLIED"
  | "SUPERSEDED";

export interface FieldChange {
  /** Name of the field that changed (e.g. "buCost", "name"). */
  field: string;
  /** Pre-change value. null = field was absent/missing. */
  from: unknown;
  /** Post-change value. null = field was removed. */
  to: unknown;
  /** When true, the change is in a complex nested field (hardModifiers)
   *  and the review UI should render a "details changed" chip instead
   *  of trying to display the raw from/to. */
  complex?: boolean;
}

export interface ProposalDiff {
  fieldChanges: FieldChange[];
}
