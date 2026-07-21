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
  // ModalStackHost MUST be the outermost provider so that GlobalControls
  // (which is rendered inside) can call useModalStack() and get the real
  // stack — not the no-op default. The previous order (GlobalControls
  // outermost, ModalStackHost inner) meant useModalStack() inside
  // GlobalControls ran before the provider existed in the tree, so the
  // FAB's Account button and any other caller of openUserMenu() was
  // pushing to a no-op stack. The modal never rendered.
  //
  // Modal content rendered by ModalStackRenderer (a sibling of children
  // inside ModalStackHost) can still call useGlobalControls() because
  // GlobalControls is rendered as a child of ModalStackHost — the
  // GlobalControls provider is a parent of the modal renderer.
  return (
    <ModalStackHost>
      <CharacterModalProvider>
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
      </CharacterModalProvider>
    </ModalStackHost>
  );
}
