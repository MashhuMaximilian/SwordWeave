"use client";

import { useState, useTransition, useRef, useEffect, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, useClerk } from "@clerk/nextjs";
import { createPortal } from "react-dom";
import { useModalStack } from "@/components/ui/modal-stack";
import {
  Heart,
  GitFork,
  Flag,
  UserPlus,
  UserMinus,
  Star,
  type LucideIcon,
} from "lucide-react";
import { ForkSuccessModal } from "@/components/engagement/fork-success-modal";
import { buildSandboxUrl } from "@/lib/publishing/fork-target";

// =============================================================================
// LikeForkBar — engagement controls for any library item
//
// Renders like (filled heart) + dislike (filled star-down style) + fork +
// flag dropdown. Follow button is shown when authorId is provided AND
// it's not the viewer's own content.
//
// All actions use optimistic UI updates then reconcile with the server
// via router.refresh(). If the user is unauthenticated, the buttons
// redirect to sign-in.
// =============================================================================

export interface LikeForkBarProps {
  targetType:
    | "PRIMITIVE"
    | "EFFECT"
    | "CAPABILITY"
    | "CHARACTER"
    | "ITEM"
    | "RACE_TEMPLATE"
    | "BACKGROUND_TEMPLATE"
    | "ARCHETYPE_TEMPLATE"
    // Mashu 2026-07-09: builds can now be liked + forked from the
    // public library grid.
    | "BUILD_TEMPLATE";
  targetId: string;
  versionId?: string;
  initialLikes: number;
  initialDislikes: number;
  initialForks: number;
  initialUserReaction?: "LIKE" | "DISLIKE" | null;
  initialFollowing?: boolean;
  authorId?: string | null;
  authorUsername?: string | null;
  currentUserId?: string | null;
  /** Compact mode for browse cards (icon-only). */
  compact?: boolean;
  className?: string;
  /**
   * Override the sandbox route the Fork button navigates to. Defaults to
   * the legacy route resolved by buildSandboxUrl (e.g. /sandbox/grammar).
   * The Atelier page passes "/atelier" so forking stays on the
   * unified page instead of bouncing to the legacy route.
   */
  sandboxPath?: string | undefined;
  /**
   * Direct fork handler. When provided (e.g. by the Atelier page), the
   * Fork button calls this instead of navigating. This is the most
   * reliable path for in-page forking: the parent loads the fork-draft
   * into its own build form directly (no cross-component event, no
   * same-pathname router.push that doesn't update the URL bar).
   */
  onFork?: ((targetType: string, targetId: string) => void) | undefined;
}

type FlagReason =
  | "UNBALANCED"
  | "BROKEN"
  | "INAPPROPRIATE"
  | "DUPLICATE"
  | "OTHER";

const FLAG_REASONS: { value: FlagReason; label: string }[] = [
  { value: "UNBALANCED", label: "Unbalanced (BU / power)" },
  { value: "BROKEN", label: "Broken / doesn't work" },
  { value: "INAPPROPRIATE", label: "Inappropriate content" },
  { value: "DUPLICATE", label: "Duplicate of existing" },
  { value: "OTHER", label: "Other (with note)" },
];

