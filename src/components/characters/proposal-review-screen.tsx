"use client";

// =============================================================================
// ProposalReviewScreen — PLAN Eilxina Part C (Mashu 2026-09-09).
//
// Client component for the proposal review screen. Three panels:
//   1. Header: proposer + rationale + status chip + action buttons.
//   2. Current version card (the slot's pinned version).
//   3. Proposed version card (the new version).
//   4. Diff: field-level changes highlighted side-by-side.
//
// On mobile (per the codebase §0 two-panel-on-mobile rule) the
// three panels collapse into a tab strip — same shape as the
// /characters Part B tabs.
//
// Approve/Reject:
//   - Only OWNER sees the action buttons (Editors see read-only).
//   - APPROVE calls PATCH with { action: "APPROVE" } and on success
//     redirects to the character sheet.
//   - REJECT calls PATCH with { action: "REJECT", note: ... }.
//   - Withdraw (the proposer themselves): only PENDING proposals
//     owned by the viewer can be withdrawn — for Part C we hide
//     the button from the screen and let the proposer hit the
//     API directly. (Future polish.)
// =============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, X, ArrowLeft, GitBranch, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ProposalStatus,
  ProposalTargetKind,
  FieldChange,
} from "@/lib/character/proposal-types";

interface ProposalSummary {
  id: string;
  status: ProposalStatus;
  targetKind: ProposalTargetKind;
  targetId: string;
  rationale: string | null;
  proposer: { username: string; displayName: string | null } | null;
  proposedDiff: { fieldChanges: FieldChange[] };
  createdAt: string;
  reviewedAt: string | null;
  reviewerNote: string | null;
}

interface ProposalReviewScreenProps {
  characterId: string;
  characterName: string;
  viewerPermission: "OWNER" | "EDITOR" | "VIEWER";
  proposal: ProposalSummary;
  currentSnapshot: Record<string, unknown> | null;
  proposedSnapshot: Record<string, unknown> | null;
}

