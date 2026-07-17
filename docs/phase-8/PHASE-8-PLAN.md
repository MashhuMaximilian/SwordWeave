# Phase 8 — Character Sheet & Character Creation Modal

**Date:** 2026-07-17
**Author:** Senku (mod for Mashu, Phase 8 kickoff)
**Status:** 🔄 IN PROGRESS — answers received 2026-07-17

---

## What this phase is

Phase 8 = **character sheet + character creation, FAB-launched modal**. A persistent floating-action button in the sandbox opens a character builder overlay. The overlay sits ABOVE the sandbox 3-column layout (desktop) or full-screen (mobile). State survives tab navigation. The character sheet (view mode) is its own page.

The central question the user flagged: **"character creation in a modal system like build?"**

The answer (clarified): the character builder is **NOT** a page route like build mode. It's a **persistent overlay layer** above the sandbox. State lives in client memory (Zustand/Context), NOT in the URL. A FAB in the bottom-right of the sandbox launches it.

The user can have grammar → templates → blueprint open below, character builder above, and the builder doesn't reset when they navigate.

---

## User-confirmed answers (2026-07-17)

1. **8.1 modal pattern:** FAB-launched persistent modal. Both desktop and mobile. Layer above sandbox, not a URL route.
2. **8.6 Q1 (custom pills):** **NO registry.** Custom tags = display-only forever. The engine handles HP/resources + auto-calculated primitives (like damage reduction) + math assistance. It does NOT try to adjudicate author-written custom conditions.
3. **8.6 Q2 (BU cost):** **NO change.** Cost is the modifier's intrinsic value. Condition is metadata.
4. **8.7 (template pre-loads):** **Ship in Phase 8.**
5. **8.9 (collections):** **Ship in Phase 8.**

---

## What the character sheet IS

Per user clarification (2026-07-17):
- **Not a VTT.** People play at the table IRL.
- **Display** the character: stats, capabilities, slotted primitives, conditions, notes
- **Track** HP, resources, status (checkboxes for conditions, current/max HP)
- **Lightweight actions** that help with math (apply damage, apply healing, etc.) — the engine handles primitives that auto-calculate (like Vitality Shielding halving incoming damage)
- **Soft warnings** when a capability references missing primitives (system flags the gap, user resolves at the table)
- **Never** adjudicates custom conditions automatically. The DM/player handles that.

---

## Sub-phase ordering

### 8.0 — Mirror Badge Fix (carryover from Phase 7 closeout, Q5)

**Effort:** ~30 minutes
**Risk:** Trivial
**Blocks:** 8.3 (character sheet rendering needs mirror badges live)

**What:**
- Widen `formSnapshot.primitiveIds` to also carry `mirroredPrimitiveIds: number[]` next to it
- Item form's preview pane reads from snapshot, not just DB row
- MIRRORED badges now show while editing, not only after save

Land first; nothing else has to backtrack.

---

### 8.1 — Character Creation Modal (FAB-launched persistent overlay) — THE central issue

**Effort:** 6-8 days
**Risk:** Medium-high (architectural; new persistent layer pattern)
**Blocks:** 8.3, 8.7, 8.9 (everything that touches the character creation flow)

**The architecture:**

```
┌─────────────────────────────────────────────────┐
│  Sandbox page (grammar / templates / blueprint) │  ← URL-driven, navigates normally
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │                                           │ │
│  │         Character Builder Modal           │ │  ← Fixed-position overlay, persistent
│  │         (persistent client-side state)    │ │
│  │                                           │ │
│  │   ⛶                                       │ │
│  └───────────────────────────────────────────┘ │
│                              [⚒ FAB]            │  ← Floating Action Button, bottom-right
└─────────────────────────────────────────────────┘
```

The modal is **always overlay** (both desktop and mobile). The 3-column sandbox layout stays visible behind the dim/blur. On mobile, the modal goes full-screen. The modal state persists across sandbox tab navigation because it lives in a global Zustand store, not in any URL.

**Implementation:**

| New file | Purpose |
|---|---|
| `src/lib/characters/character-store.ts` | Zustand store: `currentCharacter`, `pendingSlots`, `setName()`, `addSlot()`, etc. Persists across navigations. |
| `src/components/character-modal/character-modal.tsx` | The persistent overlay component. Mounted once in the sandbox layout. Reads/writes to the store. |
| `src/components/character-modal/character-fab.tsx` | The floating action button. Always visible in sandbox bottom-right. Toggles the modal. |
| `src/components/character-modal/character-modal-provider.tsx` | Provider that mounts the modal + FAB at the sandbox layout level. |
| `src/app/sandbox/layout.tsx` (or root layout) | Wraps children with `<CharacterModalProvider>` so it covers all sandbox tabs. |

**The wizard flow (inside the modal):**

