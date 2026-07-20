# Phase 8 — Character Creation Modal Flow (Focused Design)

**Date:** 2026-07-17
**Author:** Senku (mod for Mashu, Phase 8 kickoff, rev 4)
**Status:** 🔄 IN PROGRESS — focused on **character creation**, not character sheet

---

## What this phase is (revised, rev 4)

Per user feedback (2026-07-17):

> "Look through how we create a character now and how we can make the modal based flow good for character building... no, we do not have tokens for implementation, maybe we can discuss a bit more detail about the character creation itself."

This phase focuses on **character creation**, NOT the character sheet. The sheet has its own work (Phase 8.3+ in the master plan). This doc covers only the modal-based creation flow.

**Existing assets being built on top of (NOT rebuilt):**
- `CharacterWizard` component (`src/components/workshops/character-wizard.tsx`) — 5-step form
- `characterPrimitiveSourceEnum` schema (`src/db/schema/characters.ts`) — already has `RACE | BACKGROUND | PERSONAL | TRAINING | LEVEL_UP | DM` for slot assignment
- `character_primitives` junction table — already has `source`, `isMirrored`, `acquiredAtLevel`, `versionId`
- BU engine (`src/lib/engine/bu.ts`) — already calculates positive/mirror/net spent, volatility rating, ceiling by level
- Sheet aggregator (`src/lib/engine/sheet.ts`) — already computes practice table, vitality, defensive DCs
- Sandbox library + slot-into-build button (existing pattern to mirror)

**Goal:** Take the existing stepped wizard and convert it into a **persistent FAB-launched modal** that can live alongside the sandbox, with **multi-tab layout for high-level characters** and **live BU budget tracking**.

---

## The bundling hierarchy (canonical)

```
Template (race / background / archetype / item)
  └── bundles:
      ├── Capabilities
      │     └── bundles:
      │           ├── Primitives (verbs, domains, ranges, structures)
      │           └── Effects
      │                 └── bundles:
      │                       └── Primitives
      └── Primitives (standalone, e.g. +1 physical, +1 Prowess)
```

So when authoring a **race**, an author slots primitives + capabilities into it. When a player picks a race for their character, the race's primitives + capabilities come along.

At character level 16, the player might want their race to grow (e.g. "flaming wings" as part of the race, not the archetype). The slot-source enum already supports `LEVEL_UP` so this is encoded.

---

## BU mechanics (canonical, from Notion `Leveling & Progression Canon v1`)

- Start at **25 BU** = level 1
- Each level threshold grants BU (+10 typically, +14/+18/+22/+26 at spike levels)
- Progression spikes at lvl 4 (+4), 8 (+8), 12 (+12), 16 (+16), 20 (+20) — already baked into thresholds
- BU is **cumulative, never spent/lost** — you accumulate BU over time and your level is a function of total BU
- **Mirror a primitive** = take the negative version, get +BU credit (and the volatility cost)
- **Volatility ceiling** by level bracket:
  - 1-4: -4 BU
  - 5-10: -12 BU
  - 11-15: -16 BU
  - 16+: -24 BU
- **Items have BU** (proxy for power) but **do NOT count toward leveling BU** — only primitives count for budget

**This means:** when a player mirrors a primitive (e.g. fire vulnerability -X), they get +X BU that pushes them up the level table. Items are flavor/equipment and have their own separate BU total.

---

## What the wizard does today (existing)

The `CharacterWizard` at `/sandbox/characters` is a **5-step form**:

1. **Identity** — name, size, portrait, notes, level, starting BU
2. **Attributes** — physical/mental/magical, must sum to 10, pick proficient
3. **Race / Background** — pick from library OR freeform text
4. **Capabilities & Items** — pick capabilities from library + starting items
5. **Review** — show totals, submit → POST `/api/characters`

Limitations of the current wizard:
- Single-flow linear (good for lvl 1, bad for lvl 16)
- No multi-tab layout
- No BU budget live tracking with debt/ceiling
- No mirror primitive toggle
- No slot-source assignment (everything defaults to PERSONAL)
- Stepped page, not modal — leaves sandbox context
- No "slot from sandbox while editing primitive" flow

