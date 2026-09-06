# Plan: Atelier triage + character creation + condition→primitive

**Created:** 2026-09-06 (EEST, host local 20:33)
**Branch:** `main` @ `d8a4e5e` (production)
**Prior fixes still on main:** `3a87838` expertise (reapplyMirror guard), `8790285` isAttrProficient pre-scan

---

## Q1 — DB probe (answer)

**8 primitives created since 16:00 EEST today.** Probe `scripts/_probe_primitives_today.mts`:

| id | created (EEST) | name |
|----|----------------|------|
| 21354 | 19:18:16 | Infallible folicles |
| 21353 | 19:15:37 | Enfeebling Envenom |
| 21352 | 19:11:51 | Big Bear Belly |
| 21351 | 19:10:55 | Metallic Masticators |
| 21350 | 19:07:28 | Combat Commands |
| 21349 | 19:02:07 | Bodily boon |
| 21348 | 19:00:13 | Innate instinct |
| 21347 | 18:39:10 | Mental Muscle Mass |

DB clock = 2026-09-06 17:34 UTC = 20:34 EEST, so all 8 fall in the window. Total in 24h / 7d = same 8 → confirms no creation in the 8h–24h gap. Nothing dropped, nothing lost. **Save path is working.**

---

## Q2 — Atelier issues (sign-in / search / sort / save)

### Q2.1 Sign-in page not properly working

**Investigation:**
- `GET /sign-in` → 200, body includes `<div class="flex justify-center">` with mounted `SignIn` Clerk component (`"$L6"` in SSR payload). HTML structure is correct.
- Clerk script (`clerk-js@6`) preloaded from `https://clerk.swordweave.quest`. No build errors visible.
- `proxy.ts` (`clerkMiddleware`) lists `/sign-in(.*)` in `isPublicRoute` — auth wall is not blocking.

**Likely cause:** clerk-js hydration issue, OR a recent Clerk runtime error in production. Without browser access here, I cannot reproduce directly.

**Action:**
1. Confirm latest Vercel deploy (`d8a4e5e`) is what serves `/sign-in` — it is (per Vercel headers above).
2. Need the user's screenshot of the actual error, or a description ("form blank", "submit button broken", "redirect loop"). One specific symptom will pin this in one round.

### Q2.2 Atelier: search only matches titles, RECENT sort broken, save can look broken

Three real bugs, all in **Atelier (`/atelier`)**, NOT in the public Codex (`/library`).

#### Bug A — search filters only `item.name`

**Location:** `src/components/sandbox/grammar-library.tsx` line 478

```ts
if (toolbarState.search) {
  const q = toolbarState.search.toLowerCase();
  if (!item.name.toLowerCase().includes(q)) return false;  // ← ONLY name
}
```

User symptom: typing a tag, target name, or description finds nothing.

By contrast, `/library/browse` server-side search (`src/lib/publishing/library-query.ts:613-619`) searches `name OR verboseDescription` for capabilities and `name` for primitives — at least capabilities search description. The atelier in-memory filter is even narrower than the public one.

**Fix:** Expand search to also match against `item.description`, `item.tags`, `item.category`, and (lower-priority) `item.targetType`. Same shape for `heritage-library.tsx` if it has the same bug.

#### Bug B — RECENT sort does nothing in atelier

**Location:** `src/components/sandbox/sandbox-row-mapper.ts:175-181` (`EMPTY_ENGAGEMENT`)

```ts
const EMPTY_ENGAGEMENT = {
  ...
  publishedAt: null,  // ← always null in atelier
};
```

User symptom: "Recent" sort order in `/atelier` looks identical to "Engagement".

**Root cause:** sandbox-side rows (primitives, effects, capabilities, heritage, items) are passed through `*ToLibraryItem(row)` which spreads `EMPTY_ENGAGEMENT`. Public Codex rows use `r.createdAt → publishedAt` (`library-query.ts:570,702,830,950,1097,1241`).

**Fix:** in the Atelier server (`src/app/atelier/page.tsx`), before mapping, attach `createdAt` to each row (the Drizzle `with` query already returns `createdAt` from `timestamps`). In `sandbox-row-mapper.ts`, expose `createdAt: row.createdAt ?? null` on each mapper and read it as `publishedAt`.

