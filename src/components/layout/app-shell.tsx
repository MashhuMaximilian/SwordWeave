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
  return (
    <ModalStackHost>
      <GlobalControls>
        <main className="min-w-0 pb-2">{children}</main>
      </GlobalControls>
    </ModalStackHost>
  );
}
