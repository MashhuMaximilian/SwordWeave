/** 100 original system templates. Dry run first; stable IDs and unchanged versions on rerun. */
import { createHash } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { and, eq, sql } from "drizzle-orm";
import { db, pool, withDatabaseTransaction } from "@/db/client";
import {
  monsters,
  monsterVersions,
  collections,
  collectionEntries,
} from "@/db/schema";
import { systemBestiary } from "@/lib/monsters/catalogue/system-bestiary";
import {
  monsterBaselines,
  autoMonsterPractices,
  sameMonsterSnapshot,
  type MonsterDefinition,
} from "@/lib/monsters/model";
import { prepareMonster, type PinnedDefinition } from "@/lib/monsters/service";
import { pinMonsterReferences } from "@/lib/monsters/pins";
import { resolveMonsterComposition } from "@/lib/monsters/composition";
import { monsterCost } from "@/lib/monsters/resolve";
import { assertMonsterAudience } from "@/lib/monsters/visibility";
const owner = "system:bestiary-2026-10";
const stable = (key: string) => {
  const h = createHash("sha256").update(`${owner}:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
async function main() {
  if (
    systemBestiary.length !== 100 ||
    new Set(systemBestiary.map((r) => r.key)).size !== 100
  )
    throw new Error("Manifest must contain 100 unique creatures.");
  const limit = process.argv.includes("--initial") ? 12 : 100;
  const picks = new Map<
    string,
    { kind: "PRIMITIVE" | "CAPABILITY" | "ITEM"; id: string }[]
  >();
  for (const [table, kind] of [
    ["primitives", "PRIMITIVE"],
    ["capabilities", "CAPABILITY"],
    ["items", "ITEM"],
  ] as const) {
    const result = await db.execute(
      sql`SELECT id,name,user_id,source_origin FROM ${sql.identifier(table)} WHERE is_public=true ORDER BY CASE WHEN user_id IS NULL OR source_origin='SRD' THEN 0 ELSE 1 END,id`,
    );
    for (const row of result.rows as { id: string | number; name: string }[]) {
      const key = `${kind}:${row.name}`;
      picks.set(key, [...(picks.get(key) ?? []), { kind, id: String(row.id) }]);
    }
  }
  function reference(kind: "PRIMITIVE" | "CAPABILITY" | "ITEM", name: string) {
    const found = picks.get(`${kind}:${name}`)?.[0];
    if (!found) throw new Error(`Public ${kind} not found: ${name}`);
    return { ...found, quantity: 1, isMirrored: false, versionId: null };
  }
  const prepared: {
    id: string;
    definition: PinnedDefinition;
    environment: string;
    spent: number;
    itemBu: number;
    raisedFrom: number | null;
  }[] = [];
  for (const recipe of systemBestiary.slice(0, limit)) {
    console.log(`Checking ${recipe.name}: ${recipe.ability}, ${recipe.trait}`);
    const references = [
      reference("CAPABILITY", recipe.ability),
      reference("PRIMITIVE", recipe.trait),
      ...(recipe.item ? [reference("ITEM", recipe.item)] : []),
    ];
    const attr = (budget: number) => {
      const n = monsterBaselines(budget).attributePoints;
      const side = Math.floor(n / 5);
      return {
        physical: recipe.focus === "physical" ? n - side * 2 : side,
        mental: recipe.focus === "mental" ? n - side * 2 : side,
        magical: recipe.focus === "magical" ? n - side * 2 : side,
      };
    };
    const draft: MonsterDefinition = {
      name: recipe.name,
      sourceOrigin: "SRD",
      concept: `${recipe.concept}\n\n**Encounter use:** ${recipe.environment} · ${recipe.role.toLowerCase()}.\n\n**Tactics:** ${recipe.tactics}\n\n**Rules:** Use the saved ${recipe.ability} capability and ${recipe.trait} primitive as written. Description does not grant additional mechanics.`,
      budget: recipe.budget,
      size: recipe.size as MonsterDefinition["size"],
      attributes: attr(recipe.budget),
      proficientAttribute: recipe.focus,
      practiceSlices: autoMonsterPractices(attr(recipe.budget)),
      baselineVitality: null,
      references,
      catalogue: {
        environment: recipe.environment,
        role: recipe.role,
        tactics: recipe.tactics,
        tags: [recipe.environment, recipe.role],
      },
    };
    const pinned = await pinMonsterReferences(draft);
    const slots = await resolveMonsterComposition(pinned, owner);
    const cost = monsterCost(slots);
    const budget = Math.max(recipe.budget, Math.ceil(cost.spent / 5) * 5);
    const result = await prepareMonster(
      {
        ...pinned,
        budget,
        attributes: attr(budget),
        practiceSlices: autoMonsterPractices(attr(budget)),
      },
      owner,
    );
    await assertMonsterAudience(
      result.definition.componentPins.map(
        (p) =>
          `${p.kind}:${p.id}` as import("@/lib/character/workspace/model").EntityKey,
      ),
      owner,
      "PUBLIC",
    );
    if (!Number.isSafeInteger(result.sheet.maximum) || result.sheet.maximum < 1)
      throw new Error(`${recipe.name}: invalid Vitality.`);
    prepared.push({
      id: stable(recipe.key),
      definition: JSON.parse(
        JSON.stringify(result.definition),
      ) as PinnedDefinition,
      environment: recipe.environment,
      spent: result.sheet.spent,
      itemBu: result.sheet.itemBu,
      raisedFrom: budget === recipe.budget ? null : recipe.budget,
    });
    if (prepared.length % 10 === 0 || prepared.length === limit)
      console.log(`Validated ${prepared.length}/${limit} templates.`);
  }
  const signatures = prepared.map((p) =>
    JSON.stringify({
      refs: p.definition.references,
      attributes: p.definition.attributes,
      budget: p.definition.budget,
      size: p.definition.size,
    }),
  );
  if (new Set(signatures).size !== limit)
    throw new Error("Duplicate mechanical recipes in bestiary.");
  mkdirSync(".local-plans/gm-tools-oct8", { recursive: true });
  writeFileSync(
    ".local-plans/gm-tools-oct8/bestiary-audit.json",
    JSON.stringify(
      prepared.map((p) => ({
        id: p.id,
        name: p.definition.name,
        budget: p.definition.budget,
        spent: p.spent,
        itemBu: p.itemBu,
        environment: p.environment,
        raisedFrom: p.raisedFrom,
      })),
      null,
      2,
    ),
  );
  if (!process.argv.includes("--apply")) {
    console.log(
      `DRY RUN: ${limit} templates passed public dependency, allocation, cost, Vitality and uniqueness checks. No writes.`,
    );
    return;
  }
  let inserted = 0,
    unchanged = 0;
  await withDatabaseTransaction(async () => {
    for (const p of prepared) {
      const [prior] = await db
        .select()
        .from(monsters)
        .where(eq(monsters.id, p.id));
      if (prior) {
        if (
          prior.userId !== owner ||
          !sameMonsterSnapshot(prior.definition, p.definition)
        ) {
          throw new Error(
            `Existing seed differs: ${p.definition.name}. Review rather than overwrite.`,
          );
        }
        unchanged++;
      } else {
        await db.insert(monsters).values({
          id: p.id,
          userId: owner,
          name: p.definition.name,
          description: p.definition.concept,
          isPublic: true,
          visibility: "PUBLIC",
          definition: p.definition,
        });
        await db.insert(monsterVersions).values({
          id: stable(`version:${p.id}:1`),
          monsterId: p.id,
          version: 1,
          definition: p.definition,
        });
        inserted++;
      }
      const collectionId = stable(`collection:${p.environment}`);
      await db
        .insert(collections)
        .values({
          id: collectionId,
          ownerId: owner,
          name: `Bestiary · ${p.environment}`,
          visibility: "PUBLIC",
        })
        .onConflictDoNothing();
      await db
        .insert(collectionEntries)
        .values({ collectionId, targetType: "MONSTER", targetId: p.id })
        .onConflictDoNothing();
    }
  });
  console.log(
    `Seed complete: ${inserted} added, ${unchanged} unchanged; bestiary collections populated.`,
  );
}
main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : "Seed failed.");
    process.exitCode = 1;
  })
  .finally(() => pool.end());
