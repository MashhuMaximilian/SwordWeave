// =============================================================================
// save-intent — Phase 1 of the edit-creates-fork refactor (§11 of
// docs/architecture/edit-creates-fork.md).
//
// The intent flag records HOW the user entered the sandbox:
//   - "fork"  → they clicked a "Fork" button. Save always forks.
//   - "load"  → they clicked "Load into build". Save forks only if
//               the caller does NOT own the source; otherwise it
//               updates in place.
//   - null    → no ?intent= param (e.g. deep link, or user landed on
//               the sandbox directly to start a brand-new entry).
//               Defaults to "load" semantics on save.
//
// The flag lives in the URL (`?intent=fork|load`) and is read on the
// server in /sandbox/grammar + /sandbox/blueprint page.tsx, threaded
// into the client form via React props, then included in the save
// fetch body. The server's /api/<entity> POST handler reads it from
// the body and dispatches via src/lib/publishing/dispatch-save.ts.
// =============================================================================

export type SaveIntent = "fork" | "load" | null;

/**
 * Parse a `?intent=<value>` query param into a typed SaveIntent.
 * Unknown / missing values resolve to `null` (default-load semantics).
 */
export function parseSaveIntent(raw: string | undefined): SaveIntent {
  if (raw === "fork") return "fork";
  if (raw === "load") return "load";
  return null;
}

/**
 * Serialize a SaveIntent back into a URL search-param value.
 * `null` returns null so callers can omit the param entirely.
 */
export function serializeSaveIntent(intent: SaveIntent): string | null {
  if (intent === "fork" || intent === "load") return intent;
  return null;
}

/**
 * Human-readable chip label for the sandbox form header (Phase 1 UX).
 * `null` returns null so the chip can be omitted on a clean sandbox.
 */
export function saveIntentLabel(
  intent: SaveIntent,
  sourceName: string | null,
): string | null {
  if (intent === "fork") {
    return sourceName ? `Forking ${sourceName}` : "Forking";
  }
  if (intent === "load") {
    return sourceName ? `Working on ${sourceName}` : "Working on it";
  }
  return null;
}