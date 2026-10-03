import { mechanicalDescriptionFromModifiers } from "./mechanical-rule";
import { flipOperation, readMirrorMeta } from "@/lib/engine/mirror";
import type { HardModifier } from "@/types/swordweave";

type RecordValue = Record<string, unknown>;
export type MechanicalSummaryRule = { text: string; mechanical: boolean; path: string; quantity: number; mirrored: boolean };
const record = (value: unknown): RecordValue | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : null;
const prose = (value: unknown) => typeof value === "string" ? value.trim() : "";

/** Walk relation payloads (including older links with primitives beside effect).
 * A purchased primitive is shown once across composition paths. Its normal and
 * mirrored forms stay distinct, and different primitives with identical copy
 * are never merged. First occurrence supplies the displayed path and quantity. */
export function collectMechanicalSummary(value: unknown): MechanicalSummaryRule[] {
  const result: MechanicalSummaryRule[] = [];
  const seen = new Map<unknown, Set<boolean>>();
  const walk = (node: RecordValue, path: string[], mirrored: boolean, quantity: number, ancestors: Set<object>) => {
    if (ancestors.has(node)) return;
    const visited = new Set(ancestors).add(node);
    for (const kind of ["primitive", "capability", "effect"] as const) {
      const links = node[`${kind}Links`];
      if (!Array.isArray(links)) continue;
      for (const rawLink of links) {
        const link = record(rawLink), child = record(link?.[kind]);
        if (!link || !child) continue;
        const nextPath = [...path, prose(child["name"])].filter(Boolean);
        const isMirrored = mirrored || link["isMirrored"] === true;
        const count = typeof link["quantity"] === "number" && Number.isFinite(link["quantity"]) && link["quantity"] > 0 ? link["quantity"] : 1;
        if (kind === "primitive") {
          const identity = link["primitiveId"] ?? child["id"] ?? child;
          const variants = seen.get(identity) ?? new Set<boolean>();
          if (variants.has(isMirrored)) continue;
          variants.add(isMirrored);
          seen.set(identity, variants);
          const modifiers = Array.isArray(child["hardModifiers"]) ? child["hardModifiers"].filter(value => record(value) && typeof value.operation === "string") as HardModifier[] : [];
          const vector = prose(child["mirrorVector"]) || "VARIABLE_VECTOR";
          const generated = modifiers.length ? mechanicalDescriptionFromModifiers(isMirrored && vector === "VARIABLE_VECTOR" ? modifiers.map(modifier => readMirrorMeta(modifier)?.optedOut ? modifier : ({ ...modifier, operation: (flipOperation(modifier.operation) ?? modifier.operation) as HardModifier["operation"] })) : modifiers) : "";
          const descriptive = record(child["mechanicalRule"])?.["family"] === "DESCRIPTIVE";
          const mechanical = descriptive ? "" : (isMirrored ? generated : "") || prose(child["mechanicalOutputText"]) || generated;
          const fallback = (prose(child["narrativeRule"]) || (descriptive ? prose(child["mechanicalOutputText"]) : "")).split(/\s+/).filter(Boolean);
          const text = mechanical || fallback.slice(0, 30).join(" ") + (fallback.length > 30 ? "…" : "");
          if (text) result.push({ text, mechanical: Boolean(mechanical), path: nextPath.join(" › "), quantity: quantity * count, mirrored: isMirrored });
        } else {
          const nested = Array.isArray(child["primitiveLinks"]) && child["primitiveLinks"].length ? child : { ...child, primitiveLinks: link["primitiveLinks"] ?? child["primitiveLinks"] };
          if (!visited.has(child)) walk(nested, nextPath, isMirrored, quantity * count, nested === child ? visited : new Set(visited).add(child));
        }
      }
    }
  };
  const root = record(value);
  if (root) walk(root, [prose(root["name"])].filter(Boolean), false, 1, new Set());
  return result;
}
