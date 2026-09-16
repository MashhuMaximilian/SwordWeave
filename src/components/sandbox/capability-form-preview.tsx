"use client";

// Live preview for the capability being composed in CapabilityForm.

import { computeTransitiveBu } from "@/lib/engine/transitive-bu";
import { LiveRecipeCard, LivePrimitiveRules, LiveEffectRules, LiveMechanicalSummary, type LivePrimitive, type LiveEffect } from "./live-recipe-card";

export type CapabilityFormState = {
  name: string;
  type: string;
  sourceType: string;
  verboseDescription: string;
  sourceOrigin: string;
  tags: string;
  isPublic: boolean;
  // Phase 8: per-entity iconography
  iconSource: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string;
};

export type CapabilitySlot = {
  primitiveId: number;
  role: string;
  quantity: number;
  sortOrder: number;
  slotLabel: string | null;
  /**
   * Per-slot notes from the source row. Optional; the form carries them
   * so a "save with no edits" round-trip computes the same content hash
   * as the source's stored hash. Same pattern as EffectFormSlot.
   */
  notes?: string | undefined;
  /**
   * Phase 7 Q-M-UX: per-slot Mirrored flag. Drives the BU debt at
   * template/character-creation time but does NOT change the capability's
   * own BU cost.
   */
  isMirrored: boolean;
  primitive: LivePrimitive;
};

/** Effect summary used by the preview — name + narrative description. */
export type CapabilityEffectRef = LiveEffect;

export function CapabilityFormPreview({ form, slots, effects = [] }: {
  form: CapabilityFormState; slots: CapabilitySlot[]; effects?: CapabilityEffectRef[];
}) {
  const allSlots = [...slots, ...effects.flatMap(effect => effect.primitiveLinks ?? [])];
  const completeCost = effects.every(effect => effect.primitiveLinks !== undefined);
  const { transitiveBu: totalBu } = computeTransitiveBu({ primitiveLinks: slots, effectLinks: effects.map(effect => ({effectId: effect.id, ...(effect.primitiveLinks ? {primitiveLinks: effect.primitiveLinks} : {})})) });
  const dedicated = ([
    ["VERB", "Verb tier"],
    ["DOMAIN", "Domain"],
    ["RANGE", "Range"],
    ["OUTPUT", "Output die"],
  ] as const).map(([role, label]) => ({role, label, slots: slots.filter(slot => slot.role === role || (role === "VERB" && slot.primitive.category === "VERB_TIER") || (role === "DOMAIN" && slot.primitive.category === "DOMAIN") || (role === "RANGE" && slot.primitive.category === "RANGE") || (role === "OUTPUT" && ["INTENSITY_DICE", "OUTPUT"].includes(slot.primitive.category)))}));
  const dedicatedIds = new Set(dedicated.flatMap(group => group.slots.map(slot => slot.primitiveId)));
  const regularSlots = slots.filter(slot => !dedicatedIds.has(slot.primitiveId));
  return <LiveRecipeCard name={form.name} kind="Capability" icon={form} description={form.verboseDescription} sourceOrigin={form.sourceOrigin} tags={form.tags} badges={<>
    <span data-tone="violet">{form.type}</span><span>{form.sourceType}</span><span data-tone="teal">{form.isPublic ? "Public" : "Private draft"}</span><span>{totalBu} BU{completeCost ? "" : " · direct rules"}</span>
  </>}>
    <LiveMechanicalSummary slots={allSlots} />
    <section className="v12-live-composition grid gap-2 sm:grid-cols-2" aria-label="Capability foundation slots">
      {dedicated.map(group => <div className="rounded-md border border-border bg-background p-2" key={group.role}><h3 className="v12-kicker">{group.label}</h3>{group.slots.length ? <LivePrimitiveRules slots={group.slots} /> : <p className="v12-live-note">Open</p>}</div>)}
    </section>
    <details className="v12-live-composition" open><summary>Composition · {allSlots.length} primitive rules{completeCost ? "" : " loaded"}</summary>
      <LivePrimitiveRules slots={regularSlots} /><LiveEffectRules effects={effects} />
      {!allSlots.length && !effects.length ? <p className="v12-live-note">Add primitives or effects from the Library to compose this capability.</p> : null}
    </details>
  </LiveRecipeCard>;
}
