import type { HardModifier } from "@/types/swordweave";
import type { EntityKind } from "@/lib/character/workspace/model";
import type { MonsterComponentPin } from "./composition";
import { monsterPreviewInput } from "./draft";
import { monsterDefinitionSchema, type MonsterDefinition, type MonsterReference } from "./model";
import { resolveMonster, type MonsterSlot } from "./resolve";

/** Supplied only from the visibility-filtered Atelier catalog. This adapter
 * never fetches a missing dependency or grants permission to save a draft. */
export interface GuestMonsterCatalog {
  primitives: readonly object[];
  effects: readonly object[];
  capabilities: readonly object[];
  items: readonly object[];
  heritage?: readonly object[];
}
type Row = Record<string, unknown>;
const row = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const fields = { primitive: "primitives", effect: "effects", capability: "capabilities", heritage: "heritage", item: "items" } as const;
const kinds = Object.keys(fields) as EntityKind[];
const quantity = (value: unknown) => {
  const amount = value ?? 1;
  if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount < 1) throw new Error("Component quantity must be a positive whole number.");
  return amount;
};

export function resolveGuestMonster(value: MonsterDefinition, catalog: GuestMonsterCatalog) {
  const definition = monsterDefinitionSchema.parse(monsterPreviewInput(value));
  const lookup = new Map<string, Row>();
  for (const kind of kinds) for (const entry of catalog[fields[kind]] ?? []) {
    const data = row(entry);
    if (data["id"] !== undefined) lookup.set(`${kind}:${data["id"]}`, data);
  }
  const slots: MonsterSlot[] = [];
  const captured = new Map<string, MonsterComponentPin>();
  let steps = 0;

  function walk(reference: MonsterReference, ancestors: string[] = [], names: Record<string, string> = {}, item = false, versions: string[] = []) {
    if (++steps > 50_000 || captured.size > 5_000) throw new Error("This preview has too many connected components.");
    const kind = reference.kind.toLowerCase() as EntityKind;
    const key = `${kind}:${reference.id}`;
    if (ancestors.includes(key)) throw new Error("Cyclic monster composition.");
    const data = lookup.get(key);
    if (!data) throw new Error("A component is unavailable in the public catalog. Choose an available public component.");
    // A guest calculation must not label a live definition as an old pin.
    const availableVersion = typeof data["versionId"] === "string" ? data["versionId"] : null;
    if (reference.versionId && reference.versionId !== availableVersion) throw new Error("This component version is unavailable in the public catalog. Choose its current public version.");
    const name = String(data["name"] ?? reference.id);
    const chain = [...ancestors, key];
    const supplyNames = { ...names, [key]: name };
    const versionKey = `${key}:${availableVersion ?? "public-current"}`;
    const versionChain = [...versions, versionKey];
    const isItem = item || kind === "item";
    const links: MonsterComponentPin["links"] = [];
    if (kind !== "primitive") for (const childKind of kinds) {
      const members = data[`${childKind}Links`];
      for (const entry of Array.isArray(members) ? members : []) {
        const member = row(entry);
        const id = member[`${childKind}Id`] ?? row(member[childKind])["id"];
        if (id === undefined || id === null) continue;
        // Only canonical catalog rows supply rules. Inline relation fragments
        // can be shallow, stale or stripped by the visibility boundary.
        links.push({ kind: childKind, id: String(id), data: { quantity: quantity(member["quantity"]), isMirrored: member["isMirrored"] === true } });
      }
    }
    captured.set(versionKey, { key: versionKey, kind, id: reference.id, name, versionId: availableVersion, links,
      fallback: Object.fromEntries(["name", "description", "narrativeRule", "mechanicalOutputText", "category", "buCost", "mirrorBuCredit", "hardModifiers", "isMirrorable", "mirrorVector", "consequenceBehavior"].filter(field => data[field] !== undefined).map(field => [field, data[field]])) });
    if (kind === "primitive") {
      if (reference.isMirrored && data["isMirrorable"] === false) throw new Error("This primitive cannot be mirrored.");
      const dependencyKey = `${key}:${availableVersion ?? "public-current"}:${reference.isMirrored}:${isItem}`;
      const existing = slots.find(slot => slot.dependencyKey === dependencyKey);
      if (existing) {
        existing.quantity = Math.max(existing.quantity, reference.quantity);
        existing.supplyKeys?.push(chain);
        existing.supplyNames = { ...existing.supplyNames, ...supplyNames };
        return;
      }
      slots.push({ primitiveId: Number(reference.id), name, category: String(data["category"] ?? ""),
        mechanicalDescription: String(data["mechanicalOutputText"] || data["narrativeRule"] || name),
        hardModifiers: Array.isArray(data["hardModifiers"]) ? data["hardModifiers"] as HardModifier[] : [],
        buCost: Number(data["buCost"] ?? 0), ...(typeof data["mirrorBuCredit"] === "number" ? { mirrorBuCredit: data["mirrorBuCredit"] } : {}),
        isMirrored: reference.isMirrored, isMirrorable: data["isMirrorable"] !== false,
        mirrorVector: typeof data["mirrorVector"] === "string" ? data["mirrorVector"] : null,
        originHeritageId: chain.find(source => source.startsWith("heritage:"))?.slice(9) ?? null,
        originCapabilityId: chain.find(source => source.startsWith("capability:"))?.slice(11) ?? null,
        originEffectId: chain.find(source => source.startsWith("effect:"))?.slice(7) ?? null,
        originItemId: chain.find(source => source.startsWith("item:"))?.slice(5) ?? null,
        quantity: reference.quantity, dependencyKey, item: isItem, supplyKeys: [chain], supplyNames, dependencyVersions: versionChain,
        consequenceBehavior: data["consequenceBehavior"] as MonsterSlot["consequenceBehavior"] ?? null });
      return;
    }
    for (const link of links) {
      const count = quantity(link.data["quantity"]) * reference.quantity;
      walk({ kind: link.kind.toUpperCase() as MonsterReference["kind"], id: String(link.id), quantity: quantity(count),
        isMirrored: reference.isMirrored !== (link.data["isMirrored"] === true), versionId: null }, chain, supplyNames, isItem, versionChain);
    }
  }
  for (const reference of definition.references) walk(reference);
  const sheet = resolveMonster(definition, slots);
  if (sheet.spent > sheet.availableBudget) throw new Error("Composition exceeds the chosen BU budget. Weakness credit extends the budget; items use their separate pool.");
  return { definition: { ...definition, componentPins: [...captured.values()] }, sheet, slots };
}

