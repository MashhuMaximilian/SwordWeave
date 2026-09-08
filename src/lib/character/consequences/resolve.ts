import type { ResolvedPrimitiveSlot } from "@/lib/engine/resolve-modifiers";
import {
  applyConditionOverrides,
  runtimeConditionModifiers,
} from "../condition-overrides";
import {
  effectiveAvailability,
  instanceSupplyPaths,
  type WorkspaceGraph,
} from "../workspace/model";
import {
  activeRestrictions,
  occurrenceEnabled,
  type ConsequenceOccurrence,
} from "./types";
export function consequenceAdjustedSlots(
  slots: readonly ResolvedPrimitiveSlot[],
  graph: WorkspaceGraph,
  occurrences: readonly ConsequenceOccurrence[],
): ResolvedPrimitiveSlot[] {
  const restrictions = activeRestrictions(occurrences);
  const base = slots.map((slot) => {
    const key = `primitive:${slot.primitiveId}` as const;
    const node = graph.nodes.find((n) => n.key === key);
    const paths = instanceSupplyPaths(graph, slot);
    return {
      ...slot,
      hardModifiers: node?.data["consequenceBehavior"]
        ? []
        : applyConditionOverrides(
            slot.hardModifiers,
            occurrences,
            "primitive",
            String(slot.primitiveId),
          ),
      isToggledOff:
        !!slot.isToggledOff ||
        !effectiveAvailability(key, paths, restrictions).available,
    };
  });
  const runtime = occurrences
    .filter((c) => c.source === "custom" && occurrenceEnabled(c))
    .map((c, index): ResolvedPrimitiveSlot => ({
      primitiveId:
        c.applicationId && c.sourceEntityType === "primitive"
          ? Number(c.sourceEntityId)
          : -100000 - index,
      name: c.title,
      category: "RUNTIME_CONDITION",
      hardModifiers: runtimeConditionModifiers(c),
      isMirrored: false,
      isMirrorable: false,
      mirrorVector: null,
      originHeritageId: null,
      originCapabilityId: null,
      originEffectId: null,
      isToggledOff: false,
    }));
  return [...base, ...runtime];
}
