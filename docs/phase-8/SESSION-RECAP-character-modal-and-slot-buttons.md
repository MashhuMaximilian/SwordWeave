# Phase 8 — Session Recap: Character Modal + Atelier Slot Buttons

**Date:** 2026-07-21
**Author:** Senku (mod for Mashu, Phase 8 kickoff rev 5)
**Status:** 🔄 Recap confirmed — pre-build, no code yet

Companion doc to `PHASE-8-PLAN.md` + `CREATION-MODAL-FLOW.md`. Read those first.

---

## TL;DR — what we're building next

Two things, in order:

### (A) Heritage parity — add `tags` + `sourceOrigin` to heritage build modal (DB + form + render)

**Confirmed gap (2026-07-21 audit):**
- `heritage` table (`src/db/schema/characters.ts:263`) has `source_origin` column but **no `tags` column**. So heritage rows CANNOT store tags today.
- `heritage-form.tsx` (`src/components/sandbox/heritage-form.tsx`) renders **neither** `sourceOrigin` nor `tags` fields. The columns exist in DB for sourceOrigin but the form just doesn't bind them.
- `item-form.tsx` already has both fields wired (`src/components/sandbox/item-form.tsx:639-643`). Items are parity-correct.
- The `entity-preview.tsx` preview renderer already knows how to display both (`src/components/preview/entity-preview.tsx:715, 773, 785, 829, 839, 964, 974`), so once data flows in, it just renders.

**What needs to happen:**
1. Migration: add `tags text[]` column to `heritage` table, plus GIN index (mirror items).
2. Schema: add `tags: text("tags").array().notNull().default(sql\`ARRAY[]::text[]\`)` to the heritage table in `src/db/schema/characters.ts`.
3. Form: add `sourceOrigin` + `tags` fields to `heritage-form.tsx` matching the item-form pattern.
4. Submit: parse and pass both fields on save.

### (B) Fix / restore the missing "Slot into build" buttons in atelier previews

The slot-into-build buttons are partially broken or missing in the atelier preview modal. Per Mashu's report:

- Should appear for **primitives into effects and capabilities loaded in build**, and **effects into capability that is already loaded** — i.e. the bundling-hierarchy rule.
- Should appear on **heritages** (slot primitives + capabilities into heritage loaded in build).
- Should appear on **items** (slot primitives + capabilities + effects into item loaded in build).

**Current bug observed:** the button has disappeared in the atelier preview. Infrastructure is intact (functions + slot event + dispatch logic still wired in `grammar-library.tsx` / `heritage-library.tsx`), but the button no longer renders.

Likely root cause (to verify once code begins): the `canSlot` checks only consider `slottableKinds` against `build` mode. When `build === "heritage"` or `build === "item"`, the heritage-library hardcodes `slottableKinds = ["primitive","effect","capability"]` which is correct, BUT we also need to make sure the preview body actually renders the `primarySecondary` button when the *previewed item* matches one of those kinds.

### (B) Add "Slot into character" button — alongside "Slot into build"

Same preview modal, one more button below "Slot into build". Toggles the character modal and stages the item for slotting.

---

## The slot matrix — CANONICAL

Derived from the bundling hierarchy in `CREATION-MODAL-FLOW.md`:

```
Template (race / background / archetype / item)
 └── Capabilities
     └── Primitives (verbs, domains, ranges, structures)
     └── Effects
         └── Primitives
 └── Primitives (standalone, e.g. +1 physical, +1 Prowess)
```

**Where can X be slotted?**

| Mechanic X \ Target → | Primitive | Effect | Capability | Heritage | Item | Character |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Primitive | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| Effect    | — | — | ✅ | (via Cap) | ✅ | ✅ |
| Capability | — | — | — | ✅ | ✅ | ✅ |
| Heritage   | — | — | — | — | — | ✅ |
| Item       | — | — | — | — | — | ✅ |

Notes:
- **Effect → Heritage** is only possible via nesting into a Capability. Heritage slots capabilities (which contain effects). Direct effect → heritage slotting is not a thing.
- **Effect → Character** is allowed directly (the character modal has an Effects slot too, via capability bundles).
- **Heritage / Item → Build** is **not** allowed. They have their own build tabs (`?build=heritage`, `?build=item`) but the "slot into build" target for them is the *parent container* of whatever they're authoring, which doesn't make sense — they're top-level entities.

### Two "slot into" buttons in atelier preview

