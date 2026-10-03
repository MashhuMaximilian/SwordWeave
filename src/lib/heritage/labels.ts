/** Human-facing heritage names; TEMPLATE is only a storage discriminator. */
export function heritageKindLabel(kind: string): string {
  const normalized = kind.replace(/_TEMPLATE$/, "").toUpperCase();
  if (normalized === "LINEAGE") return "Lineage";
  if (normalized === "UPBRINGING") return "Upbringing";
  if (normalized === "MANIFEST") return "Manifest";
  return kind;
}

export function isHeritageKind(kind: string): boolean {
  return ["LINEAGE", "UPBRINGING", "MANIFEST"].includes(kind.replace(/_TEMPLATE$/, "").toUpperCase());
}
