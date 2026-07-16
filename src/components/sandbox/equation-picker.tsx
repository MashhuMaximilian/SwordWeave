"use client";

/**
 * EquationPicker — Phase 7.5 v4 equation Value Type field.
 *
 * Renders an equation as a list of (operator, value) chips with
 * categorized suggestions below. Each chip has a clickable
 * operator badge to its left (cycling through +, −, ×, ÷, %).
 * Paren groups are rendered as nested chip stacks.
 *
 * Categorized suggestions:
 *   - Common Numbers (-5..10)
 *   - Attribute (Physical/Mental/Magic)
 *   - Practice (10 chips)
 *   - Derived (PB/PB/2/Level)
 *   - Dice (1d4..1d20 + custom)
 *   - Keywords (fire, piercing, bludgeoning, ...) — tags
 *   - Paren group button (wrap last operand in ())
 *
 * The user picks chips and tags them with operators. Live
 * preview string ("PB + 2 - level ÷ 4") shows above the chips.
 *
 * The picker mirrors the chip-stack's design pattern but adds
 * operator selection — each suggestion chip's click is wrapped
 * in an operator context. Selecting from the "Add (+)" row
 * adds the chip with `op: "+"`. Selecting from the
 * "Subtract (−)" row adds with `op: "-"`. Etc.
 *
 * v4 changes from v3 chip-stack:
 *   - Operator selection per chip (click row, get operator-tagged chip).
 *   - Paren group button creates nested operand.
 *   - Live equation preview string.
 *   - Soft-warnings surfaced from resolveEquation.
 */

import { useState, type ReactElement } from "react";
import {
  ALL_ATTRIBUTES,
  ALL_DERIVED,
  ALL_PRACTICES,
  DICE_TYPES,
  ALL_OPERATORS,
  operatorLabel,
  type AttributeKey,
  type Operand,
  type OperandValue,
  type Operator,
  type PracticeKey,
  type ValueToken,
  normalizeDiceLabel,
} from "@/types/modifier";
import { resolveEquation, type EquationResolution } from "@/lib/engine/equations";
import { parseEquationInput, SUB_CHOICE_KEYWORDS } from "@/lib/primitives/form-helpers";
import { CollapsibleSection } from "@/components/ui/collapsible-section";

interface EquationPickerProps {
  readonly operands: readonly Operand[];
  readonly onChange: (next: Operand[]) => void;
}

