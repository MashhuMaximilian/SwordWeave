"use client";
import { useCallback, useEffect, useState } from "react";
import { Check, MessageSquare, RefreshCw, Send, X } from "lucide-react";
import { DraftChangeReview } from "./draft-change-review";
import type { ReviewPreview } from "./draft-change-review-model";
export { DraftChangeReview } from "./draft-change-review";
import type { CharacterPermission } from "@/lib/character/permission-policy";
import type { WorkspaceDraft } from "@/lib/character/workspace/draft-types";
import type { CharacterCollaborationState, CharacterDraftProposal } from "@/lib/character/workspace/collaboration-types";

type ProposalPreview = ReviewPreview;

interface Props {
  characterId: string;
  permission: CharacterPermission;
  draft?: WorkspaceDraft | null | undefined;
  onApplied?: (() => void) | undefined;
}

/** Same character route and same draft: collaborators submit; owners review the entire connected change set. */
export function DraftCollaborationPanel({ characterId, permission, draft, onApplied }: Props) {
  const [state, setState] = useState<CharacterCollaborationState | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, ProposalPreview>>({});
  const url = `/api/characters/${characterId}/workspace/collaboration`;
  const refresh = useCallback(async () => {
    try {
      const response = await fetch(url, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load review activity.");
      setState(data as CharacterCollaborationState);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not load reviews."); }
  }, [url]);
  useEffect(() => { void refresh(); }, [refresh]);
  async function send(body: object) {
    setBusy(true); setError(null); setMessage(null);
    try {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "The request could not be completed.");
      await refresh();
      return data as { preview?: ProposalPreview; proposal?: CharacterDraftProposal };
    } catch (error) { setError(error instanceof Error ? error.message : "Could not complete the request."); return null; }
    finally { setBusy(false); }
  }
  async function decide(proposal: CharacterDraftProposal, action: "approve" | "reject" | "withdraw" | "preview") {
    const data = await send({ action, proposalId: proposal.id, note });
    if (data?.preview) setPreviews(previous => ({ ...previous, [proposal.id]: data.preview! }));
    if (data?.proposal) {
      setMessage(action === "approve" ? "Changes applied together. The live sheet is updated." : action === "reject" ? "Proposal declined. The character is unchanged." : "Proposal withdrawn.");
      if (action === "approve") onApplied?.();
    }
  }
  return <details className="v12-panel mt-4 rounded-xl border border-[var(--sw-border,#a98a47)] p-4">
    <summary className="flex cursor-pointer items-center gap-2 font-semibold text-[var(--sw-gold,#e6c778)]"><MessageSquare size={17}/>Review with your group {state && <span className="ml-auto text-sm">{state.proposals.filter(p => p.status === "pending").length} pending</span>}</summary>
    <div className="mt-4 space-y-4">
      <p className="text-sm text-muted-foreground">Proposals stay separate from the live character until its owner applies them. A review covers one saved build; later changes need another review.</p>
      {permission !== "VIEWER" && <>
        <label className="block text-sm">A note for your group<textarea className="mt-1 w-full rounded-md border border-border bg-background p-2" rows={2} maxLength={2000} value={note} onChange={event => setNote(event.target.value)} placeholder="What changed, or what you would like checked…"/></label>
        <div className="flex flex-wrap gap-2">
          {permission !== "OWNER" && <button className="v12-btn-primary" disabled={busy || !draft?.operations.length} onClick={async () => {
            if (!draft) return;
            const data = await send({ action: "submit", draftId: draft.id, version: draft.version, rationale: note, requestId: crypto.randomUUID() });
            if (data) setMessage("Proposed changes sent. Your draft is kept; the owner decides whether to apply them.");
          }}><Send size={14}/>Send proposed changes</button>}
          <button className="v12-btn-ghost" disabled={busy || !state} onClick={async () => { const result = await send({ action: "reviewed", revision: state?.revision, note }); if (result) setMessage("Marked this saved build reviewed."); }}><Check size={14}/>Mark saved build reviewed</button>
          <button className="v12-btn-ghost" disabled={busy} onClick={() => void refresh()}><RefreshCw size={14}/>Refresh</button>
        </div>
      </>}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {message && <p role="status" className="text-sm text-teal-200">{message}</p>}
      {state?.reviews.map(review => <div key={review.reviewerId} className="rounded-md border border-border p-3 text-sm"><strong>{!review.changedSinceReview ? "Reviewed at this revision" : "Changed since review"}</strong> · {review.reviewerName} · Build {review.revision} · {new Date(review.reviewedAt).toLocaleDateString()}{review.note && <p>{review.note}</p>}</div>)}
      {state?.proposals.length === 0 && <p className="text-sm text-muted-foreground">No proposed changes yet. Use Share to invite someone with “Can suggest” access.</p>}
      {state?.proposals.map(proposal => {
        const stale = proposal.baseRevision !== state.revision;
        const preview = previews[proposal.id];
        return <article key={proposal.id} className="rounded-lg border border-border bg-background/60 p-3">
          <div className="flex flex-wrap justify-between gap-2"><strong>{proposal.operations.length} proposed {proposal.operations.length === 1 ? "change" : "changes"}</strong><span className="text-xs uppercase text-muted-foreground">{proposal.status} · {proposal.authorName} · Build {proposal.baseRevision}</span></div>
          {proposal.rationale && <p className="my-2 text-sm">{proposal.rationale}</p>}
          <ol className="my-2 list-inside list-decimal text-sm">{proposal.operations.map(operation => <li key={operation.id}>{operation.label ?? (operation.type === "create" ? `Add ${operation.payload.kind}` : (operation.type === "move-root" || operation.type === "relocate") ? `Move to ${operation.category.toLowerCase()}` : operation.type === "character" ? "Update character details" : String(operation.payload["type"] ?? "Change a rule"))}</li>)}</ol>
          <p className="text-xs text-muted-foreground">These changes are reviewed together so connected rules and abilities stay intact.</p>
          {stale && proposal.status === "pending" && <p className="mt-2 text-sm text-amber-200">The saved build changed. Refresh and resubmit this proposal before applying it.</p>}
          {preview && <DraftChangeReview preview={preview}/>}
          {proposal.status === "pending" && <div className="mt-3 flex flex-wrap gap-2">
            <button className="v12-btn-ghost" disabled={busy || stale} onClick={() => void decide(proposal,"preview")}>Preview changes</button>
            {permission === "OWNER" ? <>
              <button className="v12-btn-primary" disabled={busy || stale || !preview} onClick={() => void decide(proposal,"approve")}><Check size={14}/>Apply proposal</button>
              <button className="v12-btn-ghost" disabled={busy} onClick={() => void decide(proposal,"reject")}><X size={14}/>Decline</button>
            </> : <button className="v12-btn-ghost" disabled={busy} onClick={() => void decide(proposal,"withdraw")}>Withdraw</button>}
          </div>}
          {proposal.reviewerNote && <p className="mt-2 text-sm">Review note: {proposal.reviewerNote}</p>}
        </article>;
      })}
    </div>
  </details>;
}
