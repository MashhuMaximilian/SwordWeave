# Modifier Lifecycle — Phase 8.I i2.5h (Mashu 2026-08-06)

## Canonical Data Model

The form's `ModifierDraft` state has 4 fields that together describe
the modifier's value:

  - `tokens: ValueToken[]`  — chip stack, primary source of truth
  - `value: string`  — cached display string derived from tokens[0]
  - `valueKind: ValueKind`  — derived from the dominant token kind
  - `operands: Operand[]`  — only used in equation mode

The stored `HardModifier.value` is a **JsonValue** — it can be:

  - A primitive (number, string, boolean)
  - A typed-token object (e.g. {kind:"derived", which:"pb"})
  - For equation mode: the FIRST operand's value (a typed token)

The stored `HardModifier.metadata` may also contain:

  - `metadata.targetScope: { layer, values }`  — sub-target scope
  - `metadata.behaviorName: string`  — for behavior target
  - `metadata.scopeName: string`  — for free-text targets
  - `metadata.operands: Operand[]`  — for equation mode
  - `metadata.valueKind: "equation"`  — marker for equation mode

## Translation: ModifierDraft → HardModifier (save)

```ts
function toHardModifier(draft: ModifierDraft): HardModifier {
  let baseValue: JsonValue;

  if (draft.valueKind === "equation" && draft.operands.length > 0) {
    // Equation mode: the stored value is the first operand's value.
    // The full operand array goes to metadata.operands.
    baseValue = operandToTokenValue(draft.operands[0].value);
  } else if (draft.tokens.length > 0) {
    // Non-equation mode: the stored value is the first token (typed object).
    baseValue = draft.tokens[0];
  } else if (draft.tokens.length === 0 && draft.valueKind === "text") {
    baseValue = "";
  } else {
    // Fallback: try to parse the cached value field
    baseValue = parseValueFallback(draft.value, draft.valueKind);
  }

  const metadata: Record<string, JsonValue> = { ... };

  if (draft.valueKind === "equation") {
    metadata["operands"] = draft.operands as JsonValue;
    metadata["valueKind"] = "equation";
  }

  return {
    kind: "modify",
    target: ...,
    operation: draft.operation,
    value: baseValue,
    metadata,
    ...
  };
}
```

## Translation: HardModifier → ModifierDraft (load)

```ts
function fromHardModifier(stored: Record<string, unknown>): ModifierDraft {
  const meta = stored.metadata ?? {};
  const operandsRaw = meta.operands;
  const isEquation = Array.isArray(operandsRaw) && operandsRaw.length > 0;

  if (isEquation) {
    // Equation mode: derive tokens from operands, valueKind = "equation"
    const tokens = operandsToTokens(operandsRaw);
    return {
      ...,
      tokens,
      value: "",
      valueKind: "equation",
      operands: operandsRaw,
    };
  }

  // Non-equation mode: tokens come from parseValueField of the stored value
  const tokens = parseValueField(stored.value);
  const first = tokens[0];
  const valueKind = first ? tokenKindToValueKind(first.kind) : "number";

  return {
    ...,
    tokens,
    value: serializeFirstToken(first),  // rebuild cached value from token
    valueKind,
    operands: [],
  };
}
```

## Translation: ValueToken kind → ValueKind

```ts
function tokenKindToValueKind(kind: ValueToken["kind"]): ValueKind {
  switch (kind) {
    case "number":
    case "derived":
    case "attribute":
    case "practice":
    case "behavior":
    case "runtime":
      return "number";
    case "dice":
      return "dice";
    case "keyword":
      return "text";
    default:
      return "number";
  }
}
```

## Why this is the right design

The chip stack is the user's mental model — it's what they see and
click. The cached `value` and `valueKind` are derived from the chips
to keep backwards compatibility with the engine and preview code.

By making `toHardModifier` derive the stored value from `tokens`
(not from `parseValue(value, valueKind)`), we eliminate the entire
class of "value=0" bugs caused by the cached string being empty or
mismatched. The token is the truth; the string is just a render.

The equation case is similar: the stored value comes from the FIRST
operand's value (a typed token), not from parsing the cached
value string. The full operand array is in metadata.operands.