Concrete diff:
- `sandbox-row-mapper.ts`: change `EMPTY_ENGAGEMENT.publishedAt = null` → each mapper passes `publishedAt: row.createdAt ?? null` (mirrors `library-query.ts` shape).
- Mappers needing the change: `primitiveToLibraryItem`, `effectToLibraryItem`, `capabilityToLibraryItem`, `heritageToLibraryItem`, `itemToLibraryItem` (all 5 mappers).
- `SandboxPrimitive`/`SandboxEffect`/`SandboxCapability`/`SandboxTemplate`/`SandboxItem` types need to add `createdAt?: string | Date | null`.

#### Bug C — save appearing broken (after Bug A fix it may self-resolve)

`useSandboxSaveHandler` (line 42) prepends `optimisticItems` to the list on `sw-sandbox-saved`. The form (`primitive-form.tsx:1207-1218`) POSTs `/api/primitives` and the atelier dispatches `sw-sandbox-saved` after success (`atelier-sandbox-client.tsx:907-919`). This logic is correct. But if the new entity has e.g. tag-only search and Bug A filters it out, the user sees the optimistic item land and then "disappear" after `router.refresh()` → confusion: "save is broken, search doesn't find it."

**Fix:** Bug A + Bug B fix will make save "look" unbroken. No further change needed.

---

## Q3 — Features

### Q3.1 Create character with just identity, attributes, eventually backstory

**Current state:** `/api/characters` POST already accepts `name + attrPhysical + attrMental + attrMagical + attrProficient` (no required heritage, no required items, no required anything else). Line 166: `if (!name) ...` is the only mandatory check. Line 193: attributes must sum to 10. Backstory is optional (line 264-275 parses if present, else `null`).

**So** the endpoint supports this. The UX gap must be either in:
- (a) the modal's `canCreate` gate, or
- (b) the modal not surfacing "Create" until identity is filled.

Let me audit both paths before the user expects this to work.

### Q3.2 Condition → primitive transform (character sheet → atelier)

**Sketch (open questions before code):**
1. **Where:** per-accordion (Lineage/Upbringing/Manifest) "Extract as primitive" button on `character-sheet-view.tsx`.
2. **What:** picks all conditions currently `active` on this character's sheet + accordion (Lineage / Upbringing / Manifest), bundles into a new primitive's modifier list (or augments the active heritage).
3. **Toggle pattern:** per accordion, "+ Extract" opens a chooser: "Add as new primitive" vs "Augment this accordion's heritage." The latter writes back into the heritage's bundled primitives + effects.

**This is significant new code.** Needs:
- New API: `POST /api/characters/[id]/extract-conditions` → creates primitive(s) from active conditions.
- New modal: `condition-extract-modal.tsx`.
- New server actions to wire the toggle.
- Mapping from `RuntimeCondition` (sheet-side) → `HardModifier` row (sandbox-side).

### Q3.3 Transform each accordion in a new heritage of the accord type

**Sketch:** "Wrap as heritage" button. Gathers the accordion's primitives + capabilities + their effects, calls `POST /api/heritage` with the appropriate `kind` (LINEAGE/UPBRINGING/MANIFEST) and the bundle.

Same shape as Q3.2 — new API + modal + accordion wiring.

---

## Sequencing

| Order | Item | Time | Risk |
|------:|------|------|------|
| 1 | Bug A: extend atelier search to description + tags + category | 30 min | low — string-includes change, no schema |
| 2 | Bug B: thread `createdAt` through sandbox mappers → publishedAt, so RECENT sort works | 45 min | low — type-only + 5 mappers |
| 3 | Audit `canCreate` modal gate + Identity tab UX → confirm Q3.1 already works end-to-end | 30 min | none |
| 4 | Q3.2 + Q3.3 design writeup → ask user 3 scoping questions before code | 30 min | none |
| 5 | Implement Q3.2 + Q3.3 once approved | ~1 day | medium — new tables / new routes |

Items 1 + 2 are independent, ship together as one PR. Items 3 is verification-only. Items 4 + 5 are separate scope.

## Open questions for the user (before code on 4/5)

