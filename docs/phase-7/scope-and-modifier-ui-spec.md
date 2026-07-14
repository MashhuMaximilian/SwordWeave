# Phase-7-E + Phase-7-B.2 — Modifier UI & Target Scope Spec

**Author:** Senku (mod for Mashu, Phase 7 lock 2026-07-14)
**Status:** 📝 DRAFT — awaiting Mashu sign-off before code

---

## Goal

1. **Phase-7-B.2:** Finish the primitive layer — assign `targetScope` values
   to the 5 trigger-hook primitives.
2. **Phase-7-E (new):** Rebuild the Modifier Builder UI in the
   primitive form so each modifier carries a **Target Value** field
   that captures the **scope axis** (which attribute, which practice,
   which dice, which focus, etc.), distinct from the existing
   "What Changes" dropdown.

These two pieces of work are tightly coupled — they share the
`targetScope` vocabulary. So they're specced together and shipped
together.

---

## Part A — Target Scope Vocabulary (LOCKED)

Locked in `src/lib/primitives/target-scope.ts` (Phase 7-A, already
shipped) and extended below.

### Already supported `SCOPE_LAYERS`

```
ATTRIBUTE       — Physical / Mental / Magical
PRACTICE        — 10 named practices (PROWESS, FINESSE, FIELDCRAFT,
                  AWARENESS, REASON, KNOWLEDGE, INFLUENCE,
                  MYSTICISM, COMMUNION, INTUITION)
NARROW_FOCUS    — free-form text ("Awareness (Smell)",
                  "Fieldcraft (Tracking)", "Dodge Roll < 15")
METRIC          — HP, ATTACK_ROLL, DEFENSE_ROLL, CHARACTER_DC,
                  PROFICIENCY_BONUS, REACTION_SLOT, MOVEMENT_SPEED,
                  INITIATIVE, ATTACK, SAVE, DEFENSE, VITALITY
DICE            — D20, D100
DURATION        — INSTANT, SHORT, MEDIUM, LONG, SCENE, PERSISTENT,
                  PERMANENT
ALL             — applies globally with no narrow scope
(null)          — no scope axis (verbs, domains, structures, etc.)
```

### Closed-vocab layers

- **ATTRIBUTE** values: `PHYSICAL`, `MENTAL`, `MAGICAL`
- **PRACTICE** values: the 10 listed above
- **METRIC** values: `HP`, `ATTACK_ROLL`, `DEFENSE_ROLL`,
  `CHARACTER_DC`, `PROFICIENCY_BONUS`, `REACTION_SLOT`,
  `MOVEMENT_SPEED`, `INITIATIVE`, `ATTACK`, `SAVE`, `DEFENSE`,
  `VITALITY`
- **DICE** values: `D20`, `D100`
- **DURATION** values: 7 listed above

### Open-vocab layers

- **NARROW_FOCUS** value is free-form; any non-empty string accepted
- **METRIC** accepts free-form strings via "open foundry" pattern —
  `LAND_SPEED`, `FLY_SPEED`, `SWIM_SPEED`, etc. are valid even if
  not yet enumerated in the closed list

---

## Part B — Modifier UI: New "What Changes" Dropdown (16 entries)

### Why trim from 22 → 16?

