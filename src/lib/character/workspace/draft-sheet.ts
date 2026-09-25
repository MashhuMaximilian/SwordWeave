import { effectivePrimitiveLinks } from "./effective-primitives";
import { applyConditionOverrides, runtimeConditionModifiers } from "@/lib/character/condition-overrides";
import { activeRestrictions, occurrenceEnabled } from "@/lib/character/consequences/types";
import { effectiveAvailability, instanceSupplyPaths } from "./model";
import { readWorkspace } from "./read";
import type { WorkspaceGraph } from "./model";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { characters, characterConsequences } from "@/db/schema";
import { aggregateCharacterSheet, type CharacterSheetInput } from "@/lib/engine/sheet";

/** Uses the same materialized membership rows and two-pass condition evaluation
 * as the sheet page. It intentionally bypasses the live resolver cache. */
export async function readDraftSheet(characterId: string, currentGraph?: WorkspaceGraph) {
  const row = await db.query.characters.findFirst({
    where: eq(characters.id, characterId),
    with: {
      primitiveLinks: { with: { primitive: true } },
      capabilityLinks: { with: { capability: true } },
      itemLinks: { with: { item: true } },
    },
  });
  if (!row) throw new Error("Character not found.");
  const [graph, conditionRows, pinnedLinks] = await Promise.all([
    currentGraph ?? readWorkspace(characterId),
    db.select().from(characterConsequences).where(eq(characterConsequences.characterId, characterId)),
    effectivePrimitiveLinks(row.primitiveLinks),
  ]);
  const occurrences = conditionRows.filter(condition => !condition.deletedAt).map(condition => condition.occurrence);
  const restrictions = activeRestrictions(occurrences);
  const input: CharacterSheetInput = {
    ...row,
    practiceSlices: row.practiceSlices as CharacterSheetInput["practiceSlices"],
    primitiveLinks: pinnedLinks.map(link => {
      const primitive = link.primitive;
      return {
        ...link,
        primitive: { ...primitive, hardModifiers:
          primitive.consequenceBehavior || !effectiveAvailability(`primitive:${link.primitiveId}`, instanceSupplyPaths(graph, link), restrictions).available
            ? [] : applyConditionOverrides(primitive.hardModifiers ?? [], occurrences, "primitive", String(link.primitiveId)),
        },
      };
    }),
    capabilityLinks: row.capabilityLinks,
    itemLinks: row.itemLinks,
    runtimeConditions: occurrences.filter(condition => condition.source === "custom" && occurrenceEnabled(condition)).map(condition => ({
      title: condition.title, active: true, modifiers: runtimeConditionModifiers(condition),
    })),
  };
  const base = aggregateCharacterSheet(input);
  return aggregateCharacterSheet({ ...input, conditionContext: { character: {
    vitality: row.currentVitality ?? base.vitality.max,
    vitalityMax: base.vitality.max,
    saveDc: base.saveDCs.find(s => s.attribute === (row.attrProficient ?? "PHYSICAL"))?.dc ?? 5,
    blockValue: base.behaviorVariables.find(b => b.key === "blockvalue")?.value ?? 0,
    attributes: base.attributes,
    practices: Object.fromEntries(base.practices.map(p => [p.practice, p.total])) as never,
    proficiencies: new Set(base.practices.filter(p => p.attribute === (row.attrProficient ?? "PHYSICAL")).map(p => p.practice)),
    flags: new Set(), custom: {},
  } } });
}
