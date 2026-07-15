# Phase 7 Q-B — Condition v1 Closeout

**Status:** Phase 7 closed. New primitives write the v1 condition
shape end-to-end. Old shapes still load and render correctly. UI
cleanup A + B complete; migration script (E) shipped.

**Last commit:** see `git log` for `feat/fix(phase-7-Q-B)` lines.

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
- `legacyConditionProjection(raw)` — projects any shape back into the
  legacy triple for the ModifierDraft cache.

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

### 7. UI cleanup A — removed in-modal slot pickers

Removed the duplicate `+ Slot primitive/effect/capability` buttons
from all four sandbox forms. Slotting always happens via the Library
column's `Slot into build` action. Net change: **−550 lines of dead
code**.

- `effect-form.tsx` — dropped `+ Slot primitive` button,
  `pickerOpen` state, and the local `PrimitivePicker` function.
- `capability-form.tsx` — dropped `+ Slot primitive` AND
  `+ Slot effect` buttons, `pickerOpen`/`pickerTarget` state, and
  the local `SlotPicker` + `EffectPicker` functions.
- `template-form.tsx` — dropped `+ Slot primitive` AND
  `+ Slot capability` buttons, `pickerOpen`/`pickerTarget` state,
  and the local `SlotPicker` function.
- `item-form.tsx` — dropped `+ Slot capability` AND `+ Slot effect`
  buttons, `pickerOpen`/`pickerTarget` state, and the local
  `SlotPicker` function.

Empty-state messages updated to point at the Library column.

Commit: `749ca02`.

### 8. UI cleanup B — click-to-preview in right column

Clicking a slotted primitive/effect/capability in the right-column
form preview now opens that sub-entity's library preview modal —
same affordance as clicking from the library list.

Mechanism: a new `sw-sandbox-open-preview` CustomEvent bus in
`src/lib/sandbox/slot-events.ts`. The four form previews dispatch
the event when the user clicks a slotted sub-entity. `grammar-library`
and `blueprint-library` both listen for it and translate it to
`pushPreview()` on their modal stack. This decouples the form
previews from library internals — if a future sandbox adds another
library owner, it just listens for the same event.

- `slot-events.ts` — added `OpenPreviewEvent` + `dispatchOpenPreview()`
  + `OPEN_PREVIEW_EVENT_NAME` constant.
- `grammar-library.tsx` — listens for the event, routes to
  `pushPreview()`.
- `blueprint-library.tsx` — same; also handles `ITEM` targetType.
- `effect-form-preview.tsx` — primitive slots become click-to-preview
  buttons.
- `capability-form-preview.tsx` — primitive slots + bundled effects.
- `template-form-preview.tsx` — bundled primitives + capabilities.
- `item-form-preview.tsx` — primitive slots + capabilities + effects.

6 new tests for the slot-events bus (742/742 passing total).

Commit: `0fa8154`.

### 9. Migration script (E) — `scripts/migrate-primitive-conditions.mts`

Backfill utility: walks every primitive row, migrates
`HardModifier.condition` from the legacy `{key, operator, value}`
shape to the v1 `{kind: 'preset' | 'narrative' | 'tags'}` shape,
and writes the result back.

- Dry-run by default (no DB writes). Pass `--apply` to UPDATE.
- Idempotent: re-running on already-v1 rows is a no-op.
- Reuses `migrateLegacyCondition()` from `src/lib/primitives/condition`.
- Post-apply assertion: queries the DB to count remaining rows with
  legacy condition shapes; should be zero after apply.

**Verified against production Neon DB:**
- 152 primitive rows scanned
- 150 empty `hard_modifiers` arrays (no work)
- 2 rows with modifiers but no conditions (no work)
- 0 legacy-shaped conditions in production today

The migration script ships so it's ready when staging / seeded data
carries legacy conditions, but there's nothing for it to migrate on
production right now.

Usage:
```
pnpm tsx scripts/migrate-primitive-conditions.mts           # dry run
pnpm tsx scripts/migrate-primitive-conditions.mts --apply  # write
```

Commit: `6c4c003`.

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
  not yet render condition badges next to applied modifiers. When a
  player has a modifier with a `target-below-half-hp` condition, no
  badge appears in their active sheet — the modifier is applied
  (engine returns `true` for v1), but the condition is invisible to
  the player during play.

- **DM-side condition tracker.** No way for a DM to track which
  conditions are currently active for a target / scene / actor. The
  condition is purely an authoring hint on the modifier description
  at this point.

This is the next-phase work. When the character-sheet phase opens,
the same `<ConditionBadges>` component should drop in. The challenge
won't be rendering (the component is reusable) — it'll be deciding
**when** a condition is active, since v1 doesn't have an evaluator.
Possible approaches for the next phase:

- LLM-assisted adjudication (parse narrative + current scene state).
- Manual DM toggle ("this target is bleeding right now").
- Hybrid: presets auto-trackable (HP thresholds), narrative always
  manual.

Decision deferred until the character-sheet phase opens.

### C2 — RETIRED (does not apply)

Earlier closeout drafts listed "C2 — mirror picker into
effect-form and capability-form" as deferred work. After re-reading
the chirality rule with the user, this entry was retired:

> "You mirror the primitive you mirror its modifier. In capability or
> effect these do not have mirrored versions. You just use the same
> primitives and each one has its chirality nothing more. They don't
> have chirality themselves as templates or effects and capabilities.
> Only primitives (actually only their modifiers but the state carries
> over to the primitive bc each primitive has one modifier max. If it
> has no modifier it basically cannot be mirrored this is the implied
> rule."

Effects, capabilities, and templates don't carry conditions or
chirality themselves — they're compositions of primitives. The
condition picker is correctly wired only into `primitive-form.tsx`
because conditions live on primitive modifiers. There's nothing to
mirror into the other forms.

---

## Migration plan for legacy DB rows (E) — DONE

E shipped as `scripts/migrate-primitive-conditions.mts`. The script
is verified, idempotent, and ready to run whenever legacy-shape rows
appear (production DB has none today). See section 9 above for usage.

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