---

## The modal-based creation flow (revised design)

### Top-level: persistent overlay layer

```
┌─────────────────────────────────────────────────────────┐
│  Sandbox page (grammar / heritage / blueprint)         │  ← navigate freely
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │       Character Modal (overlay, persistent)        │ │  ← Zustand state
│  │                                                    │ │     survives nav
│  └───────────────────────────────────────────────────┘ │
│                              [👤 FAB (Mona Lisa)]        │  ← Toggle modal
└─────────────────────────────────────────────────────────┘
```

### Modal layout: stepped for new / tabbed for edit

**Two modes inside the modal:**

**Mode A — New character (lvl 1, first time):** stepped wizard
- 5 steps as today (Identity → Attributes → Lineage → Upbringing → Manifest → Review)
- "Save & Exit" → creates character, exits wizard mode
- "Continue editing" → converts to Mode B

**Mode B — Existing character or post-creation:** tabbed editor
- Tab bar at the top of the modal: **Identity | Race | Background | Archetype | Items | Notes**
- Each tab shows the relevant slots + pickers
- Live BU budget bar at the top: `199 / 199 BU used (level 16) | -24 BU debt remaining`
- Live attribute/practice display in Identity tab
- Live capability/primitive listing in each heritage tab
- Items in their own tab (separate BU tracking)

### Tab breakdown (Mode B)

**Identity tab:**
- Name, size, portrait, notes (editable)
- Attributes (physical/mental/magical, proficient)
- Level (display only, computed from BU)
- Practice totals (read-only display)

**Lineage tab:**
- Lineage name + description (freeform or picked from library heritage)
- Primitives slotted as **LINEAGE source** (auto-set)
- Capabilities slotted as **LINEAGE source** (auto-set)
- BU total for lineage-only slots
- "+ Slot primitive" → opens library picker, on confirm slots with source = LINEAGE

**Upbringing tab:**
- Same as Lineage tab, source = UPBRINGING

**Manifest tab:**
- Same, source = PERSONAL (since archetype isn't a slot-source value — see Q1 below)
- User can also pick manifest heritage from library to pre-load its capabilities

**Items tab:**
- Items the character owns (separate from leveling BU)
- "+ Slot item from library" → opens library picker
- "+ Create new item" → link to `/sandbox/blueprint?build=item` (opens new tab)

**Notes tab:**
- Freeform notes, session log, etc.

### Live BU budget display

```
┌─────────────────────────────────────────────────────────┐
│  Net BU: 195 / 199         Volatility: -16 / -24 OK     │
│  Level 16 (Cumulative 199 BU)                           │
│  ████████████████████████░░░  98% used                  │
└─────────────────────────────────────────────────────────┘
```

Components:
- **Net BU** = positive spent + mirror credit
- **Volatility** = absolute value of mirror credit, compared to ceiling for level
- **Level** = computed from cumulative BU per Notion's threshold table
- **Visual bar** = usage percentage

When player mirrors a primitive, the bar updates instantly. If they exceed the volatility ceiling, the modal shows a warning (per existing `bu.ts` engine).

---

## Slotting from sandbox into character

### The button pattern

Today: "Slot into build" exists. New: "Slot into character" mirrors this.

Locations of the new button:
- `/sandbox/grammar?build=primitive&edit=X` (primitive editor)
- `/sandbox/grammar?build=effect&edit=X` (effect editor)
- `/sandbox/grammar?build=capability&edit=X` (capability editor)
- `/sandbox/blueprint?build=item&edit=X` (item editor)
- Library preview pane (`/library/item/[id]`) — for all entity types

### Click flow (the open question)

When user clicks "Slot into character" while editing a primitive:

**Option A — Open modal immediately with pre-loaded slot:**
- FAB badge: no change (modal opens right away)
- Modal shows current character draft, primitive is in "pending slot" state
- User assigns source (RACE/BG/PERSONAL) and confirms
- User continues editing or closes

**Option B — Pending queue (FAB badge increments):**
- FAB shows badge: "1 pending"
- User keeps editing in sandbox
- When they open modal later, the pending slot is there to assign
- Better for: user is deep in grammar editing and doesn't want to context-switch

**Option C — Inline dialog asking "Where to slot?":**
- Small modal/dialog appears over the editor
- Lists RACE / BACKGROUND / PERSONAL / etc. options
- User picks, dialog closes, primitive is queued

**My recommendation: Option B + quick-assign shortcut.** Default to pending queue. If user clicks the slot button while modal is already open, drop directly into modal (no badge — they see it immediately).

This needs user input.

### Where to slot (the source enum)

When user picks "where" in the modal:
- For new character: defaults to PERSONAL (no lineage/upbringing picked yet)
- For existing character with lineage picked: option to assign to RACE / BACKGROUND / PERSONAL
- For high-level character: PERSONAL vs LEVEL_UP — needs clarification (see below)

---

## Slot source semantics (the open question)

The enum has `RACE | BACKGROUND | PERSONAL | TRAINING | LEVEL_UP | DM`. The wizard doesn't surface this distinction. The user wants the multi-tab layout for lineage/upbringing/archetype — but the schema doesn't have an `ARCHETYPE` source value (archetype is its own template kind).

**Two design questions:**

1. **How do archetypes fit into the slot-source enum?**
   - Option (a): Add `ARCHETYPE` as a source value (migration)
   - Option (b): Map archetype slots to `PERSONAL` (default) or `LEVEL_UP`
   - Option (c): Treat archetype as a special template that's not source-assigned (it's picked from the heritage table separately)

