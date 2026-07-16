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
  DICE_TYPES,
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
  SUB_CHOICE_KEYWORDS,
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
    <CollapsibleSection
      title="Common Numbers"
      defaultOpen
      count={NUMBER_SHORTCUTS.length}
    >
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
    </CollapsibleSection>
  ) : null;

  // Section: Boolean quick-pick — only Set To + Boolean.
  const boolSection = showBool ? (
    <CollapsibleSection title="True / False" count={2}>
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
    </CollapsibleSection>
  ) : null;

  // Section: Attribute — only when "attribute" is in allowedKinds.
  const attributeSection = allowedKinds.has("attribute") ? (
    <CollapsibleSection
      title="Attribute"
      defaultOpen
      count={ALL_ATTRIBUTES.length}
    >
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
    </CollapsibleSection>
  ) : null;

  // Section: Practice — only when "practice" is in allowedKinds.
  const practiceSection = allowedKinds.has("practice") ? (
    <CollapsibleSection title="Practice" count={ALL_PRACTICES.length}>
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
    </CollapsibleSection>
  ) : null;

  // Section: Derived — only when "derived" is in allowedKinds.
  const derivedSection = allowedKinds.has("derived") ? (
    <CollapsibleSection title="Derived (PB, Level)" count={ALL_DERIVED.length}>
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
    </CollapsibleSection>
  ) : null;

  // Section: Dice — only when "dice" is in allowedKinds.
  const diceSection = allowedKinds.has("dice") ? (
    <CollapsibleSection title="Dice Type (Xd6 / Xd10)" count={DICE_TYPES.length}>
      <div className="mt-1 flex flex-wrap gap-1">
        {DICE_TYPES.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onPick({ kind: "dice", expression: `1${d}` })}
            title={`Add a 1${d} dice expression. The count X scales at runtime.`}
            className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-xs text-rose-700 dark:text-rose-300 hover:bg-rose-500/20"
          >
            + 1{d}
          </button>
        ))}
      </div>
      <p className="mt-1 px-1 text-[9px] text-muted-foreground">
        The die type (d4/d6/d8/d10/d12/d20/d100). Count scales at runtime.
      </p>
    </CollapsibleSection>
  ) : null;

  // Section: Sub-Choice Keywords — every per-axis sub-choice
  // label from MODIFIER_TARGET_SPEC. Always available so the
  // author can quickly tag modifiers with the right scope
  // axis (e.g. [Walking Speed] for a speed modifier,
  // [Physical DC] for a defense modifier).
  //
  // Grouped by category for scan-ability. Each row is one
  // group; multiple groups share a single section header.
  const subChoiceGroups = (() => {
    const byGroup = new Map<string, typeof SUB_CHOICE_KEYWORDS>();
    for (const k of SUB_CHOICE_KEYWORDS) {
      const list = byGroup.get(k.group) ?? [];
      byGroup.set(k.group, [...list, k]);
    }
    return Array.from(byGroup.entries());
  })();
  const subChoiceSection = (
    <CollapsibleSection
      title="Sub-Choice Keywords"
      count={SUB_CHOICE_KEYWORDS.length}
    >
      <div className="mt-1 space-y-1.5">
        {subChoiceGroups.map(([group, items]) => (
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
                    onPick({ kind: "keyword", text: k.label.toLowerCase().replace(/\s+/g, "_") })
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
  );

  // Section: Custom input — context-aware placeholder + classifier.
  const customPlaceholder = (() => {
    if (valueKind === "number") return "Add /number/ or /runtime name/ (e.g. /5/, /physical/, /PB/)";
    if (valueKind === "dice") return "Add #dice# (e.g. #2d6#, #1d10+3#)";
    if (valueKind === "boolean") return "Type true or false";
    return "Add [tag or keyword] (e.g. [fire], [60 ft darkvision])";
  })();

  // Syntax info block — explains the bracket/delim convention
  // so the user doesn't have to guess. Rendered below the
  // input. Mashu's request: "either this or make an info block
  // below with these rules and what they mean like we did with
  // stacking." Both: the placeholder shows the syntax; the
  // block explains the rules.
  const syntaxBlock = (
    <div className="mt-1 rounded border border-border/60 bg-muted/30 px-2 py-1.5 text-[10px] leading-relaxed text-muted-foreground">
      <p className="font-semibold uppercase tracking-wide text-foreground/70">
        Custom input syntax
      </p>
      <ul className="mt-0.5 space-y-0.5">
        <li>
          <code className="font-mono text-pink-700 dark:text-pink-300">#dice#</code>
          {" — "}dice expression. Examples: <code className="font-mono">#2d6#</code>, <code className="font-mono">#1d10+3#</code>. Scaled at runtime.
        </li>
        <li>
          <code className="font-mono text-pink-700 dark:text-pink-300">[tag]</code>
          {" — "}keyword / text tag. Examples: <code className="font-mono">[fire]</code>, <code className="font-mono">[piercing]</code>, <code className="font-mono">[60 ft darkvision]</code>.
        </li>
        <li>
          <code className="font-mono text-pink-700 dark:text-pink-300">/value/</code>
          {" — "}number OR runtime reference. Examples: <code className="font-mono">/5/</code>, <code className="font-mono">/physical/</code>, <code className="font-mono">/PB/</code>, <code className="font-mono">/blockValue/</code> (deferred to runtime).
        </li>
      </ul>
    </div>
  );

  return (
    <div className="space-y-2 rounded-md border border-border bg-card p-2 shadow-sm">
      {numberSection}
      {boolSection}
      {attributeSection}
      {practiceSection}
      {derivedSection}
      {diceSection}
      {subChoiceSection}

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
        {syntaxBlock}
      </div>
    </div>
  );
}

// =============================================================================
// CollapsibleSection — used by every chip-picker section header
// =============================================================================

/**
 * Mashu: "we should make all those chip categories collapsible
 * and collapsed by default. only number and attribute expanded
 * by default. so user will not be overwhelmed by colors. and
 * especially on mobile it will help the user."
 *
 * Each chip-picker section uses this so the user can collapse
 * a category and free vertical space. Number and Attribute
 * sections stay open by default (they're the most-used and
 * contain the canonical token kinds); everything else
 * collapses. Click the header to expand/collapse — state
 * persists per-section during a single picker session.
 */
function CollapsibleSection({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  readonly title: string;
  readonly count?: number;
  readonly defaultOpen?: boolean;
  readonly children: React.ReactNode;
}): ReactElement {
  // Local state — only used for the chevron icon. The actual
  // open/close is controlled by <details>.
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <details
      open={isOpen}
      onToggle={(e) => setIsOpen((e.currentTarget as HTMLDetailsElement).open)}
      className="rounded"
    >
      <summary
        className="flex cursor-pointer select-none items-center justify-between gap-2 rounded px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-accent/50"
        title={isOpen ? "Click to collapse" : "Click to expand"}
      >
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={`inline-block text-[8px] transition-transform ${
              isOpen ? "rotate-90" : "rotate-0"
            }`}
          >
            ▶
          </span>
          {title}
        </span>
        {count !== undefined ? (
          <span className="rounded-full bg-muted px-1.5 text-[9px] font-medium text-muted-foreground">
            {count}
          </span>
        ) : null}
      </summary>
      <div className="px-1 pb-1">{children}</div>
    </details>
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
    case "runtime":
      // Phase 7.5 v4: deferred runtime reference. Indeterminate
      // — render in indigo italic so it reads as "to be filled
      // in at slot time" rather than a fixed number.
      return `${base} border-indigo-500/30 bg-indigo-500/10 italic text-indigo-700 dark:text-indigo-300`;
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
    case "runtime":
      // Phase 7.5 v4: deferred runtime reference. Held open
      // until character-sheet slot time, when the engine
      // resolves the name against the character's compiled
      // state.
      return `Runtime reference: /${token.name}/ (resolved at slot time)`;
  }
}

// Re-export the AttributeKey / PracticeKey types for convenience.
export type { AttributeKey, PracticeKey };