The modal contains a step indicator + the existing `CharacterWizard` UI, adapted to read/write from the Zustand store instead of `useState`. The user can:
1. Click FAB → modal opens (empty character form, or current `currentCharacter` if any)
2. Walk through steps: Identity → Attributes → Race/Background → Capabilities/Items → Review
3. Click "Save" → POST `/api/characters` → close modal, character is now in their library
4. Click "Save & Continue" → persists draft without closing

**Slotting from sandbox into character modal:**

When the user is in `/sandbox/grammar` looking at a primitive, and clicks "Slot into character":
- The primitive id is added to the store's `pendingSlots`
- The FAB shows a small badge ("3 pending")
- When the user opens the modal, those slots are pre-loaded into the character's capability/item list

The "Slot into character" button reads from the same `library-engagement`/library action system that "Slot into build" uses, but writes to the character store instead of the build's local state.

**Layout integration:**

The sandbox layout (currently `src/app/sandbox/`) needs to wrap all its children with `<CharacterModalProvider>`. The modal sits as a fixed-position div with `z-50`, the FAB as `fixed bottom-6 right-6`. On mobile, the modal goes full-screen. On desktop, it's a centered 80% width panel.

**Out of scope for 8.1:**
- The actual character sheet view (separate page) is part of 8.3
- The "edit existing character" entry point is in 8.3 (the character sheet page has an "Edit" button that opens the modal pre-filled)
- Condition badges (8.5) come after 8.3

---

### 8.2 — Token Resolution Engine + Missing-Primitive Warnings

**Effort:** 5-6 days
**Risk:** Medium (foundational; everything character-sheet depends on this)
**Blocks:** 8.3, 8.4, 8.5

**The problem:**
Phase 7.5 stored modifier values as **tokens** (`{kind: "attribute", value: "PHYSICAL"}`) instead of raw numbers. This was correct — modifiers reference character state, not constants. But the runtime engine was deferred to Phase 8.

Also: when a character has a capability but is missing required primitives, we need to flag it. Soft warning, not a hard error.

**The solution:**

```typescript
type ResolutionResult = {
  number: number;          // the resolved numeric value
  warnings: Warning[];     // soft warnings for unresolvable tokens
};

function resolveTokens(
  tokens: ValueToken[],
  character: Character,
  context: ResolutionContext
): ResolutionResult
```

**Token kinds to support (from Phase 7.5):**
| Kind | Example | Resolution |
|---|---|---|
| `attribute` | `{kind:"attribute", value:"PHYSICAL"}` | Look up character's `attrPhysical` |
| `practice` | `{kind:"practice", value:"PROWESS"}` | Look up character's practice total for that practice |
| `derived` | `{kind:"derived", value:"PB"}` | `attrProficient` if set, else 0 |
| `behavior` | `{kind:"behavior", value:"darkvision"}` | Check character.behaviors → boolean → 0 or 1 |
| `dice` | `{kind:"dice", value:"1d4"}` | Random roll (or fixed for sheet preview) |
| `number` | `{kind:"number", value:3}` | Pass-through |

**Mirror handling extracted here:** when a modifier is on a mirrored primitive, the value flips per `OP_SPECS`. Mirror the op (e.g. `add` → `subtract`), then resolve normally.

