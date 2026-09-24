import type { PortraitFrame } from "@/lib/character/portrait-frame";
import type { EntityKey, EntityKind, WorkspaceCategory, WorkspaceGraph } from "./model";
import type { CharacterSheet } from "@/lib/engine/sheet";

export type DraftOperation =
  | { id: string; groupId?: string; type: "relocate"; label?: string; path: string[]; destinationPath?: string[]; category: Exclude<WorkspaceCategory, "ALL"> }
  | { id: string; groupId?: string; type: "character"; label?: string; payload: { name?: string; portraitUrl?: string | null; portraitFrame?: PortraitFrame; notes?: string | null; backstory?: Record<string, string>; attrPhysical?: number; attrMental?: number; attrMagical?: number; attrProficient?: "PHYSICAL" | "MENTAL" | "MAGICAL" | null; level?: number; startingBu?: number; size?: "TINY" | "SMALL" | "MEDIUM" | "LARGE" | "HUGE" | "GARGANTUAN"; lineageName?: string | null; lineageDescription?: string | null; upbringingName?: string | null; upbringingDescription?: string | null; manifestName?: string | null; } }
  | { id: string; groupId?: string; type: "create"; label?: string; payload: { kind: EntityKind; category: Exclude<WorkspaceCategory, "ALL">; draft: Record<string, unknown>; mirrored?: boolean; existingId?: string; target?: string; path?: string[]; expectedHash?: string | null } }
  | { id: string; groupId?: string; type: "command"; label?: string; payload: Record<string, unknown> }
  | { id: string; groupId?: string; type: "move-root"; label?: string; target: EntityKey; path: string[]; category: Exclude<WorkspaceCategory, "ALL"> };

export interface WorkspaceDraft {
  id: string;
  authorId: string;
  baseRevision: number;
  version: number;
  operations: DraftOperation[];
  status: "editing" | "applied";
  updatedAt: string;
}
export interface WorkspaceDraftPreview {
  graph: WorkspaceGraph;
  revision: number;
  buSpent: number;
  sheet: CharacterSheet;
  beforeSheet: CharacterSheet;
  results: { operationId: string; result: Record<string, unknown> }[];
  /** True only after the transaction committed. Preview results never change the sheet. */
  applied: boolean;
  warnings?: string[];
  beforeSnapshot?: { foundation: Record<string, unknown>; graph: WorkspaceGraph };
  afterSnapshot?: { foundation: Record<string, unknown>; graph: WorkspaceGraph };
}