1. **"Add a plus button" location** — per-accordion in `character-sheet-view.tsx`, or in the `ConditionsDrawer` (right drawer)? The drawer surfaces runtime conditions; the sheet accordions surface heritage bundles. Pick one.
2. **Bundle persistence** — does the new primitive/heritage auto-slot into the character (becomes part of the build), or does it land in the user's library as a draft to slot later?
3. **Lineage vs Upbringing vs Manifest disambiguation** — when a condition is on the *sheet* (not on a specific accordion), which tab does it extract to? My default would be: lineage-first if `proficientAttribute` is set, upbringing-else. Confirm.

---

## Verification matrix (after fix ships)

| Check | Command | Expected |
|-------|---------|----------|
| Bug A | Type a tag-only word in `/atelier` search → expect match | hits an item whose `tags` contains the word |
| Bug A | Type a substring of `mechanicalOutputText` | hits that primitive |
| Bug B | Switch sort to RECENT | 8 most-recent primitives land at top, NOT alphabetical |
| Save | Create 3 primitives in a row, switch tabs | list keeps all 3 visible across refresh |
| Q3.1 | Open character modal as-is, fill only name+attrs, save | new character row appears |

---

# Part 2 — Inline character-builder redesign

**Author:** Senku Ishigami, 2026-09-06 20:46 EEST
**Triggered by:** Mashu Q3 follow-up — "easier way to make a character sheet… build the body first, then place primitives as conditions… move freely between heritages and items… mobile-friendly… drag-and-drop or equivalent."

## Problem frame

Current flow: **prebuild → assemble**
1. Open `/atelier`. Create 12 primitives. Create 2 effects. Create 3 capabilities. Compose 3 heritages (lineage, upbringing, manifest). Author 5 items.
2. Open `/characters/new` (modal). Slot everything. Save.

This is the **factory first** model. It's correct for power users but miserable on mobile and for casual play. Mashu's target flow is the inverse:

**Target flow: assemble → formalize**
1. Open `/characters/new` (full-page mode on `/characters/[id]`). Fill name + attributes + backstory + identity. **Save with empty body.** Page lands on `/characters/[id]` in **BUILD MODE**.
2. From the character's own accordions (Lineage/Upbringing/Manifest/Items), tap **+ Add primitive**. A bottom-sheet picker shows my library + a "+ Create new primitive" button. Pick → it appears as a condition chip on the chosen accordion.
3. As conditions accumulate, **each accordion becomes a heritage shell**. Tap "Formalize" → the lineage accordion's primitives + their effects become a real heritage row in `heritage` table. Tap "Wrap as item" on the items accordion → the items become a real item row.
4. At any point during BUILD MODE, drag a primitive chip from lineage to upbringing. The chip moves its origin; modifiers stay; the engine sees the new lineage via the slot source.
5. When done, tap "Finish building" → exit BUILD MODE. The character is locked to its current state; subsequent edits are normal character edits (modal flow today).

## The mental model shift

Today the modal holds 7 tabs (identity, backstory, attributes, lineage, upbringing, manifest, items). Heritage authoring is in `/atelier`. The character edit happens across both surfaces.

The new model is: **character sheet = the authoring surface.** The modal dies for character creation. It stays only for *quick edits* on existing characters. The `/characters/[id]` page itself becomes a mode-aware canvas:

| Mode | When | Surface |
|------|------|---------|
| `BUILD` | new character, or "Edit build" tapped on an existing character | full-bleed accordions, drag/drop primitives, "Formalize" buttons |
| `PLAY` | default for saved characters | today's read-only sheet with PB, saves, conditions drawer |

`BUILD` requires no prebuild in `/atelier`. Primitives are created inline. Heritages are extracted (formalized) inline. Items too.

## Five concrete mechanics

### 1. Inline primitive authoring inside the accordion

**Where:** `/characters/[id]` BUILD MODE → accordion header → `+ Add primitive` → bottom sheet.