export function ProposalReviewScreen({
  characterId,
  characterName,
  viewerPermission,
  proposal,
  currentSnapshot,
  proposedSnapshot,
}: ProposalReviewScreenProps) {
  const router = useRouter();
  const [reviewNote, setReviewNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"diff" | "current" | "proposed">(
    "diff",
  );

  const isPendingProposal = proposal.status === "PENDING";
  const canApproveReject =
    viewerPermission === "OWNER" && isPendingProposal;

  async function handleDecision(action: "APPROVE" | "REJECT") {
    setError(null);
    try {
      const res = await fetch(
        `/api/characters/${characterId}/proposals/${proposal.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            note: reviewNote.trim() || undefined,
          }),
        },
      );
      const json = (await res.json()) as
        | { status: ProposalStatus; proposalId: string }
        | { error: string };
      if (!res.ok || "error" in json) {
        setError(
          "error" in json
            ? json.error
            : `Decision failed (${res.status}).`,
        );
        return;
      }
      // On APPROVE → character sheet. On REJECT → stay on the screen
      // (the status chip will flip to REJECTED so the user can see).
      if (action === "APPROVE") {
        router.push(`/characters/${characterId}`);
      } else {
        startTransition(() => router.refresh());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
    }
  }

  return (
    <div>
      <Link
        href={`/characters/${characterId}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to {characterName}
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Proposal review
          </p>
          <h1 className="mt-2 text-3xl font-semibold">
            {proposal.targetKind} change on {characterName}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <User className="size-3.5" />
              Proposed by{" "}
              <span className="font-medium text-foreground">
                @{proposal.proposer?.username ?? "unknown"}
              </span>
            </span>
            <span>·</span>
            <span title={proposal.createdAt}>
              {formatRelative(proposal.createdAt)}
            </span>
          </div>
          {proposal.rationale && (
            <blockquote className="mt-4 border-l-2 border-border pl-4 text-sm italic text-muted-foreground">
              {proposal.rationale}
            </blockquote>
          )}
        </div>
        <StatusChip status={proposal.status} />
      </div>

      {/* Tabs (mobile-friendly) */}
      <div
        role="tablist"
        aria-label="Proposal comparison views"
        className="mt-6 flex flex-wrap items-center gap-1 border-b border-border"
      >
        <TabButton
          active={activeTab === "diff"}
          onClick={() => setActiveTab("diff")}
          label="Diff"
        />
        <TabButton
          active={activeTab === "current"}
          onClick={() => setActiveTab("current")}
          label="Current version"
        />
        <TabButton
          active={activeTab === "proposed"}
          onClick={() => setActiveTab("proposed")}
          label="Proposed version"
        />
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {activeTab === "diff" && (
          <DiffPanel
            fieldChanges={proposal.proposedDiff.fieldChanges}
          />
        )}
        {activeTab === "current" && (
          <SnapshotPanel snapshot={currentSnapshot} label="Current" />
        )}
        {activeTab === "proposed" && (
          <SnapshotPanel snapshot={proposedSnapshot} label="Proposed" />
        )}
      </div>

      {/* Decision area (OWNER + PENDING only) */}
      {canApproveReject && (
        <div className="mt-8 border-t border-border pt-6">
          <h2 className="text-lg font-semibold">Decision</h2>
          <textarea
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            placeholder="Optional review note (shown to the proposer)…"
            className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            rows={3}
          />
          {error && (
            <p className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleDecision("APPROVE")}
              disabled={isPending}
              className="flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Check className="size-4" />
              Approve and apply
            </button>
            <button
              type="button"
              onClick={() => handleDecision("REJECT")}
              disabled={isPending}
              className="flex items-center gap-1 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-card disabled:opacity-50"
            >
              <X className="size-4" />
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Already-reviewed notice */}
      {!isPendingProposal && (
        <div className="mt-8 border-t border-border pt-6 text-sm text-muted-foreground">
          <p>
            This proposal is{" "}
            <span className="font-medium text-foreground">
              {proposal.status}
            </span>
            {proposal.reviewedAt && (
              <>
                {" "}
                <span title={proposal.reviewedAt}>
                  ({formatRelative(proposal.reviewedAt)})
                </span>
              </>
            )}
            .{" "}
            {proposal.reviewerNote && (
              <>
                Reviewer note:{" "}
                <span className="italic">"{proposal.reviewerNote}"</span>
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: ProposalStatus }) {
  const map: Record<ProposalStatus, { label: string; className: string }> = {
    PENDING: {
      label: "Pending review",
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    },
    APPROVED: {
      label: "Approved",
      className: "bg-green-500/15 text-green-700 dark:text-green-300",
    },
    REJECTED: {
      label: "Rejected",
      className: "bg-destructive/15 text-destructive",
    },
    APPLIED: {
      label: "Applied",
      className: "bg-green-500/15 text-green-700 dark:text-green-300",
    },
    SUPERSEDED: {
      label: "Superseded",
      className: "bg-secondary text-secondary-foreground",
    },
  };
  const v = map[status];
  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-xs font-bold",
        v.className,
      )}
    >
      {v.label}
    </span>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "relative -mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function DiffPanel({ fieldChanges }: { fieldChanges: FieldChange[] }) {
  if (fieldChanges.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No field-level differences detected. (Complex nested fields
        may have changed — see the Current / Proposed tabs.)
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="bg-secondary text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Field</th>
            <th className="px-3 py-2 text-left">Before</th>
            <th className="px-3 py-2 text-left">After</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {fieldChanges.map((c) => (
            <tr key={c.field}>
              <td className="px-3 py-2 font-mono font-medium">
                <GitBranch className="mr-1 inline size-3.5 text-muted-foreground" />
                {c.field}
              </td>
              <td className="px-3 py-2 text-muted-foreground line-through">
                {formatValue(c.from)}
              </td>
              <td className="px-3 py-2 font-medium">
                {formatValue(c.to)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SnapshotPanel({
  snapshot,
  label,
}: {
  snapshot: Record<string, unknown> | null;
  label: string;
}) {
  if (!snapshot) {
    return (
      <p className="text-sm text-muted-foreground">
        {label} snapshot unavailable.
      </p>
    );
  }
  // Show the snapshot as a 2-column key/value list. Skip very long
  // string fields (descriptions) — they're rendered compactly.
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="bg-secondary text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Field</th>
            <th className="px-3 py-2 text-left">Value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {Object.entries(snapshot).map(([k, v]) => (
            <tr key={k}>
              <td className="px-3 py-2 font-mono font-medium">{k}</td>
              <td className="px-3 py-2">{formatValue(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") {
    if (v.length > 200) return v.slice(0, 200) + "…";
    return v;
  }
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return "(complex)";
  }
}

function formatRelative(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const seconds = Math.floor((Date.now() - t) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