export function shuffleGuestMonster(value: MonsterDefinition, catalog: GuestMonsterCatalog, locks: readonly string[] = [], options: { shuffleKinds?: readonly ("PRIMITIVE" | "CAPABILITY")[]; shuffleBudget?: number; random?: () => number } = {}) {
  const original = monsterDefinitionSchema.parse(monsterPreviewInput(value));
  const selectedKinds = options.shuffleKinds ?? ["PRIMITIVE", "CAPABILITY"];
  if (!selectedKinds.length || selectedKinds.some(kind => kind !== "PRIMITIVE" && kind !== "CAPABILITY")) throw new Error("Choose primitives, capabilities, or both to shuffle.");
  const references = original.references.filter((ref, index) => ref.isMirrored || !selectedKinds.includes(ref.kind as "PRIMITIVE" | "CAPABILITY") || locks.includes(`reference:${index}`));
  let prepared = resolveGuestMonster({ ...original, references }, catalog);
  const budget = options.shuffleBudget ?? prepared.sheet.availableBudget;
  if (!Number.isSafeInteger(budget) || budget < 1 || budget > prepared.sheet.availableBudget) throw new Error("Choose a shuffle budget within the creature's available budget.");
  if (prepared.sheet.spent > budget) throw new Error("Kept components exceed this shuffle budget. Increase it or unlock some choices.");
  const pool = [...new Set(selectedKinds)].flatMap(kind => (kind === "PRIMITIVE" ? catalog.primitives : catalog.capabilities)
    .map(entry => ({ data: row(entry), kind })).filter(({ data }) => typeof data["buCost"] === "number" && data["buCost"] > 0 && data["buCost"] <= budget));
  const random = options.random ?? Math.random;
  for (let index = pool.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [pool[index], pool[other]] = [pool[other]!, pool[index]!];
  }
  let added = 0;
  for (const { data, kind } of pool.slice(0, 18)) {
    const id = String(data["id"]);
    if (references.some(ref => ref.kind === kind && ref.id === id)) continue;
    const candidate = { kind, id, quantity: 1, isMirrored: false, versionId: null };
    try {
      const next = resolveGuestMonster({ ...original, references: [...references, candidate] }, catalog);
      if (next.sheet.spent > budget) continue;
      references.push(candidate); prepared = next; added++;
    } catch { /* Keep invalid/unavailable packages out of a proposed set. */ }
  }
  if (!added) throw new Error("No public components fit these shuffle choices. Try another category or budget.");
  return prepared;
}
