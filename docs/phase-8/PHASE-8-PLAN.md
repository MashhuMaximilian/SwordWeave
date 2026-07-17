# Phase 8 — Character Sheet & Character Creation Modal

**Date:** 2026-07-17
**Author:** Senku (mod for Mashu, Phase 8 kickoff)
**Status:** 🔄 IN PROGRESS — answers received 2026-07-17 (rev 2)

---

## What this phase is

Phase 8 = **character sheet + character creation, FAB-launched modal**. A persistent floating-action button in the sandbox opens a character builder overlay. The overlay sits ABOVE the sandbox 3-column layout (desktop) or full-screen (mobile). State survives tab navigation. The character sheet (view mode) is its own page.

The central question the user flagged: **"character creation in a modal system like build?"**

The answer (clarified): the character builder is **NOT** a page route like build mode. It's a **persistent overlay layer** above the sandbox. State lives in client memory (Zustand/Context), NOT in the URL. A FAB in the bottom-right of the sandbox launches it.

The user can have grammar → templates → blueprint open below, character builder above, and the builder doesn't reset when they navigate.

**FAB icon:** `delapouite/mona-lisa` from game-icons.net (verified in `src/lib/icons/game-icons-index.json`). Rendered via the existing `/api/icons/game/delapouite/mona-lisa` route.

---

## User-confirmed answers (2026-07-17, rev 3)

1. **8.1 modal pattern:** FAB-launched persistent modal. Both desktop and mobile. Layer above sandbox, not a URL route. FAB icon: `delapouite/mona-lisa`.
2. **Custom stats storage (Q-A):** **JSONB on characters table.** Durable across sessions/devices, flexible (no migration per new stat), no schema bloat.
3. **Stat contributions (Q-B):** **Implicit** through the existing modifier target field.
4. **Player-toggleable bools (Q-C):** **Explicit `player-toggle:<stat_name>` tag** in the condition picker.
5. **Capability states (NEW from user rev 3):** Capabilities have a **mode axis** — `passive` / `actionable` / `toggleable` / `both` (actionable + toggleable). Maps to the existing Phase 7.10 Style A/B/C classification:
   - **Passive (Style A)** = just contributes stats, no UI on sheet beyond listing
   - **Actionable (Style B)** = "Trigger" button on sheet, one-shot effect on activation (damage, heal, etc.)
   - **Toggleable (Style C)** = "Active/Inactive" toggle on sheet, persists state in `custom_stats`
   - **Both (Style B+C)** = toggle gate + trigger button (e.g. Channeled ability)
6. **Trigger actions:** One-shot math operations — roll dice from modifier tokens, apply effects (damage, heal, etc.), don't persist state changes (HP loss from incoming damage is logged separately).
7. **8.6 Q2 (BU cost):** **NO change.** Cost is the modifier's intrinsic value. Condition is metadata.
8. **8.7 (template pre-loads):** **Ship in Phase 8.**
9. **8.9 (collections):** **Ship in Phase 8.**

---

## What the character sheet IS

Per user clarification (2026-07-17):
- **Not a VTT.** People play at the table IRL.
- **Display** the character: stats, capabilities, slotted primitives, conditions, notes
- **Track** HP, resources, status (checkboxes for conditions, current/max HP)
- **Custom stats** that authors declare: `block_value`, `ki_points`, etc. — numeric and bool types
- **Player-togglable bools** for stance/buff effects: `defensive_stance_active`, etc.
- **Capabilities with mode** — passive / actionable / toggleable / both. Toggles persist, triggers are one-shot
- **Lightweight actions** that help with math (apply damage, apply healing, trigger a capability) — the engine handles primitives that auto-calculate (like Vitality Shielding halving incoming damage)
- **Soft warnings** when a capability references missing primitives (system flags the gap, user resolves at the table)
- **Never** tries to evaluate author-written custom condition expressions. The DM/player handles that.

### Capability mode axis (Style A/B/C, from Phase 7.10)

Every capability has a **style** classification that the user clarified determines sheet UI:

