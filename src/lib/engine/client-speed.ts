/** Reconcile server speed with client-only condition and toggle state. */
export function buildClientSpeedByType(
  serverSpeedByType: Readonly<Record<string, number>>,
  resolver: { byTarget: Readonly<Record<string, ReadonlyArray<{
    op: string;
    value: number;
    inhibited: boolean;
    conditionActive: boolean;
    primitiveCategory: string;
  }>>> } | null,
): Readonly<Record<string, number>> {
  if (!resolver) return serverSpeedByType;
  const out: Record<string, number> = {};
  const locomotionToResolverKey: Record<string, string> = {
    WALKING_SPEED: "speed.walking_speed",
    CLIMBING_SPEED: "speed.climbing_speed",
    SWIMMING_SPEED: "speed.swimming_speed",
    FLYING_SPEED: "speed.flying_speed",
    BURROWING_SPEED: "speed.burrowing_speed",
  };
  for (const [key, serverValue] of Object.entries(serverSpeedByType)) {
    const resolverKey = locomotionToResolverKey[key];
    if (!resolverKey) {
      out[key] = serverValue;
      continue;
    }
    let adjustment = 0;
    for (const contribution of resolver.byTarget[resolverKey] ?? []) {
      if (!contribution.conditionActive || !["add", "subtract"].includes(contribution.op)) continue;
      const signedValue = contribution.op === "subtract" ? -contribution.value : contribution.value;
      // Published primitives are already present in the server sheet. Only
      // local runtime conditions need adding; an inhibited published source
      // needs its server-side contribution removed.
      if (contribution.primitiveCategory === "RUNTIME_CONDITION") {
        if (!contribution.inhibited) adjustment += signedValue;
      } else if (contribution.inhibited) {
        adjustment -= signedValue;
      }
    }
    out[key] = Math.max(0, serverValue + adjustment);
  }
  return out;
}
