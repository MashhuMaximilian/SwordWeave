import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { meetsCharacterPermission, type CharacterPermission } from "@/lib/character/permission-policy";
import { canonicalJsonStringify } from "@/lib/publishing/hash-content";
import type { McpActor } from "./auth";
import { characterToolsEnabled, type McpConfig } from "./config";

const creation = { scope: "swordweave:create", group: null, permission: null } as const;
const editing = { scope: "swordweave:edit", group: "EDIT", permission: "EDITOR" } as const;
const playing = { scope: "swordweave:play", group: "PLAY", permission: "EDITOR" } as const;

const policies = {
  character_create: creation,
  progression_pdf: creation,
  progression_note: { ...creation, permission: "EDITOR" },
  character_edit: editing,
  character_piece: { ...editing, permission: "OWNER" },
  character_advancement: { ...editing, permission: "OWNER" },
  character_proposal_submit: { ...editing, permission: "SUGGESTER" },
  character_proposal_decide: { ...editing, permission: "SUGGESTER" },
  character_version_proposal_submit: { ...editing, permission: "SUGGESTER" },
  character_version_proposal_decide: { ...editing, permission: "OWNER" },
  session_note: playing,
  session_play_action: playing,
} as const;

export type OperationKind = keyof typeof policies;
export type OperationChannel = "mcp" | "browser";
export const operationUuid = z.string().regex(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i).transform(value => value.toLowerCase());
export const MAX_CHANGED_SLOT_IDS = 50;
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const revision = z.number().int().nonnegative();
const character = z.object({ characterId: operationUuid });
const note = character.extend({ appliedRevision: revision, appendedDigest: sha256 });
const proposal = character.extend({ proposalId: operationUuid });
export const versionProposalReceipt = proposal.extend({
  status: z.enum(["PENDING", "APPLIED", "REJECTED"]),
  decision: z.enum(["approve", "reject"]).optional(),
  appliedRevision: revision.optional(),
});
export const workspaceProposalReceipt = character.extend({
  proposalId: z.string().min(10).max(240).startsWith("proposal:"),
  status: z.enum(["pending", "applied", "rejected", "withdrawn"]),
  decision: z.enum(["approve", "reject", "withdraw"]).optional(),
  appliedRevision: revision.optional(),
});
export function isWorkspaceProposalOperation(kind: string): kind is "character_proposal_submit" | "character_proposal_decide" {
  return kind === "character_proposal_submit" || kind === "character_proposal_decide";
}
export function isVersionProposalOperation(kind: string): kind is "character_version_proposal_submit" | "character_version_proposal_decide" {
  return kind === "character_version_proposal_submit" || kind === "character_version_proposal_decide";
}

export const characterAdvancementReceipt = character.extend({
  appliedRevision: revision, fromLevel: z.number().int().positive(), level: z.number().int().positive(),
  progressionPool: z.number(), progressionSpent: z.number(), progressionRemaining: z.number(), dmBonusBu: z.literal(0),
  ordinarySpent: z.number(), debtUsed: z.number(), uncoveredExcess: z.number(), itemBuSpent: z.number(),
  proficiencyBonus: z.number(), maxVitality: z.number(), volatilityCeiling: z.number(),
});

export const characterPieceReceipt = character.extend({
  appliedRevision: revision, entityKind: z.enum(["primitive", "capability", "effect", "heritage", "item"]),
  entityId: z.string().min(1).max(36), versionPin: operationUuid,
});

const receiptSchemas = {
  character_create: character,
  progression_pdf: z.object({ documentId: operationUuid }),
  progression_note: note,
  character_edit: character.extend({ appliedRevision: revision, changedSlotIds: z.array(z.string().max(160)).max(MAX_CHANGED_SLOT_IDS) }),
  character_piece: characterPieceReceipt,
  character_advancement: characterAdvancementReceipt,
  character_proposal_submit: workspaceProposalReceipt,
  character_proposal_decide: workspaceProposalReceipt,
  character_version_proposal_submit: versionProposalReceipt.extend({ status: z.literal("PENDING") }),
  character_version_proposal_decide: versionProposalReceipt.extend({
    status: z.enum(["APPLIED", "REJECTED"]), decision: z.enum(["approve", "reject"]),
  }),
  session_note: note,
  session_play_action: z.union([
    character.extend({ appliedRevision: revision, vitality: z.number().int().nonnegative() }),
    character.extend({ occurrenceId: z.string().min(1).max(200), occurrenceRevision: revision }),
    character.extend({ applicationId: operationUuid, occurrenceIds: z.array(operationUuid).min(1).max(20),
      previousVitality: z.number().int().nonnegative(), currentVitality: z.number().int().nonnegative(), applied: z.number().int() }),
  ]),
};

export type OperationReceipt = z.output<(typeof receiptSchemas)[OperationKind]>;

export function parseOperationReceipt(kind: OperationKind, value: unknown): OperationReceipt | null {
  const result = receiptSchemas[kind].safeParse(value);
  return result.success ? result.data : null;
}

export function isOperationKind(value: string): value is OperationKind {
  return Object.hasOwn(policies, value);
}

