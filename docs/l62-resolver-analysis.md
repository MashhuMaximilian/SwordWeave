# L62 — Line-by-line resolver analysis and fixes

Per Mashu R62: "analyze the ins and outs of this resolver one
line at a time and how it interacts with the modals and numbers
on the character sheet and the modifiers and conditions and
all the things and you repair it."

## Line-by-line analysis

### A. `equation-resolver.ts` line 153 (THE PRIMARY BUG)

**Original code**:
```js
const operand = operands[i] as unknown as { kind: string; ... };
if (operand.kind === "keyword") { ... }
if (operand.kind === "paren") { ... }
else { value = resolveOperandValue(operand as OperandValue, ctx); }
```

**Problem**: The Operand type (types/modifier.ts:437) is
`{ op: Operator, value: OperandValue }`. OperandValue has
`.kind`. The operand ITSELF does NOT have `.kind`. Reading
`operand.kind` returns `undefined` for every operand in the
canonical shape.

**Effect**: Every equation returned NaN. All 23 equation-resolver
tests failed. Conditions with equations (`PB + 2 [fire]`) failed.

**Fix**: Read `operand.value.kind` (the actual OperandValue's
kind). Support both canonical and legacy shapes (sweep.test.ts
uses bare OperandValue format with `{operator: "+"}`
separators).

### B. `sheet.ts` line 344 — `resolveCharacterAxes`

**Original code**:
```js
const dotIdx = target.indexOf(".");
let axis: string; let sub: string;
if (dotIdx > 0) { axis = ...; sub = ...; }
else if (kwValue) { axis = target; sub = kwValue; }
else { continue; }  // ← falls through for plain "combat_action"
```

**Problem**: `combat_action: grant primitive sets inCombat=true`
test uses `target: "combat_action"` with `value: 1` (number, not
keyword). No dot + no keyword → `continue` → never sets
`inCombat=true`.

**Fix**: Handle axis-only targets. `axis = target; sub = ""`
when there's no dot and no keyword.

### C. `sheet.ts` behavior walk — typed token values

**Original code**:
```js
const value = Number(mod.value);
if (!Number.isFinite(value)) continue;  // typed tokens dropped
```

**Problem**: `legend` condition with `value: {kind: "derived",
which: "pb"}` returns NaN from `Number()`. Condition silently
dropped. User sees `legendary_resistance = 1` (primitive only)
when it should be `1 + 6 = 7` (PB token condition).

**Fix**: Route through `resolveValue` / `resolveEquation` for
typed tokens (object values). Plain numbers and numeric strings
still go through `Number()`. Build a ResolveContext with the
character state for the resolver.

### D. `resolve-modifiers.ts` PASS 1 behavior handling

**Original code**:
```js
if (target === "behavior" && behaviorName !== null) {
  // populates behaviorVariables map
  behaviorVariables[behaviorName] = ...
} else { ... }
// Dotted form ("behavior.<key>") goes through `else` branch.
// It populates totals via PASS 2 but NEVER updates
// behaviorVariables. Result: behaviorVariables < totals.
```

**Problem**: Dotted form (e.g. primitive's `behavior.legendary_resistance`)
populates `totals["behavior.legendary_resistance"]` via PASS 2
but NOT `behaviorVariables` map. Downstream consumers reading
`behaviorVariables` (like the engine's behavior walk, or any
direct user of the map) miss the primitive's contribution.

**Fix**: Detect both forms. Route the dotted form through the
same behavior update path (populate `behaviorVariables[key]`
AND emit byTarget entry).

## End-to-end user scenarios now verified

| Scenario | Engine result | User-visible |
|---|---|---|
| Primitive Legendary Resistance (+1) + condition "+2 PB" canonical | legendary_resistance = 1+2 = 3 ✓ | +3 in UI |
| Primitive Legendary Resistance + condition with `+` value (`/pb/`) | legendary_resistance = 1+6 = 7 ✓ | +7 in UI |
| Primitive with PB token + condition with equation `PB + 2` | legendary_resistance = 1+8 = 9 ✓ | +9 in UI |
| +2 PB condition + Proficient Fieldcraft primitive (PB token) | fieldcraft = 4+8+8 = 20 ✓ | +20 in UI |
| Exhausted (-2) all practices + Plating (Floor 10) | fieldcraft = 14 (raw, no clamp) ✓ | +14, floor 10 informational |
| Attribute.physical max 18 with PHY=50 | fieldcraft base uses 18 (clamped) ✓ | +24 (=18+6) |

## Test count change

| | Before L62 | After L62 |
|---|---|---|
| Total tests | 2279 | 2289 |
| Passing | 2253 | 2287 |
| Failing | 26 | 2 |
| Pre-existing failures fixed | — | **24** |
| New tests added | — | +10 |

The 2 remaining failures are DB migration tests:
- `phase710-3.test.ts`: 145/146 canonical primitives have Notion
  data appended. The 1 missing is "Verb Access Tier I" — a data
  sync issue, not a code bug.