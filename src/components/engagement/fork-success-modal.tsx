"use client";

// =============================================================================
// ForkSuccessModal — post-fork confirmation modal
//
// After a successful fork, the user is shown a modal with two next-step
// options:
//   1. "View fork source page" — opens the fork's public library page
//      in the current tab so the user can verify the fork exists.
//   2. "Edit in sandbox" — opens the sandbox with the fork pre-loaded
//      so the user can immediately start editing.
//
// "Edit in sandbox" routes through the existing ?edit=<id> flow. The
// right sandbox path depends on the entity type (grammar for primitives/
// effects/capabilities, blueprint for templates/items). We compute the
// destination via the same helper used by the version-history page.
//
// Visibility: not used for self-fork (no-op; like-fork-bar disables the
// fork button when the viewer owns the content). Always shows the modal
// for a successful fork from someone else's content.
//
// =============================================================================

import { useEffect } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, Wrench, X } from "lucide-react";

export interface ForkResult {
  /** Composite id of the new fork (just the inner id, no type prefix). */
  forkedTargetId: string;
  /** Composite id of the source we forked from. */
  sourceTargetId: string;
  /** Type of both source and fork (forks preserve type). */
  targetType: ForkSuccessModalTargetType;
  /** Optional name to display in the modal title. */
  forkName?: string;
}

export type ForkSuccessModalTargetType =
  | "PRIMITIVE"
  | "CAPABILITY"
  | "EFFECT"
  | "ITEM"
  | "CHARACTER"
  | "RACE_TEMPLATE"
  | "BACKGROUND_TEMPLATE"
  | "ARCHETYPE_TEMPLATE"
  | "BUILD_TEMPLATE";

export function ForkSuccessModal(props: {
  isOpen: boolean;
  onClose: () => void;
  result: ForkResult | null;
}) {
  const router = useRouter();

  // Escape closes
  useEffect(() => {
    if (!props.isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.isOpen, props.onClose]);

  if (!props.isOpen || typeof document === "undefined" || !props.result) {
    return null;
  }

  const r = props.result;
  // "View source page" should actually go to the SOURCE's library page, not
  // the fork's. The variable was previously misnamed/miswired, sending users
  // to their own new fork page when they expected to see the original they
  // forked from. (forkedTargetId = NEW fork's id; sourceTargetId = original.)
  const sourceLibraryHref = `/library/item/${r.targetType}:${encodeURIComponent(r.sourceTargetId)}`;
  const sandboxHref = buildSandboxEditUrl(r);

  function handleEditInSandbox() {
    // Close modal first, then navigate. Next router.push is fine here
    // since the page is server-rendered.
    props.onClose();
    router.push(sandboxHref);
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Fork created"
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={props.onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <span className="inline-flex size-6 items-center justify-center rounded-full bg-green-500/20 text-green-600 dark:text-green-400">
              <Check className="size-4" />
            </span>
            Forked
          </span>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="space-y-4 p-5">
          <p className="text-sm text-foreground">
            {r.forkName ? (
              <>
                Your fork{" "}
                <span className="font-semibold">{r.forkName}</span> is saved
                to your sandbox.
              </>
            ) : (
              <>Your fork is saved to your sandbox.</>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            The fork is private by default. Publish it from your sandbox to
            share it with the community.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href={sourceLibraryHref}
              onClick={props.onClose}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:border-primary hover:text-primary"
            >
              <ExternalLink className="size-3.5" />
              View source page
            </Link>
            <button
              type="button"
              onClick={handleEditInSandbox}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Wrench className="size-3.5" />
              Edit in sandbox
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// =============================================================================
// Helper — build the sandbox ?edit= URL for the entity type
// =============================================================================
//
// Mirrors the helper in /library/item/[id]/versions/page.tsx so the
// "Slot into build" button and the post-fork modal send users to the
// same sandbox page for each entity kind.
// =============================================================================

function buildSandboxEditUrl(r: ForkResult): string {
  const editId = encodeURIComponent(r.forkedTargetId);
  switch (r.targetType) {
    case "PRIMITIVE":
      return `/sandbox/grammar?build=primitive&edit=${editId}`;
    case "EFFECT":
      return `/sandbox/grammar?build=effect&edit=${editId}`;
    case "CAPABILITY":
      return `/sandbox/grammar?build=capability&edit=${editId}`;
    case "ITEM":
      return `/sandbox/blueprint?build=item&edit=${editId}`;
    case "RACE_TEMPLATE":
      return `/sandbox/blueprint?build=template&kind=RACE&edit=${editId}`;
    case "BACKGROUND_TEMPLATE":
      return `/sandbox/blueprint?build=template&kind=BACKGROUND&edit=${editId}`;
    case "ARCHETYPE_TEMPLATE":
      return `/sandbox/blueprint?build=template&kind=ARCHETYPE&edit=${editId}`;
    case "CHARACTER":
      return `/sandbox/builds?edit=${editId}`;
    case "BUILD_TEMPLATE":
      return `/sandbox/blueprint?build=template&edit=${editId}`;
    default:
      // Defensive fallback — should never happen if the schema enums stay
      // in sync with this switch.
      return `/sandbox?edit=${editId}`;
  }
}