**Sheet contents (mobile-first):**
- Top: search bar (uses atelier's now-fixed library-query-style search)
- Middle: scrollable list of **my authored primitives** + **public primitives I haven't authored** + **system primitives**
- Bottom: `+ Create new primitive` button → opens a slide-over `PrimitiveMiniForm` (just name + 1 modifier + category + cost). Save → chip appears on the accordion.
- Empty search "create new" hotkey: typing + no result → `Create "<search>"` button at the top of the results.

**Persistence:** every inline creation is a real row in `primitives` with `user_id = <character owner>`. The chip on the character sheet references it via `character_primitives.instance_id` (which we already have from Phase 8.3a multi-instance storage).

### 2. Drag/drop primitives between accordions

**Mobile-first constraint:** native HTML5 drag/drop is desktop-only. Mobile needs a long-press menu instead. Both must work.

**Desktop:**
- Chip → `draggable=true`, drop target = any accordion header.
- Drop fires `PATCH /api/characters/[id]/primitives/[primitiveId]` with `{ originHeritageId: newAccordionKind, originCapabilityId: null }`.

**Mobile:**
- Long-press chip → bottom sheet: "Move to: Lineage / Upbringing / Manifest / Items / Detach (remove from character)". Tap destination → same PATCH.

**Engine consequence:** `origin_heritage_id` / `origin_capability_id` columns on `character_primitives` (we added these in Phase 8.1 batch 13.1) already track provenance. The chip's `provenance.kind` and breadcrumb update in real time. The engine doesn't need a code change; only the UI plumbing does.

### 3. Heritage formalization ("wrap this accordion as a heritage")

**Where:** BUILD MODE → accordion → overflow menu → **"Formalize as heritage"**.

**What happens:**
1. Reads the accordion's currently slotted primitives + their composed effects/capabilities.
2. Opens a confirm sheet: "Formalize Lineage accordion as a new heritage?" — name field (defaults to character name + accordion kind), Visibility picker (Private / Followers / Public).
3. On confirm:
   - `POST /api/heritage` with `kind = LINEAGE`, the bundled primitives + capabilities.
   - `POST /api/heritage/publish` with `targetType: LINEAGE_TEMPLATE, targetId: <newId>`. (Existing route. Just wires to the right enum value.)
   - On the character, `UPDATE characters.lineage_id = <newId>`, and the accordion now displays the new heritage's author + version header.
4. Inline primitives are now ALSO heritage slots (because the accordion's source becomes the heritage row). The chip's provenance shows "via <heritage name>".

### 4. Item formalization

**Where:** BUILD MODE → Items accordion → **"Wrap as item"** button.

Same shape as 3 but:
- Target table = `items`.
- Compiled primitive bundle (with quantity) + capability bundle becomes the item row.
- The character sheet's items accordion header now shows the item's name + rarity + slot cost.

### 5. Mode toggle & persistence

**Mode flag:** stored on `characters.mode` column (new). Default `PLAY` for existing rows. New chars = `BUILD` until "Finish building" is tapped.

**When toggling to PLAY:**
- Accordion headers collapse to read-only.
- Conditions drawer stays.
- The PB / saves / mods / attack bonus cards stay (today's runtime).
- A persistent banner: "Open in Build Mode" button (visible on PLAY, hidden on BUILD).

**When toggling to BUILD:**
- Primitives become draggable chips.
- "Formalize" buttons appear.
- Save is auto-on every primitive/heritage/item authoring operation (no explicit Save step).

## What survives

The modal still exists. Its job narrows to:
- **Quick edits** (rename, change level, tweak attributes) on existing characters.
- **Visibility toggles** (the visibility chip on `/creations`).
- **BU adjustments** (the dm-bonus editor).

The full creation flow moves to `/characters/new` (a brand-new route) → `/characters/[id]` (BUILD mode).

### ⚠️ Modal preservation contract (Mashu 2026-09-06)

The current **7-tab character modal** at `src/components/character-modal/character-modal-store.tsx` (tabs: identity / backstory / attributes / lineage / upbringing / manifest / items) is **NOT deprecated** by this redesign. It is the canonical character-authoring surface for users who prefer it. Specifically:

1. **The modal still creates new characters.** `POST /api/characters` accepts the modal's payload shape unchanged. The modal can still be opened from `/creations`, `/characters`, and the FAB.
2. **The modal still edits existing characters.** Today's `/characters/[id]?edit=true` (or any modal-driven edit path) continues to work. Quick-edit and rename flows keep the modal.
3. **The modal coexists with BUILD mode.** A user who opened a character in BUILD mode can switch to PLAY mode and use the modal as before. A user who started in the modal can later tap "Edit build" on the character sheet to enter BUILD mode.
4. **What changes is the default creation route.** `/characters/new` (a full-page equivalent of the modal's identity/backstory/attributes tabs) becomes the recommended starting point. The modal stays as a parallel entry.

**Engineering implication:** never inline the modal store into BUILD mode; never delete `character-modal-store.tsx`; never collapse the 7 tabs into a single full-page form unless Mashu asks. If a future refactor wants to share a typing between the modal and BUILD mode, do it via a shared `CharacterDraft` type — keep the modal's tabbed render path intact.

**Verification:** every release must keep `/characters` → "Edit" button working without a redirect to `/characters/[id]?mode=BUILD`.

## Migration plan

| Layer | Change | Risk |
|-------|--------|------|
| Schema | `characters.mode TEXT NOT NULL DEFAULT 'PLAY'` (idempotent migration) | low — additive nullable default |
| API | `POST /api/characters/[id]/primitives` (inline create), `PATCH /api/characters/[id]/primitives/[pid]` (move), `POST /api/characters/[id]/heritages/formalize`, `POST /api/characters/[id]/items/formalize`, `POST /api/characters/[id]/mode` | medium — 5 new routes |
| Routes | New `src/app/characters/new/page.tsx` (full-page creator) | low — copied from modal store |
| UI | `CharacterSheetView` gains a `mode: "BUILD" \| "PLAY"` prop + accordion children render different affordances per mode | medium — touches the 3500-line monolith |
| Component | `InlinePrimitiveSheet.tsx`, `HeritageFormalizeSheet.tsx`, `ItemFormalizeSheet.tsx`, `PrimitiveMiniForm.tsx`, drag/drop context (`useDraggableChip`, `useDropAccordion`) | medium — new shared primitives |
| Engine | none. (Engine already consumes `character_primitives.origin_heritage_id` etc.) | none |

## Sequencing (revised)

| # | Item | Time | Risk |
|--:|------|------|------|
| 1 | Bug A+B (shipped `371f0d8`) | done | done |
| 2 | Schema: `characters.mode` column, DB migration | 30 min | low |
| 3 | New API: `POST /api/characters/[id]/primitives` (inline create) + `PATCH /api/characters/[id]/primitives/[pid]` (move) | 3 h | medium |
| 4 | Inline primitive sheet + long-press menu | 4 h | medium |
| 5 | New page `/characters/new` → redirect to `/characters/[id]?mode=BUILD` | 2 h | low |
| 6 | Accordion drag/drop wiring (desktop) | 4 h | medium |
| 7 | Mode toggle + banner + Persistence | 3 h | medium |
| 8 | Heritage formalization (accordion → `heritage` row) | 6 h | medium |
| 9 | Item formalization (items accordion → `items` row) | 4 h | medium |
| 10 | Tests + visual verification on mobile widths | 4 h | n/a |

Total: ~30 hours. Ships as 4 PRs:

**PR A — schema + APIs (steps 2, 3):** foundation. No UI change visible.
**PR B — inline authoring (steps 4, 5, 6, 7):** the user-facing flow. Biggest UX win.
**PR C — formalization (steps 8, 9):** turns accordions into real rows.
**PR D — tests + mobile QA (step 10).**

## Open questions (before PR B starts)

1. **Search-source priority in inline picker** — my authored primitives first, then public, then system — or alphabetical regardless of ownership? My default: authored-first.
2. **"Create new primitive" inline form** — full primitive form (16 fields), or minimal (name + 1 modifier + category + cost, expand later)? My default: minimal — saves time, the user can later edit the row in `/atelier` for full fidelity.
3. **Long-press duration** — 400 ms standard, or 600 ms (less accidental on mobile)? My default: 500 ms.
4. **Visibility default when formalizing** — Private (safer for accidental leaks) or Followers (your table sees it)? My default: Private with one-tap to change.
5. **Drag visual feedback on mobile (long-press menu)** — confirm bottom sheet is the right shape, vs. a floating action menu anchored to the chip. My default: bottom sheet (consistent with the rest of the mobile app).
6. **(NEW 2026-09-06) Modal co-existence** — confirm both flows should be live at once. *My default: yes — modal stays as a parallel authoring entry; BUILD mode is additive.* See "Modal preservation contract" above.

If those defaults are fine, I start with PR A.