export function EquationPicker({
  operands,
  onChange,
}: EquationPickerProps): ReactElement {
  const [pendingOp, setPendingOp] = useState<Operator>("+");
  // Paren cursor: depth of currently-open parens. 0 means
  // we're at the top level (between operands in the outer
  // operand list). When > 0, the next operand click adds
  // to the inner-most paren.
  const [parenStack, setParenStack] = useState(0);

  // Live preview: re-resolve on every change to get warnings.
  // The resolver is pure; safe to call on every render.
  const resolution: EquationResolution = resolveEquation(operands);

  /**
   * Add an operand at the current cursor position. If
   * parenStack > 0, route into the inner-most open paren.
   * Otherwise append to the outer operand list.
   *
   * Cursor semantics:
   *   parenStack === 0 → top-level operands
   *   parenStack === 1 → inside the most-recently-opened paren
   *   parenStack === 2 → nested inside two parens
   *
   * Note: the parenStack is a UI cursor, not the data
   * structure. The data is a recursive Operand[] where each
   * paren's `operands` array is its inner sequence. We track
   * the cursor so the user knows where their next click will
   * land.
   */
  const addOperand = (op: Operator, value: OperandValue) => {
    if (parenStack === 0) {
      onChange([...operands, { op, value }]);
      return;
    }
    // Route into the inner-most paren. Walk the operand
    // list, find the last paren at depth parenStack.
    onChange(appendToInnerParen(operands, parenStack, { op, value }));
  };

  const removeOperand = (index: number) => {
    onChange(operands.filter((_, i) => i !== index));
  };

  const setOperandOp = (index: number, op: Operator) => {
    onChange(
      operands.map((o, i) => (i === index ? { ...o, op } : o)),
    );
  };

  /**
   * Phase 7.5 v4: paren-internal mutations. These are
   * called by the expanded paren chip's children. They find
   * the paren at `parenIndex` in the outer operand list and
   * mutate its inner operands.
   *
   * For nested parens, the caller (OperandChip inside
   * ParenChipContents) recurses with the parenIndex being
   * the inner index.
   */
  const appendToParenAt = (
    parenIndex: number,
    op: Operator,
    value: OperandValue,
  ) => {
    onChange(
      operands.map((o, i) => {
        if (i !== parenIndex) return o;
        if (o.value.kind !== "paren") return o;
        return { op: o.op, value: { kind: "paren", operands: [...o.value.operands, { op, value }] } };
      }),
    );
  };

  const setOpInParenAt = (
    parenIndex: number,
    innerIndex: number,
    op: Operator,
  ) => {
    onChange(
      operands.map((o, i) => {
        if (i !== parenIndex) return o;
        if (o.value.kind !== "paren") return o;
        return {
          op: o.op,
          value: {
            kind: "paren",
            operands: o.value.operands.map((inner, j) =>
              j === innerIndex ? { ...inner, op } : inner
            ),
          },
        };
      }),
    );
  };

  const removeInParenAt = (
    parenIndex: number,
    innerIndex: number,
  ) => {
    onChange(
      operands.map((o, i) => {
        if (i !== parenIndex) return o;
        if (o.value.kind !== "paren") return o;
        return {
          op: o.op,
          value: {
            kind: "paren",
            operands: o.value.operands.filter((_, j) => j !== innerIndex),
          },
        };
      }),
    );
  };

  /**
   * Open a new paren group. The empty paren is appended to the
   * current operand list. Subsequent operand additions go to
   * the inner-most open paren (parenStack tracks open depth).
   *
   * The user clicks `(` to open and `)` to close. While inside
   * a paren, the live preview shows "(...)" and the operator
   * toggle still controls the next chip's op within that
   * paren.
   *
   * If there's no open paren when `(` is clicked, we open a
   * new one and switch the cursor to inside-paren mode.
   * If a paren is already open when `(` is clicked, we open
   * a nested paren.
   */
  const openParen = () => {
    onChange([
      ...operands,
      {
        op: "+",
        value: { kind: "paren", operands: [] },
      },
    ]);
    setParenStack((s) => s + 1);
  };

  /**
   * Close the inner-most open paren. After closing, the cursor
   * is back at the outer operand sequence.
   *
   * If there's no open paren (parenStack === 0), `)` is a no-op
   * (button disabled in that case).
   */
  const closeParen = () => {
    if (parenStack === 0) return;
    setParenStack((s) => Math.max(0, s - 1));
  };

  return (
    <div className="space-y-2">
      {/* Live preview */}
      <div
        data-testid="equation-preview"
        className="rounded-md border border-input bg-card px-3 py-2 font-mono text-sm"
      >
        {resolution.numeric.kind === "number"
          ? `${resolution.numeric.value} ${resolution.tags.length > 0 ? resolution.tags.map((t) => `[${t}]`).join(" ") : ""}`
          : resolution.numeric.kind === "dice"
            ? `${resolution.numeric.expression} ${resolution.tags.length > 0 ? resolution.tags.map((t) => `[${t}]`).join(" ") : ""}`
            : "—"}
        {resolution.warnings.length > 0 ? (
          <div className="mt-1 space-y-0.5">
            {resolution.warnings.map((w, i) => (
              <p
                key={i}
                className="rounded-sm border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-700 dark:text-amber-300"
              >
                ⚠ {w}
              </p>
            ))}
          </div>
        ) : null}
      </div>

      {/* Operand chips with operator prefix */}
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5">
        {operands.length === 0 ? (
          <span className="text-xs text-muted-foreground">
            No operands yet — pick below or type
          </span>
        ) : (
          operands.map((operand, i) => (
            <OperandChip
              key={i}
              operand={operand}
              parenIndex={i}
              onOpChange={(op) => setOperandOp(i, op)}
              onRemove={() => removeOperand(i)}
              onAppendToParenAt={appendToParenAt}
              onSetOpInParenAt={setOpInParenAt}
              onRemoveInParenAt={removeInParenAt}
            />
          ))
        )}
      </div>

      {/* Operator toggle — what op the next-added chip will use */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase text-muted-foreground">
          Next chip's op:
        </span>
        {ALL_OPERATORS.map((op) => (
          <button
            key={op}
            type="button"
            onClick={() => setPendingOp(op)}
            className={`rounded-full border px-2 py-0.5 text-xs ${
              pendingOp === op
                ? "border-primary bg-primary/20 font-semibold text-primary"
                : "border-border bg-background text-muted-foreground hover:bg-accent"
            }`}
          >
            {operatorLabel(op)}
          </button>
        ))}
        {/* Paren open / close — separate buttons so the user can
            nest (2+PB)/2. While inside a paren (parenStack > 0),
            operand clicks route into the inner-most open paren.
            While outside (parenStack === 0), the close button is
            disabled. */}
        <button
          type="button"
          onClick={openParen}
          className="rounded-full border border-dashed border-border bg-background px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent"
          title="Open a new paren group"
        >
          (
        </button>
        <button
          type="button"
          onClick={closeParen}
          disabled={parenStack === 0}
          className="rounded-full border border-dashed border-border bg-background px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent disabled:opacity-40"
          title="Close the inner-most open paren"
        >
          )
        </button>
        {parenStack > 0 ? (
          <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
            Inside paren ×{parenStack}
          </span>
        ) : null}
      </div>

      {/* Suggestions — categorized by operand type */}
      <div className="space-y-2 rounded-md border border-border bg-card p-2">
        {/* Numbers */}
        <CollapsibleSection title="Numbers" count={8} defaultOpen>
          <div className="mt-1 flex flex-wrap gap-1">
            {[-5, -2, -1, 1, 2, 3, 5, 10].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => addOperand(pendingOp, { kind: "number", value: n })}
                className="rounded-full border border-slate-500/30 bg-slate-500/10 px-2 py-0.5 text-xs hover:bg-slate-500/20"
              >
                {n}
              </button>
            ))}
          </div>
        </CollapsibleSection>

        {/* Attribute */}
        <CollapsibleSection title="Attribute" count={ALL_ATTRIBUTES.length} defaultOpen>
          <div className="mt-1 flex flex-wrap gap-1">
            {ALL_ATTRIBUTES.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => addOperand(pendingOp, { kind: "attribute", attribute: a })}
                className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-xs text-blue-700 dark:text-blue-300 hover:bg-blue-500/20"
              >
                + {a}
              </button>
            ))}
          </div>
        </CollapsibleSection>

        {/* Practice */}
        <CollapsibleSection title="Practice" count={ALL_PRACTICES.length}>
          <div className="mt-1 flex flex-wrap gap-1">
            {ALL_PRACTICES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => addOperand(pendingOp, { kind: "practice", practice: p })}
                className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-xs text-violet-700 dark:text-violet-300 hover:bg-violet-500/20"
              >
                + {p}
              </button>
            ))}
          </div>
        </CollapsibleSection>

        {/* Derived */}
        <CollapsibleSection title="Derived (PB, Level)" count={ALL_DERIVED.length}>
          <div className="mt-1 flex flex-wrap gap-1">
            {ALL_DERIVED.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => addOperand(pendingOp, { kind: "derived", which: d })}
                className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
              >
                + {d === "pb_half" ? "PB/2" : d.toUpperCase()}
              </button>
            ))}
          </div>
        </CollapsibleSection>

        {/* Dice — just the type, count scales at runtime */}
        <CollapsibleSection title="Dice Type (Xd6 / Xd10)" count={DICE_TYPES.length}>
          <div className="mt-1 flex flex-wrap gap-1">
            {DICE_TYPES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => addOperand(pendingOp, { kind: "dice", expression: `1${d}` })}
                title={`Add a 1${d} dice expression. The count X scales at runtime. Use as a multiplier: 5 × D6 = 5d6.`}
                className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-xs text-rose-700 dark:text-rose-300 hover:bg-rose-500/20"
              >
                + D{d.replace(/^d/, "")}
              </button>
            ))}
          </div>
          <p className="mt-1 px-1 text-[9px] text-muted-foreground">
            Die type only — count (1, 2, 3...) is decided at runtime. Try <code className="font-mono">5 × D6</code>.
          </p>
        </CollapsibleSection>

        {/* Keywords (tags) — used for damage type, etc. */}
        <CollapsibleSection
          title="Tag (keyword)"
          count={11}
        >
          <div className="mt-1 flex flex-wrap gap-1">
            {["fire", "cold", "lightning", "acid", "poison",
              "piercing", "slashing", "bludgeoning",
              "psychic", "radiant", "necrotic"].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => addOperand(pendingOp, { kind: "keyword", text: k })}
                className="rounded-full border border-pink-500/30 bg-pink-500/10 px-2 py-0.5 text-xs text-pink-700 dark:text-pink-300 hover:bg-pink-500/20"
              >
                [{k}]
              </button>
            ))}
          </div>
        </CollapsibleSection>

        {/* Sub-choice keywords */}
        <CollapsibleSection
          title="Sub-Choice Keywords"
          count={SUB_CHOICE_KEYWORDS.length}
        >
          <div className="mt-1 space-y-1.5">
            {(() => {
              const byGroup = new Map<string, typeof SUB_CHOICE_KEYWORDS>();
              for (const k of SUB_CHOICE_KEYWORDS) {
                const list = byGroup.get(k.group) ?? [];
                byGroup.set(k.group, [...list, k]);
              }
              return Array.from(byGroup.entries());
            })().map(([group, items]) => (
              <div key={group}>
                <p className="px-1 text-[9px] uppercase tracking-wide text-muted-foreground/70">
                  {group}
                </p>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {items.map((k) => (
                    <button
                      key={k.label}
                      type="button"
                      onClick={() =>
                        addOperand(
                          pendingOp,
                          {
                            kind: "keyword",
                            text: k.label.toLowerCase().replace(/\s+/g, "_"),
                          },
                        )
                      }
                      title={`Tag this modifier with "${k.label}"`}
                      className="rounded-full border border-pink-500/30 bg-pink-500/10 px-2 py-0.5 text-xs text-pink-700 hover:bg-pink-500/20 dark:text-pink-300"
                    >
                      [{k.label}]
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* Custom input */}
        <EquationCustomInput
          onSubmit={(op, value) => addOperand(op, value)}
        />
      </div>
    </div>
  );
}

/**
 * Append an operand to the inner-most open paren at the given
 * depth. Walks the operand list backwards to find the most
 * recently opened paren at depth `targetDepth` (1-based from
 * outermost = 0).
 *
 * Recursive structure: outer operands contain parens, parens
 * contain inner operands, those can contain more parens, etc.
 *
 * For parenStack === 1, we find the LAST paren in the outer
 * operand list and append to its inner operand array.
 * For parenStack === 2, we find the last paren at depth 1,
 * then the last paren inside IT, and append there.
 */
function appendToInnerParen(
  operands: readonly Operand[],
  targetDepth: number,
  newOperand: Operand,
): Operand[] {
  if (targetDepth === 0) {
    return [...operands, newOperand];
  }
  return appendAtDepth(operands, targetDepth, newOperand);
}

function appendAtDepth(
  operands: readonly Operand[],
  remainingDepth: number,
  newOperand: Operand,
): Operand[] {
  if (remainingDepth === 0) {
    return [...operands, newOperand];
  }
  // Find the last paren at this level.
  let lastParenIndex = -1;
  for (let i = operands.length - 1; i >= 0; i--) {
    const o = operands[i];
    if (o && o.value.kind === "paren") {
      lastParenIndex = i;
      break;
    }
  }
  if (lastParenIndex === -1) {
    // No paren at this depth — fall back to top-level append.
    return [...operands, newOperand];
  }
  // Walk into that paren and recurse one level deeper.
  const lastParen = operands[lastParenIndex];
  if (!lastParen || lastParen.value.kind !== "paren") {
    return [...operands, newOperand];
  }
  const newInner = appendAtDepth(
    lastParen.value.operands,
    remainingDepth - 1,
    newOperand,
  );
  const newParen: Operand = {
    op: lastParen.op,
    value: { kind: "paren", operands: newInner },
  };
  return operands.map((o, i) => (i === lastParenIndex ? newParen : o));
}

// =============================================================================
// OperandChip — single (operator, value) chip with click-to-cycle op
// =============================================================================

function OperandChip({
  operand,
  onOpChange,
  onRemove,
  parenIndex,
  parenDepth = 0,
  onAppendToParenAt,
  onSetOpInParenAt,
  onRemoveInParenAt,
}: {
  readonly operand: Operand;
  readonly onOpChange: (op: Operator) => void;
  readonly onRemove: () => void;
  /**
   * Phase 7.5 v4: this operand's index in its containing
   * operand list. For top-level operands, it's the index in
   * the outer list. For operands inside a paren, it's the
   * index in the paren's inner operand list. Used to route
   * edits when this operand is a paren.
   */
  readonly parenIndex: number;
  /**
   * Phase 7.5 v4: paren depth this chip is rendered at. 0
   * means top-level; 1+ means we're rendering inside a
   * paren. Used to style the paren border distinctly from
   * top-level chips.
   */
  readonly parenDepth?: number;
  /**
   * Direct callbacks that route to the parent (which knows
   * the operand list to mutate). The OperandChip's paren
   * child passes these through to its inner chips.
   */
  readonly onAppendToParenAt: (
    parenIndex: number,
    op: Operator,
    value: OperandValue,
  ) => void;
  readonly onSetOpInParenAt: (
    parenIndex: number,
    innerIndex: number,
    op: Operator,
  ) => void;
  readonly onRemoveInParenAt: (
    parenIndex: number,
    innerIndex: number,
  ) => void;
}): ReactElement {
  const { op, value } = operand;
  const depth = parenDepth;

  // The first chip's operator is conventionally "+"; show it
  // but make it non-clickable (otherwise the user could create
  // negative starting values which the resolver doesn't support).
  const isFirst = false; // We can't know this from props; the
                        // operator badge is always editable. The
                        // resolver handles the convention.

  const cycleOp = () => {
    const idx = ALL_OPERATORS.indexOf(op);
    const next = ALL_OPERATORS[(idx + 1) % ALL_OPERATORS.length];
    if (next) onOpChange(next);
  };

  // Phase 7.5 v4: paren chips are rendered EXPANDED by
  // default. Mashu: "I cannot expand the paranthesis to see
  // what is inside, it's hard to make things inside
  // paranthesis bc i cannot see and the tag with 'inside
  // paranthesis' is not helping.... I need that to be
  // expanded by default".
  //
  // The paren chip shows:
  //   ( + chip1 + chip2 + chip3 )
  // with the inner operands as full chips (each editable).
  // The outer ( and ) brackets are rendered as part of the
  // paren group's wrapper, not as separate operands.
  if (value.kind === "paren") {
    return (
      <ParenChipContents
        op={op}
        parenIndex={parenIndex}
        operands={value.operands}
        depth={depth}
        onRemove={onRemove}
        onOpChange={cycleOp}
        onAppendToParenAt={onAppendToParenAt}
        onSetOpInParenAt={onSetOpInParenAt}
        onRemoveInParenAt={onRemoveInParenAt}
      />
    );
  }

  return (
    <span className="inline-flex items-center gap-0.5">
      <button
        type="button"
        onClick={cycleOp}
        disabled={isFirst}
        title={`Operator: ${op} (click to cycle)`}
        className={`inline-flex h-5 items-center rounded-l-full border px-1.5 font-mono text-[10px] font-bold ${
          isFirst
            ? "cursor-default border-slate-300 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
            : "border-primary bg-primary/20 text-primary hover:bg-primary/30"
        }`}
      >
        {operatorLabel(op)}
      </button>
      <span className={chipClass(value)}>
        {chipLabel(value)}
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove operand`}
          className="ml-1 text-muted-foreground hover:text-foreground"
        >
          ×
        </button>
      </span>
    </span>
  );
}

/**
 * ParenChipContents — renders a paren group with its inner
 * operands visible inline. Replaces the old "(…)" compact
 * chip with an expanded view.
 *
 * Layout:
 *   ( + chip1 + chip2 + chip3 )
 *
 * The outer ( and ) are decorative brackets, NOT operands.
 * The inner chips are full OperandChip instances, each
 * with their own parenIndex relative to the paren's inner
 * list.
 */
function ParenChipContents({
  op,
  parenIndex,
  operands,
  depth,
  onRemove,
  onOpChange,
  onAppendToParenAt,
  onSetOpInParenAt,
  onRemoveInParenAt,
}: {
  readonly op: Operator;
  readonly parenIndex: number;
  readonly operands: readonly Operand[];
  readonly depth: number;
  readonly onRemove: () => void;
  readonly onOpChange: () => void;
  readonly onAppendToParenAt: (
    parenIndex: number,
    op: Operator,
    value: OperandValue,
  ) => void;
  readonly onSetOpInParenAt: (
    parenIndex: number,
    innerIndex: number,
    op: Operator,
  ) => void;
  readonly onRemoveInParenAt: (
    parenIndex: number,
    innerIndex: number,
  ) => void;
}): ReactElement {
  // Paren border color by depth — distinct shade per nesting
  // level so the user can see at a glance which paren they're
  // inside. Top-level paren is cyan; nested parens shift
  // through teal/blue/violet.
  const parenBorderClass = (() => {
    if (depth === 0) return "border-cyan-500/40 bg-cyan-500/5";
    if (depth === 1) return "border-teal-500/40 bg-teal-500/5";
    if (depth === 2) return "border-blue-500/40 bg-blue-500/5";
    return "border-violet-500/40 bg-violet-500/5";
  })();

  return (
    <span
      className={`inline-flex flex-wrap items-center gap-1 rounded-lg border-2 border-dashed ${parenBorderClass} px-1.5 py-1`}
    >
      {/* Operator badge for the paren itself */}
      <button
        type="button"
        onClick={onOpChange}
        title={`Paren operator: ${op} (click to cycle)`}
        className="inline-flex h-5 items-center rounded border border-primary bg-primary/20 px-1.5 font-mono text-[10px] font-bold text-primary hover:bg-primary/30"
      >
        {operatorLabel(op)}
      </button>
      <span className="font-mono text-sm text-cyan-700 dark:text-cyan-300">
        (
      </span>
      {operands.length === 0 ? (
        <span className="text-[10px] italic text-muted-foreground">
          empty paren
        </span>
      ) : (
        operands.map((inner, i) => (
          <OperandChip
            key={`${depth}-${i}`}
            operand={inner}
            parenIndex={i}
            parenDepth={depth + 1}
            onOpChange={(newOp) => onSetOpInParenAt(parenIndex, i, newOp)}
            onRemove={() => onRemoveInParenAt(parenIndex, i)}
            onAppendToParenAt={onAppendToParenAt}
            onSetOpInParenAt={onSetOpInParenAt}
            onRemoveInParenAt={onRemoveInParenAt}
          />
        ))
      )}
      <span className="font-mono text-sm text-cyan-700 dark:text-cyan-300">
        )
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove paren`}
        className="ml-1 text-cyan-700 hover:text-cyan-900 dark:text-cyan-300"
      >
        ×
      </button>
    </span>
  );
}

function chipClass(value: OperandValue): string {
  const base = "inline-flex items-center rounded-r-full border-y border-r px-2 py-0.5 text-xs font-medium";
  switch (value.kind) {
    case "number": return `${base} border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300`;
    case "dice": return `${base} border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300`;
    case "attribute": return `${base} border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300`;
    case "practice": return `${base} border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300`;
    case "derived":
      return `${base} border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300`;
    case "behavior":
      return `${base} border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300`;
    case "keyword":
      return `${base} border-pink-500/30 bg-pink-500/10 text-pink-700 dark:text-pink-300`;
    case "runtime":
      // Phase 7.5 v4: deferred runtime reference. Indeterminate
      // value — render in a neutral indigo so it reads as
      // "to be filled in at slot time" rather than a fixed
      // number. Distinct from behavior (which is text) and
      // from runtime tokens like PB (which are amber).
      return `${base} border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 italic`;
    case "paren":
      return `${base} border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300`;
  }
}

function chipLabel(value: OperandValue): string {
  switch (value.kind) {
    case "number": return String(value.value);
    case "dice": return value.expression;
    case "attribute": return value.attribute;
    case "practice": return value.practice;
    case "derived":
      if (value.which === "pb") return "PB";
      if (value.which === "pb_half") return "PB/2";
      return value.which;
    case "behavior": return value.name;
    case "keyword": return `[${value.text}]`;
    case "runtime":
      // Phase 7.5 v4: show the name with the delim convention
      // so the author can see at a glance that this is a
      // deferred reference (e.g. "/blockValue/") rather than
      // a fixed number.
      return `/${value.name}/`;
    case "dice":
      // Phase 7.5 v4-rev: normalize dice display — show
      // D4 instead of 1d4. See normalizeDiceLabel for the
      // full conversion rules.
      return normalizeDiceLabel(value.expression);
    case "paren":
      return `(…)`;  // Rendered compactly — full preview is
                     // shown in the live preview above.
  }
}

// =============================================================================
// Custom input — typed text classifies as operand
// =============================================================================

function EquationCustomInput({
  onSubmit,
}: {
  readonly onSubmit: (op: Operator, value: OperandValue) => void;
}): ReactElement {
  const [text, setText] = useState("");
  const [op, setOp] = useState<Operator>("+");

  /**
   * Parse custom input using bracket/delim conventions:
   *
   *   [text]    → keyword operand (tag-style)
   *               Examples: [fire], [piercing], [60 ft]
   *
   *   #expr#    → dice expression (the inside can be a standard
   *               dice expression like 2d6+3)
   *               Examples: #2d6#, #1d10+3#
   *
   *   /value/   → numeric (the inside is a number OR a runtime
   *               reference that resolves to a number — physical,
   *               mental, awareness, PB, level)
   *               Examples: /5/, /physical/, /level/
   *
   * Anything else: classified by content (number/dice/keyword/
   * runtime token) — same as before.
   *
   * This convention lets the author type mixed-type expressions
   * in a single text field, e.g.:
   *   "PB + /2/ + #2d6# + [fire]"
   * would resolve to (PB + 2 + 2d6) tagged fire.
   */
  const submit = () => {
    const t = text.trim();
    if (t.length === 0) return;
    const parsed = parseEquationInput(t);
    onSubmit(op, parsed);
    setText("");
  };

  // Phase 7.5 v4-rev: syntax info block. The token-chip
  // stack has one (Mashu asked for it last round), the
  // equation picker didn't get it. Mashu: "Idk why in
  // equation the block with info about syntax is not
  // showing." Now it does. The block explains the
  // bracket/delim convention so the user doesn't have to
  // guess what `#2d6#` vs `[fire]` vs `/physical/` means.
  const syntaxBlock = (
    <div className="mt-1 rounded border border-border/60 bg-muted/30 px-2 py-1.5 text-[10px] leading-relaxed text-muted-foreground">
      <p className="font-semibold uppercase tracking-wide text-foreground/70">
        Custom input syntax
      </p>
      <ul className="mt-0.5 space-y-0.5">
        <li>
          <code className="rounded bg-background/60 px-1 font-mono">#dice#</code>{" "}
          — dice expression. e.g.{" "}
          <code className="rounded bg-background/60 px-1 font-mono">#2d6#</code>,{" "}
          <code className="rounded bg-background/60 px-1 font-mono">#1d10+3#</code>
        </li>
        <li>
          <code className="rounded bg-background/60 px-1 font-mono">[tag]</code>{" "}
          — keyword / tag. e.g.{" "}
          <code className="rounded bg-background/60 px-1 font-mono">[fire]</code>,{" "}
          <code className="rounded bg-background/60 px-1 font-mono">
            [60 ft darkvision]
          </code>
        </li>
        <li>
          <code className="rounded bg-background/60 px-1 font-mono">
            /value/
          </code>{" "}
          — number or runtime reference. e.g.{" "}
          <code className="rounded bg-background/60 px-1 font-mono">/5/</code>,{" "}
          <code className="rounded bg-background/60 px-1 font-mono">/physical/</code>
          ,{" "}
          <code className="rounded bg-background/60 px-1 font-mono">/PB/</code>
        </li>
        <li className="text-muted-foreground/80">
          Mix them:{" "}
          <code className="rounded bg-background/60 px-1 font-mono">
            PB + /2/ + #2d6# + [fire]
          </code>
        </li>
      </ul>
    </div>
  );

  return (
    <div className="space-y-1">
      <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Custom
      </p>
      <div className="flex items-center gap-1.5">
        <select
          value={op}
          onChange={(e) => setOp(e.target.value as Operator)}
          className="h-7 rounded-md border border-input bg-background px-1 text-xs"
        >
          {ALL_OPERATORS.map((o) => (
            <option key={o} value={o}>
              {operatorLabel(o)}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Add #dice#, [tag or keyword], or /number or runtime name/"
          className="h-7 flex-1 rounded-md border border-input bg-background px-2 text-xs outline-none ring-ring focus:ring-2"
        />
        <button
          type="button"
          onClick={submit}
          className="h-7 rounded-md border border-border bg-background px-2 text-xs hover:bg-accent"
        >
          + add
        </button>
      </div>
      {syntaxBlock}
    </div>
  );
}

// =============================================================================
// Re-exports
// =============================================================================

export type { ValueToken };