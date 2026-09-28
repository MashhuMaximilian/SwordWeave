import { inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { primitives } from "@/db/schema";
import { queryCompleteLibrary, visibilityCondition, type LibraryItem, type LibraryTargetType } from "@/lib/publishing/library-query";
import { libraryOrigin } from "@/lib/publishing/library-classification";
import { eligibleMirrorCandidates, mirrorConsequence } from "@/lib/character/mirror-suggestions";
import type { EntityKind } from "../model";
import { quickRuleFromLibrary } from "./quick-rules";
import type { DiscoveryCandidate } from "./matching";

const TYPES: Record<EntityKind, LibraryTargetType[]> = {
  primitive: ["PRIMITIVE"], capability: ["CAPABILITY"], effect: ["EFFECT"], item: ["ITEM"],
  heritage: ["LINEAGE_TEMPLATE", "UPBRINGING_TEMPLATE", "MANIFEST_TEMPLATE"],
};

/** Exhaust the authorized catalog; matching is never confined to the visible UI page. */
export async function loadCompleteLibraryType(targetType: LibraryTargetType, viewerClerkId: string, query = queryCompleteLibrary): Promise<LibraryItem[]> {
  const items = await query({ targetType, viewerClerkId, origin: "all", sort: "ALPHABETICAL" });
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

export async function loadDiscoveryCatalog(kinds: EntityKind[], viewerClerkId: string): Promise<DiscoveryCandidate[]> {
  const types = [...new Set(kinds.flatMap((kind) => TYPES[kind]))];
  const pages = await Promise.all(types.map((type) => loadCompleteLibraryType(type, viewerClerkId)));
  let items = pages.flat();
  if (!items.length) return [];
  // Verify every candidate with the same publication/legacy-public authorizer
  // used by Add. Explicit publication restrictions always take precedence.
  // Batches keep the SQL parameter count bounded for a large Library.
  const allowed = new Set<string>();
  for (let offset = 0; offset < items.length; offset += 250) {
    const batch = items.slice(offset, offset + 250);
    const checks = sql.join(batch.map((item) => sql`SELECT ${item.id}::text AS key, ${visibilityCondition(item.targetType, sql`${item.targetId}`, sql`${item.authorId}`, viewerClerkId)} AS allowed`), sql` UNION ALL `);
    const visible = await db.execute(checks);
    for (const row of visible.rows) if (row["allowed"] === true) allowed.add(String(row["key"]));
  }
  items = items.filter(item => allowed.has(item.id));
  const primitiveIds = items.filter((item) => item.targetType === "PRIMITIVE").map((item) => Number(item.targetId));
  const rules = primitiveIds.length ? await db.select({
    id: primitives.id, name: primitives.name, category: primitives.category, costTier: primitives.costTier, mechanicalOutputText: primitives.mechanicalOutputText, narrativeRule: primitives.narrativeRule, mechanicalRule: primitives.mechanicalRule, consequenceBehavior: primitives.consequenceBehavior, hardModifiers: primitives.hardModifiers, isMirrorable: primitives.isMirrorable,
    mirrorVector: primitives.mirrorVector, mirrorBuCredit: primitives.mirrorBuCredit, buCost: primitives.buCost,
  }).from(primitives).where(inArray(primitives.id, primitiveIds)) : [];
  const rawById = new Map(rules.map((row) => [String(row.id), row]));
  const mirrors = new Map(eligibleMirrorCandidates(rules, Number.MAX_SAFE_INTEGER).map((row) => [String(row.id), row]));
  return items.map((item) => {
    const kind: EntityKind = item.targetType.endsWith("_TEMPLATE") ? "heritage" : item.targetType.toLowerCase() as EntityKind;
    const mirror = kind === "primitive" ? mirrors.get(item.targetId) : undefined;
    const seedRow = kind === "primitive" ? rawById.get(item.targetId) : undefined;
    const ruleSeed = seedRow ? quickRuleFromLibrary({ ...seedRow, familyKey: item.familyKey ?? null }) : null;
    const nestedRules = item.compositionPaths?.map((path) => `${path.primitiveName}: ${path.mechanicalDescription}`).join("\n") ?? "";
    return {
      key: `${kind}:${item.targetId}`, kind, name: item.name,
      ...(ruleSeed ? { ruleSeed } : {}),
      description: item.verboseDescription ?? item.description ?? "",
      mechanicalDescription: item.mechanicalDescription || nestedRules || item.compositionSummary || "",
      tags: item.tags, family: item.familyLabel ?? item.familyKey ?? item.category ?? "",
      structuredRules: kind === "primitive" ? JSON.stringify(rawById.get(item.targetId)?.hardModifiers ?? []) : nestedRules,
      primitiveCosts: item.compositionPaths?.map((leaf) => ({ key: `primitive:${leaf.primitiveId}` as const, cost: leaf.buCost })) ?? [],
      origin: libraryOrigin(item), cost: item.buCost === null ? Number.NaN : Number(item.buCost), versionNumber: item.versionNumber ?? null,
      ...(kind === "heritage" ? { heritageType: item.targetType.replace("_TEMPLATE", "") } : {}),
      ...(mirror ? { mirrorCredit: mirror.mirrorBuCredit ?? mirror.buCost, mirrorDescription: mirrorConsequence(mirror) } : {}),
    };
  });
}
