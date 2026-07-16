"use client";

/**
 * TokenChipStack — Phase 7.5 v3 modifier Value field.
 *
 * Renders the Value field as an ordered list of token chips with
 * a popover picker. The popover shows categorized suggestions
 * (Attribute / Practice / Derived / Dice / Common numbers /
 * boolean / custom) gated by the current `valueKind` and `op`
 * tuple — see `allowedTokenKinds` in form-helpers.ts.
 *
 * v3 changes from pre-rev:
 *   - Input classification is value-type-aware (`classifyTypedValue`).
 *     Typed text becomes the right token kind for the current
 *     Value Type (number string → number token, dice expr → dice
 *     token, "true" → boolean token, etc.) — never just a
 *     behavior token by default.
 *   - Runtime tokens (+physical, +awareness, +PB) are now exposed
 *     in number mode so users can compose "+ 2 + physical"
 *     without typing.
 *   - Boolean quick-pick chips ([+ true], [+ false]) appear in
 *     Set To + Boolean.
 *   - Common number chips (+1, +2, +3, +5, +10, -1, -2, -5)
 *     appear in number mode.
 *   - Soft-warnings are surfaced as inline text under the input
 *     when a typed value doesn't match the current Value Type.
 */

import { useState, type ReactElement } from "react";
import {
  ALL_ATTRIBUTES,
  ALL_DERIVED,
  ALL_PRACTICES,
  CANONICAL_DICE,
  tokenLabel,
  type AttributeKey,
  type PracticeKey,
  type ValueToken,
} from "@/types/modifier";
import {
  classifyTypedValue,
  isBooleanValueType,
  NUMBER_SHORTCUTS,
  showsNumberShortcuts,
  type FormValueKind,
} from "@/lib/primitives/form-helpers";
import type { ModifierOperation } from "@/types/modifier";

interface TokenChipStackProps {
  readonly tokens: readonly ValueToken[];
  readonly onChange: (next: ValueToken[]) => void;
  /**
   * Restrict which kinds of tokens can be added. The form's
   * Value Type filter narrows this — e.g. when valueKind is
   * "number" only number/token kinds are allowed.
   */
  readonly allowedKinds: ReadonlySet<ValueToken["kind"]>;
  /**
   * Current operation. Used by classifyTypedValue to pick the
   * right coercion (e.g. boolean is only valid for Set To).
   */
  readonly op: ModifierOperation;
  /**
   * Current valueKind. Drives which sections render in the
   * popover AND how typed text classifies.
   */
  readonly valueKind: FormValueKind;
}

