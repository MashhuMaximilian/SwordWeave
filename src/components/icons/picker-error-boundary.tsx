"use client";

// =============================================================================
// PickerErrorBoundary — Phase 9 follow-up round 8.
//
// Catches render errors inside the IconPicker's ColorPicker (or any other
// react-aria component) so the page doesn't white-screen when something
// inside throws. Used to wrap the color picker popover content in icon-picker.tsx.
//
// Without this, a crash inside `<ColorPicker>` (e.g. from an invalid initial
// color value, a hydration mismatch from server vs client Color serialization,
// or a future react-aria regression) tears down the whole IconPicker tree and
// visibly closes the build modal mid-edit. With this, the picker shows a
// "Color picker unavailable" fallback with the hex value visible so the user
// can still see what color they had picked.
//
// Implementation: class component because React's error boundaries require
// `componentDidCatch` / `getDerivedStateFromError`, which hooks don't expose.
// =============================================================================

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class PickerErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: { componentStack?: string }) {
    // Log to the browser console for debugging — Vercel + Sentry (if added
    // later) can pick this up. Don't throw — we're the safety net.
    console.error("[PickerErrorBoundary]", error, info.componentStack);
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
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
          Color picker unavailable. Reload the page or pick a color from the
          hex field below.
        </div>
      );
    }
    return this.props.children;
  }
}