export function LikeForkBar(props: LikeForkBarProps) {
  const router = useRouter();
  const { session } = useSession();
  const clerk = useClerk();
  // Modal stack holds the preview popup. When forking, the pathname stays
  // on the current sandbox route (e.g. /sandbox/atelier), so ModalStackHost's
  // pathname-change auto-clear won't fire — clear it explicitly so the
  // preview doesn't stay on top of the forked build.
  const stack = useModalStack();

  // Clerk's session token has a 60s TTL by default. If the user lingers
  // on a page past that window then clicks Like, the cached JWT is stale
  // and the API returns 401. `getToken({ skipCache: true })` forces a
  // refresh before the engagement call goes out.
  async function withFreshToken<T>(fn: () => Promise<T>): Promise<T> {
    if (session) {
      try {
        await session.getToken({ skipCache: true });
      } catch {
        // Ignore — fetch below will surface auth errors with a clearer message.
      }
    }
    return fn();
  }
  const [pending, startTransition] = useTransition();

  const [likes, setLikes] = useState(props.initialLikes);
  const [dislikes, setDislikes] = useState(props.initialDislikes);
  const [forks, setForks] = useState(props.initialForks);
  const [userReaction, setUserReaction] = useState<"LIKE" | "DISLIKE" | null>(
    props.initialUserReaction ?? null,
  );
  const [following, setFollowing] = useState(props.initialFollowing ?? false);
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagReason, setFlagReason] = useState<FlagReason | null>(null);
  const [flagNote, setFlagNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  /**
   * After a successful fork, hold the result here so the
   * ForkSuccessModal can render with both action buttons ("View
   * source page" + "Edit in sandbox"). Previously the handleFork
   * redirected to /sandbox?forkedFrom=… immediately, skipping the
   * confirmation step the user asked for.
   */
  const [forkResult, setForkResult] = useState<{
    forkedTargetId: string;
    sourceTargetId: string;
    forkName?: string;
  } | null>(null);

  const isAuthed = Boolean(props.currentUserId);
  const isOwnContent =
    props.authorId != null && props.authorId === props.currentUserId;
  const showFollow = !isOwnContent && props.authorId != null;
  const netRating = likes - dislikes;

  // ---------- handlers ----------

  const requireAuth = (): boolean => {
    if (isAuthed) return true;
    // Don't hard-redirect — that's hostile to browsing. Open the
    // sign-in modal via Clerk (it preserves the current URL as the
    // post-signin redirect target so the user lands back on this page
    // and can resume liking). The `useClerk()` hook gives us a stable
    // reference client-side; the previous global `window.Clerk` lookup
    // was unreliable on mobile browsers and would fall through to a
    // full page redirect to /sign-in (which is what the user reported).
    try {
      clerk.openSignIn({});
      return false;
    } catch {
      // Clerk not mounted yet (rare). Hard nav as last resort.
      if (typeof window !== "undefined") {
        window.location.href = "/sign-in";
      }
      return false;
    }
  };

  const handleLike = () => {
    if (!requireAuth()) return;
    const prev = { likes, dislikes, userReaction };
    if (userReaction === "LIKE") {
      setLikes(Math.max(0, likes - 1));
      setUserReaction(null);
    } else if (userReaction === "DISLIKE") {
      setLikes(likes + 1);
      setDislikes(Math.max(0, dislikes - 1));
      setUserReaction("LIKE");
    } else {
      setLikes(likes + 1);
      setUserReaction("LIKE");
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await withFreshToken(() => fetch("/api/reactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetType: props.targetType,
            targetId: props.targetId,
            ...(props.versionId ? { versionId: props.versionId } : {}),
            kind: "LIKE",
          }),
        }));
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        const data = await res.json();
        setLikes(data.likesCount);
        setDislikes(data.dislikesCount);
      } catch (e) {
        // Roll back
        setLikes(prev.likes);
        setDislikes(prev.dislikes);
        setUserReaction(prev.userReaction);
        setError(e instanceof Error ? e.message : "Failed to like");
      }
    });
  };

  const handleDislike = () => {
    if (!requireAuth()) return;
    const prev = { likes, dislikes, userReaction };
    if (userReaction === "DISLIKE") {
      setDislikes(Math.max(0, dislikes - 1));
      setUserReaction(null);
    } else if (userReaction === "LIKE") {
      setDislikes(dislikes + 1);
      setLikes(Math.max(0, likes - 1));
      setUserReaction("DISLIKE");
    } else {
      setDislikes(dislikes + 1);
      setUserReaction("DISLIKE");
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await withFreshToken(() => fetch("/api/reactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetType: props.targetType,
            targetId: props.targetId,
            ...(props.versionId ? { versionId: props.versionId } : {}),
            kind: "DISLIKE",
          }),
        }));
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        const data = await res.json();
        setLikes(data.likesCount);
        setDislikes(data.dislikesCount);
      } catch (e) {
        setLikes(prev.likes);
        setDislikes(prev.dislikes);
        setUserReaction(prev.userReaction);
        setError(e instanceof Error ? e.message : "Failed to dislike");
      }
    });
  };

  const handleFork = () => {
    if (!requireAuth()) return;
    // Phase 1 (round 6 revision of edit-creates-fork.md): clicking
    // Fork no longer creates a fork immediately. Instead it navigates
    // to the sandbox with ?intent=fork&edit=<sourceId>. The actual
    // fork row is materialized at save time by dispatch-save.ts.
    //
    // Rationale: the old flow created an empty fork on click that
    // polluted the user's Creations list whenever they clicked Fork
    // and then backed out. The new flow is "no side effect until save"
    // — cancel/back-out leaves no trace. Mashu: "I click fork. No fork
    // is created. Instead, it just loads into build and opens build
    // modal. I do my modifications and save. Only then the fork is
    // created and added to my creations."
    //
    // ForkSuccessModal is now triggered AFTER save, not on click.
    // For Phase 1 the post-save modal is wired in PrimitiveForm +
    // EffectForm + CapabilityForm via the form's onSaved callback.
    const target = buildSandboxUrl(
      props.targetType,
      props.targetId,
      "fork",
    );
    if (!target) {
      // Target isn't fork-able (e.g. CHARACTER / BUILD). Show a
      // friendly error so the user knows the button is currently
      // informational only for those types. Phase 2 may revisit.
      setError("This content type can't be forked yet.");
      return;
    }
    stack.clear();
    // Direct fork handler (Atelier): the parent loads the fork-draft into
    // its own build form. This is the most reliable in-page fork — no
    // cross-component event, no same-pathname router.push that fails to
    // update the URL bar.
    if (props.onFork) {
      props.onFork(props.targetType, props.targetId);
      return;
    }
    if (props.sandboxPath) {
      // Fallback for any caller that sets sandboxPath without onFork:
      // notify the Atelier client via event.
      window.dispatchEvent(
        new CustomEvent("sw-atelier-fork", {
          detail: { targetType: props.targetType, targetId: props.targetId },
        }),
      );
      return;
    }
    router.push(`${target.sandboxPath}${target.search}`);
  };
  /**
   * Called by ForkSuccessModal when the user dismisses it (X / click
   * backdrop / "View source page"). We refresh the parent server tree
   * here — AFTER the modal has closed — so any server-rendered fork
   * counts / "forked from" breadcrumbs elsewhere on the page pick up
   * the new fork. This used to fire immediately after the API call,
   * which killed the modal's state.
   *
   * Skip the refresh when we're navigating away via the "Edit in sandbox"
   * button — that handler already does router.push first; a refresh on
   * the OLD route would interrupt the navigation. handleEditInSandbox
   * calls props.onClose() but we detect that via a flag passed to this
   * function.
   */
  const handleForkModalClose = (skipRefresh = false) => {
    setForkResult(null);
    if (!skipRefresh) {
      router.refresh();
    }
  };

  const handleFollow = () => {
    if (!requireAuth() || !props.authorId) return;
    const wasFollowing = following;
    setFollowing(!wasFollowing);
    setError(null);
    startTransition(async () => {
      try {
        const res = await withFreshToken(() => fetch("/api/follows", {
          method: wasFollowing ? "DELETE" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetUserId: props.authorId }),
        }));
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        const data = await res.json();
        setFollowing(data.following);
      } catch (e) {
        setFollowing(wasFollowing);
        setError(e instanceof Error ? e.message : "Failed to follow");
      }
    });
  };

  const submitFlag = () => {
    if (!requireAuth() || !flagReason) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await withFreshToken(() => fetch("/api/flags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetType: props.targetType,
            targetId: props.targetId,
            ...(props.versionId ? { versionId: props.versionId } : {}),
            reason: flagReason,
            ...(flagReason === "OTHER" && flagNote ? { note: flagNote } : {}),
          }),
        }));
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        setFlagOpen(false);
        setFlagReason(null);
        setFlagNote("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to flag");
      }
    });
  };

  // ---------- render ----------

  const buttonBase = props.compact
    ? "inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded border px-1 py-0 text-[10px] leading-none transition disabled:opacity-50"
    : "inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-sm transition disabled:opacity-50";
  const buttonGhost =
    "border-border bg-card/50 text-muted-foreground hover:border-primary hover:text-foreground";
  const buttonActive = "border-primary bg-primary/10 text-primary";
  const buttonFilled = "border-rose-500 bg-rose-500/10 text-rose-500";

  const iconClass = props.compact ? "h-3 w-3" : "h-4 w-4";

  return (
    <>
    <div
      onClick={(e) => e.stopPropagation()}
      className={`flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${props.className ?? ""}`}
      role="group"
      aria-label="Engagement"
    >
      <button
        type="button"
        onClick={handleLike}
        disabled={pending}
        title={userReaction === "LIKE" ? "Unlike" : "Like"}
        aria-label={`Like (${likes} ${likes === 1 ? "like" : "likes"})`}
        aria-pressed={userReaction === "LIKE"}
        className={`${buttonBase} ${userReaction === "LIKE" ? buttonFilled : buttonGhost}`}
      >
        <Heart
          className={iconClass}
          fill={userReaction === "LIKE" ? "currentColor" : "none"}
          aria-hidden="true"
        />
        <span className="tabular-nums" aria-hidden="true">{likes}</span>
        {!props.compact && <span>like{likes === 1 ? "" : "s"}</span>}
      </button>

      <button
        type="button"
        onClick={handleDislike}
        disabled={pending}
        title={userReaction === "DISLIKE" ? "Remove dislike" : "Dislike"}
        aria-label={`Dislike (${dislikes} ${dislikes === 1 ? "dislike" : "dislikes"})`}
        aria-pressed={userReaction === "DISLIKE"}
        className={`${buttonBase} ${userReaction === "DISLIKE" ? buttonFilled : buttonGhost}`}
      >
        <ThumbsDown
          className={iconClass}
          fill={userReaction === "DISLIKE" ? "currentColor" : "none"}
          aria-hidden="true"
        />
        <span className="tabular-nums" aria-hidden="true">{dislikes}</span>
        {!props.compact && <span>dislike{dislikes === 1 ? "" : "s"}</span>}
      </button>

      <button
        type="button"
        onClick={handleFork}
        disabled={pending}
        title="Fork to your sandbox"
        aria-label={`Fork (${forks} ${forks === 1 ? "fork" : "forks"})`}
        className={`${buttonBase} ${buttonGhost}`}
      >
        <GitFork className={iconClass} aria-hidden="true" />
        <span className="tabular-nums" aria-hidden="true">{forks}</span>
        {!props.compact && <span>fork{forks === 1 ? "" : "s"}</span>}
      </button>

      <span
        className={`${buttonBase} border-border bg-card/50 text-muted-foreground`}
        title="Net rating (likes − dislikes)"
        role="status"
        aria-label={`Net rating ${netRating > 0 ? "plus " : ""}${netRating}`}
      >
        <Star className={iconClass} aria-hidden="true" />
        <span className="tabular-nums" aria-hidden="true">
          {netRating > 0 ? "+" : ""}
          {netRating}
        </span>
        {!props.compact && <span>rating</span>}
      </span>

      {showFollow && props.authorUsername && (
        <button
          type="button"
          onClick={handleFollow}
          disabled={pending}
          title={following ? `Unfollow @${props.authorUsername}` : `Follow @${props.authorUsername}`}
          aria-label={following ? `Unfollow @${props.authorUsername}` : `Follow @${props.authorUsername}`}
          aria-pressed={following}
          className={`${buttonBase} ${following ? buttonActive : buttonGhost}`}
        >
          {following ? (
            <UserMinus className={iconClass} aria-hidden="true" />
          ) : (
            <UserPlus className={iconClass} aria-hidden="true" />
          )}
          {!props.compact && <span>{following ? "Following" : "Follow"}</span>}
        </button>
      )}

      <button
        type="button"
        onClick={() => {
          if (!requireAuth()) return;
          setFlagOpen((v) => !v);
        }}
        disabled={pending}
        title="Flag this content"
        aria-label="Flag this content"
        aria-haspopup="dialog"
        aria-expanded={flagOpen}
        data-flag-trigger
        className={`${buttonBase} ${buttonGhost}`}
      >
        <Flag className={iconClass} aria-hidden="true" />
        {!props.compact && <span>Flag</span>}
      </button>
      <FlagPopover
        isOpen={flagOpen}
        onClose={() => {
          setFlagOpen(false);
          setFlagReason(null);
          setFlagNote("");
        }}
        pending={pending}
        flagReason={flagReason}
        flagNote={flagNote}
        onSelectReason={setFlagReason}
        onChangeNote={setFlagNote}
        onSubmit={submitFlag}
        compact={!!props.compact}
      />
      {error && (
        <p className="w-full text-xs text-rose-400" role="alert">
          {error}
        </p>
      )}
    </div>
    <ForkSuccessModal
      isOpen={forkResult !== null}
      onClose={handleForkModalClose}
      result={
        forkResult
          ? {
              forkedTargetId: forkResult.forkedTargetId,
              sourceTargetId: forkResult.sourceTargetId,
              // LikeForkBar's targetType union is narrower than the
              // modal's (it doesn't include BUILD_TEMPLATE etc), but
              // every value it accepts IS a valid ForkSuccessModal
              // target type. Cast widens without runtime impact.
              targetType: props.targetType as never,
              // Only include forkName when defined — exactOptionalPropertyTypes
              // forbids `string | undefined` on an optional property.
              ...(forkResult.forkName
                ? { forkName: forkResult.forkName }
                : {}),
            }
          : null
      }
    />
    </>
  );
}

