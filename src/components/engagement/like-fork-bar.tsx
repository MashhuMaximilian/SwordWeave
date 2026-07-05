"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Heart,
  GitFork,
  Flag,
  UserPlus,
  UserMinus,
  Star,
  type LucideIcon,
} from "lucide-react";

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
    | "CAPABILITY"
    | "CHARACTER"
    | "ITEM"
    | "RACE_TEMPLATE"
    | "BACKGROUND_TEMPLATE"
    | "ARCHETYPE_TEMPLATE";
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

  const isAuthed = Boolean(props.currentUserId);
  const isOwnContent =
    props.authorId != null && props.authorId === props.currentUserId;
  const showFollow = !isOwnContent && props.authorId != null;
  const netRating = likes - dislikes;

  // ---------- handlers ----------

  const requireAuth = (): boolean => {
    if (isAuthed) return true;
    // Redirect to Clerk sign-in
    window.location.href = "/sign-in";
    return false;
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
        const res = await fetch("/api/reactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetType: props.targetType,
            targetId: props.targetId,
            ...(props.versionId ? { versionId: props.versionId } : {}),
            kind: "LIKE",
          }),
        });
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
        const res = await fetch("/api/reactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetType: props.targetType,
            targetId: props.targetId,
            ...(props.versionId ? { versionId: props.versionId } : {}),
            kind: "DISLIKE",
          }),
        });
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
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/fork", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetType: props.targetType,
            targetId: props.targetId,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        const data = await res.json();
        setForks(data.forkCount);
        // Optionally navigate to the new fork
        if (data.forkedTargetId) {
          router.push(`/sandbox?forkedFrom=${data.forkedTargetId}`);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to fork");
      }
    });
  };

  const handleFollow = () => {
    if (!requireAuth() || !props.authorId) return;
    const wasFollowing = following;
    setFollowing(!wasFollowing);
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/follows", {
          method: wasFollowing ? "DELETE" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetUserId: props.authorId }),
        });
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
        const res = await fetch("/api/flags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetType: props.targetType,
            targetId: props.targetId,
            ...(props.versionId ? { versionId: props.versionId } : {}),
            reason: flagReason,
            ...(flagReason === "OTHER" && flagNote ? { note: flagNote } : {}),
          }),
        });
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

  const buttonBase =
    "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition disabled:opacity-50";
  const buttonGhost =
    "border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-500 hover:bg-slate-800";
  const buttonActive = "border-cyan-500 bg-cyan-500/10 text-cyan-300";
  const buttonFilled = "border-rose-500 bg-rose-500/10 text-rose-300";

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${props.className ?? ""}`}
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
          className="h-4 w-4"
          fill={userReaction === "LIKE" ? "currentColor" : "none"}
          aria-hidden="true"
        />
        <span className="tabular-nums" aria-hidden="true">{likes}</span>
        <span>like{likes === 1 ? "" : "s"}</span>
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
          className="h-4 w-4"
          fill={userReaction === "DISLIKE" ? "currentColor" : "none"}
          aria-hidden="true"
        />
        <span className="tabular-nums" aria-hidden="true">{dislikes}</span>
        <span>dislike{dislikes === 1 ? "" : "s"}</span>
      </button>

      <button
        type="button"
        onClick={handleFork}
        disabled={pending}
        title="Fork to your sandbox"
        aria-label={`Fork (${forks} ${forks === 1 ? "fork" : "forks"})`}
        className={`${buttonBase} ${buttonGhost}`}
      >
        <GitFork className="h-4 w-4" aria-hidden="true" />
        <span className="tabular-nums" aria-hidden="true">{forks}</span>
        <span>fork{forks === 1 ? "" : "s"}</span>
      </button>

      <span
        className={`${buttonBase} border-slate-700 bg-slate-900/70 text-slate-300`}
        title="Net rating (likes − dislikes)"
        role="status"
        aria-label={`Net rating ${netRating > 0 ? "plus " : ""}${netRating}`}
      >
        <Star className="h-4 w-4" aria-hidden="true" />
        <span className="tabular-nums" aria-hidden="true">
          {netRating > 0 ? "+" : ""}
          {netRating}
        </span>
        <span>rating</span>
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
            <UserMinus className="h-4 w-4" aria-hidden="true" />
          ) : (
            <UserPlus className="h-4 w-4" aria-hidden="true" />
          )}
          <span>
            {following ? "Following" : "Follow"}
          </span>
        </button>
      )}

      <div className="relative">
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
          className={`${buttonBase} ${buttonGhost}`}
        >
          <Flag className="h-4 w-4" aria-hidden="true" />
          <span>Flag</span>
        </button>
        {flagOpen && (
          <div
            role="dialog"
            aria-label="Flag content"
            className="absolute right-0 z-20 mt-2 w-64 rounded-md border border-slate-700 bg-slate-900 p-3 shadow-lg"
          >
            <p className="mb-2 text-xs text-slate-400">Why are you flagging this?</p>
            <div className="space-y-1">
              {FLAG_REASONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFlagReason(opt.value)}
                  className={`w-full rounded px-2 py-1.5 text-left text-sm ${
                    flagReason === opt.value
                      ? "bg-cyan-500/20 text-cyan-200"
                      : "text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {flagReason === "OTHER" && (
              <textarea
                value={flagNote}
                onChange={(e) => setFlagNote(e.target.value)}
                placeholder="Optional note (max 500 chars)"
                maxLength={500}
                className="mt-2 w-full rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200"
                rows={2}
              />
            )}
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={submitFlag}
                disabled={!flagReason || pending}
                className="flex-1 rounded bg-rose-500/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
              >
                Submit
              </button>
              <button
                type="button"
                onClick={() => {
                  setFlagOpen(false);
                  setFlagReason(null);
                  setFlagNote("");
                }}
                className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="w-full text-xs text-rose-400" role="alert">
          {error}
        </p>
      )}
    </div>
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