| Style | Mode | UI on character sheet | Engine behavior |
|---|---|---|---|
| **A** | Passive | Listed in passive stats section | Just contributes to stats; no interactivity |
| **B** | Actionable | **Trigger** button | One-shot action: rolls dice, applies effects (damage/heal/etc.), doesn't persist state |
| **C** | Toggleable | **Active/Inactive** toggle | Persists bool in `custom_stats`; passive modifiers gated by that bool apply when active |
| **B+C** | Both | Toggle + Trigger button | Toggle gates whether trigger is usable; trigger fires one-shot when toggled-on |

**Examples:**
- **Shield Bash** (Style B, actionable) — Trigger button → "Roll to hit" → "Deal block_value damage"
- **Defensive Stance** (Style C, toggleable) — Active toggle → multiplies block_value by 2 when active
- **Channeled Heal** (Style B+C) — Toggle "Channeling" → Trigger "Release Heal" → HP +X
- **Thick Skin** (Style A, passive) — Just shows "+1 to all defenses" in passive stats

### The "Block" example, mapped to architecture

User scenario: A player has a shield primitive (gives `block_value = 3`) + a "Defensive Stance" capability (`multiply block_value 2` when active) + a "Shield Bash" capability (`add block_value to damage dealt` when active). Player toggles Defensive Stance in the sheet.

**What this needs:**

1. **Custom stat on character** — `block_value: number` lives on the character. Authored as a contribution from the Shield primitive's modifier (`{op: add, target: block_value, value: 3}`).
2. **Player-togglable bool** — `defensive_stance_active: bool` lives on the character. Player toggles via checkbox in the sheet. Engine reads this bool to gate modifiers.
3. **Engine resolution** — at sheet render time, walk every modifier on every slotted primitive/capability. If the modifier targets a stat and references another stat in its value (or has a condition that references a bool), resolve it.
4. **Math helpers** — Apply Damage button computes: incoming damage → subtract block_value (if stance active, double it) → subtract other reductions → apply to HP.

This is **NOT** a permissioned registry of arbitrary expressions. It's a structured stat-contribution system: primitives declare stat targets in their modifiers, characters have a stat bag, engine walks the graph.

---

## Custom-Stat System Architecture (rev 3 — confirmed)

### Storage: JSONB on characters table

```sql
ALTER TABLE characters
  ADD COLUMN custom_stats jsonb NOT NULL DEFAULT '{}'::jsonb;
```

- Schema per row: `{ "block_value": 3, "defensive_stance_active": false, "ki_points": 7 }`
- Durability: lives in DB, survives across sessions/devices. No data loss.
- Flexibility: no migration needed when authors add new stat names.
- Validation: stat names must match `^[a-z][a-z0-9_]{0,63}$` (kebab → snake on lookup).

### Stat contributions: implicit through modifier target

A primitive/capability's existing modifier `{op: add, target: "block_value", value: 3}` already declares the contribution. The modifier's `target` field is extended to accept stat names (matching the regex) in addition to the closed enum (Attribute, Practice, Metric, etc.).

No new field on primitives/capabilities. The modifier IS the contribution.

### Player-toggleable bools: explicit `player-toggle:<name>` tag

A primitive/capability modifier's condition can carry a `player-toggle:<stat_name>` tag (via the existing condition-picker custom-tag adder). The character sheet:
1. Reads all `player-toggle:*` tags from slotted modifiers
2. Renders a checkbox for each unique tag
3. The checkbox's state is bound to `character.custom_stats[<stat_name>]`
4. Engine reads the bool at resolution time: modifier applies iff bool is true

---

## Capability mode axis (Style A/B/C, rev 3)

The Phase 7.10 Style classification already exists for capabilities. The character sheet uses it to drive UI:

| Style | Mode | UI on character sheet | Engine behavior |
|---|---|---|---|
| **A** | Passive | Listed in passive stats section | Just contributes to stats; no interactivity |
| **B** | Actionable | **Trigger** button | One-shot action: rolls dice, applies effects (damage/heal/etc.), doesn't persist state |
| **C** | Toggleable | **Active/Inactive** toggle | Persists bool in `custom_stats`; passive modifiers gated by that bool apply when active |
| **B+C** | Both | Toggle + Trigger button | Toggle gates whether trigger is usable; trigger fires one-shot when toggled-on |