// =============================================================================
// FlagPopover — portal-rendered to escape overflow containers
// =============================================================================
//
// The previous implementation used `position: absolute` relative to the
// flag button, which got clipped by any ancestor with `overflow: hidden`
// or `overflow: auto` (the LikeForkBar's own scroll container on mobile,
// the modal body on desktop, etc.). The user had to scroll inside the
// tiny popover to see all reason options — a UX bug.
//
// This version:
//   1. Captures the trigger button's bounding rect via a ref.
//   2. Positions the popover with `position: fixed` (escapes ALL
//      overflow ancestors — fixed positions are relative to the
//      viewport, not the nearest containing block).
//   3. Renders the popover into `document.body` via createPortal so
//      it can't be clipped by any container's `overflow: hidden`,
//      `overflow: auto`, or stacking context.
//   4. Clamps to the viewport edges (right-side overflow protection
//      on small screens where the trigger is near the right edge).
//   5. Adds an invisible full-viewport backdrop that closes the
//      popover on click-outside (Escape handled below).
// =============================================================================

const POPOVER_WIDTH = 280; // px
const POPOVER_OFFSET = 8; // px between trigger and popover

function FlagPopover(props: {
  isOpen: boolean;
  onClose: () => void;
  pending: boolean;
  flagReason: FlagReason | null;
  flagNote: string;
  onSelectReason: (r: FlagReason) => void;
  onChangeNote: (s: string) => void;
  onSubmit: () => void;
  compact: boolean;
}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  // useLayoutEffect so we paint positioned correctly on the same frame
  // the popover opens — no flash of "popover in top-left corner".
  useLayoutEffect(() => {
    if (!props.isOpen) {
      setPos(null);
      return;
    }
    const trigger = document.querySelector<HTMLButtonElement>(
      "[data-flag-trigger]",
    );
    triggerRef.current = trigger;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    // Default: position to the LEFT of the trigger (because the flag
    // button is on the right end of the LikeForkBar). If there isn't
    // enough room on the left, fall back to below.
    const viewportWidth = window.innerWidth;
    const rightAlignedLeft = rect.right - POPOVER_WIDTH;
    const useRightAligned = rightAlignedLeft >= 8;
    let left = useRightAligned ? rightAlignedLeft : rect.left;
    // Clamp so the popover never overflows the viewport horizontally.
    if (left + POPOVER_WIDTH > viewportWidth - 8) {
      left = viewportWidth - POPOVER_WIDTH - 8;
    }
    if (left < 8) left = 8;
    // Position above the trigger if there's room, otherwise below.
    const popoverHeight = 320; // estimate; safe for any content
    const topAbove = rect.top - popoverHeight - POPOVER_OFFSET;
    const topBelow = rect.bottom + POPOVER_OFFSET;
    const top =
      topAbove >= 8 ? topAbove : Math.min(topBelow, window.innerHeight - popoverHeight - 8);
    setPos({ top, left });
  }, [props.isOpen]);

  // Escape closes the popover.
  useEffect(() => {
    if (!props.isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.isOpen, props.onClose]);

  if (!props.isOpen || !pos || typeof document === "undefined") return null;

  return createPortal(
    <>
      {/* Invisible full-screen backdrop. Click closes the popover. */}
      <div
        aria-hidden="true"
        onClick={props.onClose}
        className="fixed inset-0 z-[100]"
      />
      <div
        role="dialog"
        aria-label="Flag content"
        aria-modal="true"
        className="fixed z-[101] w-[280px] rounded-md border border-border bg-card p-3 shadow-xl"
        style={{ top: pos.top, left: pos.left }}
        // Stop click propagation so clicks inside don't close us.
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-2 text-xs text-muted-foreground">
          Why are you flagging this?
        </p>
        <div className="space-y-1">
          {FLAG_REASONS.map((opt) => {
            const active = props.flagReason === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => props.onSelectReason(opt.value)}
                className={`w-full rounded px-2 py-1.5 text-left text-sm ${
                  active
                    ? "bg-primary/20 text-primary"
                    : "text-foreground hover:bg-accent"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {props.flagReason === "OTHER" && (
          <textarea
            value={props.flagNote}
            onChange={(e) => props.onChangeNote(e.target.value)}
            placeholder="Optional note (max 500 chars)"
            maxLength={500}
            className="mt-2 w-full rounded border border-border bg-background p-2 text-xs text-foreground"
            rows={2}
          />
        )}
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={props.onSubmit}
            disabled={!props.flagReason || props.pending}
            className="flex-1 rounded bg-rose-500/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
          >
            Submit
          </button>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded border border-border px-3 py-1.5 text-xs text-foreground hover:bg-accent"
          >
            Cancel
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}

// Inline icon (lucide-react doesn't export ThumbsDown as a separate import
// path in older versions — fall back to a simple SVG if missing).
function ThumbsDown({ className, fill }: { className?: string; fill?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill={fill === "currentColor" ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M17 14V2" />
      <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H17v12" />
      <path d="M17 22a2 2 0 0 0 2-2v-3.17a2 2 0 0 0-.59-1.41L17 14H9l1 4.12A2 2 0 0 0 11.95 20.5L13 22Z" />
    </svg>
  );
}

// Avoid unused-import lint warning if lucide-react version differs
export type { LucideIcon };