2. **What does `LEVEL_UP` vs `PERSONAL` mean operationally?**
   - `PERSONAL` = slotted at character creation, permanent
   - `LEVEL_UP` = slotted when reaching a new level, can be "lost" if you lose the level (DM discretion)
   - `TRAINING` = slotted via in-game training, similar to LEVEL_UP
   - `DM` = DM-granted, can be revoked

These need user input.

---

## Character modal architecture

### Component structure

```
src/components/character-modal/
├── character-fab.tsx               # Floating action button (Mona Lisa icon)
├── character-modal-provider.tsx    # Provider mounted in sandbox layout
├── character-modal.tsx             # The modal shell (overlay + frame)
├── character-modal-store.ts        # Zustand store
├── modes/
│   ├── stepped-wizard-mode.tsx     # Mode A — new character flow
│   └── tabbed-editor-mode.tsx      # Mode B — existing character tabs
├── tabs/
│   ├── identity-tab.tsx            # Identity (name, attrs, etc.)
│   ├── heritage-tab.tsx            # Generic template tab (Lineage/Upbringing/Manifest)
│   ├── items-tab.tsx               # Items (separate BU)
│   └── notes-tab.tsx               # Freeform notes
├── bu-budget-bar.tsx               # Live BU display
├── library-picker-panel.tsx        # Side panel for slotting from library
└── pending-slots-badge.tsx         # FAB badge for pending slot queue
```

### State (Zustand store)

```typescript
interface CharacterDraft {
  // Identity
  name: string;
  size: Size;
  portraitUrl: string | null;
  notes: string;
  level: number;            // computed, but stored for read-only display
  
  // Attributes
  attrPhysical: number;
  attrMental: number;
  attrMagical: number;
  attrProficient: AttrProf | null;
  
  // Templates
  raceName: string | null;
  raceDescription: string | null;
  backgroundName: string | null;
  backgroundDescription: string | null;
  archetypeName: string | null;
  
  // Slots (each tagged with source)
  primitiveSlots: Array<{
    primitiveId: number;
    source: CharacterPrimitiveSource;
    isMirrored: boolean;
    acquiredAtLevel: number;
    versionId?: string;
  }>;
  capabilitySlots: Array<{
    capabilityId: string;
    acquiredAtLevel: number;
    versionId?: string;
  }>;
  itemSlots: Array<{
    itemId: string;
    quantity: number;
    equipped: boolean;
    versionId?: string;
  }>;
  
  // Modal metadata
  id: string | null;          // null for new character
  isDirty: boolean;
  lastSaved: Date | null;
}
```