The current dropdown lists each variant of an axis separately
(Physical Attribute / Mental Attribute / Magical Attribute — three
rows). Each variant has the same scope layer and only differs in the
Target Value. Consolidating them into a single "Attribute" entry
with a multi-select Target Value picker lets a single modifier
target **multiple attributes** simultaneously (e.g., "+1 to Physical
AND Magical saves") which was previously impossible without
duplicating the modifier card.

### Trimmed "What Changes" Dropdown

| # | Label | Layer | Target Value control |
|---|---|---|---|
| 1 | Attribute | ATTRIBUTE | Checklist: Physical / Mental / Magical |
| 2 | Defense DC | METRIC | Checklist: Physical / Mental / Magical |
| 3 | Speed | METRIC | Checklist: Land / Fly / Swim |
| 4 | Max Vitality | METRIC | none (single axis) |
| 5 | Current Vitality | METRIC | none (single axis) |
| 6 | Skill / Practice Check | PRACTICE *or* NARROW_FOCUS | depends on granularity (see below) |
| 7 | Proficiency Bonus | METRIC | none (single axis) |
| 8 | Action Roll | METRIC | none (single axis) |
| 9 | Damage / Healing Output | DICE | Checklist: D6 / D8 / D10 / D12 / D20 |
| 10 | Action Range | NARROW_FOCUS | Checklist + free-text: Self / Touch / Near / Far / Line of Sight / Global |
| 11 | Target Count | NARROW_FOCUS | Checklist + free-text: Single / 2 / 4 / AoE / All |
| 12 | Area Size | NARROW_FOCUS | Checklist + free-text: 5 ft / 30 ft / Scene |
| 13 | Duration | DURATION | Checklist: 7 DURATION values |
| 14 | Strain | (null) | free-text number (uses Value below) |
| 15 | Item Slot Cost | (null) | free-text number (uses Value below) |
| 16 | Scene Pace | (null) | free-text narrow-focus: Round / Scene / Day |

### Skill / Practice Check — special case (granularity toggle)

The Skill / Practice Check line has two scope-layer options:

- **Broad:** `targetScope = { layer: "PRACTICE", value: "AWARENESS" }`
  — affects all Awareness checks
- **Narrow focus:** `targetScope = { layer: "NARROW_FOCUS",
  value: "Awareness (Smell)" }` — affects only a specific sub-focus

UI: a **radio button** above the Target Value widget:

```
Granularity:  ( ) Broad  ( ) Narrow focus
              ↑ default
```

Switching the radio swaps the Target Value widget:

- **Broad:** Practice checklist (10 practices + "All / Any")
- **Narrow:** Free-text input (one narrow focus string, e.g.
  "Awareness (Smell)")

The `value` field of the modifier carries the rendered targetValue
*plus* an optional `metadata.narrowFocus` string when on Narrow.

### Damage / Healing Output dice checklist

When user picks Damage / Healing Output, the Target Value widget
shows the 5 dice sizes as a checklist. The numeric Value field
below handles the *multiplier* (default "1" = single die block).

### Action Range / Target Count / Area Size / Duration / Strain / Slot / Pace

Curated checklist of common values + free-text "Other:" escape
hatch. The Value field is repurposed:
- For numeric fields (Strain, Item Slot Cost): Value = number
- For range/target/area: Target Value = checklist+text, Value = the
  effect amount (e.g., "+30 ft" or "+2 targets")

---

## Part C — Modifier JSON Storage

### Before (current HardModifier shape)

```json
{
  "kind": "modify",
  "target": "character.attribute.physical",
  "operation": "add",
  "value": 1,
  "stacking": "stack",
  "condition": { ... }
}
```

### After (with Phase-7-E changes)

```json
{
  "kind": "modify",
  "target": "attribute",
  "operation": "add",
  "value": 1,
  "stacking": "stack",
  "condition": { ... },
  "metadata": {
    "targetScope": {
      "layer": "ATTRIBUTE",
      "values": ["PHYSICAL", "MAGICAL"]
    }
  }
}
```

Key changes:
- `target` becomes the canonical-3-axis short label
  (`"attribute"`, `"defense_dc"`, `"speed"`, etc.) instead of the
  long dotted string. The dotted string in the form dropdown's
  *value* field is the legacy representation.
- `metadata.targetScope.layer` and `metadata.targetScope.values[]`
  carry the multi-value scope axis.
- For **single-axis** modifiers (Max Vitality, Proficiency Bonus,
  Action Roll), `metadata.targetScope.layer` is set,
  `metadata.targetScope.values` is omitted (null = "any" is
  implicit).

### Backward-compat strategy

Round-trip: when loading older modifiers that have
`target: "character.attribute.physical"` (dotted) and no
`metadata.targetScope`, infer the scope from the target string and
set metadata accordingly. This keeps existing library rows /
canonical rows editable without a forced migration.

### What about the `target` field — keep it or change it?

We **canonicalize** `target` to the short axis name (e.g.,
`"attribute"`) but **accept** both the new short form and the legacy
dotted form when loading. The engine prefers `metadata.targetScope`
over `target` heuristics, falling back to the legacy target field
for unmodified rows.

---

## Part D — Engine Wiring

### `src/lib/engine/stats.ts`

The engine reads `modifiers: HardModifier[]` for each stat. Today
it parses `target` strings. After Phase-7-E:

1. If `modifier.metadata?.targetScope` is present, use it directly.
2. Otherwise, fall back to legacy `target` heuristics (existing
   behavior preserved).

The engine needs to be updated to **multiply-out** a single modifier
across multiple target values. For example, a "+1" modifier on
`{"layer":"ATTRIBUTE","values":["PHYSICAL","MAGICAL"]}` will apply
to both Physical attribute and Magical attribute checks.

This means `resolveStat(kind, scope, modifiers)` resolves once per
axis — meaning **a single HardModifier card can resolve into multiple
stat contributions**. That's a real engine change but it's the
correct canonical reading.

### `src/lib/engine/bu.ts`

Mirror surcharge math (Phase 7-C) reads `metadata.targetScope` for
the audit-counted scope of a mirrored acquisition. Not yet
implemented but the data shape supports it.

---

## Part E — Phase-7-B.2 Trigger-Hook Scopes

Five TRIGGER_HOOK primitives currently have `targetScope = null`.
After this phase, all five get `NARROW_FOCUS` scope (the trigger
condition is by nature a free-form descriptor).

| Trigger | Suggested targetScope |
|---|---|
| `Conditional Informational Trigger` | `{ layer: "NARROW_FOCUS", value: "abstract conditions (e.g., individual lying, ally losing consciousness, hidden entity crossing a boundary)" }` |
| `Direct Material Trigger` | `{ layer: "NARROW_FOCUS", value: "concrete physical actions (e.g., crossing a threshold, launching an attack, dropping an object)" }` |
| `Dormant Trigger Hook` | `{ layer: "NARROW_FOCUS", value: "dormant until manually activated" }` |
| `Interceptive Causal Trigger` | `{ layer: "NARROW_FOCUS", value: "out-of-sequence interception before an event resolves" }` |
| `Systemic Threshold Trigger` | `{ layer: "NARROW_FOCUS", value: "parameter changes (energy signature, vitality threshold, zone entry)" }` |

Live DB has 32/146 primitives with targetScope populated. After
B.2: 37/146 (32 existing + 5 new).

---

## Part F — Sequencing

### Step-by-step

1. **Add the helper file** `src/lib/primitives/modifier-scope.ts`
   with `MODIFIER_TARGET_LABELS`, `MODIFIER_TARGET_SCOPE`,
   `buildScopeForModifier`, `applyScopeToModifier`.
2. **Refactor `primitive-form.tsx`:**
   - Update the `targetOptions` constant to the 16-entry trimmed
     list
   - Add `targetValue: string[]` and `granularity: "broad"|"narrow"`
     to `ModifierDraft`
   - Add the Target Value widget below the What Changes dropdown
   - Add granularity radio for Skill / Practice Check line
   - Persist into `metadata.targetScope.layer/values` and
     `metadata.targetScopeGranularity`
3. **Update `fromHardModifier`/`toHardModifier`** to round-trip
   `metadata.targetScope` and `metadata.granularity`
4. **Engine stats resolver** — add fallback chain
5. **Phase-7-B.2 seed** — scope the 5 trigger primitives; re-seed
6. **Tests:** helper + form draft round-trip + engine stat resolution
7. **Verify:** build, typecheck, seed-vs-db, vitest
8. **Commit + update audit matrix**
