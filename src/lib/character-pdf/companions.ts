import { listOwnerCharacterCompanionCopies } from "@/lib/character/companions";
import { evaluateCondition } from "@/lib/engine/condition-evaluator";
import { monsterCopyDefinition } from "@/lib/monsters/copy-definition";
import { monsterArtwork } from "@/lib/monsters/art";
import { resolveMonsterComposition } from "@/lib/monsters/composition";
import { resolveMonsterPlay } from "@/lib/monsters/play";
import type { MonsterSlot } from "@/lib/monsters/resolve";
import type { PinnedDefinition } from "@/lib/monsters/service";
import type { PlayOverrides } from "@/lib/play-state/model";
import { mechanicalDescriptionFromModifiers } from "@/lib/primitives/mechanical-rule";
import { mirrorConsequence } from "@/lib/character/mirror-suggestions";
import type { CharacterPdfCompanion } from "./types";

type OwnedCopy = Awaited<ReturnType<typeof listOwnerCharacterCompanionCopies>>[number]["copy"];

/** Render the same pinned definition and saved state as the monster play sheet. */
export function createCharacterPdfCompanion(copy: Pick<OwnedCopy, "id" | "name" | "templateId" | "templateVersionId" | "templateVersion" | "currentVitality">,
  definition: PinnedDefinition, slots: MonsterSlot[], overrides: PlayOverrides): CharacterPdfCompanion {
  const { sheet, occurrences, context } = resolveMonsterPlay(definition, slots, overrides, copy.currentVitality);
  const totals = sheet.resolved.totals;
  const components = definition.references.flatMap(reference => {
    const kind = reference.kind.toLowerCase();
    if (kind === "primitive") return [];
    const pin = definition.componentPins?.find(candidate => candidate.kind === kind && candidate.id === reference.id
      && candidate.versionId === reference.versionId);
    const key = `${kind}:${reference.id}`;
    const name = pin?.name ?? slots.find(slot => slot.supplyNames?.[key])?.supplyNames?.[key];
    if (!name) return [];
    const prose = pin?.fallback?.["description"] ?? pin?.fallback?.["narrativeDescription"] ?? pin?.fallback?.["verboseDescription"];
    return [{ name, kind, quantity: reference.quantity, description: typeof prose === "string" ? prose : "" }];
  });
  const rules = slots.map(slot => {
    const rule = slot.mechanicalDescription || mechanicalDescriptionFromModifiers(slot.hardModifiers);
    const original = slot.isMirrored && rule ? `Original rule: ${rule}` : rule;
    const description = slot.isMirrored ? [mirrorConsequence({ id: slot.primitiveId, buCost: slot.buCost,
      mirrorVector: slot.mirrorVector, hardModifiers: slot.hardModifiers }), original].filter(Boolean).join("\n\n") : original;
    const source = [...new Set((slot.supplyKeys ?? []).flatMap(path => path.slice(0, -1)))]
      .map(key => slot.supplyNames?.[key]).filter(Boolean).join(" / ");
    return { name: slot.name, quantity: slot.quantity, mirrored: slot.isMirrored, description, source };
  });
  const consequences = occurrences.filter(occurrence => occurrence.status !== "resolved" &&
    (occurrence.manualOverride ?? (occurrence.source === "sheet-auto"
      ? evaluateCondition(occurrence.modifiers[0]?.condition as never, context) : occurrence.active)))
    .map(occurrence => ({
      title: occurrence.title, description: occurrence.description,
      effect: [mechanicalDescriptionFromModifiers(occurrence.modifiers),
        ...(occurrence.restrictions ?? []).map(restriction => restriction.reason)].filter(Boolean).join("\n\n"),
      recovery: occurrence.recovery ?? "",
      duration: { manual: "Manual resolution", short_rest: "Until short rest", long_rest: "Until long rest" }[occurrence.durationTier],
    }));
  const portraitUrl = monsterArtwork({ ...definition, id: copy.templateId ?? undefined });
  return { name: copy.name, templateName: definition.name, templateVersion: copy.templateVersion,
    ...(portraitUrl ? { portraitKey: copy.templateVersionId ?? copy.id, portraitUrl,
      ...(definition.portraitFrame ? { portraitFrame: definition.portraitFrame } : {}) } : {}),
    concept: definition.concept, size: definition.size, attributes: sheet.attributes,
    vitality: { current: sheet.currentVitality, max: sheet.maximum }, speed: totals["speed"] ?? 0,
    proficiencyBonus: totals["proficiency_bonus"] ?? sheet.pb,
    attackBonus: totals["attack_bonus"] ?? 0, saveDc: totals["save_dc"] ?? 0,
    saves: { physical: totals["physical_saving_throw"] ?? 0,
      mental: totals["mental_saving_throw"] ?? 0, magical: totals["magical_saving_throw"] ?? 0 },
    practices: sheet.practices.map(practice => ({ name: practice.practice, total: practice.total,
      training: practice.attribute.toLowerCase() === definition.proficientAttribute ? 1 : 0 })),
    components, rules, consequences };
}

/** The ownership-scoped reader selects saved overrides without creating a play state. */
export async function loadCharacterPdfCompanions(characterId: string, clerkUserId: string): Promise<CharacterPdfCompanion[]> {
  const copies = await listOwnerCharacterCompanionCopies(characterId, clerkUserId);
  const pinned = new Map<string, { definition: PinnedDefinition; slots: MonsterSlot[] }>();
  const companions: CharacterPdfCompanion[] = [];
  for (const { copy, overrides } of copies) {
    const key = copy.templateVersionId ?? copy.id;
    let material = pinned.get(key);
    if (!material) {
      const definition = await monsterCopyDefinition(copy);
      const slots = definition.resolvedSlots ?? await resolveMonsterComposition(definition, clerkUserId, undefined, {
        trustedPinnedComposition: !!copy.templateVersionId && Array.isArray(definition.componentPins),
      });
      material = { definition, slots };
      pinned.set(key, material);
    }
    companions.push(createCharacterPdfCompanion(copy, material.definition, material.slots, overrides ?? {}));
  }
  return companions;
}
