/** Idempotent nested fixtures for visually testing Atelier recipe cards. */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../src/db/client";
import {
  capabilities, capabilityEffects, capabilityPrimitives,
  effects, effectPrimitives,
  heritage, heritageCapabilities, heritagePrimitives,
  itemCapabilities, itemEffects, itemPrimitives, items, primitives,
} from "../src/db/schema";

const ORIGIN = "system:atelier-qa-corpus-2026-09-16";
const IDS = {
  effect: "90000000-0000-4000-8000-000000000001",
  directCapability: "90000000-0000-4000-8000-000000000002",
  composedCapability: "90000000-0000-4000-8000-000000000003",
  item: "90000000-0000-4000-8000-000000000004",
  heritage: "90000000-0000-4000-8000-000000000005",
} as const;

async function main() {
  const available = await db.select({ id: primitives.id, name: primitives.name, category: primitives.category })
    .from(primitives)
    .where(inArray(primitives.name, ["Touch Range", "Minor Die Block", "Domain of Metal", "Verb Access Tier I", "Fast Execution"]));
  const byName = new Map(available.map(row => [row.name, row]));
  const required = (name: string) => {
    const row = byName.get(name);
    if (!row) throw new Error(`Missing canonical primitive: ${name}`);
    return row;
  };
  const touch = required("Touch Range");
  const die = required("Minor Die Block");
  const metal = required("Domain of Metal");
  const verb = required("Verb Access Tier I");
  const fast = required("Fast Execution");

  await db.transaction(async tx => {
    await tx.update(primitives).set({
      category: "INTENSITY_DICE",
      costTier: "Tier 0 — Baseline (0 BU)",
      buCost: 0,
      mechanicalOutputText: "Unlock [1d4] damage or healing output.",
      narrativeRule: "Use a d4 for the baseline damage or healing output available without added BU cost. The parent capability still determines the action, target, source, and delivery rules.",
    }).where(eq(primitives.id, die.id));
    await tx.delete(itemEffects).where(eq(itemEffects.itemId, IDS.item));
    await tx.delete(itemCapabilities).where(eq(itemCapabilities.itemId, IDS.item));
    await tx.delete(itemPrimitives).where(eq(itemPrimitives.itemId, IDS.item));
    await tx.delete(items).where(and(eq(items.id, IDS.item), eq(items.sourceOrigin, ORIGIN)));
    await tx.delete(heritageCapabilities).where(eq(heritageCapabilities.templateId, IDS.heritage));
    await tx.delete(heritagePrimitives).where(eq(heritagePrimitives.templateId, IDS.heritage));
    await tx.delete(heritage).where(and(eq(heritage.id, IDS.heritage), eq(heritage.sourceOrigin, ORIGIN)));
    for (const id of [IDS.directCapability, IDS.composedCapability]) {
      await tx.delete(capabilityEffects).where(eq(capabilityEffects.capabilityId, id));
      await tx.delete(capabilityPrimitives).where(eq(capabilityPrimitives.capabilityId, id));
      await tx.delete(capabilities).where(and(eq(capabilities.id, id), eq(capabilities.sourceOrigin, ORIGIN)));
    }
    await tx.delete(effectPrimitives).where(eq(effectPrimitives.effectId, IDS.effect));
    await tx.delete(effects).where(and(eq(effects.id, IDS.effect), eq(effects.sourceOrigin, ORIGIN)));

    await tx.insert(effects).values({ id: IDS.effect, name: "Atelier QA · Resonant Fracture", narrativeDescription: "**Resonant Fracture** leaves a struck surface ringing with stored force. The next impact releases that pressure as a sharp secondary break.", isPublic: true, sourceOrigin: ORIGIN, tags: ["atelier-qa", "nested", "effect"], iconSource: "GAME_ICONS", iconKey: "lorc/cracked-glass", iconColor: "#d49762" });
    await tx.insert(effectPrimitives).values([
      { effectId: IDS.effect, primitiveId: die.id, sortOrder: 0, targetWho: "target" },
      { effectId: IDS.effect, primitiveId: fast.id, sortOrder: 1, targetWho: "target" },
    ]);

    await tx.insert(capabilities).values([
      { id: IDS.directCapability, name: "Atelier QA · Ferric Hand", type: "ACTIVE", sourceType: "MAGICAL", verboseDescription: "Shape nearby metal by touch with deliberate, visible force.", isPublic: true, sourceOrigin: ORIGIN, tags: ["atelier-qa", "direct-only"], iconSource: "GAME_ICONS", iconKey: "lorc/metal-hand", iconColor: "#66d5d0" },
      { id: IDS.composedCapability, name: "Atelier QA · Bellbreaker Pulse", type: "ACTIVE", sourceType: "PHYSICAL", verboseDescription: "Strike metal so its own resonance carries a delayed breaking pulse through it.", isPublic: true, sourceOrigin: ORIGIN, tags: ["atelier-qa", "nested", "effect"], iconSource: "GAME_ICONS", iconKey: "lorc/ringing-bell", iconColor: "#d5a84e" },
    ]);
    await tx.insert(capabilityPrimitives).values([
      { capabilityId: IDS.directCapability, primitiveId: verb.id, role: "VERB", sortOrder: 0 },
      { capabilityId: IDS.directCapability, primitiveId: metal.id, role: "DOMAIN", sortOrder: 1 },
      { capabilityId: IDS.directCapability, primitiveId: touch.id, role: "RANGE", sortOrder: 2 },
      { capabilityId: IDS.composedCapability, primitiveId: verb.id, role: "VERB", sortOrder: 0 },
      { capabilityId: IDS.composedCapability, primitiveId: metal.id, role: "DOMAIN", sortOrder: 1 },
      { capabilityId: IDS.composedCapability, primitiveId: touch.id, role: "RANGE", sortOrder: 2 },
    ]);
    await tx.insert(capabilityEffects).values({ capabilityId: IDS.composedCapability, effectId: IDS.effect, sortOrder: 0, slotLabel: "Released resonance" });

    await tx.insert(items).values({ id: IDS.item, name: "Atelier QA · Bellmetal Gauntlet", itemType: "ARTIFACT", rarity: "RARE", size: "SMALL", description: "A brass-and-steel gauntlet whose knuckles hum near structural weaknesses.", slotCost: 1, quantity: 1, actsAsFocus: true, isPublic: true, sourceOrigin: ORIGIN, tags: ["atelier-qa", "nested", "item"], iconSource: "GAME_ICONS", iconKey: "lorc/gauntlet", iconColor: "#d5a84e" });
    await tx.insert(itemPrimitives).values({ itemId: IDS.item, primitiveId: metal.id, sortOrder: 0 });
    await tx.insert(itemCapabilities).values({ itemId: IDS.item, capabilityId: IDS.composedCapability, sortOrder: 1 });
    await tx.insert(itemEffects).values({ itemId: IDS.item, effectId: IDS.effect, sortOrder: 2 });

    await tx.insert(heritage).values({ id: IDS.heritage, kind: "MANIFEST", name: "Atelier QA · Bellforged Scion", description: "A body tempered to hear and command the hidden harmonics of worked metal.", suggestedTraits: "- Speaks softly near fragile structures\n- Collects the tones of famous bells", isPublic: true, sourceOrigin: ORIGIN, tags: ["atelier-qa", "nested", "heritage"], iconSource: "GAME_ICONS", iconKey: "lorc/anvil-impact", iconColor: "#d49762" });
    await tx.insert(heritagePrimitives).values([
      { templateId: IDS.heritage, primitiveId: metal.id, sortOrder: 0 },
      { templateId: IDS.heritage, primitiveId: touch.id, sortOrder: 1 },
    ]);
    await tx.insert(heritageCapabilities).values([
      { templateId: IDS.heritage, capabilityId: IDS.directCapability },
      { templateId: IDS.heritage, capabilityId: IDS.composedCapability },
    ]);
  });
  console.log("Seeded Atelier QA · Resonant Fracture, Ferric Hand, Bellbreaker Pulse, Bellmetal Gauntlet, and Bellforged Scion.");
}

main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
