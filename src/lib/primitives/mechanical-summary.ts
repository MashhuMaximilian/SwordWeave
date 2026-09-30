import { mechanicalDescriptionFromModifiers } from "./mechanical-rule";
import { flipOperation, readMirrorMeta } from "@/lib/engine/mirror";
import type { HardModifier } from "@/types/swordweave";

type RecordValue = Record<string, unknown>;
export type MechanicalSummaryRule = { text: string; mechanical: boolean; path: string; quantity: number; mirrored: boolean };
const record = (value: unknown): RecordValue | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : null;
const prose = (value: unknown) => typeof value === "string" ? value.trim() : "";

/** Walk relation payloads (including older links with primitives beside effect).
 * Repeated rules in distinct branches are retained: they describe distinct grants.
 * Path-local cycle protection avoids dropping legitimately shared primitives. */
export function collectMechanicalSummary(value: unknown): MechanicalSummaryRule[] {
  const result: MechanicalSummaryRule[] = [];
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
          const modifiers = Array.isArray(child["hardModifiers"]) ? child["hardModifiers"].filter(value => record(value) && typeof value.operation === "string") as HardModifier[] : [];
          const vector = prose(child["mirrorVector"]) || "VARIABLE_VECTOR";
          const generated = modifiers.length ? mechanicalDescriptionFromModifiers(isMirrored && vector === "VARIABLE_VECTOR" ? modifiers.map(modifier => readMirrorMeta(modifier)?.optedOut ? modifier : ({ ...modifier, operation: (flipOperation(modifier.operation) ?? modifier.operation) as HardModifier["operation"] })) : modifiers) : "";
          const mechanical = (isMirrored ? generated : "") || prose(child["mechanicalOutputText"]) || generated;
          const fallback = prose(child["narrativeRule"]).split(/\s+/).filter(Boolean);
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