| Button | Visible when | Targets |
|---|---|---|
| **Slot into build** | Build modal/drawer is open AND previewed kind is slottable into build mode | Whatever's open in the middle column (the active build form) |
| **Slot into character** | Character modal is open AND previewed kind is slottable into character | The active character draft |

### Build-mode gating for "Slot into build"

Per `grammar-library.tsx:636-641` (existing logic, to be kept):
- **Primitive mode** → nothing slottable (you ARE a primitive).
- **Effect mode** → accepts primitives only.
- **Capability mode** → accepts primitives + effects.
- **Heritage mode** → accepts primitives + capabilities + effects (per blueprint library).
- **Item mode** → accepts primitives + capabilities + effects (per blueprint library).

The matrix above encodes this — cells where build mode = primitive column are blank.

### Character-modal gating for "Slot into character"

Always allows: primitives, effects, capabilities, heritages, items — if the character modal is open with an active draft (Mode A new character, or Mode B tabbed editor).

---

## The FAB — what changes

`src/components/layout/fab-speed-dial.tsx` — the existing FAB is a single hamburger that expands into a menu with a 2x3 icon-grid at the bottom:

```
[ split ]  [ dark ]  [ fullscreen ]
[account ]  [ build ]  [ filters ]
```

**Changes:**
1. **Remove `filters`** from the icon-grid (Mashu's note: filter is already a button in the page, FAB redundancy is not worth it).
2. **Add `character`** to the icon-grid, next to `build`. Icon: `delapouite/mona-lisa` (verified in `src/lib/icons/game-icons-index.json`).

New grid:
```
[ split ]  [ dark ]  [ fullscreen ]
[account ]  [ build ]  [ character ]
```

When `build` and `character` are both tapped in sequence, behavior is: **modal-stack with replace**. Tapping `character` while build is open closes the build modal (state preserved in Zustand — not reset), and shows the character modal. Tapping `build` while character is open does the reverse.

---

## The character modal — high-level recap

Per `CREATION-MODAL-FLOW.md` rev 4, this is what the modal does:

1. **FAB-launched** (Mona Lisa icon). Persistent overlay above sandbox. State in Zustand (survives nav).
2. **Mode A — New character** (lvl 1, first time): stepped wizard — 5 steps: Identity → Attributes → Lineage → Upbringing → Manifest → Review. Inside the modal. "Save & Exit" creates character. "Continue editing" → converts to Mode B.
3. **Mode B — Existing character / post-creation**: tabbed editor with tabs Identity | Lineage | Upbringing | Manifest | Items | Notes. Live BU budget bar at top (Net BU / Volatility / Level / usage bar).
4. **Slot source assignment**: when slotting, pick RACE | BACKGROUND | PERSONAL | TRAINING | LEVEL_UP | DM (existing `characterPrimitiveSourceEnum`).
5. **Mirror toggle**: `isMirrored = true` → +BU credit per existing schema.
6. **Slot from sandbox**: "Slot into character" button in primitive/effect/capability/item editors + library preview + atelier preview.
7. **Library picker side panel**: in modal, browse + pick without leaving.
8. **Template pre-loads**: picking a lineage populates Lineage tab with its primitives + capabilities.
9. **Preview opens in new tab**: `/characters/[id]` always opens separately.

What is **NOT** in scope: live character sheet rendering, capability modes, custom stats JSONB, token resolver, math helpers, conditions engine v2, share links, collections. That's the **deferred sheet track**.

---

## Slot button rendering in atelier preview — where they live

`src/components/preview/entity-preview.tsx` — the unified `LibraryItemPreview` rendering. Receives a `PreviewActionProps` object that includes `loadIntoBuild` + `primarySecondary` (slot into build) + ownership actions. **Add `slotIntoCharacter`** as a new action prop.

The action-bar code lives in `grammar-library.tsx:745-771` (for grammar-library preview) and `heritage-library.tsx:815-839` (for blueprint-library preview). Both currently pass:

```ts
const actionBar: PreviewActionProps = {
  loadIntoBuild: { label: "Load into build", onClick: ... },
  ...(canSlot ? { primarySecondary: { label: "Slot into build", onClick: slotIntoBuild } } : {}),
  ...(isOwner ? { onEdit, onDelete, ... } : {}),
  openSourceHref, versionHistoryHref,
};
```

Both need to grow `slotIntoCharacter` (gated by `canSlotIntoCharacter` — character modal open + kind is slottable into character).

---

## Open questions before code begins

Three decisions to lock in:

1. **Pending slot queue vs immediate slot** (CREATION-MODAL-FLOW.md Q3 — never resolved). Recommendation: immediate slot if character modal is open, pending queue with FAB badge if not. The pending queue state lives in the existing `character-modal-store.ts` Zustand.
2. **What does "is the character modal open" actually mean?** Two cases: (a) the modal is visible, (b) a draft exists in the store. Recommendation: require both — show "Slot into character" only when (a) AND (b). Otherwise fall back to "Open character modal & slot" with a queued payload.
3. **Item kind `item` already has `Slot into build` working** — but the rules need verification. Per Mashu's note: "in items primitives, capabilities, and effects" → so `canSlot` for items should match the heritage matrix (primitives + capabilities + effects, all of them slottable since items are top-level and accept anything). Confirm against `heritage-library.tsx` lines 708-715 — that code path looks correct but we'll verify.

---

## Build order (when we start coding)

1. **Heritage parity migration** — add `tags` column to heritage table + GIN index.
2. **Heritage parity schema** — wire `tags` into `src/db/schema/characters.ts`.
3. **Heritage parity form** — add `sourceOrigin` + `tags` inputs to `heritage-form.tsx` (mirroring `item-form.tsx:639-643`).
4. **Heritage parity submit** — parse fields on save (mirror items).
5. **Verify the matrix in `heritage-library.tsx`** matches the table above (primitives + effects + capabilities all slottable into heritage AND item build modes).
6. **Fix the missing slot-into-build rendering** in both libraries.
7. **Add `slotIntoCharacter` to `PreviewActionProps` interface** in `preview-shared.tsx`.
8. **Render the new button** in both `SandboxPreviewBody` and `BlueprintPreviewBody` with appropriate gating.
9. **Wire character modal store** — add `pendingSlots: SlotEvent[]` + `addPendingSlot` + `consumePendingSlot`.
10. **Add Mona Lisa to FAB icon-grid**, remove filters.
11. **Test end-to-end**: open character modal, navigate atelier, slot into character → verify modal reflects slot.

---

## Files involved (current state)

### Read for this recap
- `src/components/sandbox/grammar-library.tsx` (800 lines) — has `slotIntoBuild` + `SandboxPreviewBody`
- `src/components/sandbox/heritage-library.tsx` (870 lines) — has `slotIntoBuild` + `BlueprintPreviewBody`
- `src/components/sandbox/primitive-form.tsx` (1739 lines) — has Tags + Source origin fields
- `src/components/preview/preview-shared.tsx` — defines `PreviewActionProps` with `loadIntoBuild` + `primarySecondary`
- `src/components/preview/entity-preview.tsx` — unified preview renderer
- `src/components/library/library-item-preview.tsx` — SandboxPreviewItem type defs
- `src/components/layout/fab-speed-dial.tsx` — current FAB (hamburger + 2x3 icon-grid)
- `src/lib/sandbox/slot-events.ts` — `SLOT_EVENT_NAME` + `SlotEvent` type

### To modify (when we start)
- `src/components/sandbox/grammar-library.tsx` — fix missing slot-into-build + add slot-into-character
- `src/components/sandbox/heritage-library.tsx` — fix missing slot-into-build + add slot-into-character
- `src/components/preview/preview-shared.tsx` — add `slotIntoCharacter` to `PreviewActionProps`
- `src/components/preview/entity-preview.tsx` — render `slotIntoCharacter` button
- `src/components/layout/fab-speed-dial.tsx` — swap filters for character (Mona Lisa)
- `src/components/character-modal/character-modal-store.ts` — add pending slots queue

### To create
- `src/components/character-modal/` — the whole directory tree from CREATION-MODAL-FLOW.md
- `src/components/character-modal/character-fab.tsx`
- `src/components/character-modal/character-modal.tsx`
- `src/components/character-modal/modes/stepped-wizard-mode.tsx`
- `src/components/character-modal/modes/tabbed-editor-mode.tsx`
- `src/components/character-modal/tabs/{identity,lineage,upbringing,manifest,items,notes}-tab.tsx`
- `src/components/character-modal/bu-budget-bar.tsx`

---

## Confirmation needed before code

- ✅ Slot matrix matches your mental model?
- ✅ FAB swap (filters out, Mona Lisa in next to build) correct?
- ✅ Modal-stack with replace for build ↔ character toggling correct?
- ✅ "Slot into character" shows same rules as "Slot into build" except no build-mode gating (always allowed when character modal open + kind is in character slot enum)?

Once you confirm these, I start with step 1 (fix the missing slot-into-build bug) and we'll go from there.