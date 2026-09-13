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
  // An explicit identity wins over a broader target scope (for example Self).
  const domainKey = metadata?.["domain_key"] ?? metadata?.["domainKey"] ?? scope?.["domain_key"] ?? first["domain_key"];
  if (typeof domainKey === "string" && domainKey.trim()) {
    return domainKey.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
  }
  const values = scope?.["values"] ?? first["targetValues"] ?? first["targetValue"];
  if (Array.isArray(values) && values.length) return values.map(String).sort().join(" · ");
  if (typeof values === "string" && values) return values;
  return category === "DOMAIN" ? "Unclassified" : String(first["target"] ?? category).replaceAll("_", " ");
}

/** Preserve identity boundaries even when two scopes have the same display text. */
export function groupLibraryEntries<T extends { category?: string | null; costTier?: string | null; groupKey?: string | null }>(items: T[]) {
  const groups = new Map<string, { id: string; category: string | null; tier: number | null; key: string; entries: T[] }>();
  for (const item of items) {
    const category = item.category ?? null;
    const tier = libraryTier(item);
    const key = item.groupKey ?? "Unclassified";
    const id = JSON.stringify([category, tier, key]);
    const group = groups.get(id) ?? { id, category, tier, key, entries: [] };
    group.entries.push(item);
    groups.set(id, group);
  }
  return [...groups.values()].sort((a, b) => (a.tier ?? Number.MAX_SAFE_INTEGER) - (b.tier ?? Number.MAX_SAFE_INTEGER));
}
