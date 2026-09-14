/** Shared classification for public browsing and the Atelier source shelf. */
export function libraryOrigin(item: { authorId: string | null; authorIsAdmin: boolean | null; sourceOrigin: string | null }): "system" | "community" {
  return !item.authorId || item.authorIsAdmin || item.sourceOrigin === "system" || item.sourceOrigin?.startsWith("system:") ? "system" : "community";
}

export function libraryAuthorLabel(item: {
  authorId: string | null;
  authorIsAdmin: boolean | null;
  authorDisplayName: string | null;
  authorUsername: string | null;
  sourceOrigin: string | null;
}): string {
  if (libraryOrigin(item) === "system") return "System";
  return item.authorDisplayName ?? item.authorUsername ?? "Community";
}

const CATEGORY_ALIASES: Record<string, string> = {
  CHARACTER_SHEET_AUGMENT: "SHEET_AUGMENT",
};

export function canonicalLibraryCategory(category: string): string {
  const aliased=CATEGORY_ALIASES[category] ?? category;
  if (aliased === "SHEET_AUGMENT") return "SHEET_AUGMENT";
  return MARKET_FAMILIES.find((family)=>family.key===aliased || family.categories.includes(aliased))?.key ?? aliased;
}

export function libraryCategoryMembers(category: string): string[] {
  const canonical = canonicalLibraryCategory(category);
  const family=MARKET_FAMILIES.find((candidate)=>candidate.key===canonical);
  const members=family?.categories ?? [canonical];
  return [
    ...members,
    ...Object.entries(CATEGORY_ALIASES)
      .filter(([, target]) => members.includes(target))
      .map(([alias]) => alias),
  ];
}
export function libraryTier(item: { costTier?: string | null }): number | null {
  const match = item.costTier?.match(/tier\s*(\d+)/i);
  return match ? Number(match[1]) : null;
}
export function primitiveGroupKey(
  category: string,
  modifiers: unknown,
  name?: string,
  sourceOrigin?: string | null,
): string {
  if (category === "DOMAIN" && name) {
    const match = name.match(/^domain\s+o(?:f|d)\s+(.+?)(?:\s*\(fork\))?$/i);
    if (match?.[1]) return match[1].trim().replace(/\s+/g, " ");
  }
  if (!Array.isArray(modifiers) || !modifiers.length) {
    return sourceOrigin === "system" || sourceOrigin?.startsWith("system:")
      ? name?.replace(/\s+tier\s+[ivx]+$/i, "").trim() || "Canonical expression"
      : "Needs classification";
  }
  if (!modifiers[0] || typeof modifiers[0] !== "object") return "Needs classification";
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
  return category === "DOMAIN" ? "Community expressions" : String(first["target"] ?? category).replaceAll("_", " ");
}

/** Preserve identity boundaries even when two scopes have the same display text. */
export function groupLibraryEntries<T extends { category?: string | null; familyKey?: string | null; costTier?: string | null; groupKey?: string | null }>(items: T[]) {
  const groups = new Map<string, { id: string; category: string | null; tier: number | null; key: string; entries: T[] }>();
  for (const item of items) {
    const category = item.familyKey ?? (item.category ? canonicalLibraryCategory(item.category) : null);
    const tier = libraryTier(item);
    const key = item.groupKey ?? "Unclassified";
    const id = JSON.stringify([category, tier, key]);
    const group = groups.get(id) ?? { id, category, tier, key, entries: [] };
    group.entries.push(item);
    groups.set(id, group);
  }
  return [...groups.values()].sort((a, b) => {
    const tierOrder = (a.tier ?? Number.MAX_SAFE_INTEGER) - (b.tier ?? Number.MAX_SAFE_INTEGER);
    return tierOrder || a.key.localeCompare(b.key);
  });
}
import { MARKET_FAMILIES } from "@/lib/primitives/canonical-market";
