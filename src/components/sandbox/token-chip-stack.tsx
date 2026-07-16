"use client";

/**
 * TokenChipStack — Phase 7.5 modifier Value field.
 *
 * Renders the Value field as an ordered list of token chips with
 * a `[+ add token]` button that opens a small popover picker.
 *
 * Each token is a `ValueToken` (attribute / practice / derived /
 * behavior / dice / number). The popover lists canonical token
 * kinds for quick-pick plus a `[+ custom]` option that accepts
 * any string (becomes a behavior token).
 *
 * Real-time JSON: `onChange` fires on every chip add/remove.
 * The primitive form's preview updates immediately.
 *
 * Mobile-friendly: chips wrap, the popover is full-width on
 * small screens.
 */

import { useState, type ReactElement } from "react";
import {
  ALL_ATTRIBUTES,
  ALL_DERIVED,
  ALL_PRACTICES,
  CANONICAL_DICE,
  SUGGESTED_TOKENS,
  tokenLabel,
  type AttributeKey,
  type PracticeKey,
  type ValueToken,
} from "@/types/modifier";

interface TokenChipStackProps {
  readonly tokens: readonly ValueToken[];
  readonly onChange: (next: ValueToken[]) => void;
  /**
   * Restrict which kinds of tokens can be added. The form's
   * Value Type filter narrows this — e.g. when valueKind is
   * "number" only number/token kinds are allowed.
   */
  readonly allowedKinds: ReadonlySet<ValueToken["kind"]>;
}

/**
 * Phase 7.5 v3: biasMode removed. The bias op is gone; advantage
 * / disadvantage are handled via grant/revoke on the canonical
 * `behavior:advantage` and `behavior:disadvantage` chips (which
 * show up in the regular behavior picker).
 */
export function TokenChipStack({
  tokens,
  onChange,
  allowedKinds,
}: TokenChipStackProps): ReactElement {
  const [showPicker, setShowPicker] = useState(false);

  const addToken = (token: ValueToken) => {
    onChange([...tokens, token]);
  };

  const removeToken = (index: number) => {
    onChange(tokens.filter((_, i) => i !== index));
  };

  const filteredSuggestions = SUGGESTED_TOKENS.filter((t) =>
    allowedKinds.has(t.kind),
  );

  return (
    <div className="space-y-1.5">
      {/* Chip stack */}
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5">
        {tokens.length === 0 ? (
          <span className="text-xs text-muted-foreground">
            Empty — pick a token below
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

      {/* Add button */}
      <button
        type="button"
        onClick={() => setShowPicker(!showPicker)}
        className="rounded-md border border-dashed border-border bg-background px-3 py-1 text-xs text-muted-foreground hover:bg-accent"
      >
        {showPicker ? "× close" : "+ add token"}
      </button>

      {/* Token picker popover */}
      {showPicker ? (
        <TokenPicker
          allowedKinds={allowedKinds}
          suggestions={filteredSuggestions}
          onPick={(token) => { addToken(token); setShowPicker(false); }}
          onCustom={(name) => { addToken({ kind: "behavior", name }); setShowPicker(false); }}
        />
      ) : null}
    </div>
  );
}

// =============================================================================
// Token picker popover
// =============================================================================

interface TokenPickerProps {
  readonly allowedKinds: ReadonlySet<ValueToken["kind"]>;
  readonly suggestions: readonly ValueToken[];
  readonly onPick: (token: ValueToken) => void;
  readonly onCustom: (name: string) => void;
}

function TokenPicker({
  allowedKinds,
  suggestions,
  onPick,
  onCustom,
}: TokenPickerProps): ReactElement {
  const [customName, setCustomName] = useState("");

  const handleCustomSubmit = () => {
    const t = customName.trim();
    if (t.length === 0) return;
    onCustom(t);
    setCustomName("");
  };

  return (
    <div className="space-y-2 rounded-md border border-border bg-card p-2 shadow-sm">
      {allowedKinds.has("attribute") ? (
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
                className="rounded-full border border-border bg-background px-2 py-0.5 text-xs hover:bg-accent"
              >
                + {attr}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {allowedKinds.has("practice") ? (
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
                className="rounded-full border border-border bg-background px-2 py-0.5 text-xs hover:bg-accent"
              >
                + {practice}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {allowedKinds.has("derived") ? (
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
                className="rounded-full border border-border bg-background px-2 py-0.5 text-xs hover:bg-accent"
              >
                + {d === "pb_half" ? "PB/2" : d.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {allowedKinds.has("dice") ? (
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
                className="rounded-full border border-border bg-background px-2 py-0.5 text-xs hover:bg-accent"
              >
                + {d}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Custom behavior input — always available */}
      <div>
        <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Custom behavior (any name)
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCustomSubmit();
              }
            }}
            placeholder="e.g. darkvision, mana_pool"
            className="h-7 flex-1 rounded-md border border-input bg-background px-2 text-xs outline-none ring-ring focus:ring-2"
          />
          <button
            type="button"
            onClick={handleCustomSubmit}
            className="h-7 rounded-md border border-border bg-background px-2 text-xs hover:bg-accent"
          >
            + add
          </button>
        </div>
      </div>

      {/* Free-form text — always available, becomes a behavior token */}
      <details className="rounded-md border border-dashed border-border">
        <summary className="cursor-pointer px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          + free text
        </summary>
        <FreeTextInput
          onSubmit={(text) => { onCustom(text); setCustomName(""); }}
        />
      </details>
    </div>
  );
}

// Phase 7.5 v3: BiasPicker removed (bias op is gone). Advantage
// and disadvantage are now just behavior chips (use the regular
// TokenPicker).

// =============================================================================
// Free-text input (multi-word → behavior token)
// =============================================================================

function FreeTextInput({
  onSubmit,
}: {
  readonly onSubmit: (text: string) => void;
}): ReactElement {
  const [draft, setDraft] = useState("");
  const submit = () => {
    const t = draft.trim();
    if (t.length === 0) return;
    onSubmit(t);
    setDraft("");
  };
  return (
    <div className="flex items-center gap-1.5 p-2">
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
        placeholder='e.g. "60 ft darkvision"'
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
  }
}

// Re-export the AttributeKey / PracticeKey types for convenience.
export type { AttributeKey, PracticeKey };