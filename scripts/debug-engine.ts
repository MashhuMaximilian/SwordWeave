import { resolveValue } from "../src/lib/engine/runtime-resolver";
import { evaluateCondition } from "../src/lib/engine/condition-evaluator";

const ctx = {
  level: 18,
  pb: 6,
  attributes: { physical: 2, mental: 0, magical: 0 } as Record<"physical"|"mental"|"magical", number>,
  practices: {} as Record<string, number>,
  behaviorVariables: {} as Record<string, number>,
};

const pbToken = { kind: "derived", which: "pb" };
const pbResult = resolveValue(pbToken, ctx);
console.log("resolveValue derived pb:", pbResult, "(expected 6)");

const twoXpb = { kind: "equation", tokens: [
  { kind: "number", value: 2 },
  { kind: "operator", value: "*" },
  { kind: "paren", value: "pb" },
] };
try {
  console.log("resolveValue 2*pb paren:", resolveValue(twoXpb, ctx), "(expected 12)");
} catch (e) {
  console.log("resolveValue 2*pb paren FAILED:", (e as Error).message);
}

const mixed = { kind: "equation", tokens: [
  { kind: "number", value: 2 },
  { kind: "operator", value: "*" },
  { kind: "runtime", name: "pb" },
] };
try {
  console.log("resolveValue 2*pb runtime:", resolveValue(mixed, ctx), "(expected 12)");
} catch (e) {
  console.log("resolveValue 2*pb runtime FAILED:", (e as Error).message);
}

// Compound form: actor:stat|vitality_pct|<|50
const cond = {
  kind: "compound",
  tokens: [
    {
      kind: "predicate",
      predicate: {
        kind: "stat",
        axis: "self",
        stat: "vitality_pct",
        op: "<",
        value: 0.5,  // 0.1 (10%) < 0.5 (50%)
      },
    },
  ],
};
const ctxTest = {
  character: {
    attrPhysical: 2, attrMental: 0, attrMagical: 0,
    vitality: 10, vitalityMax: 100,
    practices: {} as Record<string, number>, custom: {} as Record<string, number | boolean | string>,
  },
} as unknown as never;
try {
  console.log("condition vitality_pct<50:", evaluateCondition(cond as never, ctxTest));
} catch (e) {
  console.log("condition FAILED:", (e as Error).message);
}
console.log("vitality_pct expected:", 10 / 100);