### Trigger action flow

1. Player clicks "Trigger" on a Style B capability
2. System snapshots current character state (so it can show "before/after")
3. For each modifier on the capability:
   - Resolve tokens (dice rolls happen here, can be fixed for v1)
   - Apply the operation to its target stat
   - If target is HP, character.hp updates
   - If target is a custom stat, custom_stats[stat] updates
4. Show a result modal: "Shield Bash: rolled 14 + 3 STR = 17 damage. Target takes 17. Updated HP: 45 → 28."
5. Log the action to character notes (timestamp + capability name + effect)

### Toggle capability flow

1. Player toggles a Style C capability
2. Determine the stat name from the capability (e.g. `defensive_stance_active`)
3. Write the new bool value to `character.custom_stats[stat_name]`
4. Sheet re-renders, all modifiers gated by that stat now apply/don't apply

## Sub-phase ordering (revised, rev 2)

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

### 8.2 — Token Resolution Engine + Missing-Primitive Warnings + Custom-Stat Support

**Effort:** 6-7 days
**Risk:** Medium (foundational; everything character-sheet depends on this)
**Blocks:** 8.3, 8.4, 8.5

**The problem:**
Phase 7.5 stored modifier values as **tokens** (`{kind: "attribute", value: "PHYSICAL"}`) instead of raw numbers. This was correct — modifiers reference character state, not constants. But the runtime engine was deferred to Phase 8.

The user's "Block" example adds a new requirement: modifiers must be able to reference **custom character stats** (like `block_value`) that authors declare via primitives, AND **player-toggleable bools** (like `defensive_stance_active`) that gate modifier application.

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

**Token kinds to support (from Phase 7.5 + new for 8.2):**

| Kind | Example | Resolution |
|---|---|---|
| `attribute` | `{kind:"attribute", value:"PHYSICAL"}` | Look up character's `attrPhysical` |
| `practice` | `{kind:"practice", value:"PROWESS"}` | Look up character's practice total for that practice |
| `derived` | `{kind:"derived", value:"PB"}` | `attrProficient` if set, else 0 |
| `behavior` | `{kind:"behavior", value:"darkvision"}` | Check character.behaviors → boolean → 0 or 1 |
| `dice` | `{kind:"dice", value:"1d4"}` | Random roll (or fixed for sheet preview) |
| `number` | `{kind:"number", value:3}` | Pass-through |
| **`stat`** (NEW) | `{kind:"stat", value:"block_value"}` | Look up `character.custom_stats[block_value]` (default 0) |

**NEW: Stat target vocabulary:**

The modifier's `target` field currently accepts a closed enum (Attribute, Practice, Metric, Duration, etc.). Extend it to also accept **stat names** — any string matching `^[a-z][a-z0-9_]{0,63}$`. When the engine sees a stat name target:
1. Look up the stat value in `character.custom_stats` (default 0 for numbers, false for bools)
2. Apply the modifier op to that stat
3. The stat value is updated in `character.custom_stats`

This makes stat contributions **implicit** through the modifier system. No new field on primitives/capabilities.

**Mirror handling extracted here:** when a modifier is on a mirrored primitive, the value flips per `OP_SPECS`. Mirror the op (e.g. `add` → `subtract`), then resolve normally.

