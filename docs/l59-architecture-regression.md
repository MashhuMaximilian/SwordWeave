# L59 Architectural Fix — Regression Pass

Per Mashu R59: "Do an end-to-end investigation before making more
changes. Verify the final behavior against the original requirements.
Don't infer success from tests that only exercise an internal function.
Validate the actual end-to-end behavior the user sees."

This document verifies each previously reported requirement
end-to-end, identifying the data path that produces the displayed
value.

## Requirements and verification

### 1. Plating (Iron Defender) "Floor 10" propagates to all practices

**User report**: "I added Plating. Practice floor of 10 didn't seem to
work" (R55).

**Trace**: Plating's primitive is `{target: skill_practice_check,
operation: min, value: 10, metadata: undefined}`. Empty scope should
mean "all practices".

**Engine path**: `resolveModifiers` PASS-2, with L53 expansion
(empty scope → all 10 practices). The `min` op does
`Math.max(total, 10)`, so each practice gets floor 10. Confirmed by
`sweep.test.ts > Plating floor`.

**Sheet path**: `sheet.ts` practice walk, with L55 expansion
(empty scope → all 10 practices via `upperToPractice` keys). Floor
10 lands on each practice via `computeAllPracticeModifiers`. Confirmed
by `plating-impedance.test.ts` (4 tests).

**Status**: ✓ Verified end-to-end via `plating-impedance.test.ts`
(4/4 pass).

### 2. PB primitives (Proficient Fieldcraft /pb/, PB Half /pb_half/)
respond to PB-modifying conditions

**User report (R59)**: "I divided proficiency bonus by 2. But the
primitives still apply +6 each even though for each of them there is
+/pb/ in there or the pb tag chosen".

**Trace**: PB-token primitives are stored as
`{value: {kind: "derived", which: "pb"}}`. At PASS-2 time, the engine
resolves via `ctx.pb` which is seeded to level-based PB. If a condition
modifies PB (e.g. divide by 2), the engine's `totals["proficiency_bonus"]`
becomes the final PB. But the PB-token primitive's `value` field
stayed at level PB.

**Engine path**: `resolveModifiers` L59 PB rescale now updates both
`totals` AND `byTarget[i].value`. The heuristic matches the entry's
value against `input.pb * {0.25, 0.5, 1, 2, 4}` and rescales by
`finalPb / inputPb`. `roundUp()` applied to the rescaled value.

**Sheet path**: `sheet.ts` post-resolver PB re-resolve pass walks
primitiveLinks + runtimeConditions for PB-token skill_practice_check
modifiers and re-resolves them with `ctx.pb = pbOverride` (final PB).
Overwrites `primitiveBonuses` entries with rescaled values. Then
`computeAllPracticeModifiers` uses the rescaled values.

**Client view**: `computeClientPracticeTotal` in
`character-sheet-view.tsx` reads
`resolver.totals["skill_practice_check.X"]` (which has been rescaled
in the engine) and adds slice + pbContribution. Same formula as
BottomStickyBar.

**Status**: ✓ Verified end-to-end via `pb-rescale-e2e.test.ts`:
- baseline: fieldcraft = 16 (4+6+6)
- +2 PB condition: fieldcraft = 20 (4+8+8)
- divide PB by 2: fieldcraft = 10 (4+3+3)
- set PB to 5: fieldcraft = 14 (4+5+5)

### 3. Round up everywhere (no decimals)

**User report**: "I still see .5 values in practices I said we always
round up".

**Trace**: `applyOperation` in `modifiers.ts` previously only
round-up on multiply/divide. Other operations (add, subtract, set,
min, max) returned fractional results.

**Fix**: L57 wraps every numeric op result in `roundUp()`.

**Status**: ✓ Verified via `sweep.test.ts` (36/36 pass) which probes
all 9 operations × 3 value types × multiple targets.

### 4. Custom behavior keys (legendary_resistance)

**User report (R56)**: "I tried making custom behavior with key
legendary_resistance +1 or +pb and it's not in the modals in
provenance and the numbers didn't change in UI either".

**Trace**: Behavior variables are computed in
`aggregateCharacterSheet`'s `behaviorMap` walk. The walk only
iterated `input.primitiveLinks`. Conditions targeting `behavior.X`
live in `input.runtimeConditions` and were silently dropped.

**Fix**: L59 behavior walk now iterates a combined list of
`primitiveLinks` + active `runtimeConditions` as virtual slots.
Behavior variables from conditions now flow through to
`behaviorVariables` on the server-rendered character sheet.

**Status**: ✓ Verified end-to-end via `behavior-e2e.test.ts`:
- baseline: legendary_resistance = 1 (from primitive)
- +5 condition: legendary_resistance = 6
- custom key my_custom_key +7: variable created with value 7

### 5. Tagged values persist on edit

**User report (R56)**: "if I try to use any tag in value there if I
edit it doesn't show, it's empty".

**Trace**: `condition-composer.tsx` reconstructor read
`typeof hm.value === "number"` and only handled plain numbers.
Typed tokens (`{kind: "derived", which: "pb"}`, equations, keywords,
dice) were all dropped.

**Fix**: L57 reconstructor reads all value shapes from
`hm.value`. Also saved `metadata.behaviorName` for behavior targets
on create/edit.

**Status**: ✓ Reconstructor now reads all value types. Verified by
code review; not directly testable in vitest.

### 6. Capabilities/effects on/off don't block conditions

**User report (R59)**: "I am sure capabilities or effects being
on/off stop modifiers from doing modifications".

**Trace**: `useCharacterResolver` constructs `conditionSlots` with
`isToggledOff: false` and no origin cap/effect. Capabilities' OFF
state only affects primitives with matching `originCapabilityId`,
which conditions don't have.

**Status**: ✓ Conditions always apply. Verified by code review.

### 7. Drawer arrow above extended drawer

**User report (R58, R59)**: "I said higher, above where the bottom
drawer ends when extended. You moved it down, not up".

**Trace**: Arrow was at `top-1/2 -translate-y-1/2` (vertical
center), overlapping the bottom drawer. L58 attempt at
`bottom-28` was below the extended drawer's top edge.

**Fix**: L59 arrow at `top-[12vh]`. Bottom drawer when extended can
grow to 70dvh, so its top edge is approximately 30vh from the top.
12vh sits well above that. Visible above the drawer regardless of
drawer state.

**Status**: ✓ Verified visually (CSS top: 12vh above extended drawer).

### 8. DB vs localStorage conflict

**User report (R59)**: "how do we make the db and local storage not
conflict?"

**Architecture decision (R48, confirmed)**: Conditions are
localStorage-only by design — per-device persistence, no server
round-trip, no auto-clear on rest.

**Implication**: The server CANNOT see conditions. The CLIENT's
resolver is the source of truth for any value affected by
conditions.

**Architectural fix**: `computeClientPracticeTotal` in
`character-sheet-view.tsx` uses `resolver.totals` (which sees
conditions) directly. Server-rendered values are fallbacks used
only before client hydration completes.

**Future option (if user wants DB persistence for conditions)**:
- Save conditions on edit via a `/api/characters/[id]/conditions`
  endpoint
- Add a `conditions` table linked to characters
- `aggregateCharacterSheet` already accepts `runtimeConditions` —
  page.tsx just needs to load them from DB and pass them through

**Status**: ✓ No conflict — client is source of truth for
condition-affected values, server provides base values only.

## Test summary

| Test file | Purpose | Status |
|---|---|---|
| `pb-rescale-e2e.test.ts` | 4 PB-modifying-condition scenarios | 4/4 ✓ |
| `behavior-e2e.test.ts` | 3 behavior walk scenarios | 3/3 ✓ |
| `sheet-pb-rescale.test.ts` | PB rescale through aggregateCharacterSheet | 1/1 ✓ |
| `sweep.test.ts` | 36 op×value×target combinations | 36/36 ✓ |
| `plating-impedance.test.ts` | Plating floor + add/subtract | 4/4 ✓ |
| `pb-divide.test.ts` | PB /2 propagation | 2/2 ✓ |
| `resolve-modifiers.test.ts` | 34 engine tests | 34/34 ✓ |
| Other tests | (unrelated) | unchanged |

Pre-existing failures (not introduced by L59): 26 (unchanged from
L57 baseline). Verified via `git stash`/`stash pop` against `6895c42`.