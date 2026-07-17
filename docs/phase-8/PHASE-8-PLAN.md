# Phase 8 — Character Sheet & Character Creation Modal

**Date:** 2026-07-17
**Author:** Senku (mod for Mashu, Phase 8 kickoff)
**Status:** 📝 PLAN — awaiting sign-off

---

## What this phase is

Phase 8 = **character sheet + character creation, modal-style**. The character is reachable from anywhere in the sandbox, doesn't take you out of your build flow, and uses the Phase 7.9 modifier model to compute live values during play.

The central question the user flagged: **"character creation in a modal system like build?"**

The answer: mirror the existing build-mode URL pattern. `/sandbox/builds?edit=X` is already "modal-style" — it's a deep-linkable URL route that the sandbox library can slot into. Do the same for `/sandbox/characters?edit=X`. Add a **Slot into character** button alongside the existing **Slot into build** button.

---

## What's NOT in this phase

- **No DM tracker** (deferred indefinitely per Phase 7 closeout)
- **No BU cost rebalancing for conditions** (open design question, see 8.6)
- **No versioning/forking architectural work** (the Phase 7 closeout's Q5 ambiguity resolved to "the mirror-badge bug, not the version system")
- **No pill engine work** (display-only continues until 8.6 design call)
- **No realtime sync** (polling for v1)

---

## Sub-phase ordering

Ordering principle: **the central issue first, unblockers next, soft features last.**

### 8.0 — Mirror Badge Fix (carryover from Phase 7 closeout, Q5)

**Effort:** ~30 minutes
**Risk:** Trivial
**Blocks:** 8.3 (character sheet rendering needs mirror badges live)

**What:**
- Widen `formSnapshot.primitiveIds` to also carry `mirroredPrimitiveIds: number[]` next to it
- Item form's preview pane reads from snapshot, not just DB row
- MIRRORED badges now show while editing, not only after save

This was a known carryover from the Phase 7 closeout. Land it first so nothing else has to backtrack.

---

### 8.1 — Character Creation Modal Mode (THE central issue)

**Effort:** 4-6 days
**Risk:** Medium-high (architectural; touches sandbox layout + character-wizard)
**Blocks:** 8.7-8.9 (template pre-loads, share, collections all flow through the modal)

**The problem:**
Character creation today is a stepped wizard at `/sandbox/characters` (a page route). To use it, you leave your build/grammar/blueprint tab. The user wants to **edit a character and a build simultaneously** — same screen, different concerns.

**The solution:**
Mirror the `/sandbox/builds?edit=X` URL pattern for characters:

```
/sandbox/characters            → list of my characters + "new character" CTA
/sandbox/characters?edit=X     → character editor (URL-addressable, deep-linkable)
/characters/[id]               → view-only character sheet (the existing page)
/sandbox/characters?edit=X&slot=Y   → open editor with slot pre-loaded from a sandbox item
```

Then add **Slot into character** buttons throughout the sandbox/library, mirroring the existing Slot into build buttons.

**On desktop (3-column layout):** character editor opens in a new column / split, build mode stays in the other column.
**On mobile (single column):** character editor opens in a new tab.

**Component breakdown:**

| New file | Purpose |
|---|---|
| `src/app/sandbox/characters/page.tsx` (refactor) | Existing — convert to URL-addressable `?edit=X` pattern matching `/sandbox/builds` |
| `src/components/workshops/character-composer.tsx` | Refactor `character-wizard.tsx` into a URL-driven composer. Reads `?edit=X`, pre-fills form, supports `?slot=Y` |
| `src/components/sandbox/slot-into-character-button.tsx` | The new "Slot into character" button. Mirrors `slot-into-build-button.tsx`. Reads `?character=X&slot=Y` query params |
| `src/components/layout/character-mode-launcher.tsx` | The "Open character builder" global button. On desktop → side panel; on mobile → new tab |
| `src/lib/characters/slot-targets.ts` | New helper: resolve `?slot=Y` to a target (primitive/capability/effect/item) and dispatch to the character editor |

**The modal question, answered:** this isn't a CSS-overlay modal. It's a **URL-addressable, slot-compatible editor** — same pattern as build mode, so users can have both open. On mobile they're separate tabs; on desktop they're panes.

---

### 8.2 — Token Resolution Engine

**Effort:** 4-5 days
**Risk:** Medium (foundational; everything character-sheet depends on this)
**Blocks:** 8.3, 8.4, 8.5 (all live-sheet work)

**The problem:**
Phase 7.5 stored modifier values as **tokens** (`{kind: "attribute", value: "PHYSICAL"}`) instead of raw numbers. This was correct — modifiers reference character state, not constants. But the runtime engine was deferred to Phase 8 because at author-time we don't have a character in scope.

**The solution:**
Build `resolveTokens(tokens, character, context)` that walks the token list and returns concrete numbers at character-sheet slot time.

```typescript
type ResolutionResult = {
  number: number;        // the resolved numeric value
  warnings: Warning[];   // soft warnings for unresolvable tokens
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

**Soft warnings:** if a `behavior` token references something the character doesn't have, emit a `Warning` with `{kind:"unresolved", token, message}`. Render in the sheet as a callout, not a hard error.

**Location:** `src/lib/engine/token-resolver.ts`

---

### 8.3 — Character Sheet Live Rendering

**Effort:** 5-7 days
**Risk:** Medium
**Blocks:** 8.4, 8.5 (conditions sit on top of the live sheet)

**The problem:**
The existing `/characters/[id]` view shows static stored values. We need it to compute live values from the modifier graph using `resolveTokens`.

**The solution:**
Wire `resolveTokens` into the character-sheet-view component. For every modifier-bearing slot, resolve the modifier's tokens and aggregate the effect on the relevant character stat.

**Stats to live-render:**
- HP (current / max)
- Each attribute (Physical / Mental / Magical)
- Each practice total (10 of them)
- Proficiency bonus (derived)
- BU total spent / remaining
- Attack / Save / Defense bonuses (if character has abilities affecting them)
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
  → renders the live values
```

**Files:**
- `src/lib/engine/resolve-all-modifiers.ts` — the new entry point
- `src/components/characters/character-sheet-view.tsx` — replace static values with live values

---

### 8.4 — Condition Evaluator v2

**Effort:** 3-4 days
**Risk:** Low-medium
**Blocks:** 8.5

**The problem:**
v1 conditions are display-only. Phase 7 closed with the engine returning `true` for any v1 condition — meaning the condition badge shows, but the engine never gates the modifier. The Phase 7 closeout identified this as a "Phase 28 (probably never)" issue, but the user is now scoping it into Phase 8.

**The solution:**
Build `evaluateCondition(condition, character, scene)` that returns `{active, source}`:

```typescript
type ConditionSource = "auto" | "narrative" | "manual";
type Evaluation = {
  active: boolean;
  source: ConditionSource;
  reason: string;
};

function evaluateCondition(
  condition: ModifierCondition,
  character: Character,
  scene?: SceneContext
): Evaluation
```

**Auto-trackable (initial whitelist):**
- `target-below-half-hp` → `character.hp / character.maxHp < 0.5`
- `target-below-quarter-hp` → `character.hp / character.maxHp < 0.25`
- Anything else with a clear numeric rule we can derive from existing columns

**Narrative (display-only):**
- `{kind: "narrative"}` → always `{active: false, source: "narrative"}`
- `{kind: "tags"}` with custom tags → always narrative, source: "narrative"
- Unknown preset keys → narrative, source: "narrative", warning

**Manual (deferred):**
- No DM tracker exists, so "manual" source returns active=false for now. The function shape supports it for when the DM tracker ships.

**Mirror handling here too:** when the underlying primitive is mirrored, the condition's "active" status is computed identically — mirror affects value sign, not trigger logic.

**Location:** `src/lib/engine/condition-evaluator.ts`

---

### 8.5 — Live Condition Badges

**Effort:** 2-3 days
**Risk:** Low (mostly UI)
**Blocks:** none

**The problem:**
`<ConditionBadges>` exists, but it only renders preset/tag/narrative — no `active`/`source` coloring.

**The solution:**
Extend `<ConditionBadges>` to accept a live evaluation, color badges by `source`:
- `auto + active` → green (vivid, drawing attention)
- `auto + inactive` → outlined gray (visible but not shouting)
- `narrative` → gray italic (always display, never active)
- `manual` → blue (deferred)

Drop the enhanced component into `character-sheet-view.tsx`. For each modifier-bearing slot, render its condition badge with the live evaluation.

**Live updates:**
- Polling every 5s for v1 (re-evaluate conditions on tick)
- When HP changes (after combat), next tick reflects new state
- Realtime sync deferred — no Supabase realtime channel yet

**Files:**
- `src/components/library/condition-badges.tsx` — extend with `evaluation` prop
- `src/components/characters/character-sheet-view.tsx` — drop in live badges

---

### 8.6 — Design Calls: Custom Pills + BU Cost of Conditions

**Effort:** 1-2 days
**Risk:** Depends on user decisions
**Blocks:** possibly 8.4 expansion

**Two open design questions from Phase 7 closeout:**

**Q1:** Should author-added custom pills (via the custom-tag adder in condition-picker) be engine-addressable?
- **Option A:** Display-only, like v1. Author can write tags, they show as badges, engine never resolves them. Simpler, current behavior.
- **Option B:** Permissioned registry. Authors register tags with rules (HP threshold, attribute check, etc.), engine recognizes registered tags. More flexible but bigger scope.

**Q2:** Should a modifier's BU cost change if it carries a preset condition?
- **Option A:** No. Cost is the modifier's intrinsic value. The condition is metadata. (Phase 7 closeout's implicit stance.)
- **Option B:** Yes, by tier. e.g. +1 BU for a preset, +0 for narrative.
- **Option C:** Discount for narrow conditions (target-below-half-hp narrows the trigger, so it should be cheaper).

