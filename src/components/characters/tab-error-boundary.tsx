"use client";

// =============================================================================
// TabErrorBoundary — Phase 8.4 (Mashu 2026-07-28)
//
// Catches render errors inside a character-sheet tab so the rest of the
// sheet stays usable. We don't want a single bad capability to white-screen
// the entire character sheet (and lose the user's scroll position, tab
// selection, etc.).
//
// Mashu 2026-07-28: "Capability tab still crashes." Even after rolled back
// the heredity accordion (commit d142977), the tab continues to crash on
// some characters (Tessy's "Ironborn fork test" capability is one reproducer).
// The crash is in a child's component tree (likely related to a specific
// capability's tags / preview-modal wiring). Wrapping the tab in this
// boundary is the immediate fix so the user can keep using the rest of the
// sheet. The underlying error is logged to the console for triage.
//
// Implementation: class component because React's error boundaries require
// `componentDidCatch` / `getDerivedStateFromError`, which hooks don't expose.
// =============================================================================

import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  readonly tabName: string;
  readonly children: ReactNode;
  readonly fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  readonly error: Error | null;
}

export class TabErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: { componentStack?: string }) {
    // Log to the browser console for debugging. Don't throw — we're the
    // safety net. Treatment matches the icon-picker boundary (see
    // src/components/icons/picker-error-boundary.tsx).
    // eslint-disable-next-line no-console
    console.error(
      `[TabErrorBoundary:${this.props.tabName}]`,
      error,
      info.componentStack,
    );
  }

  reset = () => {
    this.setState({ error: null });
  };

  override render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="size-5 shrink-0 text-destructive" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-destructive">
                {this.props.tabName} failed to render
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Something in this tab threw an error. The rest of the sheet
                is still usable. Reload the page to try again, or report the
                issue with the message below.
              </p>
              <pre className="mt-2 max-h-32 overflow-auto rounded bg-background/50 p-2 text-[10px] text-muted-foreground">
                {this.state.error.message}
              </pre>
              <button
                type="button"
                onClick={this.reset}
                className="mt-2 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium hover:bg-secondary"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