### Persistence

- **Auto-save draft** every 5s (when dirty) to local storage
- **Save to server** on explicit "Save" click or modal close
- **Server is source of truth** — local draft merges with server data on modal open

### FAB behavior

- **Click FAB** → open modal (or toggle if open)
- **Click FAB with pending slots** → opens modal, scrolls to pending section
- **Click outside modal** → confirm "discard changes?" if dirty
- **ESC key** → same as click outside

### Preview is always a new tab

The user confirmed: **preview should always open in a new tab**. So:
- "Preview character" button → opens `/characters/[id]` in new tab
- "Open character sheet" → same
- Modal stays open in background, doesn't disrupt building

---

## Slotting flow — detailed walkthrough

### Flow 1: User in `/sandbox/grammar?build=primitive&edit=42` clicks "Slot into character"

1. Component checks if character modal is open
2. If **modal closed**:
   - Open modal
   - Add primitive #42 to `pendingSlots` queue
   - FAB shows badge "1 pending"
3. If **modal open**:
   - Skip queue, drop primitive into modal directly
   - Modal scrolls to primitive assignment UI
4. User picks source: RACE / BACKGROUND / PERSONAL
5. If user picks "mirror", `isMirrored = true` — bar shows +BU credit
6. User confirms slot
7. Modal updates, primitive is in the chosen tab

### Flow 2: User is in modal, clicks "Slot from library"

1. Side panel slides in from right of modal
2. Shows library filtered to current entity type
3. User browses, picks item
4. Source assignment appears inline
5. User confirms

### Flow 3: User saves character (first time)

1. Modal in stepped wizard mode, on Step 5 (Review)
2. User clicks "Create character"
3. POST `/api/characters` with full payload
4. Response: character ID
5. Modal converts to tabbed editor mode for the new character
6. Character appears in user's `/creations` list

### Flow 4: User edits existing character

1. User navigates to `/characters/[id]`
2. Clicks "Edit" button
3. Modal opens with character pre-loaded
4. User makes changes, clicks "Save" → PATCH `/api/characters/[id]`
5. Modal updates, sheet view in new tab refreshes on next focus

---

## Data model — what already exists vs what's needed

### Already exists
- `characters` table with all identity/attribute fields
- `character_primitives` junction with `source`, `isMirrored`, `acquiredAtLevel`, `versionId`
- `character_capabilities` junction
- `character_items` junction
- `characterPrimitiveSourceEnum` with 6 values (`RACE | BACKGROUND | PERSONAL | TRAINING | LEVEL_UP | DM`)
- `heritageKindEnum` with 3 values (`LINEAGE | UPBRINGING | MANIFEST`) — separate from slot source
- BU engine with positive/mirror/net/volatility
- Sheet aggregator with practice/vitality/encumbrance

### Probably NOT needed for v1 modal
- (Q1 resolved) No `ARCHETYPE` slot source needed — archetype is a template kind, slots get PERSONAL
- (Q2 resolved) PERSONAL/LEVEL_UP/TRAINING/DM distinction stays in schema but not surfaced in v1 modal UI
- (Q5 resolved) Visibility is `is_public` on the character row — already a standard pattern

---

## What's IN scope for the creation modal (revised)

1. ✅ FAB-launched modal layer above sandbox
2. ✅ State persistence across navigation (Zustand)
3. ✅ Stepped wizard for new character (Mode A)
4. ✅ Tabbed editor for existing character (Mode B)
5. ✅ Multi-tab layout: Identity / Race / Background / Archetype / Items / Notes
6. ✅ Live BU budget bar (uses existing engine)
7. ✅ Mirror primitive toggle (uses existing schema field)
8. ✅ Slot-source assignment (uses existing enum)
9. ✅ "Slot into character" button in sandbox/library
10. ✅ Pending slot queue (FAB badge)
11. ✅ Library picker side panel within modal
12. ✅ Save flows (new character → POST, edit → PATCH)
13. ✅ Preview opens in new tab (per user clarification)
14. ✅ Templates pre-load (lineage/upbringing/archetype fill their tabs when picked)

