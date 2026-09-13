/** Shared classification for public browsing and the Atelier source shelf. */
export function libraryOrigin(item: { authorId: string | null; authorIsAdmin: boolean | null; sourceOrigin: string | null }): "system" | "community" {
  return !item.authorId || item.authorIsAdmin || item.sourceOrigin === "system" || item.sourceOrigin?.startsWith("system:") ? "system" : "community";
}
export function libraryTier(item: { costTier?: string | null }): number | null {
  const match = item.costTier?.match(/tier\s*(\d+)/i);
  return match ? Number(match[1]) : null;
}
export function primitiveGroupKey(category: string, modifiers: unknown): string {
  if (!Array.isArray(modifiers) || !modifiers.length) return "Unclassified";
  if (!modifiers[0] || typeof modifiers[0] !== "object") return "Unclassified";
  const first = modifiers[0] as Record<string, unknown>;
  const metadata = first["metadata"] as Record<string, unknown> | undefined;
  const scope = (metadata?.["targetScope"] ?? first["scope"]) as Record<string, unknown> | undefined;
  const values = scope?.["values"] ?? first["targetValues"] ?? first["targetValue"];
  if (Array.isArray(values) && values.length) return values.map(String).sort().join(" · ");
  if (typeof values === "string" && values) return values;
  const domainKey = metadata?.["domain_key"] ?? metadata?.["domainKey"] ?? scope?.["domain_key"] ?? first["domain_key"];
  if (typeof domainKey === "string") return domainKey;
  return category === "DOMAIN" ? "Unclassified" : String(first["target"] ?? category).replaceAll("_", " ");
}
