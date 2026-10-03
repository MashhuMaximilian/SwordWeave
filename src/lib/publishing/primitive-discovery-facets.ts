import type { HardModifier } from "@/types/swordweave";

export function primitiveMechanicFacets(value: unknown) {
  const modifiers = Array.isArray(value) ? value.filter((entry): entry is HardModifier => Boolean(entry) && typeof entry === "object" && typeof entry.target === "string") : [];
  return {
    mechanicTargets: [...new Set(modifiers.flatMap(modifier => {
      const metadata = modifier.metadata ?? {};
      const scope = metadata["targetScope"];
      const values = scope && typeof scope === "object" && !Array.isArray(scope)
        ? (scope as Record<string, unknown>)["values"] : [];
      const selected = Array.isArray(values) ? values.filter((entry): entry is string => typeof entry === "string") : [];
      const names = [metadata["behaviorName"], metadata["scopeName"]].filter((entry): entry is string => typeof entry === "string");
      return [modifier.target, ...selected.map(entry => `${modifier.target}.${entry}`), ...names];
    }))],
    recipients: [...new Set(modifiers.map(modifier => String(modifier.metadata?.["recipient"] ?? "SELF").toUpperCase()))],
    conditional: modifiers.some(modifier => Boolean(modifier.condition) || Boolean(modifier.metadata?.["conditionText"])),
    magnitudes: [...new Set(modifiers.flatMap(modifier => { const value = modifier.value; if (typeof value === "number") return [value]; if (value && typeof value === "object" && !Array.isArray(value) && (value as Record<string, unknown>)["kind"] === "number" && typeof (value as Record<string, unknown>)["value"] === "number") return [(value as Record<string, number>)["value"]!]; return []; }))],
  };
}

