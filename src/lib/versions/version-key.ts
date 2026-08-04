/**
 * version-key — Phase 8.5 / Session H6 round 9 (Mashu
 * 2026-08-03): client-safe helper for building the
 * `${kind}:${id}` map key used by the character sheet
 * to look up a slot's latest published version id.
 *
 * Extracted from bulk-resolve-latest-versions.ts
 * because that module imports `@/db/client` (a
 * server-only Neon serverless client). The character
 * sheet is a Client Component and re-imported the
 * makeKey helper, which transitively pulled @next/env
 * into the client bundle and broke the Turbopack
 * build ("Module not found: Can't resolve 'fs'").
 *
 * This file has NO server-only imports so it's safe
 * to use from client components.
 */

export type VersionEntityKind =
  | "primitive"
  | "effect"
  | "capability"
  | "item"
  | "heritage";

export type VersionKey = `${VersionEntityKind}:${string | number}`;

export function makeKey(
  kind: VersionEntityKind,
  id: string | number,
): VersionKey {
  return `${kind}:${id}` as VersionKey;
}