**These are user decisions.** Phase 8 ships the questions here; implementation per the answers lands in 8.6.1 / 8.6.2 (or split into 8.6 if both answers are clear).

---

### 8.7 — Template Pre-loads for Character Creation

**Effort:** 2-3 days
**Risk:** Low
**Blocks:** none

**What:**
A character sheet template system that pre-loads canonical primitives / capabilities / items when the user picks a template at character creation time. Already partially supported via the `archetypeName` field on `BuildComposer` — extend to `CharacterComposer`.

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

## Suggested build order (recommended execution)

If we have limited credits/time, this is the priority order that gives the most user value per phase:

| # | Sub-phase | Days | Why this priority |
|---|---|---|---|
| 1 | **8.0** Mirror fix | 0.5d | Trivial carryover; unblocks 8.3 |
| 2 | **8.1** Character modal | 5d | THE central issue, user-flagged |
| 3 | **8.2** Token resolver | 5d | Foundational; blocks all live-sheet work |
| 4 | **8.3** Live rendering | 6d | The "wow" of Phase 8 |
| 5 | **8.4** Condition evaluator | 4d | Unblocks 8.5 |
| 6 | **8.5** Live condition badges | 3d | Visible payoff of 8.3 + 8.4 |
| 7 | **8.6** Design calls | 2d | Depends on user |
| 8 | **8.7** Template pre-loads | 3d | Polish on the creation flow |
| 9 | **8.8** Share-with-link | 4d | Community engagement |
| 10 | **8.9** Collections | 6d | Big surface; ship last |

