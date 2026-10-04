/** Count purchased vocabulary once even when several compositions grant it.
 * Item-only grants remain in the separate equipment budget. */
export function rosterComposition(character: {
  primitiveLinks: ReadonlyArray<{
    primitiveId: number;
    isMirrored: boolean | null;
    source?: string;
    directSource?: string | null;
  }>;
  capabilityLinks: ReadonlyArray<{ capabilityId: string }>;
}) {
  const purchased = character.primitiveLinks.filter(link =>
    link.source !== "ITEM" || Boolean(link.directSource));
  return {
    primitives: new Set(purchased.filter(link => !link.isMirrored).map(link => link.primitiveId)).size,
    drawbacks: new Set(purchased.filter(link => link.isMirrored).map(link => link.primitiveId)).size,
    capabilities: new Set(character.capabilityLinks.map(link => link.capabilityId)).size,
  };
}
