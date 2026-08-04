/**
 * composite-id — Phase 8.5 / Session H6 round 8 (Mashu
 * 2026-08-03): helpers for building the canonical
 * library composite id (`<TYPE>:<id>`) and the
 * canonical library URL paths.
 *
 * The character sheet uses these so "View source" and
 * "View version history" links go to the canonical
 * `/library/item/[id]` page instead of the 404-prone
 * `/atelier/{kind}/{id}` routes.
 *
 * For heritages, the TYPE is the heritage's raw `kind`
 * column (LINEAGE / UPBRINGING / MANIFEST) + `_TEMPLATE`
 * suffix. e.g. `LINEAGE_TEMPLATE:<uuid>`.
 *
 * Same shape used by library-item-preview.libraryCompositeId,
 * but takes the kind + id as plain strings instead of a
 * full SandboxPreviewItem (character sheet doesn't have
 * that wrapper type).
 */

export type LibraryEntityKind =
  | "primitive"
  | "capability"
  | "effect"
  | "item";

export type HeritageRawKind = "LINEAGE" | "UPBRINGING" | "MANIFEST";

export function compositeId(
  kind: LibraryEntityKind,
  id: string | number,
): string {
  return `${kind.toUpperCase()}:${id}`;
}

export function heritageCompositeId(
  kind: HeritageRawKind,
  id: string,
): string {
  return `${kind}_TEMPLATE:${id}`;
}

export function libraryItemUrl(
  kind: LibraryEntityKind,
  id: string | number,
  opts?: { tab?: "versions" },
): string {
  const base = `/library/item/${compositeId(kind, id)}`;
  if (opts?.tab === "versions") return `${base}/versions`;
  return base;
}

export function heritageLibraryItemUrl(
  kind: HeritageRawKind,
  id: string,
  opts?: { tab?: "versions" },
): string {
  const base = `/library/item/${heritageCompositeId(kind, id)}`;
  if (opts?.tab === "versions") return `${base}/versions`;
  return base;
}