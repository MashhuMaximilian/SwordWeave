# Phase 7 Q-B m4 — AND/OR operator chain (spec, draft v3)

**Status:** SIGNED OFF by user 2026-07-16. Implementing.

## User decisions (from Discord thread, latest)

1. **No bare category tokens.** Pills carry their own category via
   prefix (`target:Prone`). Unselected categories don't render
   their pill section. The chain is **pills only**, joined by
   AND/OR operators. No `(target) AND (scene)` declarator tokens.
2. **Drag-and-drop reorder.** Using `@dnd-kit/core` + `@dnd-kit/sortable`.
3. **Default operator OR.** Chip is clickable to toggle OR ↔ AND.
4. **Real-time JSON update.** The trigger card's summary text
   reflects the live chain as the user edits — no save gate.

## Storage shape (no DB migration)

```jsonc
{
  "kind": "compound",
  // Flat token stream: pills and operators interleaved.
  // Pills carry their category via the "category:label" prefix.
  // Operators are exactly "AND" or "OR" (uppercase, distinct
  // from any pill — pills never start with "AND"/"OR").
  "tokens": [
    "target:Prone",
    "OR",
    "target:Grappled",
    "AND",
    "actor:Stance",
    "OR",
    "scene:Dim"
  ]
}
```

### Validation rules (parser)

1. `kind === "compound"` requires `tokens` array.
2. Tokens must alternate: pill, operator, pill, operator, ..., pill.
   **N pills, N-1 operators, no trailing operator.**
3. Operators must be exactly `"AND"` or `"OR"`. Anything else throws.
4. Pills must match `^<category>:<label>$` where `<category>` is one
   of `target` / `self` / `scene`. Mismatch throws.
5. Empty `tokens` → `null`.

### When is "compound" emitted vs simpler variants?

- 0 pills + no narrative → `null`.
- 1 pill, no operators → emit `tags` variant (legacy shape, no need
  for the heavier `compound` shape).
- 2+ pills OR any operator → emit `compound`.
- Narrative alone (no pills) → emit `narrative`.

### Backwards compatibility

Existing `{kind: "tags", customTags: [...]}` rows load as:
- All-OR compound (the parser implicitly inserts OR between every
  pill).
- Picker renders them with all-OR chips by default.
- If the user edits and saves, the new write uses `kind: "compound"`.

### Why no bare categories in tokens?

Per user decision 1: the picker hides per-category sections when
the category is unselected. There is no need to declare a
category as participating unless it has pills. Pills carry their
own category via prefix, so the parser can bucket them
automatically. No declarators in the chain.

### Authoring shape (in-memory, not stored)

The picker manipulates this structured shape; `buildCondition`
serializes it to the flat token stream when emitting `compound`.

```ts
export interface ConditionAuthoring {
  readonly categories: readonly ConditionPresetCategory[];
  /** Ordered list of pills in the chain. */
  readonly pills: readonly { category: ConditionPresetCategory; label: string }[];
  /** Operators between pills. Length = pills.length - 1. */
  readonly operators: readonly ("AND" | "OR")[];
  readonly narrative: string;
  readonly includeTags: boolean;
}
```

## Picker UX

### Trigger card (compact summary, real-time)

```
┌─ Triggers when… ─────────────────────────────────────────┐
│                                                           │
│ Target [Self] [Scene]      ← category multi-select chips │
│                                                           │
│ Current expression                                         │
│ ┌─────────────────────────────────────────────────────┐  │
│ │ Prone  OR  Grappled  AND  Stance  OR  Dim           │  │
│ │ [edit]                                              │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                           │
│ ▾ Target pills (tap to add to end of expression)         │
│   [Bleeding] [Prone] [Grappled] [...]                    │
│ ▸ Self pills                                              │
│ ▸ Scene pills                                             │
│                                                           │
│ ── Or describe it yourself ──                            │
│ [textarea]                                                │
└───────────────────────────────────────────────────────────┘
```

### Edit expression modal (drag-and-drop, mobile-friendly)

