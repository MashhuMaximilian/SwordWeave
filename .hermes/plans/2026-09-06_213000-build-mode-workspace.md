# Phase 9.2 — The Workspace

**Author:** Senku  
**Date:** 2026-09-06 (revised 21:32 after Mashu sign-off)  
**Supersedes:** Phase 9.1 inline-builder scope extension.

---

## Shipped this PR (commit in flight)

- **PATCH /api/characters/[id]/primitives/[pid]** extended with `toCapabilityId` parameter. Sets `originCapabilityId` on the row, which the existing resolver walks to know which primitives belong to which capability body for that character. Validates the capability actually belongs to the target character (returns 404 otherwise). Audit log gains `fromCapabilityId` / `toCapabilityId` fields.
- **InlinePrimitiveSheet** rewritten with **3 modes** in tabs:
  - **Search library** — existing authored/public/system buckets. Each row now opens a `<PrimitivePreviewModal>` (new) showing name + category + BU + description + hard modifiers JSON. [Slot] closes both modal and sheet.
  - **Quick author** — existing 4-field mini-form.
  - **Promote condition** — new tab. Reads the character's runtime conditions from localStorage (same source as ConditionsDrawer). Click a condition → pre-fills Quick Author with the condition's title + description, switches to Quick. User picks category + BU cost, submits, primitive is created and slotted.
- **DnD primitives library** at `src/components/characters/workspace/dnd-primitives.tsx`:
  - `<DraggablePrimitiveChip>` — wraps any chip with `draggable=true`. Writes a typed payload (`CHIP_MIME`) into `dataTransfer`.
  - `<DroppableAccordion>` — render-prop drop target for heritage accordions.
  - `<DroppableCapabilityCard>` — render-prop drop target for capability cards inside heritage accordions.
  - `<TrashZone>` — drop-to-delete primitive instances.
  - 6 unit tests for the encoder/decoder + MIME constant.
- **No new migration** — `originCapabilityId` already exists on `character_primitives`; the resolver walks it. (Initial plan had a junction table; cancelled after auditing the schema.)

## DEFERRED to a follow-up PR (NOT shipped yet)

The user's mental model went further than this PR shipped:

1. **Wire drag/drop INTO the heritage accordions** so the user can actually drag a primitive from one accordion to another using mouse/touch. Today the `<DroppableAccordion>` and `<DroppableCapabilityCard>` primitives are written and tested but not consumed — they need to be wrapped around the `<HeritageKindAccordion>` and capability card bodies in `character-sheet-view.tsx`. This is an integration step on a 4261-line component; needs careful extraction of `HeritageKindAccordion` into its own client component first.

2. **Sidebar tabs (Browse / Author / Promote)** — already partly satisfied by the existing `<ConditionsDrawer>` + the new picker Promote tab. No need for a new right-sidebar component. The picker Promote tab IS the "promote condition → primitive" path; the conditions drawer IS the "list of conditions" the user wanted in the right panel.

3. **Drag effects / drag conditions** — explicitly out of scope per Mashu's "primitives inside accordions, not primitives accordion" clarification.

## Why the trimmed scope

Mashu's follow-up message corrected my over-engineering: there's already a conditions sidebar (ConditionsDrawer). I was about to build a redundant one. The 3 modes became:
- Search (existing flow, now with preview modal)  
- Quick (existing 4-field form)  
- Promote (one-click from condition to primitive — uses the existing drawer as the source)

Total LOC shipped: ~700 (vs the original 2100-line plan). Includes the API extension that unlocks DnD wiring in the next PR.

## Next session: where to start

`src/components/characters/character-sheet-view.tsx` lines 2638-2765 — that's where the 3 HeritageKindAccordion blocks are. Wrap each one's body in `<DroppableAccordion>` + each capability card in `<DroppableCapabilityCard>`. Use `<DraggablePrimitiveChip>` on each existing primitive chip inside those bodies. The DnD primitives are ready; the wiring is mechanical.

## Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Sheet header                                                    │
├──────────────────────────────┬──────────────────────────────────┤
│  STAGE                      │  RIGHT SIDEBAR (toggle, default   │
│  (active tab)               │  collapsed)                       │
│                              │  ┌─────────────────────────────┐ │
│  In BUILD mode:              │  │ Tabs: Browse / Author /     │ │
│  - Heritage accordions      │  │       Promote               │ │
│    render primitives as     │  ├─────────────────────────────┤ │
│    draggable chips          │  │ Browse tab: search across   │ │
│  - Capability cards INSIDE   │  │   primitives                │ │
│    heritage accordions are  │  │ Author tab: Primitive /     │ │
│    also drop-zones          │  │   Capability / Effect forms  │ │
│                              │  │ Promote tab: condition →    │ │
│                              │  │   primitive wrapper         │ │
│                              │  └─────────────────────────────┘ │
└──────────────────────────────┴──────────────────────────────────┘
```

## 3-mode Add Primitive sheet (Mashu's request)

When the user clicks [+ Add primitive] on any heritage accordion (or via the sidebar's [Author → Primitive] flow), they get a sheet with three sections:

1. **Search library** (`<PrimitiveSearchMode>`)  
   Text search across authored / public / system primitives. Each result row → opens `<PrimitivePreviewModal>` (the atelier's read-only preview, with [Slot] / [Edit] / [Fork]). [Slot] closes modal AND sheet, drops the chip.

2. **Create from scratch** (`<PrimitiveCreateMode>`)  
   Full atelier-grade form: name, category, BU cost, description, trigger / toggle, **right-side conditions list** (each clickable to attach as a chip in the primitive's `conditions[]`).

3. **Quick author** (`<PrimitiveQuickMode>`)  
   Name + category + BU cost + 1-line description. Stub primitive, fleshed-out later from preview.

## Drag semantics (native HTML5)

- **Primitive chip** → drag source: `draggable=true`, dataTransfer carries `{ kind: "primitive", instanceId }`.
- **Heritage accordion body** → drop target. On drop: existing `PATCH /api/characters/[id]/primitives/[instanceId]` to set `to: "LINEAGE" | "UPBRINGING" | "MANIFEST"`.
- **Capability card** inside a heritage accordion → drop target. On drop: NEW `POST /api/characters/[id]/capabilities/[capabilityId]/primitives` to slot the primitive into the capability's body (modifies the character's effective modifiers through that capability path).
- **Trash drop-zone** in the sidebar → on drop: existing `DELETE /api/characters/[id]/primitives/[instanceId]`.

For **touch / long-press**: chip has a 500ms long-press handler that opens the long-press menu (existing Phase 9.1 component) with [Move to…] / [Detach]. Move to → opens a target picker; Detach → DELETE.

## Schema

- `0055_capability_primitives.sql`: `(character_id, capability_id, primitive_id, source, order)` many-to-many, all FKs `on delete cascade`. Nullable everywhere except the IDs. No new columns on existing tables.

This table records "this primitive is slotted into this capability ON THIS CHARACTER". Distinct from `heritage_capabilities` (template link) and `capability_primitives` (if it exists — to check).

## API surface

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/characters/[id]/capabilities/[capabilityId]/primitives` | NEW — slot a primitive into a capability's body for this character |
| DELETE | `/api/characters/[id]/capabilities/[capabilityId]/primitives/[primitiveId]` | NEW — remove the slot |

That's it for new routes. Everything else reuses 9.1 endpoints.

## File plan

### New
- `src/db/migrations/0055_capability_primitives.sql`
- `src/db/schema/character-capability-primitives.ts`
- `src/app/api/characters/[id]/capabilities/[capabilityId]/primitives/route.ts` (POST + DELETE)
- `src/components/characters/workspace/workspace-shell.tsx` — gates PLAY vs BUILD render
- `src/components/characters/workspace/right-sidebar.tsx` — toggleable Toolbox
- `src/components/characters/workspace/sidebar-browse-tab.tsx`
- `src/components/characters/workspace/sidebar-author-tab.tsx`
- `src/components/characters/workspace/sidebar-promote-tab.tsx`
- `src/components/characters/workspace/primitive-picker-sheet.tsx` — the 3-mode sheet
- `src/components/characters/workspace/primitive-search-mode.tsx`
- `src/components/characters/workspace/primitive-create-mode.tsx`
- `src/components/characters/workspace/primitive-quick-mode.tsx`
- `src/components/characters/workspace/primitive-preview-modal.tsx`
- `src/components/characters/workspace/draggable-primitive-chip.tsx` — wraps chip with `draggable`
- `src/components/characters/workspace/droppable-accordion.tsx` — wraps body with `onDragOver/onDrop`
- `src/components/characters/workspace/droppable-capability-card.tsx`
- `src/components/characters/workspace/trash-zone.tsx`
- `src/lib/character/__tests__/capability-primitive-route.test.ts`

### Modified
- `src/components/characters/character-sheet-view.tsx` — in BUILD mode, render `<WorkspaceShell>` wrapping the heritage accordions.
- `src/components/characters/build-mode-banner.tsx` — add [Toolbox] toggle.
- `src/components/characters/inline-primitive-sheet.tsx` — deprecated; replaced by `<PrimitivePickerSheet>`.

### Untouched (verbatim)
- `src/components/character-modal/**` — modal creator.
- `src/components/characters/items-tab.tsx` — items accordion.
- PLAY-mode rendering.
- All 9.1 API routes except the new additions.

## Risks

- Native HTML5 DnD is **broken on iOS Safari** — `dragstart` fires but `dragover` doesn't reliably. We mitigate by keeping the long-press menu as the touch path; the drag visual is best-effort.
- DnD on 4261-line character-sheet-view.tsx is the integration risk. Solution: extract `<HeritageKindAccordion>` and the capability cards inside it into their own client components that take `onPrimitiveDrop` as a prop. WorkspaceShell wires the drop callbacks.
- New `character_capability_primitives` table needs to be queried in the character resolver — separate concern, will check if existing resolver walks heritage_capabilities.primitiveLinks; if not, we add it. Document this in a follow-up note.

## Estimate

~1500 lines net new (down from 2100 — no DnD lib, no effect routing).
