import {
  ALL_ATTRIBUTES,
  ALL_PRACTICES,
  type Operand,
  type OperandValue,
  type Operator,
} from "@/types/modifier";

export interface ParsedRuleFormula {
  readonly operands: readonly Operand[];
  readonly error: string | null;
}

const ATTRIBUTE_SET = new Set<string>(ALL_ATTRIBUTES);
const PRACTICE_SET = new Set<string>(ALL_PRACTICES);

const TOKEN_PATTERN =
  /\s*(#[^#]+#|\[[^\]]+\]|\/[A-Za-z_][A-Za-z0-9_:.-]*\/|(?:\d+(?:\.\d+)?|PB)d\d+(?:[+-]\d+)?|\d+(?:\.\d+)?|PB\/2|PB\*2|PB×2|2PB|PB|LEVEL|[A-Za-z_][A-Za-z0-9_:.-]*|[()+\-*/%×÷])/gi;

function normalizeOperator(token: string): Operator | null {
  if (token === "+" || token === "-" || token === "*" || token === "/" || token === "%") {
    return token;
  }
  if (token === "×") return "*";
  if (token === "÷") return "/";
  return null;
}

function tokenToValue(token: string): OperandValue {
  const clean = token.trim();
  if (clean.startsWith("[") && clean.endsWith("]")) {
    return { kind: "keyword", text: clean.slice(1, -1).trim() };
  }
  if (clean.startsWith("#") && clean.endsWith("#")) {
    return { kind: "dice", expression: clean.slice(1, -1).trim() };
  }
  if (clean.startsWith("/") && clean.endsWith("/")) {
    return tokenToValue(clean.slice(1, -1));
  }
  if (/^-?\d+(?:\.\d+)?$/.test(clean)) {
    return { kind: "number", value: Number(clean) };
  }

  const scaledDie = clean.match(/^(PB|\d+(?:\.\d+)?)d(\d+)([+-]\d+)?$/i);
  if (scaledDie) {
    const count = scaledDie[1] ?? "1";
    const sides = scaledDie[2] ?? "6";
    const suffix = scaledDie[3] ?? "";
    if (count.toUpperCase() === "PB") {
      return {
        kind: "paren",
        operands: [
          { op: "+", value: { kind: "derived", which: "pb" } },
          { op: "*", value: { kind: "dice", expression: `1d${sides}${suffix}` } },
        ],
      };
    }
    return { kind: "dice", expression: `${count}d${sides}${suffix}` };
  }

  const lower = clean.toLowerCase();
  if (ATTRIBUTE_SET.has(lower)) {
    return { kind: "attribute", attribute: lower as (typeof ALL_ATTRIBUTES)[number] };
  }
  if (PRACTICE_SET.has(lower)) {
    return { kind: "practice", practice: lower as (typeof ALL_PRACTICES)[number] };
  }
  if (lower === "pb") return { kind: "derived", which: "pb" };
  if (lower === "pb/2") return { kind: "derived", which: "pb_half" };
  if (lower === "pb*2" || lower === "pb×2" || lower === "2pb") {
    return { kind: "derived", which: "pb2" };
  }
  if (lower === "level") return { kind: "derived", which: "level" };
  return { kind: "runtime", name: lower, hint: "number" };
}

/**
 * Parse the compact expression language used by the rule builder.
 * Arithmetic intentionally follows the engine's left-to-right model;
 * parentheses make grouping explicit. Examples:
 *   (5 + PB) / Awareness + 2d8 + PBd10 [fire]
 *   Physical + PB/2
 *   /block_value/ * 2
 */
export function parseRuleFormula(input: string): ParsedRuleFormula {
  const source = input.trim();
  if (!source) return { operands: [], error: "Write a formula first." };

  const tokens: string[] = [];
  let lastIndex = 0;
  TOKEN_PATTERN.lastIndex = 0;
  for (let match = TOKEN_PATTERN.exec(source); match; match = TOKEN_PATTERN.exec(source)) {
    const skipped = source.slice(lastIndex, match.index).trim();
    if (skipped) {
      return { operands: [], error: `I could not read “${skipped}”.` };
    }
    tokens.push(match[1]!);
    lastIndex = TOKEN_PATTERN.lastIndex;
  }
  const tail = source.slice(lastIndex).trim();
  if (tail) return { operands: [], error: `I could not read “${tail}”.` };

  let cursor = 0;
  const parseSequence = (insideGroup: boolean): ParsedRuleFormula => {
    const operands: Operand[] = [];
    let pendingOperator: Operator = "+";
    let expectsValue = true;

    while (cursor < tokens.length) {
      const token = tokens[cursor]!;
      if (token === ")") {
        if (!insideGroup) return { operands: [], error: "There is an extra closing parenthesis." };
        cursor += 1;
        return operands.length
          ? { operands, error: null }
          : { operands: [], error: "A parenthesis group cannot be empty." };
      }

      const operator = normalizeOperator(token);
      if (operator) {
        if (expectsValue) {
          if (operator === "-" && operands.length === 0) {
            operands.push({ op: "+", value: { kind: "number", value: 0 } });
          } else {
            return { operands: [], error: `“${token}” needs a value before it.` };
          }
        }
        pendingOperator = operator;
        expectsValue = true;
        cursor += 1;
        continue;
      }

      let value: OperandValue;
      if (token === "(") {
        cursor += 1;
        const inner = parseSequence(true);
        if (inner.error) return inner;
        value = { kind: "paren", operands: inner.operands };
      } else {
        value = tokenToValue(token);
        cursor += 1;
      }
      operands.push({ op: pendingOperator, value });
      pendingOperator = "+";
      expectsValue = false;
    }

    if (insideGroup) return { operands: [], error: "Close the open parenthesis." };
    if (expectsValue && operands.length > 0) {
      return { operands: [], error: "The formula cannot end with an operator." };
    }
    return { operands, error: null };
  };

  return parseSequence(false);
}