**Soft warnings (per user's note: "missing primitives should be flagged, not duplicated"):**

```typescript
type Warning = 
  | {kind:"unresolved-token", token: ValueToken, message: string}
  | {kind:"missing-primitive", capabilityId: string, primitiveId: number, message: string};
```

**`missing-primitive` warning:** when a character has a capability slotted that requires primitive X (per the capability's required-primitive list), and X is not in the character's slotted primitives, emit a warning. Don't auto-add (avoid duplicates). Surface in the sheet as a yellow callout: "Required primitive 'Vitality Shielding' not slotted. Add it from the library to enable this capability's full effect."

This is the soft-warning hook the user wants. The character sheet shows the gap; the user decides whether to slot the missing primitive or accept the limitation.

**Location:** `src/lib/engine/token-resolver.ts`

---

### 8.3 — Character Sheet Live Rendering + View Mode

**Effort:** 6-8 days
**Risk:** Medium
**Blocks:** 8.4, 8.5

**The problem:**
The existing `/characters/[id]` view shows static stored values. We need it to compute live values from the modifier graph using `resolveTokens`. The view is a separate page (NOT a modal) — this is the "view-only" experience.

**The solution:**
Wire `resolveTokens` into the character-sheet-view component. For every modifier-bearing slot, resolve the modifier's tokens and aggregate the effect on the relevant character stat.

**Stats to live-render:**
- HP (current / max) — trackable: HP up/down buttons, current HP box
- Each attribute (Physical / Mental / Magical)
- Each practice total (10 of them)
- Proficiency bonus (derived)
- BU total spent / remaining
- Damage reduction (from slotted primitives like Vitality Shielding)
- Movement speed
- Initiative

**Architecture:**
```
character-sheet-view.tsx
  → loads character + all slotted primitives/capabilities/items
  → calls resolveAllModifiers(character, context) which:
     1. Walks every slot
     2. For each modifier, resolveTokens(modifier.tokens, character, context)
     3. Apply the operation with the resolved number (with mirror flip)
     4. Accumulate effects per target stat
  → renders the live values + soft warnings (missing primitives, unresolved tokens)
```

**Lightweight actions (per user):**
The sheet has buttons for common math:
- **Apply Damage** — opens a small modal: input damage amount → runs through damage reduction primitives → updates current HP
- **Apply Healing** — similar
- **Add Note** — appends to character's notes
- **Toggle Condition** — checkbox UI for tracked conditions (poisoned, etc.)

These are math helpers. They call `/api/characters/[id]/adjust` with the change. The engine runs the math; the user confirms.

**Files:**
- `src/lib/engine/resolve-all-modifiers.ts` — the new entry point
- `src/components/characters/character-sheet-view.tsx` — replace static values with live values, add lightweight action buttons
- `src/app/characters/[id]/page.tsx` — existing; add Edit button that opens character modal with this character pre-loaded

---

### 8.4 — Condition Evaluator v2 (auto-trackable only)

**Effort:** 3-4 days
**Risk:** Low
**Blocks:** 8.5

**The problem:**
v1 conditions are display-only. Phase 7 closed with the engine returning `true` for any v1 condition. The Phase 7 closeout identified this as a "Phase 28 (probably never)" issue, but the user is now scoping it in.

**The solution (simplified by user clarification):**

```typescript
type ConditionSource = "auto" | "narrative";
type Evaluation = {
  active: boolean;
  source: ConditionSource;
};

function evaluateCondition(
  condition: ModifierCondition,
  character: Character
): Evaluation
```

**Auto-trackable (initial whitelist — only what we can derive from existing columns):**
- `target-below-half-hp` → `character.hp / character.maxHp < 0.5`
- `target-below-quarter-hp` → `character.hp / character.maxHp < 0.25`
- That's it for v1. Add more as new primitives need them.

**Narrative (display-only, ALWAYS):**
- `{kind: "narrative"}` → always `{active: false, source: "narrative"}`
- `{kind: "tags"}` with custom tags → always narrative
- Unknown preset keys → narrative, source: "narrative", warning
- **No engine evaluation of custom tags. Ever.** Per user answer.

**Mirror handling here too:** when the underlying primitive is mirrored, the condition's "active" status is computed identically — mirror affects value sign, not trigger logic.

**Location:** `src/lib/engine/condition-evaluator.ts`

---

### 8.5 — Live Condition Badges

**Effort:** 2-3 days
**Risk:** Low
**Blocks:** none

**The problem:**
`<ConditionBadges>` exists but only renders preset/tag/narrative — no `active`/`source` coloring.

**The solution:**
Extend `<ConditionBadges>` to accept a live evaluation, color badges by `source`:
- `auto + active` → green (vivid, drawing attention)
- `auto + inactive` → outlined gray (visible but not shouting)
- `narrative` → gray italic (always display, never active)

Drop the enhanced component into `character-sheet-view.tsx`. For each modifier-bearing slot, render its condition badge with the live evaluation.

**Live updates:**
- Polling every 5s for v1
- When HP changes (after Apply Damage / Apply Healing), next tick reflects new state
- Realtime sync deferred

**Files:**
- `src/components/library/condition-badges.tsx` — extend with `evaluation` prop
- `src/components/characters/character-sheet-view.tsx` — drop in live badges

---

### 8.6 — DELETED

Q1 (custom pills): NO registry. Display-only forever. No work needed.
Q2 (BU cost): NO change. No work needed.

This sub-phase is closed. Both decisions are codified in 8.4 ("narrative = always display-only").

---

### 8.7 — Template Pre-loads for Character Creation

**Effort:** 2-3 days
**Risk:** Low
**Blocks:** none

**What:**
A character sheet template system that pre-loads canonical primitives / capabilities / items when the user picks a template at character creation time. Already partially supported via the `archetypeName` field on `BuildComposer` — extend to `CharacterComposer` (the modal from 8.1).

When a user picks a template (race/background/archetype), the character editor auto-fills:
- The relevant primitives slotted at level 1
- The starting capabilities
- The starting items
- The BU budget

User can then customize (add/remove/change).

**Location:** `src/lib/characters/template-loader.ts`

---

### 8.8 — Share-with-Link

**Effort:** 3-4 days
**Risk:** Medium (auth model + visibility)
**Blocks:** 8.9 (collections reference public links)

**The model:**
| Action | Anonymous | Signed-in (not owner) | Signed-in (owner) |
|---|---|---|---|
| View a public page | ✅ Read | ✅ Read | ✅ Read+edit |
| View a private page | ❌ 404 | ❌ 404 | ✅ Read+edit |
| Use a public source in their build | ❌ Sign-in required | ✅ | ✅ |
| Fork a public source | ❌ Sign-in required | ✅ | ✅ |

So anonymous = view-only, signed-in = can use and fork. Visibility rules stay the same (`is_public` on each entity).

**Implementation:**
- Existing `is_public` flag on each entity already drives visibility
- Add a new `/api/share/[token]` route that mints a public link token (random UUID, stored in a new `share_links` table)
- Add `/s/[token]` route that resolves the token and renders the library item
- Add "Share" button on each library item (owner-only) that generates + copies the link
- Revoke link = delete the row

**Files:**
- `src/db/schema/sharing.ts` — new `share_links` table
- `src/db/migrations/0036_share_links.sql`
- `src/app/api/share/[token]/route.ts` — mint/revoke
- `src/app/s/[token]/page.tsx` — public render

---

### 8.9 — Collections / Follow Lists

**Effort:** 5-7 days
**Risk:** Medium-high (new feature surface, cross-cutting)
**Blocks:** none

**The model:**
Per-user collections. Default 3:
1. **My Creations** — auto-populated with everything the user authored
2. **Forked** — auto-populated with everything the user forked
3. **Favorites** — user-curated (heart button anywhere in library)

Plus user-created custom collections.

**Visibility:** same as library items (`is_public` on each collection).

**UI surface:**
- `/u/[username]/collections` — public page listing that user's public collections
- `/collections` — signed-in user's collections dashboard
- `+` button anywhere in library to add to a collection (modal: pick collection or create new)
- Per-collection page: `/collections/[id]` showing the items in it

**Implementation:**
- `src/db/schema/collections.ts` — `collections` and `collection_items` tables
- `src/db/migrations/0037_collections.sql`
- `src/lib/collections/*` — query/insert/delete
- `src/app/collections/*` — pages
- `src/components/library/add-to-collection-button.tsx` — the button

---

## Suggested build order (revised, after user answers)

If we have limited credits/time, this is the priority order:

| # | Sub-phase | Days | Why this priority |
|---|---|---|---|
| 1 | **8.0** Mirror fix | 0.5d | Trivial carryover; unblocks 8.3 |
| 2 | **8.1** Character modal (FAB) | 7d | **THE central issue** |
| 3 | **8.2** Token resolver + missing-primitive warnings | 5d | Foundational |
| 4 | **8.3** Live rendering + lightweight actions | 7d | The "wow" of Phase 8 |
| 5 | **8.4** Condition evaluator v2 | 4d | Unblocks 8.5 |
| 6 | **8.5** Live condition badges | 3d | Visible payoff of 8.3 + 8.4 |
| 7 | **8.7** Template pre-loads | 3d | Polish on creation flow |
| 8 | **8.8** Share-with-link | 4d | Community |
| 9 | **8.9** Collections | 6d | Community |

**Total estimated effort:** ~39.5 days at single-developer pace.

8.6 deleted (no work needed).

If we ship 8.0 → 8.7, that's the **complete character experience**: modal creation + live sheet with computed values + live conditions + template pre-loads. ~29.5 days.

8.8 and 8.9 are the **community features**.

---

## What ships with Phase 8 (the punchline, revised)

When Phase 8 is fully done:

1. **FAB in the sandbox** launches a persistent character builder modal
2. Modal state survives tab navigation (grammar → templates → blueprint → back)
3. Slot primitives/capabilities/items into the character from anywhere in the sandbox
4. **Character sheet view** (separate page) renders live: HP, attributes, practices, BU totals, all computed from the modifier graph via token resolution
5. Apply damage/healing buttons that handle math through slotted primitives (Vitality Shielding halves, etc.)
6. Conditions show as colored badges — green for active HP-threshold presets, gray for narrative
7. **Soft warnings** when a capability references missing primitives (system flags, user resolves)
8. Mirror badges show live in the editor AND the sheet
9. Race/background/archetype templates pre-load canonical primitives
10. Public share links (anonymous-readable, signed-in to use)
11. Collections to organize bookmarks (My Creations / Forked / Favorites + custom)

That's a complete interactive character-sheet experience + community features.

---

## See also

- `docs/phase-7/condition-v1-closeout.md` — v1 conditions (display-only)
- `docs/phase-7/phase-7.5-modifier-rebuild-spec.md` — modifier model with tokens
- `docs/phase-7/phase-710-COMPLETE.md` — Phase 7.10 effects/capabilities
- `docs/phase-7/phase-710-4-system-user-ui.md` — System user (admin) UI rule
- `docs/phase-7/phase-8-and-beyond-notes.md` — Phase 7 closeout deferred items