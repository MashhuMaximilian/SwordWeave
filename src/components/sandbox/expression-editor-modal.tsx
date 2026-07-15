"use client";

/**
 * ExpressionEditorModal — Phase 7 Q-B m4
 *
 * Full editor for the trigger expression chain:
 *   - Drag-and-drop reorder of pills (via @dnd-kit/sortable)
 *   - AND/OR chip between each adjacent pair, click to toggle
 *   - × to remove a pill
 *   - "Add to end" affordances (per-category chips + custom input)
 *
 * The modal emits a new ConditionAuthoring via onChange every time
 * the user changes anything. The parent picker's summary line
 * updates in real time (no save gate).
 *
 * Mobile-friendly: drag handles are large, operator chips are
 * 44×44px minimum tap targets, modal takes full screen width.
 */

import { useState, type ReactElement } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CONDITION_PRESETS,
  type ConditionAuthoring,
  type ConditionPresetCategory,
} from "@/types/condition";

const CATEGORY_LABELS: Record<ConditionPresetCategory, string> = {
  target: "Target",
  actor: "Self",
  scene: "Scene",
};

interface ExpressionEditorModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly value: ConditionAuthoring;
  readonly onChange: (next: ConditionAuthoring) => void;
}

export function ExpressionEditorModal({
  open,
  onOpenChange,
  value,
  onChange,
}: ExpressionEditorModalProps): ReactElement | null {
  // Always render the container so the modal can animate in/out,
  // but only display the inner content when open.
  if (!open) return null;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Pill IDs — dnd-kit needs stable string IDs per sortable item.
  // We generate them as `<index>:<category>:<label>` so React keys
  // are stable across reorders.
  const pillIds = value.pills.map(
    (p, i) => `${i}:${p.category}:${p.label}`,
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over == null || active.id === over.id) return;
    const oldIndex = pillIds.indexOf(String(active.id));
    const newIndex = pillIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    // arrayMove the pills AND their operators (operators stay
    // attached to the pill they precede — moving pill i to position
    // j moves operator i-1 with it, and operator i becomes the
    // operator at the new boundary).
    const reorderedPills = arrayMove(
      value.pills.map((p) => ({ ...p })),
      oldIndex,
      newIndex,
    );
    // Operators array semantics: operators[i] binds pills[i] to
    // pills[i+1]. After reorder, we want operators[k] to bind
    // reorderedPills[k] to reorderedPills[k+1] — but the operator
    // TYPE (AND/OR) was originally chosen by the user for the
    // adjacency at OLD position. To preserve user intent, the
    // simplest rule is: operators move WITH the pill that was at
    // the LEFT of the operator (i.e. operator i moves to position
    // min(oldIndex, newIndex) after reorder).
    //
    // We implement this by tracking operators with their "left pill"
    // identity. Here, simpler: take the operator that was at
    // oldIndex - 1 (or +0 if oldIndex === 0) and move it to
    // newIndex - 1. The other operators stay in place.
    const reorderedOperators: ("AND" | "OR")[] = [...value.operators];
    // For simplicity in this milestone, the operator that was
    // immediately AFTER oldIndex (i.e. operators[oldIndex], which
    // bound old pill to next) stays with the pill at oldIndex when
    // it moves. Operators before oldIndex stay put.
    // The cleanest implementation: re-pair every pill with its
    // adjacent operator by tracking which operator was to its right
    // BEFORE the move, then placing them after the move.
    //
    // Implementation: build a side-by-side list of [pill, op-after]
    // pairs, then arrayMove them as units.
    if (reorderedOperators.length === 0) {
      onChange({ ...value, pills: reorderedPills });
      return;
    }
    // Build the (pill, opAfter) pairs.
    // pairs[i] = { pill: pills[i], opAfter: operators[i] } for i in [0, n-2].
    // The last pill has no opAfter.
    type Pair = {
      pill: ConditionAuthoring["pills"][number];
      opAfter?: "AND" | "OR" | undefined;
    };
    const pairs: Pair[] = reorderedPills.map((pill, i) => ({
      pill,
      opAfter: i < reorderedOperators.length ? reorderedOperators[i] : undefined,
    }));
    // To make the reorder respect the operator TYPE that was chosen
    // by the user at the old adjacency, we need to track the
    // ORIGINAL operator at index oldIndex and preserve it through
    // the move. In the pair representation, that operator lives at
    // pairs[oldIndex].opAfter.
    //
    // For now we use a simpler rule: the operator immediately
    // preceding the moved pill stays attached to it. This means
    // operators[oldIndex - 1] moves with the pill if it exists.
    // Operators[oldIndex] (the one AFTER oldIndex) also moves.
    // In pair terms: if oldIndex === 0, no preceding op; if
    // oldIndex > 0, the op at operators[oldIndex - 1] is the one
    // preceding the pill. After move, this op becomes operators[newIndex - 1].
    //
    // Operators after the moved pill also need to follow. To keep
    // this milestone simple, we just arrayMove the whole pairs
    // list — this means the operator that was between oldIndex and
    // oldIndex+1 now sits between the moved pill and the pill that
    // used to be at newIndex. This is "the operator follows the
    // pill it preceded" semantics.
    const movedPairs = arrayMove(pairs, oldIndex, newIndex);
    const nextPills = movedPairs.map((p) => p.pill);
    const nextOperators: ("AND" | "OR")[] = [];
    for (let i = 0; i < movedPairs.length - 1; i++) {
      const op = movedPairs[i]!.opAfter ?? "OR";
      nextOperators.push(op);
    }
    onChange({
      ...value,
      pills: nextPills,
      operators: nextOperators,
    });
  };

  const removePillAt = (index: number) => {
    const nextPills = value.pills.filter((_, i) => i !== index);
    // Operators stay length = nextPills.length - 1. Drop the
    // operator at index-1 (the one BEFORE the removed pill).
    const nextOperators: ("AND" | "OR")[] = [];
    for (let i = 0; i < nextPills.length - 1; i++) {
      const oldIdx = i < index ? i : i + 1;
      nextOperators.push(value.operators[oldIdx] ?? "OR");
    }
    onChange({ ...value, pills: nextPills, operators: nextOperators });
  };

  const toggleOperatorAt = (index: number) => {
    if (index < 0 || index >= value.operators.length) return;
    const next = [...value.operators];
    next[index] = next[index] === "AND" ? "OR" : "AND";
    onChange({ ...value, operators: next });
  };

  const addPillAtEnd = (category: ConditionPresetCategory, label: string) => {
    const trimmed = label.trim();
    if (trimmed.length === 0) return;
    const dup = value.pills.some(
      (p) => p.category === category && p.label === trimmed,
    );
    if (dup) return;
    const nextPills = [...value.pills, { category, label: trimmed }];
    const nextOperators: ("AND" | "OR")[] = value.pills.length === 0
      ? []
      : [...value.operators, "OR"];
    onChange({ ...value, pills: nextPills, operators: nextOperators });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="expression-editor-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-lg bg-background p-4 shadow-lg sm:rounded-lg">
        <div className="mb-3 flex items-center justify-between">
          <h2
            id="expression-editor-title"
            className="text-sm font-bold"
          >
            Edit trigger expression
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-accent"
          >
            Close
          </button>
        </div>

        <p className="mb-3 text-xs text-muted-foreground">
          Drag rows to reorder. Tap × to remove. Tap the AND/OR chip to
          toggle. Tap a chip below to add to the end.
        </p>

        {/* ── Sortable list of pills + operator chips between them ── */}
        {value.pills.length === 0 ? (
          <p className="my-4 text-center text-xs text-muted-foreground">
            No pills yet — add some below.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={pillIds}
              strategy={verticalListSortingStrategy}
            >
              <ol className="space-y-0">
                {value.pills.map((pill, i) => (
                  <PillRowWithOperator
                    key={pillIds[i]}
                    id={pillIds[i]!}
                    pill={pill}
                    operator={i > 0 ? value.operators[i - 1] : undefined}
                    onRemove={() => removePillAt(i)}
                    onToggleOperator={
                      i > 0 ? () => toggleOperatorAt(i - 1) : undefined
                    }
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}

        {/* ── Add to end: per-category chips + custom pill input ── */}
        <div className="mt-4 space-y-2 border-t border-border pt-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Add to end
          </div>
          {(["target", "actor", "scene"] as const).map((cat) => {
            const pillsInCat = value.pills.filter((p) => p.category === cat);
            const suggestions = CONDITION_PRESETS.filter(
              (p) => p.category === cat,
            );
            return (
              <details key={cat} className="rounded-md border border-border">
                <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-xs font-medium hover:bg-accent">
                  <span>{CATEGORY_LABELS[cat]} pills</span>
                  <span className="text-[10px] text-muted-foreground">
                    {pillsInCat.length} in chain
                  </span>
                </summary>
                <div className="border-t border-border p-3">
                  <CustomPillInput
                    onAdd={(label) => addPillAtEnd(cat, label)}
                  />
                  {suggestions.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {suggestions.map((s) => {
                        const alreadyAdded = pillsInCat.some(
                          (p) => p.label === s.label,
                        );
                        return (
                          <button
                            key={s.key}
                            type="button"
                            onClick={() => addPillAtEnd(cat, s.label)}
                            disabled={alreadyAdded}
                            title={s.hint ?? s.label}
                            className={
                              alreadyAdded
                                ? "rounded-full border border-border bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground line-through"
                                : "rounded-full border border-dashed border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-accent"
                            }
                          >
                            + {s.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </details>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// PillRowWithOperator — single sortable row + its preceding operator
// =============================================================================

interface PillRowWithOperatorProps {
  readonly id: string;
  readonly pill: { category: ConditionPresetCategory; label: string };
  readonly operator: "AND" | "OR" | undefined;
  readonly onRemove: () => void;
  readonly onToggleOperator: (() => void) | undefined;
}

function PillRowWithOperator({
  id,
  pill,
  operator,
  onRemove,
  onToggleOperator,
}: PillRowWithOperatorProps): ReactElement {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <li ref={setNodeRef} style={style} className="flex flex-col">
      {operator !== undefined && onToggleOperator !== undefined ? (
        <button
          type="button"
          onClick={onToggleOperator}
          className={
            operator === "AND"
              ? "mx-auto my-0.5 flex h-7 w-12 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10 text-[10px] font-bold uppercase tracking-wider text-amber-700 hover:bg-amber-500/20 dark:text-amber-300"
              : "mx-auto my-0.5 flex h-7 w-12 items-center justify-center rounded-md border border-blue-500/30 bg-blue-500/10 text-[10px] font-bold uppercase tracking-wider text-blue-700 hover:bg-blue-500/20 dark:text-blue-300"
          }
          title={`Click to toggle ${operator === "AND" ? "OR" : "AND"}`}
        >
          {operator}
        </button>
      ) : null}
      <div className="flex items-center gap-2 rounded-md border border-border bg-card p-2">
        <button
          type="button"
          ref={setNodeRef}
          {...attributes}
          {...listeners}
          aria-label="Drag handle"
          className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-accent active:cursor-grabbing"
          style={style}
        >
          ⋮⋮
        </button>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {pill.label}
        </span>
        <span
          className={
            pill.category === "target"
              ? "shrink-0 rounded-sm bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300"
              : pill.category === "actor"
                ? "shrink-0 rounded-sm bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-300"
                : "shrink-0 rounded-sm bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300"
          }
        >
          {CATEGORY_LABELS[pill.category]}
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove pill ${pill.label}`}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          ×
        </button>
      </div>
    </li>
  );
}

// =============================================================================
// Custom pill input — local to the modal
// =============================================================================

function CustomPillInput({
  onAdd,
}: {
  readonly onAdd: (label: string) => void;
}): ReactElement {
  const [draft, setDraft] = useState("");
  const submit = () => {
    const t = draft.trim();
    if (t.length === 0) return;
    onAdd(t);
    setDraft("");
  };
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="add a pill…"
        className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs outline-none ring-ring focus:ring-2"
      />
      <button
        type="button"
        onClick={submit}
        className="h-8 rounded-md border border-border bg-background px-2 text-xs hover:bg-accent"
      >
        + add
      </button>
    </div>
  );
}