## What's OUT of scope (deferred to later phases)

- Character sheet rendering (separate from creation, see master plan 8.3+)
- Live value computation (token resolver, modifiers, etc.)
- Custom stats system
- Capability modes / triggers
- Condition evaluator
- Math helpers (Apply Damage, etc.)

---

## Sub-phase ordering (revised for creation-first)

### 8.0 — Mirror Badge Fix (carryover, 30 min)

Same as before.

### 8.1 — Character Modal Layer (FAB + Zustand + stepped wizard)

**Effort:** 5-6 days
**What:** Extract wizard into modal layer. FAB + provider + state. New character flow works.
**Out of scope:** Existing character editing, multi-tab layout, slot-from-sandbox.

### 8.7a — Multi-tab layout for existing characters

**Effort:** 3-4 days
**What:** When character is loaded (or post-creation), modal converts to tabbed editor. Each tab (Identity/Lineage/Upbringing/Manifest/Items/Notes) shows the relevant slots and pickers.
**Out of scope:** BU budget bar (use simple count for now).

### 8.7b — Live BU budget bar

**Effort:** 1-2 days
**What:** Wire to existing `bu.ts` engine. Show net BU, volatility, level, percentage bar. Update live as slots change.

### 8.7c — Slot-source assignment + mirror toggle

**Effort:** 2-3 days
**What:** When adding a slot, user picks source (RACE/BG/PERSONAL/etc). Mirror toggle adds +BU credit per existing schema field.

### 8.7d — "Slot into character" button + pending queue

**Effort:** 2-3 days
**What:** Mirror the "Slot into build" pattern. Add button to primitive/effect/capability/item editors + library preview. Pending queue with FAB badge.

### 8.7e — Library picker side panel within modal

**Effort:** 2-3 days
**What:** Side panel slides in from right when user wants to slot from library while in modal. Search + filter + click-to-slot.

### 8.7f — Templates pre-load (lineage/upbringing/archetype)

**Effort:** 1-2 days
**What:** When user picks a template in the modal (or auto-loads from existing character), the template's primitives and capabilities populate the appropriate tab.

**Total estimated effort:** ~16-21 days for the full creation modal.

After 8.7f, character creation is complete. The character sheet work (8.2-8.5 in the master plan) is a separate track that consumes the data the modal produces.

---

## Open questions (need user input)

### Q1: Slot source for archetypes — RESOLVED 2026-07-17

User clarification: archetypes are template kinds (like lineage/upbringing), NOT slot-source values. The existing `heritage_kind` enum already has `LINEAGE | UPBRINGING | MANIFEST`.

The slot-source enum (`RACE | BACKGROUND | PERSONAL | TRAINING | LEVEL_UP | DM`) is **about how the character acquired the slot**, NOT which template it came from. The values `RACE` and `BACKGROUND` in the slot-source enum refer to slots that come from those templates.

**Resolution:** No new source value needed. The multi-tab layout maps:
- **Lineage tab** → slots with source = LINEAGE (auto-set when slotted here)
- **Upbringing tab** → slots with source = UPBRINGING
- **Manifest tab** → slots with source = PERSONAL by default (archetype is template kind, not slot source)
- **Personal catch-all** → slots with source = PERSONAL

**Surface in v1 modal:** RACE, BACKGROUND, PERSONAL (auto-set based on tab). Hide TRAINING, LEVEL_UP, DM — they exist in the enum for future DM bookkeeping but aren't implemented yet. The user didn't know what DM meant, confirming it's an unimplemented legacy value.

### Q2: PERSONAL vs LEVEL_UP semantics — RESOLVED 2026-07-17

User clarification: doesn't understand the distinction because nothing uses it yet. Confirmed by codebase search: no code reads or writes these values, just defaults to PERSONAL.

**Resolution:** In v1 modal, only PERSONAL is surfaced for non-template slots. The character has a single BU total — no per-source subtotals in v1. The enum values stay in the schema for future DM bookkeeping tools.

