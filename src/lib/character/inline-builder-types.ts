/**
 * Shared types + helpers for the Phase 9.1 inline character-builder
 * routes. Kept in /lib so the route handlers and the unit tests
 * import from one place (route handlers live in /app which is harder
 * to import from vitest).
 */

export const KIND_TO_SOURCE = {
  LINEAGE: "LINEAGE",
  UPBRINGING: "UPBRINGING",
  MANIFEST: "MANIFEST",
} as const;

export const KIND_TO_COLUMN = {
  LINEAGE: "lineageId",
  UPBRINGING: "upbringingId",
  MANIFEST: "manifestId",
} as const;

export const KIND_TO_SNAPSHOT = {
  LINEAGE: "lineageName",
  UPBRINGING: "upbringingName",
  MANIFEST: "manifestName",
} as const;

export type AccordionKind = keyof typeof KIND_TO_SOURCE;

export function isAccordionKind(v: unknown): v is AccordionKind {
  return (
    typeof v === "string" &&
    (Object.keys(KIND_TO_SOURCE) as string[]).includes(v)
  );
}

/**
 * Per-accordion sources for primitive linkage. PERSONAL is the
 * items accordion; the heritage accordion sources are LINEAGE /
 * UPBRINGING / MANIFEST.
 */
export const ALLOWED_PRIMITIVE_SOURCES = [
  "LINEAGE",
  "UPBRINGING",
  "MANIFEST",
  "PERSONAL",
] as const;

export type PrimitiveSource = (typeof ALLOWED_PRIMITIVE_SOURCES)[number];

export function isPrimitiveSource(v: unknown): v is PrimitiveSource {
  return (
    typeof v === "string" &&
    (ALLOWED_PRIMITIVE_SOURCES as readonly string[]).includes(v)
  );
}
