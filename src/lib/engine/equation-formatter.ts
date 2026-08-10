/**
 * Equation formatter — Phase 8.K K13
 *
 * Pretty-prints a HardModifier equation value object as readable text.
 *
 * Supported shapes:
 *   { kind: "number", value: 5 }
 *   { kind: "derived", which: "pb" }
 *   { kind: "derived", which: "level" }
 *   { kind: "attribute", which: "physical" | "mental" | "magical" }
 *   { kind: "equation", operands: Operand[], tag: "fire" }
 *
 * Equation operands may include a `op` field for explicit operations.
 * When `op` is omitted, operands are joined with `+`.
 */

export type Operand =
  | { kind: "number"; value: number; op?: string }
  | { kind: "derived"; which: string; op?: string }
  | { kind: "attribute"; which: string; op?: string }
  | { kind: "keyword"; value: string; op?: string };

export type EquationValue = Operand | { kind: "equation"; operands: Operand[]; tag?: string };

const DERIVED_LABELS: Record<string, string> = {
  pb: "PB",
  pb_half: "PB/2",
  level: "LVL",
};

const ATTR_LABELS: Record<string, string> = {
  physical: "PHY",
  mental: "MEN",
  magical: "MAG",
};

export function formatOperand(operand: Operand): string {
  if (operand.kind === "number") {
    return String(operand.value);
  }
  if (operand.kind === "derived") {
    return DERIVED_LABELS[operand.which] ?? operand.which.toUpperCase();
  }
  if (operand.kind === "attribute") {
    return ATTR_LABELS[operand.which] ?? operand.which.toUpperCase();
  }
  if (operand.kind === "keyword") {
    return `[${operand.value}]`;
  }
  return "?";
}

export function formatEquationValue(value: unknown): string {
  if (value === null || value === undefined) return "0";
  if (typeof value === "number") return String(value);
  if (typeof value !== "object") return String(value);

  const v = value as EquationValue;

  if ("kind" in v) {
    if (v.kind === "equation" && "operands" in v) {
      // Equation: each operand may carry an op. Default to '+'.
      const parts = v.operands.map((op, i) => {
        const explicit = (op as Operand & { op?: string }).op;
        const left = i === 0 ? "" : explicit ?? "+";
        const formatted = formatOperand(op);
        return left === "" ? formatted : `${left} ${formatted}`;
      });
      const main = parts.join(" ");
      const tag = v.tag ? ` [${v.tag}]` : "";
      return `${main}${tag}`;
    }
    if (v.kind === "number" && "value" in v) {
      return String((v as { value: number }).value);
    }
    if (v.kind === "derived" && "which" in v) {
      return DERIVED_LABELS[(v as { which: string }).which] ?? (v as { which: string }).which.toUpperCase();
    }
    if (v.kind === "attribute" && "which" in v) {
      return ATTR_LABELS[(v as { which: string }).which] ?? (v as { which: string }).which.toUpperCase();
    }
    if (v.kind === "keyword" && "value" in v) {
      return `[${(v as { value: string }).value}]`;
    }
  }
  return String(value);
}