**Total estimated effort:** ~38 days at single-developer pace.

If we ship 8.0 → 8.6, that's the **core character-sheet experience**: modal creation, live values, live conditions. ~25.5 days of work for the fundamental Phase 8 promise.

8.7-8.9 are the **community features** that make the system social. Ship those after 8.6.

---

## Open questions to resolve before kicking off

1. **8.1 (modal pattern):** confirm URL-addressable (`/sandbox/characters?edit=X`) is the right interpretation of "modal like build" — or did the user want a true CSS-overlay modal that lives over the current sandbox view?

2. **8.6 Q1 (custom pills):** display-only forever, or permissioned registry? This affects scope of 8.4.

3. **8.6 Q2 (BU cost):** does the modifier's BU change when it carries a preset? Affects the modifier engine in 8.3.

4. **8.7 (templates):** ship now, or defer to Phase 9?

5. **8.9 (collections):** ship now with default 3 only, or wait for full feature?

---

## What ships with Phase 8 (the punchline)

When Phase 8 is fully done:

1. From any sandbox tab, the user can open a character editor in a side panel / new tab
2. They slot a primitive, capability, item, effect into the character
3. The character sheet renders live — HP, attributes, practices, BU totals, all computed from the modifier graph via token resolution
4. Conditions show as colored badges — green for active HP-threshold presets, gray for narrative
5. Mirror badges show live in the editor AND the sheet
6. The user can share their build with a public link (anonymous-readable)
7. They can organize bookmarks into collections, follow users, see what others made

That's a complete player experience.

---

## See also

- `docs/phase-7/condition-v1-closeout.md` — v1 conditions (display-only)
- `docs/phase-7/phase-7.5-modifier-rebuild-spec.md` — modifier model with tokens
- `docs/phase-7/phase-710-COMPLETE.md` — Phase 7.10 effects/capabilities
- `docs/phase-7/phase-710-4-system-user-ui.md` — System user (admin) UI rule
- `docs/phase-7/phase-8-and-beyond-notes.md` — Phase 7 closeout deferred items