export function allowsOperationRole(kind: OperationKind, permission: CharacterPermission | null, config?: McpConfig): boolean {
  const required = policies[kind].permission;
  if (required && config?.privateTest) return permission === "OWNER";
  return required === null || (permission !== null && meetsCharacterPermission(permission, required));
}

const supportedPlayPayload = z.object({ action: z.object({ kind: z.enum(["set_current_vitality", "record_consequence", "resolve_consequence", "apply_consequence_package"]) }) });
export function isOwnerOnlyPlayPayload(payload: unknown): boolean {
  const parsed = supportedPlayPayload.safeParse(payload);
  return parsed.success && parsed.data.action.kind !== "set_current_vitality";
}

export function allowsOperationPayload(kind: OperationKind, payload: unknown, permission: CharacterPermission | null): boolean {
  if (kind === "character_proposal_decide") {
    const parsed = z.object({ decision: z.enum(["approve", "reject", "withdraw"]) }).safeParse(payload);
    return parsed.success && (parsed.data.decision === "withdraw" || permission === "OWNER");
  }
  if (kind !== "session_play_action") return true;
  const parsed = supportedPlayPayload.safeParse(payload);
  return parsed.success && (parsed.data.action.kind === "set_current_vitality" || permission === "OWNER");
}

export function stagingReviewEnabled(config: McpConfig, env = globalThis.process.env): boolean {
  return env["MCP_STAGING_REVIEW_ENABLED"] === "true" && config.fixtureUserIds.length === 2;
}

export function isStagingOperationActor(config: McpConfig, actor: McpActor): boolean {
  return stagingReviewEnabled(config) && config.fixtureUserIds.includes(actor.id);
}

export function browserReviewEnabled(config: McpConfig): boolean {
  return stagingReviewEnabled(config) || !!config.privateTest;
}

export function canUseBrowserReview(config: McpConfig, actor: McpActor): boolean {
  return config.privateTest ? config.privateTest.userIds.includes(actor.id) : isStagingOperationActor(config, actor);
}

export function browserApprovalSource(config: McpConfig): "staging_browser" | "private_test_browser" {
  return config.privateTest ? "private_test_browser" : "staging_browser";
}

export function versionProposalWritesEnabled(config: McpConfig, env = globalThis.process.env): boolean {
  return stagingReviewEnabled(config, env) && config.readEnabled && config.writeEnabled &&
    env["MCP_CHARACTER_EDIT_READ_ENABLED"] === "true" && env["MCP_CHARACTER_EDIT_WRITE_ENABLED"] === "true" &&
    env["MCP_CHARACTER_VERSION_PROPOSAL_READS_ENABLED"] === "true" && env["MCP_CHARACTER_VERSION_PROPOSAL_WRITE_ENABLED"] === "true";
}

export function permitsOperation(
  config: McpConfig,
  actor: McpActor,
  kind: OperationKind,
  action: "read" | "write",
  channel: OperationChannel,
): boolean {
  const { scope, group } = policies[kind];
  if (!config.readEnabled || (channel === "mcp" && !actor.scopes.includes("swordweave:read"))) return false;
  if (group && !characterToolsEnabled(config, group, "READ")) return false;
  if (config.privateTest && (!canUseBrowserReview(config, actor) || isWorkspaceProposalOperation(kind) || isVersionProposalOperation(kind))) return false;
  if (isVersionProposalOperation(kind) && (!isStagingOperationActor(config, actor) ||
    globalThis.process.env["MCP_CHARACTER_VERSION_PROPOSAL_READS_ENABLED"] !== "true" ||
    (action === "write" && !versionProposalWritesEnabled(config)))) return false;
  if (channel === "browser" && !canUseBrowserReview(config, actor)) return false;
  if (action === "read") return true;
  return canUseBrowserReview(config, actor) && config.writeEnabled &&
    (channel === "browser" || (actor.scopes.includes(scope) &&
      (kind !== "character_piece" || actor.scopes.includes(creation.scope)))) &&
    (!group || characterToolsEnabled(config, group, "WRITE"));
}

export function digestText(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function digestJson(value: unknown): string {
  return digestText(canonicalJsonStringify(value));
}

export function sameDigest(expected: unknown, supplied: unknown): boolean {
  const left = sha256.safeParse(expected);
  const right = sha256.safeParse(supplied);
  return left.success && right.success && timingSafeEqual(Buffer.from(left.data, "hex"), Buffer.from(right.data, "hex"));
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
export const operationNonceLifetime = 10 * 60 * 1000;

export function operationExpiry(kind: OperationKind, action: "prepare" | "approve" | "advance" | "finish", now: Date, original?: Date): Date {
  if (action === "prepare") return new Date(now.getTime() + (kind === "progression_pdf" ? HOUR : DAY));
  if (kind === "character_create") return new Date(now.getTime() + 90 * DAY);
  if (action === "finish" && kind !== "progression_pdf") return new Date(now.getTime() + 30 * DAY);
  if (!original) throw new Error("An existing operation needs its existing deadline");
  return original;
}