**Future:** When DM tools are built (later phase), they can use these values to filter "show me all slots acquired via level-up at level 5" etc.

### Q3: "Slot into character" click behavior — RESOLVED 2026-07-17

**User picked: Option B (pending queue with FAB badge).**

When user is editing a primitive and clicks "Slot into character":
1. Component checks if character modal is open
2. If **modal closed**: open modal + add primitive to `pendingSlots` queue. FAB shows badge "1 pending".
3. If **modal open**: drop primitive directly into modal (skip queue).

User assigns the slot to a tab (Race/Background/Archetype/Personal) when they open the modal.

### Q4: Items tab — RESOLVED 2026-07-17

User clarification: the Items tab is just another slot-source target, like Race/Background. The library action buttons are `Load into Build` / `Slot into Build` / `Slot into Character`.

**Resolution:** Items tab in the modal shows:
- "+ Slot item from library" button (uses the same library picker pattern as primitives)
- "+ Create new item" link goes to `/sandbox/blueprint?build=item` (separate tab, opens new tab — same pattern as preview)
- Items are slotted with source = PERSONAL (separate from lineage/upbringing/archetype semantics)

No special "create from scratch inside the modal" needed for v1.

### Q5: Save flow — RESOLVED 2026-07-17

**User picked: Auto-save draft + explicit publish (with visibility selector).**

- **Auto-save draft** to local storage every 5s when dirty (no server roundtrip)
- **Save button** at the bottom of the modal writes to server
  - For new character: POST `/api/characters` → creates row
  - For edit character: PATCH `/api/characters/[id]` → updates row
- **Visibility selector** in the save flow: Private / Followers / Public (matches existing visibility model on library items)
- The character has an `is_public` flag like other entities — drives who can see it

This matches the existing visibility model used by primitives/effects/capabilities/etc. — no new pattern needed.

---

## What ships with this scope (the punchline)

When 8.0 → 8.7f is done:

1. **FAB in the sandbox** (Mona Lisa icon) opens persistent character modal
2. **Modal state persists** across sandbox tab navigation
3. **New character flow**: 5-step wizard inside modal → creates character
4. **Edit character flow**: tabbed editor (Identity / Race / BG / Archetype / Items / Notes)
5. **Live BU budget bar**: net BU, volatility, level, visual usage bar
6. **Slot source assignment**: when adding primitive/capability, pick RACE/BG/PERSONAL/etc
7. **Mirror primitive toggle**: add `isMirrored = true` → get +BU credit per existing schema
8. **"Slot into character" button**: in primitive/effect/capability/item editors + library preview
9. **Pending slot queue**: FAB badge shows count, opens modal to assign
10. **Library picker side panel**: in modal, browse + pick from library without leaving
11. **Template pre-loads**: picking a race populates the Lineage tab with its primitives+capabilities
12. **Preview opens in new tab**: `/characters/[id]` always opens separately, doesn't disrupt building

That's a complete **character creation experience**. The character sheet work (sheet rendering, live values, math helpers, custom stats, capability modes) is a separate track that comes after.

---

## See also

- `docs/phase-7/condition-v1-closeout.md` — v1 conditions
- `docs/phase-7/phase-7.5-modifier-rebuild-spec.md` — modifier model (tokens are conceptual, runtime implementation deferred)
- `docs/phase-7/phase-710-COMPLETE.md` — Phase 7.10 effects/capabilities
- `docs/phase-7/phase-710-4-system-user-ui.md` — System user rule
- `docs/phase-7/phase-8-and-beyond-notes.md` — Phase 7 closeout deferred items
- `src/lib/engine/bu.ts` — existing BU ledger engine
- `src/lib/engine/sheet.ts` — existing sheet aggregator
- `src/components/workshops/character-wizard.tsx` — existing wizard to extract
- Notion: `Leveling & Progression Canon v1` (`37fed8479ccd80fba08bc88bb715658a`) — BU mechanics
- Notion: `SwordWeave TTRPG` master hub (`37eed8479ccd81fa8150d0b31e22ff1f`)