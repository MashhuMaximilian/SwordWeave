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
import {
  CharacterModalProvider,
} from "@/components/character-modal/character-modal-store";
import { CharacterModal } from "@/components/character-modal/character-modal";

export function AppShell({ children }: { children: React.ReactNode }) {
  // Provider order matters. The modal-stack portalling target must
  // sit INSIDE the CharacterModalProvider so that SandboxPreviewBody
  // (rendered via ModalStackRenderer → createPortal → document.body)
  // can call useCharacterModal() and reach the live store. Previously
  // the order was ModalStackHost outermost, CharacterModalProvider
  // inside — that meant the portal rendered content outside the
  // character modal's context, so queueSlot() / open() from the
  // library preview were silent no-ops. See phase-8.1 round-2
  // bug-fix commit for the regression report.
  //
  // ModalStackHost still wraps GlobalControls so that GlobalControls'
  // own useModalStack() resolves to the real stack (not a no-op).
  // CharacterModal still lives inside CharacterModalProvider so the
  // FAB + portal modal see the same store.
  return (
    <CharacterModalProvider>
      <ModalStackHost>
        <GlobalControls>
          <main className="min-w-0 pb-2">{children}</main>
          <footer className="border-t border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
              <span>
                SwordWeave · Open-source TTRPG engine
              </span>
              <div className="flex items-center gap-4">
                <a
                  href="/attributions"
                  className="hover:text-foreground hover:underline"
                >
                  Attributions
                </a>
                <a
                  href="https://github.com/MashhuMaximilian/SwordWeave"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground hover:underline"
                >
                  GitHub
                </a>
              </div>
            </div>
          </footer>
          {/* Character creation modal (Phase 8.1) — persistent overlay.
              Lives inside CharacterModalProvider so the FAB onClick in
              GlobalControls can read the same store. Renders nothing
              when closed. */}
          <CharacterModal />
        </GlobalControls>
      </ModalStackHost>
    </CharacterModalProvider>
  );
}