**Soft warnings (per user's note: "missing primitives should be flagged, not duplicated"):**

```typescript
type Warning = 
  | {kind:"unresolved-token", token: ValueToken, message: string}
  | {kind:"missing-primitive", capabilityId: string, primitiveId: number, message: string}
  | {kind:"unknown-stat", statName: string, message: string};  // NEW
```

**`missing-primitive` warning:** when a character has a capability slotted that requires primitive X (per the capability's required-primitive list), and X is not in the character's slotted primitives, emit a warning. Don't auto-add (avoid duplicates). Surface in the sheet as a yellow callout.

**`unknown-stat` warning:** when a modifier targets a stat that doesn't exist in `character.custom_stats`, warn. The stat is auto-initialized to 0/false but the warning is logged so authors can see typos.

**Player-togglable bools:**

A primitive/capability modifier can declare a condition with `player-toggle:<stat_name>` tag. The character sheet:
1. Reads all `player-toggle:*` tags from slotted modifiers
2. Renders a checkbox for each unique tag
3. The checkbox's state is bound to `character.custom_stats[<stat_name>]`
4. Engine reads the bool at resolution time: modifier applies iff bool is true

This is the smallest viable extension. No new schema table — `custom_stats` JSONB holds everything.

**Locations:**
- `src/lib/engine/token-resolver.ts` — new token kind `stat`
- `src/lib/engine/modifiers.ts` — extend target vocabulary to accept stat names
- `src/db/migrations/0038_custom_stats.sql` — add `characters.custom_stats jsonb`
- `src/db/schema/characters.ts` — new column

---

### 8.3 — Character Sheet Live Rendering + View Mode + Custom Stats UI + Math Helpers + Capability Triggers

**Effort:** 10-12 days
**Risk:** Medium
**Blocks:** 8.4, 8.5

**The problem:**
The existing `/characters/[id]` view shows static stored values. We need it to compute live values from the modifier graph using `resolveTokens`. The view is a separate page (NOT a modal) — this is the "view-only" experience.

The user's "Block" example adds: the sheet must render custom stats (`block_value`, `ki_points`, etc.) live, must provide **Apply Damage** math helpers, AND must support **capability mode** — toggleable bools (defensive stance) AND triggered actions (shield bash).

**The solution:**
Wire `resolveTokens` into the character-sheet-view component. For every modifier-bearing slot, resolve the modifier's tokens and aggregate the effect on the relevant character stat. Group capabilities by their **style/mode** (A/B/C) and render appropriate UI per mode.

**Stats to live-render:**
- HP (current / max) — trackable: HP up/down buttons, current HP box
- Each attribute (Physical / Mental / Magical)
- Each practice total (10 of them)
- Proficiency bonus (derived)
- BU total spent / remaining
- Damage reduction (from slotted primitives like Vitality Shielding)
- Movement speed
- Initiative
- **All custom stats** from `character.custom_stats` — discovered by walking the modifier graph

**Custom stats section in the sheet:**

For each custom stat found in slotted modifiers, render a row:
```
Block Value         3          [ -1 ] [ +1 ]
Defensive Stance    [✓ Active]
Ki Points           7          [ -1 ] [ +1 ]
```

Player can:
- Toggle bool stats (defensive stance)
- Increment/decrement numeric stats (spend ki point, recover HP, etc.)
- See soft warnings if a stat is referenced but uninitialized

**Capabilities grouped by mode:**

The sheet has a "Capabilities" section, grouped by mode:

```
PASSIVE CAPABILITIES (Style A)
  • Thick Skin              "+1 to all defenses"
  • Martial Training        "+2 to attack rolls"

TOGGLEABLE CAPABILITIES (Style C)
  • Defensive Stance        [● Active] [○ Inactive]
       While active: 2x block_value
  • Rage                    [● Active] [○ Inactive]
       While active: +2 strength, -1 defense

ACTIONABLE CAPABILITIES (Style B)
  • Shield Bash             [Trigger]
       "Deal block_value damage to target"
  • Power Attack            [Trigger]
       "Roll 1d20 + STR mod, deal 2x STR damage"

TOGGLE + TRIGGER (Style B+C)
  • Channeled Heal          [● Channeling] [Trigger: Release]
       "While channeling: +1 HP/round. Release: heal HP equal to rounds."
```

**Architecture:**
```
character-sheet-view.tsx
  → loads character + all slotted primitives/capabilities/items
  → calls resolveAllModifiers(character, context) which:
     1. Walks every slot
     2. For each modifier, resolveTokens(modifier.tokens, character, context)
     3. Apply the operation with the resolved number (with mirror flip)
     4. Accumulate effects per target stat (attributes, practices, AND custom_stats)
  → renders:
     - Live values (HP, attrs, practices, custom stats)
     - Capabilities grouped by mode (with toggle / trigger UI)
     - Soft warnings (missing primitives, unresolved tokens, unknown stats)
```

**Math helpers (per user):**

The sheet has buttons for common math, anchored to a small "Quick Actions" panel:
- **Apply Damage** — opens a modal: input damage amount → walks damage reduction chain → updates current HP
  - Step 1: subtract block_value (if `defensive_stance_active`, double it)
  - Step 2: subtract Vitality Shielding reductions (halve if relevant)
  - Step 3: apply remaining to HP
- **Apply Healing** — direct HP add
- **Add Note** — appends to character's notes
- **Toggle Condition** — checkbox UI for narrative conditions (poisoned, etc.)
- **Increment/Decrement Stat** — quick `+1`/`-1` buttons on each custom stat row
- **Trigger Capability** — fires the math for a Style B capability (see below)

**Trigger capability flow (NEW):**

When a player clicks "Trigger" on a Style B capability:
1. System snapshots current character state (so it can show "before/after")
2. For each modifier on the capability:
   - Resolve tokens (dice rolls happen here, can be fixed for v1)
   - Apply the operation to its target stat
   - If target is HP, character.hp updates
   - If target is a custom stat, custom_stats[stat] updates
3. Show a result modal: "Shield Bash: rolled 14 + 3 STR = 17 damage. Target takes 17. Updated HP: 45 → 28."
4. Log the action to character notes (timestamp + capability name + effect)

**Toggle capability flow:**

When a player toggles a Style C capability:
1. Determine the stat name from the capability (e.g. `defensive_stance_active`)
2. Write the new bool value to `character.custom_stats[stat_name]`
3. Sheet re-renders, all modifiers gated by that stat now apply/don't apply

**Out of scope for v1 (deferred):**
- Multi-target support for triggers (AOE, etc.) — single-target only
- Reactive triggers ("when X happens, fire Y") — manual triggers only
- Trigger animations / VFX — text-only result modal
- Resource costs on triggers (some capabilities spend ki, etc.) — shown as a feature for v2

**Files:**
- `src/lib/engine/resolve-all-modifiers.ts` — the new entry point
- `src/lib/engine/damage-application.ts` — the math helper for Apply Damage (walks the reduction chain)
- `src/lib/engine/capability-trigger.ts` — the trigger flow for Style B capabilities
- `src/components/characters/character-sheet-view.tsx` — replace static values with live values, add capability mode grouping + custom stats section
- `src/components/characters/custom-stats-panel.tsx` — the custom stats UI
- `src/components/characters/capability-mode-group.tsx` — group capabilities by mode and render UI per style
- `src/components/characters/capability-trigger-modal.tsx` — the result modal after triggering a Style B
- `src/app/characters/[id]/page.tsx` — existing; add Edit button that opens character modal with this character pre-loaded
- `src/app/api/characters/[id]/adjust/route.ts` — new endpoint for math helpers + triggers + toggles

---

### 8.4 — Condition Evaluator v2 (HP thresholds + custom bools)

**Effort:** 3-4 days
**Risk:** Low
**Blocks:** 8.5

**The problem:**
v1 conditions are display-only. Phase 7 closed with the engine returning `true` for any v1 condition. The Phase 7 closeout identified this as a "Phase 28 (probably never)" issue, but the user is now scoping it in.

The user's "Block" example adds: player-togglable bools (`defensive_stance_active`) need to gate modifiers. The engine must read these from `character.custom_stats` and decide if a modifier applies.

**The solution (with custom-stat support):**

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

**Auto-trackable (initial whitelist — only what we can derive from existing columns AND custom stats):**
- `target-below-half-hp` → `character.hp / character.maxHp < 0.5`
- `target-below-quarter-hp` → `character.hp / character.maxHp < 0.25`
- **NEW:** any condition with tag `auto:<stat_name>` → reads `character.custom_stats[stat_name]` and treats truthy as active. This lets authors mark conditions as auto-trackable without ceremony.
- **NEW:** any modifier whose condition is a custom-stat bool (via the `player-toggle:` tag from 8.2) → reads that bool and returns `{active: bool, source: "auto"}`.

**Narrative (display-only, ALWAYS):**
- `{kind: "narrative"}` → always `{active: false, source: "narrative"}`
- `{kind: "tags"}` with non-`auto:` and non-`player-toggle:` tags → always narrative
- Unknown preset keys → narrative, source: "narrative", warning
- **No engine evaluation of arbitrary author-written expressions. Ever.**

**Mirror handling here too:** when the underlying primitive is mirrored, the condition's "active" status is computed identically — mirror affects value sign, not trigger logic.

**Location:** `src/lib/engine/condition-evaluator.ts`

---

### 8.6 — RESURRECTED as Custom-Stat System Implementation

The user's "Block" example resurrected this sub-phase. The plan shrunk 8.6 to "no work" earlier; now it expands to land the custom-stat system.

**Effort:** 4-5 days
**Risk:** Medium (new schema + new schema interactions)
**Blocks:** 8.3 expansion (already wired to consume it)

**What:**

1. **Migration 0038** — Add `characters.custom_stats: jsonb NOT NULL DEFAULT '{}'`
2. **Schema** — Drizzle types updated
3. **Modifier target vocabulary** — Extend `target` field to accept stat names
4. **Token resolver** — Add `stat` token kind (already designed in 8.2)
5. **Condition evaluator** — Add `auto:<stat_name>` and `player-toggle:<stat_name>` resolution paths (already designed in 8.4)
6. **Author UI** — In the primitive/capability form's "Target" picker, add a "Custom stat" option that lets authors type a stat name (with regex validation)
7. **Validation** — Stat names must match `^[a-z][a-z0-9_]{0,63}$`. Reject on save otherwise.

**Out of scope for 8.6:**
- No permissioned registry of arbitrary expressions
- No rich condition language
- No "trigger event" handling — engine only reads current state

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

## Suggested build order (revised, after user answers rev 3)

If we have limited credits/time, this is the priority order:

| # | Sub-phase | Days | Why this priority |
|---|---|---|---|
| 1 | **8.0** Mirror fix | 0.5d | Trivial carryover; unblocks 8.3 |
| 2 | **8.1** Character modal (FAB + Zustand overlay) | 7d | **THE central issue** |
| 3 | **8.2** Token resolver + missing-primitive warnings + custom-stat token | 7d | Foundational |
| 4 | **8.6** Custom-stat system (schema + author UI + validation) | 5d | Resurrected by Block example |
| 5 | **8.3** Live rendering + custom stats UI + math helpers + capability triggers | 11d | The "wow" of Phase 8 |
| 6 | **8.4** Condition evaluator v2 (HP thresholds + custom bools) | 4d | Unblocks 8.5 |
| 7 | **8.5** Live condition badges | 3d | Visible payoff of 8.3 + 8.4 |
| 8 | **8.7** Template pre-loads | 3d | Polish on creation flow |
| 9 | **8.8** Share-with-link | 4d | Community |
| 10 | **8.9** Collections | 6d | Community |

**Total estimated effort:** ~50.5 days at single-developer pace.

If we ship 8.0 → 8.7, that's the **complete character experience**: modal creation + live sheet with computed values + live conditions + custom stats + capability modes/triggers + template pre-loads + math helpers. ~40.5 days.

8.8 and 8.9 are the **community features**.

---

## What ships with Phase 8 (the punchline, rev 3)

When Phase 8 is fully done:

1. **FAB in the sandbox** (Mona Lisa icon) launches a persistent character builder modal
2. Modal state survives tab navigation (grammar → templates → blueprint → back)
3. Slot primitives/capabilities/items into the character from anywhere in the sandbox
4. **Character sheet view** (separate page) renders live: HP, attributes, practices, BU totals, all computed from the modifier graph via token resolution
5. **Custom stats** (block_value, ki_points, etc.) discovered by walking the modifier graph, rendered in their own section
6. **Player-togglable bools** (defensive_stance_active, etc.) — engine reads them and gates modifiers
7. **Capability modes** — passive / actionable / toggleable / both, with appropriate UI per style
8. **Trigger actions** — click "Trigger" on a Style B capability, engine rolls dice + applies effects, shows result modal
9. **Apply Damage** math helper — walks damage reduction chain through slotted primitives (Vitality Shielding halves, block_value subtracts, stance doubles)
10. Conditions show as colored badges — green for active auto-resolved, gray for narrative
11. **Soft warnings** when a capability references missing primitives (system flags, user resolves)
12. Mirror badges show live in the editor AND the sheet
13. Race/background/archetype templates pre-load canonical primitives
14. Public share links (anonymous-readable, signed-in to use)
15. Collections to organize bookmarks (My Creations / Forked / Favorites + custom)

That's a complete interactive character-sheet experience with custom mechanics + community features.

### Worked example: Block mechanic end-to-end (rev 3)

Player scenario as it will work after Phase 8:

1. **Author** authors a Shield primitive with modifier `{op: add, target: block_value, value: 3}` — Style A (passive)
2. **Author** authors "Defensive Stance" capability (Style C, toggleable) with modifier `{op: multiply, target: block_value, value: 2, condition: {kind: tags, customTags: ["player-toggle:defensive_stance"]}}`
3. **Author** authors "Shield Bash" capability (Style B, actionable) with modifier `{op: add, target: damage_dealt, value: {kind: stat, value: block_value}}`
4. **Player** opens character modal via FAB
5. **Player** slots Shield primitive + Defensive Stance capability + Shield Bash capability
6. **Player** saves character
7. **Character sheet** shows:
   - Custom stats: `block_value: 3`, `defensive_stance_active: false`
   - Passive capabilities: Shield (just listed)
   - Toggleable: Defensive Stance [Inactive → Active]
   - Actionable: Shield Bash [Trigger]
8. **Player** toggles "Defensive Stance" → `defensive_stance_active: true` → `block_value` recomputes to 6
9. **Player** triggers "Shield Bash" → modal: "Rolled 14 + 3 STR mod = 17 damage. Deal 17 to target. (Your block_value was 6.)"
10. **Player** clicks Apply Damage on incoming attack → 10 damage reduced by block_value (6) = 4 damage to HP

The engine walked the modifier graph, resolved stats from `custom_stats`, applied gating conditions from `player-toggle` tags, rolled dice on trigger, and produced correct numbers. The player made no manual calculations.

---

## Open questions to resolve before kicking off

1. **8.1 (modal pattern):** ✅ Confirmed — FAB-launched persistent overlay. Mona Lisa icon.
2. **Custom stats storage (Q-A):** ✅ Confirmed — JSONB on characters table (durable + flexible).
3. **Stat contributions (Q-B):** ✅ Confirmed — implicit through modifier target field.
4. **Player-toggleable bools (Q-C):** ✅ Confirmed — explicit `player-toggle:<stat_name>` tag.
5. **Capability modes:** ✅ Confirmed — Style A/B/C mapping (passive / actionable / toggleable / both). Trigger actions are one-shot math ops.
6. **8.6 Q2 (BU cost):** ✅ Confirmed — NO change.
7. **8.7 (templates):** ✅ Confirmed — ship in Phase 8.
8. **8.9 (collections):** ✅ Confirmed — ship in Phase 8.

**All questions resolved.** Plan is ready to execute.

---

## See also

- `docs/phase-7/condition-v1-closeout.md` — v1 conditions (display-only)
- `docs/phase-7/phase-7.5-modifier-rebuild-spec.md` — modifier model with tokens
- `docs/phase-7/phase-710-COMPLETE.md` — Phase 7.10 effects/capabilities
- `docs/phase-7/phase-710-4-system-user-ui.md` — System user (admin) UI rule
- `docs/phase-7/phase-8-and-beyond-notes.md` — Phase 7 closeout deferred items