```
┌─ Edit trigger expression ─────────────────────────────────┐
│                                                           │
│ Drag rows to reorder. Tap × to remove. Tap AND/OR to     │
│ toggle. Tap a chip below to add to the end.               │
│                                                           │
│ ┌─────────────────────────────────────────────────────┐  │
│ │ ⋮⋮  Prone             [Target]              ×       │  │
│ │           ↓                                          │  │
│ │       [OR ▼]                                         │  │
│ │           ↓                                          │  │
│ │ ⋮⋮  Grappled          [Target]              ×       │  │
│ │           ↓                                          │  │
│ │       [AND ▼]                                        │  │
│ │           ↓                                          │  │
│ │ ⋮⋮  Stance            [Self]                ×       │  │
│ │           ↓                                          │  │
│ │       [OR ▼]                                         │  │
│ │           ↓                                          │  │
│ │ ⋮⋮  Dim               [Scene]               ×       │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                           │
│ ┌─ Add to end ─────────────────────────────────────────┐  │
│ │ Target pills: [+ Bleeding] [+ Prone] [+ Grappled]  │  │
│ │ Self pills: [+ < 50% HP] [+ Stance] [...]          │  │
│ │ Scene pills: [+ Dim] [+ Loud] [...]                │  │
│ │ Custom pill: [_______________] [+ add]              │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                           │
│                          [Close]                          │
└───────────────────────────────────────────────────────────┘
```

The "Add" chips are the **same per-category chips that appear in
the collapsed sections of the trigger card**. Tapping one
anywhere in the picker adds the pill to the end of the chain
with a default OR before it (unless the chain is empty, in
which case no operator is needed).

### Mobile UX (≤640px)

- Modal takes full screen width (max-width: none).
- Touch-friendly drag handles (large hit target, cursor: grab).
- @dnd-kit/sortable supports touch via PointerSensor.
- Operator chips render larger (min 44×44px tap target).

### Real-time JSON

`onChange` fires on every drag-end, every × tap, every operator
toggle, every chip-add. The trigger card's summary line outside
the modal updates immediately — the user sees the JSON shape
they're building as they edit.

## Implementation plan

### 1. Types (`src/types/condition.ts`)

- Add `compound` variant to `ModifierCondition` union.
- Update `ConditionAuthoring`:
  - `customPills: { category, label }[]` → `pills: { category, label }[]`.
  - Add `operators: ("AND" | "OR")[]` (length = pills.length - 1).

### 2. Parser (`src/lib/primitives/condition.ts`)

- New branch in `parseCondition` for `{ kind: "compound", tokens }`.
  Validate alternating structure, validate operators ∈ {"AND","OR"},
  validate pill prefixes ∈ {target, self, scene}.
- New helper `serializeCompoundTokens(pills, operators) → string[]`.
- `buildCondition` rule change:
  - 0 pills, no narrative → null.
  - 1 pill, 0 operators → tags (legacy).
  - 2+ pills OR any operators → compound with serialized tokens.
  - Narrative only → narrative.
- `conditionToBadges` (`compound` branch):
  - Walk tokens alternately. Each pill → badge with category color.
    Each operator → inline connector text "AND" / "OR".

### 3. Picker (`src/components/sandbox/condition-picker.tsx`)

- `<ExpressionEditorModal>` component:
  - @dnd-kit/sortable vertical list.
  - Each row: drag handle, label, category badge, × button.
  - Between rows: AND/OR chip (clickable to toggle).
  - Bottom panel: per-category adders.
- `<TriggerExpressionSummary>` component (live, real-time):
  - Renders compact summary line: pills separated by operators as
    text. "Prone OR Grappled AND Stance OR Dim".
  - "Edit" button opens modal.
- `<ConditionPicker>` renders `<TriggerExpressionSummary>` above
  the per-category sections. Tapping a per-category chip adds to
  the end of the chain (real-time).

### 4. Dependency

Add `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`
to `package.json`.

### 5. Tests

- `condition.test.ts`:
  - `parseCondition` accepts valid `compound` shape.
  - `parseCondition` rejects odd-length tokens.
  - `parseCondition` rejects non-AND/OR operators.
  - `parseCondition` rejects pill prefix not in known categories.
  - `buildCondition` emits `compound` for 2+ pills.
  - `buildCondition` emits `tags` for exactly 1 pill.
  - `buildCondition` emits `compound` for ≥2 pills with any operators.
  - `conditionToBadges` handles `compound` correctly.
- `condition-picker.test.ts`:
  - Add pill → pills length grows by 1, operators length adjusts.
  - Remove pill from middle → operators adjust (no orphaned connector).
  - Toggle operator → operator flips at index.
  - Reorder → pills array reorders, operators move with their
    adjacent pill.

### 6. UX edge cases

- Removing a pill in the middle: the operator that preceded it
  is also removed (operators array stays length = pills.length - 1).
- Removing the only pill: operators array goes empty.
- Toggling an operator when only 1 pill: no-op (no operators).
- Adding a pill when chain is empty: no operator added.
- Adding a pill when chain has items: OR operator added before
  the new pill.
- Adding a custom pill (typed): added to end with OR (or AND if
  the last operator was AND? — spec says always OR for new pills).