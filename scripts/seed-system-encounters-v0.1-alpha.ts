/**
 * 30 public System preparation examples, with immutable creature version pins.
 * Default invocation is read-only. Run it once without --apply before applying.
 * Stable UUIDs, an all-or-nothing transaction and exact prior-content checks
 * preserve user content and make unchanged reruns write nothing.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, pool, withDatabaseTransaction } from "@/db/client";
import { encounters, encounterEntries, encounterRuns, monsters, monsterVersions, collections, collectionEntries } from "@/db/schema";
import { encounterDefinitionSchema, appraiseEncounter, type EncounterDefinition, type CreatureSummary } from "@/lib/encounters/model";
import { pinSummary, getEncounter } from "@/lib/encounters/service";
import { listEncounterDirectory } from "@/lib/encounters/directory";
import { assertMonsterAudience } from "@/lib/monsters/visibility";
import type { EntityKey } from "@/lib/character/workspace/model";
import type { PinnedDefinition } from "@/lib/monsters/service";
import { systemEncounters, systemEncounterNote } from "@/lib/encounters/catalogue/system-encounters";

const owner = "system:encounters-v0.1-alpha";
const bestiaryOwner = "system:bestiary-2026-10";
const stable = (key: string) => {
  const h = createHash("sha256").update(`${owner}:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const collectionId = stable("collection:encounter-starters");
const collectionName = "Encounter starters · v0.1 alpha";
const canonical = (value: EncounterDefinition) => JSON.stringify({
  ...encounterDefinitionSchema.parse(value),
  entries: [...value.entries].sort((a, b) => `${a.templateId}:${a.version}`.localeCompare(`${b.templateId}:${b.version}`)),
});
type Prepared = {
  key: string;
  environment: string;
  id: string;
  definition: EncounterDefinition;
  pins: { templateId: string; versionId: string; version: number; quantity: number }[];
  summaries: CreatureSummary[];
  appraisal: ReturnType<typeof appraiseEncounter>;
};
async function matchesPrior(prepared: Prepared, lock = false) {
  const query = db.select().from(encounters).where(eq(encounters.id, prepared.id));
  const [prior] = await (lock ? query.for("update") : query);
  if (!prior) return false;
  const pins = await db.select().from(encounterEntries).where(eq(encounterEntries.encounterId, prepared.id));
  const definition = { ...prior.definition, visibility: prior.visibility, entries: pins.map(p => ({ templateId: p.templateId, version: p.version, quantity: p.quantity })) };
  const samePins = pins.length === prepared.pins.length && prepared.pins.every(p => pins.some(existing => existing.templateId === p.templateId && existing.versionId === p.versionId && existing.version === p.version && existing.quantity === p.quantity));
  if (prior.ownerId !== owner || prior.name !== prepared.definition.name || prior.visibility !== "PUBLIC" || canonical(definition) !== canonical(prepared.definition) || !samePins) {
    throw new Error(`Existing seed differs: ${prepared.definition.name}. Review explicitly; no record will be overwritten.`);
  }
  return true;
}
async function main() {
  if (systemEncounters.length !== 30 || new Set(systemEncounters.map(r => r.key)).size !== 30 || new Set(systemEncounters.map(r => r.name)).size !== 30)
    throw new Error("Manifest must contain 30 distinct keys and names.");
  const environments = new Set(systemEncounters.map(r => r.environment));
  if (environments.size !== 10) throw new Error("Manifest must span the ten bestiary environments.");
  if ([...environments].some(environment => systemEncounters.filter(recipe => recipe.environment === environment).length !== 3))
    throw new Error("Each environment must have three useful starting scenes.");
  const casts = systemEncounters.map(recipe => JSON.stringify([...recipe.creatures].sort((a, b) => a.name.localeCompare(b.name))));
  if (new Set(casts).size !== 30) throw new Error("Duplicate creature casts in the example manifest.");
  const templates = await db.select({ id: monsters.id, name: monsters.name, visibility: monsters.visibility }).from(monsters).where(eq(monsters.userId, bestiaryOwner));
  const byName = new Map(templates.map(t => [t.name, t]));
  const cache = new Map<string, Awaited<ReturnType<typeof pinSummary>>>();
  const prepared: Prepared[] = [];
  let unchanged = 0;
  for (const recipe of systemEncounters) {
    const pins: Prepared["pins"] = [], summaries: CreatureSummary[] = [];
    for (const entry of recipe.creatures) {
      const template = byName.get(entry.name);
      if (!template || template.visibility !== "PUBLIC") throw new Error(`Missing public System template: ${entry.name}`);
      const key = `${template.id}:${entry.version}`;
      let pin = cache.get(key);
      if (!pin) {
        // Resolve as an anonymous reader: private dependencies must not pass.
        pin = await pinSummary(null, template.id, entry.version);
        const definition = pin.pin.definition as PinnedDefinition;
        await assertMonsterAudience((definition.componentPins ?? []).map(p => `${p.kind}:${p.id}` as EntityKey), owner, "PUBLIC");
        if (!Number.isSafeInteger(pin.summary.maximum) || pin.summary.maximum < 1 || !Number.isSafeInteger(pin.summary.itemBu) || pin.summary.itemBu < 0)
          throw new Error(`Invalid resolved creature: ${entry.name}`);
        cache.set(key, pin);
      }
      pins.push({ templateId: template.id, versionId: pin.pin.id, version: pin.pin.version, quantity: entry.quantity });
      summaries.push(pin.summary);
    }
    const definition = encounterDefinitionSchema.parse({
      name: recipe.name, visibility: "PUBLIC", note: systemEncounterNote(recipe),
      partyBu: recipe.partyBu, partyItemBu: recipe.partyItemBu, partySize: recipe.partySize,
      budgetSource: "manual", characterIds: [], entries: pins.map(p => ({ templateId: p.templateId, version: p.version, quantity: p.quantity })),
    });
    const appraisal = appraiseEncounter(definition, summaries);
    if (appraisal.missing || !Number.isSafeInteger(appraisal.enemyBu) || !Number.isSafeInteger(appraisal.enemyItemBu)) throw new Error(`Invalid appraisal: ${recipe.name}`);
    const row = { id: stable(recipe.key), key: recipe.key, environment: recipe.environment, definition, pins, summaries, appraisal };
    if (await matchesPrior(row)) unchanged++;
    prepared.push(row);
    console.log(`Validated ${recipe.name}: ${appraisal.count} creatures; ${appraisal.enemyBu} creature BU + ${appraisal.enemyItemBu} Item BU.`);
  }
  const [priorCollection] = await db.select().from(collections).where(eq(collections.id, collectionId));
  if (priorCollection && (priorCollection.ownerId !== owner || priorCollection.name !== collectionName || priorCollection.visibility !== "PUBLIC"))
    throw new Error("Seed collection differs; review explicitly instead of overwriting it.");
  mkdirSync(".local-plans/public-encounters", { recursive: true });
  writeFileSync(".local-plans/public-encounters/audit-v0.1-alpha.json", JSON.stringify({ owner, collectionId, encounters: prepared.map(p => ({ id: p.id, key: p.key, name: p.definition.name, environment: p.environment, pins: p.pins, appraisal: p.appraisal })) }, null, 2));
  if (!process.argv.includes("--apply")) {
    console.log(`DRY RUN: all 30 preparations passed schema, public version/dependency, resolved Vitality, separate BU and existing-record checks. ${prepared.length - unchanged} new, ${unchanged} unchanged. No writes.`);
    return;
  }
  let inserted = 0, membershipAdded = 0;
  await withDatabaseTransaction(async () => {
    // Serialize concurrent reruns of this seed without locking unrelated content.
    await db.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${owner},0))`);
    const [collection] = await db.select().from(collections).where(eq(collections.id, collectionId)).for("update");
    if (collection && (collection.ownerId !== owner || collection.name !== collectionName || collection.visibility !== "PUBLIC")) throw new Error("Seed collection changed during validation.");
    if (!collection) await db.insert(collections).values({ id: collectionId, ownerId: owner, name: collectionName, visibility: "PUBLIC" });
    for (const row of prepared) {
      for (const entry of row.pins) {
        const [template] = await db.select({ id: monsters.id }).from(monsters).where(and(eq(monsters.id, entry.templateId), eq(monsters.userId, bestiaryOwner), eq(monsters.visibility, "PUBLIC"))).for("share");
        if (!template) throw new Error(`${row.definition.name}: template audience changed during validation.`);
        const [version] = await db.select({ id: monsterVersions.id }).from(monsterVersions).where(and(eq(monsterVersions.id, entry.versionId), eq(monsterVersions.monsterId, entry.templateId), eq(monsterVersions.version, entry.version)));
        if (!version) throw new Error(`${row.definition.name}: immutable version pin unavailable.`);
        await assertMonsterAudience((cache.get(`${entry.templateId}:${entry.version}`)!.pin.definition.componentPins ?? []).map(p => `${p.kind}:${p.id}` as EntityKey), owner, "PUBLIC");
      }
      if (!(await matchesPrior(row, true))) {
        const { entries: _, ...compact } = row.definition;
        await db.insert(encounters).values({ id: row.id, ownerId: owner, name: row.definition.name, visibility: "PUBLIC", definition: compact });
        await db.insert(encounterEntries).values(row.pins.map(p => ({ id: stable(`entry:${row.key}:${p.templateId}:${p.version}`), encounterId: row.id, ...p })));
        inserted++;
      }
      const added = await db.insert(collectionEntries).values({ collectionId, targetType: "ENCOUNTER", targetId: row.id }).onConflictDoNothing().returning({ id: collectionEntries.id });
      membershipAdded += added.length;
    }
    // Read the new preparations through the same anonymous services as the public page.
    const directory = await listEncounterDirectory(null, { ids: prepared.map(p => p.id), limit: 100 });
    if (directory.length !== 30 || directory.some(row => row.isOwner || row.unavailable || row.authorDisplayName !== "System")) throw new Error("Anonymous public directory audit failed; transaction will roll back.");
    for (const row of prepared) {
      const readable = await getEncounter(null, row.id);
      if (readable.isOwner || readable.definition.characterIds.length || readable.runs.length || readable.appraisal.missing || readable.creatures.length !== row.pins.length || readable.appraisal.enemyBu !== row.appraisal.enemyBu || readable.appraisal.enemyItemBu !== row.appraisal.enemyItemBu) throw new Error(`Public preparation read failed: ${row.definition.name}`);
    }
    const seededRuns = await db.select({ id: encounterRuns.id }).from(encounterRuns).where(inArray(encounterRuns.encounterId, prepared.map(p => p.id)));
    if (inserted === 30 && seededRuns.length) throw new Error("Fresh examples unexpectedly have live runs.");
  });
  console.log(`APPLIED: ${inserted} new, ${30 - inserted} unchanged; ${membershipAdded} collection memberships added. All 30 anonymously readable, with resolved public version pins. No runs/play copies created.`);
  console.log(`Public collection: https://www.swordweave.quest/collections/${collectionId}`);
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Encounter seed failed."); process.exitCode = 1; }).finally(() => pool.end());
