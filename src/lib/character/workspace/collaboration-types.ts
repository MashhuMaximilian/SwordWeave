import type { DraftOperation } from "./draft-types";

export interface CharacterDraftProposal {
  id: string;
  authorId: string;
  authorName?: string;
  baseRevision: number;
  baseHash: string;
  operations: DraftOperation[];
  rationale: string;
  status: "pending" | "applied" | "rejected" | "withdrawn";
  createdAt: string;
  reviewedAt?: string;
  reviewerId?: string;
  reviewerNote?: string;
  appliedRevision?: number;
}
export interface CharacterRevisionReview {
  reviewerId: string;
  reviewerName?: string;
  buildHash?: string;
  changedSinceReview?: boolean;
  revision: number;
  note: string;
  reviewedAt: string;
}
export interface CharacterCollaborationState {
  revision: number;
  proposals: CharacterDraftProposal[];
  reviews: CharacterRevisionReview[];
}

/** A proposal's connected operations are a single dependency group: never partly apply a capability and omit its rules. */
export function validateProposalOperations(operations: unknown): operations is DraftOperation[] {
  if (!Array.isArray(operations) || operations.length === 0 || operations.length > 100) return false;
  const ids = new Set<string>();
  return operations.every(operation => {
    if (!operation || typeof operation !== "object" || typeof operation.id !== "string" || !operation.id || ids.has(operation.id)) return false;
    ids.add(operation.id);
    return ["create", "command", "move-root", "relocate", "character"].includes(operation.type);
  });
}
