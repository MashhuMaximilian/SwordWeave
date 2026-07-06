"use client";

// =============================================================================
// AppShell — root layout for every page. Wraps content in:
//   - GlobalControls (provides dark mode, filter panel, build drawer, FAB)
//   - ModalStackHost (stacked modals with breadcrumbs)
//
// The desktop left sidebar was removed (commit f82718d+) because the FAB
// is now the single source of navigation. Pages render full-bleed within
// the <main> below. The FAB always sits in the bottom-right of the
// viewport (fixed positioning).
// =============================================================================

import { GlobalControls } from "./global-controls";
import { ModalStackHost } from "@/components/ui/modal-stack";

export function AppShell({ children }: { children: React.ReactNode }) {
  // CRITICAL: GlobalControls must WRAP ModalStackHost, not the other way
  // around. The ModalStackRenderer (a sibling of {children} inside
  // ModalStackHost) renders the modals — and modal content like
  // BlueprintPreviewBody / GrammarPreviewBody call
  // useGlobalControls() to open the build preview drawer after a slot
  // or load. If GlobalControls were outside, the modal content would
  // throw "useGlobalControls must be used inside <GlobalControls>"
  // when a user clicks a library row, crashing the entire page with
  // the "SANDBOX FAILED TO LOAD" / "page could not load" error.
  // Keeping GlobalControls outermost ensures the FAB, the page tree,
  // and the modal stack renderer are all inside the provider.
  return (
    <GlobalControls>
      <ModalStackHost>
        <main className="min-w-0 pb-2">{children}</main>
      </ModalStackHost>
    </GlobalControls>
  );
}
