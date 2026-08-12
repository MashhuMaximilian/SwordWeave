# Phase 8.M — Single Save DC + Single Attack Bonus Architectural Refactor

## § Problem statement

> "L6 architectural refactor (Phase 8.M) → yes to only have one save dc and one attack bonus. Here the thing is that if we will add proficiency to more than one attribute we will have to add in the modals of attack bonus and save dc a selector of which attribute should count."

— Mashu, 2026-08-12

Currently the engine has THREE per-attribute axes:
- `attack_bonus.physical`, `attack_bonus.mental`, `attack_bonus.magical`
- `saving_throw.physical`, `saving_throw.mental`, `saving_throw.magical`
- `defense_dc.physical`, `defense_dc.mental`, `defense_dc.magical`

The user wants **ONE** `attack_bonus` and **ONE** `save_dc` axis. If the character is proficient in multiple attributes, the attack_bonus / save_dc modal must show a selector so the user can pick which attribute's modifier is being rolled against.

## § Behavior matrix

| Scenario | Old behavior | New behavior |
|---|---|---|
| Char proficient in PHYSICAL only | 3 separate attack_bonus/save_dc/defense_dc totals; user has to mentally pick the right one | Single `attack_bonus` and `save_dc` total = PHYSICAL's math |
| Char proficient in PHYSICAL + MENTAL | Same 3 totals (phys and mental both populated) | **Selector in modal**: "Roll against [PHYSICAL ▼] / MENTAL". Computed total reflects chosen attribute. |
| Char proficient in all 3 | 3 totals | **Selector** with 3 options. |
| Char NOT proficient in any | No total rendered | **No attack_bonus, no save_dc** (per Phase 8 design — these are "if proficient" derived axes) |
| Defense DC (enemy roll against player's number) | 3 per-attribute DCs | Out of scope for Phase 8.M — `defense_dc` stays per-attribute. (Defense DC is what enemies roll against when targeting the character — different problem space.) |

## § Open Questions + decisions

| # | Question | Decision |
|---|---|---|
| OQ-1 | Does this refactor affect `defense_dc` too, or just `attack_bonus` + `save_dc`? | **Just attack_bonus + save_dc.** Defense DC is what enemies roll against — different concern. Leave per-attribute. |
| OQ-2 | When user has proficiency in 2+ attrs and opens the modal, what's the DEFAULT selected attr? | The character's `attrProficient` (which currently IS a single attr). When multi-proficiency is added later, default to the first proficient attr alphabetically (mental → magical → physical). |
| OQ-3 | Should primitives still target `attack_bonus.<attr>` and `saving_throw.<attr>` (per-attr targets that all roll up to the single display total)? | **YES.** Engine still keeps per-attribute targets internally. The refactor is UI-side: ONE displayed total + selector, derived from the chosen attribute. The character_primitives still target specific attributes. |
| OQ-4 | Does this affect `behavior.disadvantage.skill_practice_check.communion` etc? | **No.** Those are behavior markers (advantage/disadvantage on rolls), separate concern from attack_bonus/save_dc. |
| OQ-5 | What about the `attrProficient` field on the character? Is it multi-valued now? | **For Phase 8.M, keep single attrProficient.** Multi-proficiency is future work. The SELECTOR UI is built so it CAN handle multi-proficiency later. |

## § Implementation phases

### Phase 8.M.1 — Engine math refactor (pure)

**Goal:** Replace per-attribute attack_bonus/save_dc targets with a single `attack_bonus` and `save_dc` target that derives from a chosen attribute.

**Files:**
- `src/lib/engine/resolve-modifiers.ts` — keep per-attr targets internally, add `attack_bonus` and `save_dc` (no attr suffix) as virtual totals derived from `attrProficient`
- `src/lib/engine/target-registry.ts` — register the new targets
- `src/lib/engine/sheet.ts` — `aggregateCharacterSheet` adds `attack_bonus` and `save_dc` to the totals

**Output:** API returns `totals.attack_bonus` and `totals.save_dc` (single values, not per-attr) plus `totals.attack_bonus_by_attr` and `totals.save_dc_by_attr` (per-attr breakdown for the selector).

**Test:** `src/lib/engine/__tests__/resolve-modifiers.test.ts` — add new test cases for multi-proficiency selector.

### Phase 8.M.2 — UI refactor (modals + sheet)

**Goal:** Show single `attack_bonus` / `save_dc` on the sheet; modal shows selector when multi-proficient.

**Files:**
- `src/components/characters/bottom-sticky-bar.tsx` — `AttributeFormulaModal` adds a selector when `attrProficient.length > 1` (or when multi-attr proficiency is in effect)
- `src/components/characters/character-sheet-view.tsx` — sheet shows single value
- `src/components/characters/bottom-sticky-bar.tsx` — `FooterButton` for attack_bonus / save_dc now uses single target

**Output:** Single number in the footer for attack_bonus / save_dc; modal has selector if needed.

### Phase 8.M.3 — Update character primitives API

**Goal:** Primitives still target per-attribute axes, but the resolver exposes a unified attack_bonus / save_dc derived from `attrProficient`.

**Files:**
- `src/app/api/characters/[id]/resolve/route.ts` — no change to primitives insert logic; ensure the resolver exposes `attack_bonus` and `save_dc` totals.

**Test:** Manual: load a multi-proficient character, verify modal selector works.

### Phase 8.M.4 — Test character seed update (optional)

**Goal:** Seed a test character with multi-proficient state to validate the selector.

**Files:**
- `scripts/seed-test-character.ts` — add a second test character with proficiency in 2 attributes

## § Estimated session budget

- Phase 8.M.1: ~1 session (engine refactor + tests)
- Phase 8.M.2: ~1-2 sessions (UI modals + sheet display)
- Phase 8.M.3: ~0.5 session (API plumbing)
- Phase 8.M.4: ~0.5 session (seed update)

**Total: ~3-4 sessions** (~1 week at 1/day).

## § Review checklist (per Mashu)

- [ ] OQ-1: Confirm scope is `attack_bonus` + `save_dc` only (not `defense_dc`)
- [ ] OQ-2: Confirm default selector behavior when multi-proficient
- [ ] OQ-3: Confirm per-attr primitives targets stay (engine math doesn't change semantically)
- [ ] OQ-4: Confirm behavior markers (`behavior.advantage.skill_practice_check.communion`) are NOT touched
- [ ] OQ-5: Confirm single `attrProficient` is kept for now (multi-proficiency is future)
- [ ] Sign off on Phase 8.M.1 plan (engine math refactor)

## § What's NOT in Phase 8.M (out of scope)

- **`defense_dc` refactor** — stays per-attribute. Different problem space.
- **Multi-proficiency on character** — `attrProficient` stays single-valued. The selector UI is built to handle multi-attr but the data model is still single.
- **Behavior markers (advantage/disadvantage counters)** — completely separate.
- **Healing/HP/vitality math** — different system.