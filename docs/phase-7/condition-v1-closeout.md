# Phase 7 Q-B — Condition v1 Closeout

**Status:** Phase 7 closed. New primitives write the v1 condition
shape end-to-end. Old shapes still load and render correctly.

**Last commit:** see `git log` for `feat(phase-7-Q-B)` lines.

---

## What landed

### 1. Schema (`src/types/condition.ts`)

- `ConditionPresetKey` — closed union of 16 canonical keys (7 target /
  5 scene / 4 actor).
- `CONDITION_PRESETS` — readonly catalog. Source of truth for the
  picker UI and the engine's future preset recognizer.
- `ModifierCondition` — v1 discriminated union of
  `{kind: "preset", presetKey, customTags}` /
  `{kind: "narrative", text}` / `{kind: "tags", customTags}`.
- `ConditionAuthoring` — picker input shape (with `includeTags` flag).
- `LegacyModifierCondition` — the old `{key, operator, value}` triple,
  re-exported from `@/types/swordweave` for compatibility.

### 2. Parser & helpers (`src/lib/primitives/condition.ts`)

- `parseCondition(raw)` — accepts legacy OR v1; returns v1 or `null`.
- `buildCondition(authoring)` — picker → canonical shape, with 4-rule
  precedence (preset > tags > narrative > null).
- `migrateLegacyCondition(legacy)` — used by the DB migration (E).
- `conditionToBadges(condition)` — character-sheet badge render.
- `presetLabel(key)` — display lookup.
- `legacyConditionProjection(raw)` — **new in D-prime**. Projects any
  shape back into the legacy triple for the ModifierDraft cache.

### 3. Picker UI (`src/components/sandbox/condition-picker.tsx`)

- Collapsible accordions by category (Target / Scene / Actor).
- Pill chips inside each accordion. Click → preset selected.
- Free-text pill adder.
- Plain-text narrative escape hatch.
- "Show custom pills as separate badges" checkbox (visible when no
  preset is selected — drives `ConditionAuthoring.includeTags`).
- "clear preset" button (preserves custom tags + narrative).

### 4. Wiring

- `primitive-form.tsx` — `<ConditionPicker>` replaces the old
  "Applies When" dropdown + 3-field triple. `ModifierDraft` carries
  `v1Condition: ConditionAuthoring`. `toHardModifier` now writes the
  v1 shape via `buildCondition()`.
- `primitive-form-preview.tsx` — `modifiersFromHardModifiers` reads
  any condition shape via `legacyConditionProjection` for the legacy
  cache. Picker reads `v1Condition` on load.
- `primitive-registry.tsx` — same projection treatment.
- `library-item-preview.tsx` — replaced the JSON `<pre>` dump in
  the saved-records preview with a proper modifier list rendering
  each row's condition via `<ConditionBadges>`.

### 5. Engine (`src/lib/engine/modifiers.ts`)

- `evaluateCondition(condition, context)` widened to accept
  `HardModifierCondition` (legacy OR v1).
- v1 shapes (`preset`, `narrative`, `tags`) — engine returns `true`.
  Phase 7 is **display-only**: the character sheet renders the
  condition as a badge, and the DM adjudicates at the table. The
  engine never gates a modifier behind a v1 condition in v1.
- Legacy shapes — operator-based evaluation preserved in
  `evaluateLegacyCondition()`. Existing pre-v1 modifiers keep their
  gate behavior unchanged.

### 6. New component (`src/components/library/condition-badges.tsx`)

- `<ConditionBadges condition={...} />` — presentational badge row.
- Renders presets as primary-tinted pills, custom tags as neutral
  pills, narrative as italic prose.

---

## What was deferred

### Full D — character sheet + character creation rendering

The "minimal D-prime" implemented in this milestone renders condition
badges in the **sandbox grammar saved-records preview** only. This
was enough to verify the end-to-end loop: pick a preset in the form,
save the primitive, see the badge appear in the preview.

**Not implemented in this milestone:**

- **Character sheet rendering during play.** The actual
  `/sandbox/characters` page (and any character-creation flow) does
  not yet render condition badges next to applied modifiers. When
  a player has a modifier with a `target-below-half-hp` condition,
  no badge appears in their active sheet — the modifier is applied
  (engine returns `true` for v1), but the condition is invisible to
  the player during play.

- **DM-side condition tracker.** No way for a DM to track which
  conditions are currently active for a target / scene / actor.
  The condition is purely an authoring hint on the modifier
  description at this point.

This is the next-phase work. When the character-sheet phase opens,
the same `<ConditionBadges>` component should drop in. The challenge
won't be rendering (the component is reusable) — it'll be deciding
**when** a condition is active, since v1 doesn't have an evaluator.
Possible approaches for the next phase:

- LLM-assisted adjudication (parse narrative + current scene state).
- Manual DM toggle ("this target is bleeding right now").
- Hybrid: presets auto-trackable (HP thresholds), narrative
  always manual.

Decision deferred until the character-sheet phase opens.

### C2 — mirror picker into effect-form and capability-form

The picker is currently only wired into `primitive-form.tsx`.
Effect and capability forms still use the old condition triple.

When to do this:
- After E (DB migration) lands and the new shape is canonical.
- Or as a parallel milestone if effects/capabilities need richer
  condition authoring sooner.

---

## Migration plan for legacy DB rows (E)

When E is approved:

1. **Backup first.** `pg_dump` of the entire Neon DB.
2. **Dry run.** Run the migration in dry-run mode to count rows
   that need migrating and surface any that look malformed.
3. **Run the migration.** Use `migrateLegacyCondition()` on every
   `modifier.condition` value across the primitive/effect/capability
   tables.
4. **Verify.** Spot-check rows. Confirm `kind === "preset"` rows map
   to known preset keys. Confirm `kind === "narrative"` rows carry
   the original value as text.
5. **Optional cleanup.** Once verified, delete the
   `LegacyModifierCondition` type, the `conditionKey/Operator/Value`
   fields on `ModifierDraft`, and `evaluateLegacyCondition()` in the
   engine. All known condition evaluation now routes through the
   v1 path.

E is not blocking Phase 7 closeout. The new code is forward-
compatible with old data via `parseCondition()`, so existing
primitives keep working without E. E is a one-shot housekeeping
task for code cleanliness, not a functional requirement.

---

## Open questions for the next phase

1. **Where does the engine route v1 preset keys when evaluation is
   needed?** Pick a Phase 7.5 strategy (see "What was deferred /
   Full D" above).
2. **Are custom pills engine-addressable?** Right now they're
   display-only. If a future preset catalog expands to cover author-
   added pills (via a permissioned registry), the engine needs to
   know about them.
3. **BU cost of conditions?** Should a modifier's BU cost increase
   if it carries a preset that implies engine evaluation? Currently
   no. Deferred.