export function TokenChipStack({
  tokens,
  onChange,
  allowedKinds,
  op,
  valueKind,
}: TokenChipStackProps): ReactElement {
  const [warning, setWarning] = useState<string | null>(null);

  const addToken = (token: ValueToken) => {
    onChange([...tokens, token]);
    setWarning(null);
  };

  const removeToken = (index: number) => {
    onChange(tokens.filter((_, i) => i !== index));
  };

  const handleCustomSubmit = (raw: string) => {
    const result = classifyTypedValue(raw, op, valueKind);
    if (result.token === null) {
      setWarning(null);
      return;
    }
    onChange([...tokens, result.token]);
    setWarning(result.warning);
  };

  const showNumbers = showsNumberShortcuts(op, valueKind);
  const showBool = isBooleanValueType(op, valueKind);

  return (
    <div className="space-y-2">
      {/* Chip stack — current tokens */}
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5">
        {tokens.length === 0 ? (
          <span className="text-xs text-muted-foreground">
            No tokens yet — pick suggestions below or type a value
          </span>
        ) : (
          tokens.map((token, i) => (
            <span
              key={i}
              className={chipClass(token)}
              title={chipTitle(token)}
            >
              {tokenLabel(token)}
              <button
                type="button"
                onClick={() => removeToken(i)}
                aria-label={`Remove token ${tokenLabel(token)}`}
                className="ml-1 text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>

      {warning ? (
        <p
          data-testid="chip-stack-warning"
          className="rounded-sm border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-700 dark:text-amber-300"
        >
          ⚠ {warning}
        </p>
      ) : null}

      {/* Suggestions — always visible. Mashu's UX feedback: the
          popover toggle made users click once before seeing
          anything; suggestions should be the default state. The
          user only needs to hide them if the value area gets
          cramped (rare). */}
      <TokenPicker
        op={op}
        valueKind={valueKind}
        allowedKinds={allowedKinds}
        showNumbers={showNumbers}
        showBool={showBool}
        onPick={addToken}
        onCustom={handleCustomSubmit}
      />
    </div>
  );
}

// =============================================================================
// Token picker popover
// =============================================================================

interface TokenPickerProps {
  readonly op: ModifierOperation;
  readonly valueKind: FormValueKind;
  readonly allowedKinds: ReadonlySet<ValueToken["kind"]>;
  readonly showNumbers: boolean;
  readonly showBool: boolean;
  readonly onPick: (token: ValueToken) => void;
  readonly onCustom: (raw: string) => void;
}

function TokenPicker({
  op,
  valueKind,
  allowedKinds,
  showNumbers,
  showBool,
  onPick,
  onCustom,
}: TokenPickerProps): ReactElement {
  const [customName, setCustomName] = useState("");

  const submit = () => {
    const t = customName.trim();
    if (t.length === 0) return;
    onCustom(t);
    setCustomName("");
  };

  // Section: Common numbers — only in number mode.
  const numberSection = showNumbers ? (
    <div>
      <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Common Numbers
      </p>
      <div className="mt-1 flex flex-wrap gap-1">
        {NUMBER_SHORTCUTS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPick({ kind: "number", value: n })}
            className="rounded-full border border-border bg-background px-2 py-0.5 text-xs hover:bg-accent"
          >
            {n > 0 ? `+${n}` : n}
          </button>
        ))}
      </div>
    </div>
  ) : null;

  // Section: Boolean quick-pick — only Set To + Boolean.
  const boolSection = showBool ? (
    <div>
      <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        True / False
      </p>
      <div className="mt-1 flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => onPick({ kind: "behavior", name: "true" })}
          className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
        >
          ✓ true
        </button>
        <button
          type="button"
          onClick={() => onPick({ kind: "behavior", name: "false" })}
          className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-xs text-rose-700 dark:text-rose-300 hover:bg-rose-500/20"
        >
          ✗ false
        </button>
      </div>
    </div>
  ) : null;

  // Section: Attribute — only when "attribute" is in allowedKinds.
  const attributeSection = allowedKinds.has("attribute") ? (
    <div>
      <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Attribute
      </p>
      <div className="mt-1 flex flex-wrap gap-1">
        {ALL_ATTRIBUTES.map((attr) => (
          <button
            key={attr}
            type="button"
            onClick={() => onPick({ kind: "attribute", attribute: attr })}
            className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-xs text-blue-700 dark:text-blue-300 hover:bg-blue-500/20"
          >
            + {attr}
          </button>
        ))}
      </div>
    </div>
  ) : null;

  // Section: Practice — only when "practice" is in allowedKinds.
  const practiceSection = allowedKinds.has("practice") ? (
    <div>
      <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Practice
      </p>
      <div className="mt-1 flex flex-wrap gap-1">
        {ALL_PRACTICES.map((practice) => (
          <button
            key={practice}
            type="button"
            onClick={() => onPick({ kind: "practice", practice })}
            className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-xs text-violet-700 dark:text-violet-300 hover:bg-violet-500/20"
          >
            + {practice}
          </button>
        ))}
      </div>
    </div>
  ) : null;

  // Section: Derived — only when "derived" is in allowedKinds.
  const derivedSection = allowedKinds.has("derived") ? (
    <div>
      <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Derived
      </p>
      <div className="mt-1 flex flex-wrap gap-1">
        {ALL_DERIVED.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onPick({ kind: "derived", which: d })}
            className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
          >
            + {d === "pb_half" ? "PB/2" : d.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  ) : null;

  // Section: Dice — only when "dice" is in allowedKinds.
  const diceSection = allowedKinds.has("dice") ? (
    <div>
      <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Dice (canonical)
      </p>
      <div className="mt-1 flex flex-wrap gap-1">
        {CANONICAL_DICE.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onPick({ kind: "dice", expression: d })}
            className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-xs text-rose-700 dark:text-rose-300 hover:bg-rose-500/20"
          >
            + {d}
          </button>
        ))}
      </div>
      <p className="mt-1 px-1 text-[10px] text-muted-foreground">
        For compound (2d10, 3d8+1) type below.
      </p>
    </div>
  ) : null;

  // Section: Custom input — context-aware placeholder + classifier.
  const customPlaceholder = (() => {
    if (valueKind === "number") return "Type a number (2, 5) or runtime name (physical, PB)";
    if (valueKind === "dice") return "Type a dice expression (2d6, 1d10+3)";
    if (valueKind === "boolean") return "Type true or false";
    return "Type a keyword or behavior name (darkvision, mana_pool)";
  })();

  return (
    <div className="space-y-2 rounded-md border border-border bg-card p-2 shadow-sm">
      {numberSection}
      {boolSection}
      {attributeSection}
      {practiceSection}
      {derivedSection}
      {diceSection}

      <div>
        <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Custom
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={customPlaceholder}
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
      </div>
    </div>
  );
}

// =============================================================================
// Chip styling — color by token kind for quick visual scan
// =============================================================================

function chipClass(token: ValueToken): string {
  const base = "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium";
  switch (token.kind) {
    case "attribute":
      return `${base} border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300`;
    case "practice":
      return `${base} border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300`;
    case "derived":
      return `${base} border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300`;
    case "dice":
      return `${base} border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300`;
    case "number":
      return `${base} border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300`;
    case "behavior":
      return `${base} border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300`;
    case "keyword":
      return `${base} border-pink-500/30 bg-pink-500/10 text-pink-700 dark:text-pink-300`;
  }
}

function chipTitle(token: ValueToken): string {
  switch (token.kind) {
    case "attribute": return `Attribute modifier: ${token.attribute}`;
    case "practice": return `Practice modifier: ${token.practice}`;
    case "derived":
      if (token.which === "pb_half") return "Half proficiency bonus";
      if (token.which === "pb") return "Full proficiency bonus";
      return "Character level";
    case "dice": return `Dice expression: ${token.expression}`;
    case "number": return `Literal magnitude: ${token.value}`;
    case "behavior": return `Behavior: ${token.name}`;
    case "keyword": return `Tag: ${token.text}`;
  }
}

// Re-export the AttributeKey / PracticeKey types for convenience.
export type { AttributeKey, PracticeKey };