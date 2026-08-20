# L63 — Comprehensive verification of user scenarios

Per Mashu R63: "do it again... SO YOU MUST ANALYZE THE RESOLVER AND
CHARACTER SHEET AND EVERYTHING YOU MUST THOROUGHLY to fix this."

## What I verified end-to-end

Using the user's actual primitives (character 462f9048-b0da-4185-98db-d18027132c82)
and simulating their conditions locally:

### Baseline (no conditions)

| Field | Value | Source |
|---|---|---|
| PHY | 14 | 4 base + Str Buff +5 + Str Ring +1 + Mirrored Str Buff +4 (mirror passthrough) |
| MENT | 7 | 4 base + Mental Buff +3 |
| MAG | 4 | 2 base + Magical Buff +2 |
| fieldcraft | 26 | PHY14 + PB6 + Proficient Fieldcraft +6 |
| awareness | 7 | MENT7 (Iron Will inhibited, Floor 11 informational) |
| legendary_resistance | 1 | Primitive grant 1 (no condition) |

### With legend +2 and exhausted -2 conditions

| Field | Value | Source |
|---|---|---|
| PHY | 14 | unchanged (no attribute condition) |
| MENT | 7 | unchanged |
| legendary_resistance | **3** | Primitive +1 + legend condition +2 ✓ |
| fieldcraft | **24** | PHY14 + PB6 + Proficient +6 - exhausted -2 ✓ |
| awareness | **5** | MENT7 + Iron Will (inhibited) + Floor (informational) - exhausted -2 ✓ |
| reason | **11** | MENT7 + Hunter Bonus (inhibited, not tracking) + Reason AND (inhibited) + PB Half +3 +6 - exhausted -2 ✓ |

### Modifier state independence

A primitive with `isToggledOff: true` (capability OFF) is suppressed from totals,
but a runtime CONDITION (which has `isToggledOff: false`) still applies to the
same target. Confirmed:
- PHY = 4 (base) + 0 (primitive suppressed) + 3 (condition) = 7 ✓
- byTarget["attribute.physical"] shows BOTH entries: primitive (inhibited: true)
  and condition (inhibited: false)

### Engine vs Server parity

Both `aggregateCharacterSheet` (server) and `resolveModifiers` (engine) now produce
the same `legendary_resistance` value when given the same slots:
- Primitive (Legendary Resistance, target: behavior.legendary_resistance, grant 1)
- Condition (legend, target: behavior, add 2, metadata.behaviorName: legendary_resistance)
- Both: legendary_resistance = 3

## Test count

| | Before L62 | After L62 | After L63 |
|---|---|---|---|
| Total tests | 2279 | 2289 | 2293 |
| Passing | 2253 | 2287 | 2291 |
| Failing | 26 | 2 | 2 |
| New tests added | — | +10 | +14 |

The 2 remaining failures are `phase710-3.test.ts` DB migration tests (data,
not code).

## What I did NOT change in L63

L62 fixes already addressed:
1. equation-resolver operand shape
2. combat_action detection
3. behavior walk handling canonical target + typed tokens
4. resolver PASS 1 behavior path covering both forms

L63 added 4 new tests in `l63-comprehensive.test.ts` that exercise the user's
exact primitive set + conditions to verify end-to-end parity.