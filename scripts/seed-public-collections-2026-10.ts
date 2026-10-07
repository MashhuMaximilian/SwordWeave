/** Curated public system shelves. Dry run by default; --apply adds missing rows/memberships. */
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db, pool, withDatabaseTransaction } from "@/db/client";
import { collections, collectionEntries } from "@/db/schema/collections";
import { collectionTargetTables, visibleEntries } from "@/lib/collections/service";
import { visibilityCondition } from "@/lib/publishing/library-query";

const owner = "system:public-collections-2026-10";
const themes = [
  { key: "first-expedition", name: "First expedition", picks: ["Traveler's Cloak", "Harbor Rope Hand", "Carry Capacity Augment +10", "Climbing Speed +10", "Ordinary Lock Familiarity", "Rehearsed Route Walking +5", "Canopy Safety Belt", "Doorbrace Shield"] },
  { key: "urban-intrigue", name: "Urban intrigue", picks: ["Dry Record Roll", "Deliberate Disguise", "Agreement Recorder", "Beast Signal Keeper", "Lantern Signal Found", "Exact Witness Book", "Hand-Signal Lattice", "Oath Witness", "Doorwatch", "Exact Testimony Record", "Negotiation Witnesses"] },
  { key: "arcane-mechanisms", name: "Arcane mechanisms", picks: ["Circuit Trace", "Field Beacon", "Beaconwright Ring", "Domain of Force", "Domain of Metal", "Fine Mechanism Quieting", "Relay Guard", "Lastwatch Beacon", "Silenced Mechanism"] },
  { key: "wilderness-paths", name: "Wilderness paths", picks: ["Canopy Safety Belt", "Canopy Traverse", "Harbor Rope Hand", "Forestkind", "Marked Trail", "Canopy Footing", "Canopy Shortbow", "Climbing Speed +10", "Resin Trail", "Canopy Wraps"] },
  { key: "sky-and-storm", name: "Sky & storm", picks: ["Airkeeper Orb", "Skyborn", "Held Air", "Domain of Air", "Airshare Cup", "Reef Air Collar", "Domain of Lightning", "Flying Speed +15", "Flying Speed +30"] },
  { key: "flame-and-forge", name: "Flame & forge", picks: ["Lastlight Sash", "Ash-Cooling Veil", "Firewatch Runner", "Ashlung", "Damped Flame", "Neris Cinderthread", "Routefire Lantern", "Domain of Fire", "Ordinary Flame Dampening", "Ordinary Smoke Filtration"] },
  { key: "hidden-worlds", name: "Hidden worlds", picks: ["Echo Locket", "Blind Swordsman", "Echo Duelist", "Blind Stun", "Hollow Echo", "Surface Echo", "Ground Contact Echo (10 ft)", "Substrate Echo (Tremorsense 30ft)", "Tactile Echo (Blindsight 30ft)"] },
  { key: "guardians-and-wards", name: "Guardians & wards", picks: ["Doorbrace Shield", "Aegis Shield", "Ferry Ward", "Guardian", "Bound Passage Guard", "Ferryguard Coat", "Relay Guard", "Road Warden", "Threshold Warden", "Guard Relay", "Bludgeoning Resistance"] },
  { key: "living-echoes", name: "Living echoes", picks: ["Dry Record Roll", "Echo Off the Wall", "Agreement Recorder", "Beast Signal Keeper", "Hollow Echo", "Animal Signal Reading", "Echo Locket", "Hand-Signal Lattice", "Echo Duelist", "Lantern Signal Found", "Bounded Echo Placement", "Ferry Signal Launcher"] },
  { key: "creature-foundations", name: "Creature foundations", picks: ["Mended Vitality", "Attribute Increment +2 Physical", "Attribute Increment +3 Physical", "Carry Capacity Augment +10", "Flying Speed +15", "Climbing Speed +10", "Bludgeoning Resistance", "Substrate Echo (Tremorsense 30ft)"] },
];

function stableId(key: string) {
  const h = createHash("sha256").update(`${owner}:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
type Entry = { targetType: string; targetId: string; name: string };

async function main() {
  // Canonical/system entries only; visibility uses the same gate as collection pages.
  const candidates = (await Promise.all(Object.entries(collectionTargetTables).map(async ([type, table]) => {
    const gate = type === "MONSTER"
      ? sql`e.user_id LIKE 'system:%' AND e.visibility='PUBLIC'`
      : sql`(e.user_id IS NULL OR e.source_origin='SRD' OR e.source_origin LIKE 'system:%') AND ${visibilityCondition(type, sql`e.id`, sql`e.user_id`, undefined, sql`e.is_public`)}`;
    const kind = table === "heritage" ? sql`AND e.kind=${type.replace("_TEMPLATE", "")}` : sql``;
    const result = await db.execute(sql`SELECT ${type} AS "targetType", e.id::text AS "targetId", e.name FROM ${sql.identifier(table)} e WHERE ${gate} ${kind} ORDER BY e.name, e.id`);
    return result.rows as unknown as Entry[];
  }))).flat();
  const plan = themes.map(theme => {
    const entries = theme.picks.map(name => {
      const matches = candidates.filter(entry => entry.name === name && !/^Atelier QA/i.test(entry.name));
      if (matches.length !== 1) throw new Error(`${theme.name}: expected one public system entry named ${name}; found ${matches.length}.`);
      return matches[0]!;
    });
    return { ...theme, id: stableId(theme.key), entries };
  });
  for (const theme of plan) {
    if (theme.entries.length < 4) throw new Error(`${theme.name} has only ${theme.entries.length} public system matches; curate it before applying.`);
    console.log(`${theme.name} (${theme.entries.length} entries)\n${theme.entries.map(entry => `  ${entry.targetType}: ${entry.name}`).join("\n")}`);
  }
  const refs = plan.flatMap(theme => theme.entries);
  const visible = new Set((await visibleEntries(refs, null)).map(entry => `${entry.targetType}:${entry.targetId}`));
  if (refs.some(entry => !visible.has(`${entry.targetType}:${entry.targetId}`))) throw new Error("A selected entry is not publicly readable.");
  if (!process.argv.includes("--apply")) { console.log("DRY RUN: no writes. Run with --apply to create the ten public system collections."); return; }
  await withDatabaseTransaction(async () => {
    for (const theme of plan) {
      await db.insert(collections).values({ id: theme.id, ownerId: owner, name: theme.name, visibility: "PUBLIC" }).onConflictDoNothing();
      await db.insert(collectionEntries).values(theme.entries.map(entry => ({ collectionId: theme.id, targetType: entry.targetType, targetId: entry.targetId }))).onConflictDoNothing();
    }
  });
  const result = await db.execute(sql`SELECT c.id, c.name, c.visibility, count(ce.id)::int AS entries FROM collections c LEFT JOIN collection_entries ce ON ce.collection_id=c.id WHERE c.owner_id=${owner} GROUP BY c.id ORDER BY c.name`);
  console.log("Public system collections:", result.rows);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
