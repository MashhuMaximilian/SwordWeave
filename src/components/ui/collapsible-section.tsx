// =============================================================================
// CollapsibleSection — used by every chip-picker section header
// =============================================================================

import { useState, type ReactElement, type ReactNode } from "react";

/**
 * Mashu: "we should make all those chip categories collapsible
 * and collapsed by default. only number and attribute expanded
 * by default. so user will not be overwhelmed by colors. and
 * especially on mobile it will help the user."
 *
 * Each chip-picker section uses this so the user can collapse
 * a category and free vertical space. The most-used sections
 * (Number + Attribute in the token picker) stay open by default;
 * everything else collapses. Click the header to expand/collapse
 * — state persists per-section during a single picker session.
 *
 * Used in:
 *   - token-chip-stack.tsx (number, attribute, practice, derived,
 *     dice, sub-choice, true/false sections)
 *   - equation-picker.tsx (attribute, practice, derived, dice,
 *     sub-choice, true/false sections)
 */
export function CollapsibleSection({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  readonly title: string;
  readonly count?: number;
  readonly defaultOpen?: boolean;
  readonly children: ReactNode;
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
