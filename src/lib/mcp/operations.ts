import { randomBytes, randomUUID } from "node:crypto";
import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { db, withDatabaseTransaction } from "@/db/client";
import { capabilities, capabilityVersions, characters, companionOperations, companionOperationSteps, companionProgressionDocuments, primitives, primitiveVersions, users } from "@/db/schema";
import { acquirePublishingLock } from "@/lib/publishing/save-transaction";
import { resolveMcpActor, type McpActor } from "./auth";
import { getMcpConfig, type McpConfig } from "./config";
import { getCatalogueCursorSecret } from "./catalogue";
import { characterSheetPdfPath } from "./character-sheet-pdf";
import { assertPinnedCreationReviewCurrent, StaleCharacterCreationError } from "./proposal";
import { CharacterContextUnavailable, characterSheetUrl, requireCharacterAccess } from "./context-shared";
import {
  allowsOperationPayload, allowsOperationRole, digestJson, digestText, isOperationKind, isOwnerOnlyPlayPayload, isVersionProposalOperation, isWorkspaceProposalOperation, operationExpiry, operationNonceLifetime,
  operationUuid, parseOperationReceipt, permitsOperation, sameDigest, workspaceProposalReceipt, type OperationChannel,
  type OperationKind, type OperationReceipt,
} from "./operation-policy";

export type { OperationKind } from "./operation-policy";

type OperationRow = typeof companionOperations.$inferSelect;
type StepRow = typeof companionOperationSteps.$inferSelect;
const subjectSchema = z.object({
  kind: z.enum(["character", "proposal", "creation_series", "progression_series"]),
  id: operationUuid,
  characterId: operationUuid.nullable(),
});
type Subject = z.infer<typeof subjectSchema>;
const documentSchema = z.object({ title: z.string().trim().min(1).max(200), ideas: z.array(z.string().trim().min(1).max(500)).min(1).max(10) });
type ProgressionDocument = z.infer<typeof documentSchema>;
type ProjectedProposalReceipt = Awaited<ReturnType<typeof import("./proposal-actions").projectWorkspaceProposalReceipt>>;
type ProjectedVersionProposalReceipt = Awaited<ReturnType<typeof import("./version-proposal-actions").projectVersionProposalReceipt>>;
const stepKind = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/);
const reviewedStep = z.object({ id: operationUuid, kind: stepKind });
const reviewSchema = z.object({ version: z.literal(1), operationId: operationUuid, ownerId: operationUuid,
  kind: z.string(), subject: subjectSchema, summary: z.unknown(), payload: z.unknown(), steps: z.array(reviewedStep).max(20) });
type Review = z.infer<typeof reviewSchema>;
const failureCodes = z.enum(["STALE_REVIEW", "DEPENDENCY_UNAVAILABLE", "CONFLICT", "VALIDATION_FAILED", "UNSUPPORTED_STEP"]);
type OperationFailureCode = z.infer<typeof failureCodes>;
const statuses = z.enum(["pending_approval", "approved", "completed", "blocked", "superseded"]);
const versionedReceipt = z.object({ version: z.literal(1), receipt: z.unknown() });
const failedReceipt = z.object({ version: z.literal(1), failureCode: failureCodes, ownerOnly: z.boolean().optional() });
const versionPin = operationUuid.optional();
const creationStepReceipt = z.discriminatedUnion("entityKind", [
  z.object({ entityKind: z.literal("primitive"), entityId: z.string().regex(/^[1-9]\d{0,9}$/).refine(id => Number(id) <= 2147483647), versionPin: operationUuid }),
  z.object({ entityKind: z.literal("capability"), entityId: operationUuid, versionPin: operationUuid }),
  z.object({ entityKind: z.enum(["character", "effect", "heritage", "item"]), entityId: operationUuid, versionPin }),
]);

export class OperationUnavailableError extends Error {
  readonly code = "UNAVAILABLE";
  constructor() { super("This operation is unavailable."); }
}

export class OperationBlockError extends Error {
  constructor(readonly code: OperationFailureCode) { super(code); }
}

export class OperationAttemptTimeout extends Error {
  constructor() { super("The save did not finish in time. Check its status before retrying."); }
}

function unavailable(): never {
  throw new OperationUnavailableError();
}

export function operationReviewPath(operationId: string): string {
  return `/companion/review/${operationId}`;
}

function operationDownloadUrl(config: McpConfig, operationId: string): string {
  return new URL(`/api/companion/progression/${operationId}`, config.resource).href;
}

function parseId(id: string): string {
  const result = operationUuid.safeParse(id);
  return result.success ? result.data : unavailable();
}

function readConfig(): McpConfig {
  return getMcpConfig() ?? unavailable();
}

async function activeActor(actor: McpActor, lock = false): Promise<void> {
  if (lock) {
    const [row] = await db.select({ id: users.id }).from(users).where(eq(users.id, actor.id)).for("share");
    if (!row) unavailable();
  }
  if ((await resolveMcpActor(actor))?.id !== actor.id) unavailable();
}

async function verifyReviewDependencies(actor: McpActor, review: Review) {
  try {
    if (review.kind === "character_create") await assertPinnedCreationReviewCurrent(review.payload, actor);
    if (review.kind === "character_edit") {
      const { assertCharacterEditReviewCurrent } = await import("./character-edits");
      await assertCharacterEditReviewCurrent(review.payload, actor);
    }
    if (review.kind === "character_advancement") {
      const { assertAdvancementReviewCurrent } = await import("./character-advancement");
      await assertAdvancementReviewCurrent(review.payload, actor);
    }
    if (review.kind === "character_piece") {
      const { assertCharacterPieceReviewCurrent } = await import("./character-piece");
      await assertCharacterPieceReviewCurrent(review.payload, actor);
    }
    if (review.kind === "session_play_action") {
      const { assertPlayReviewCurrent } = await import("./play-actions");
      await assertPlayReviewCurrent(review.payload, actor);
    }
    if (review.kind === "session_note") {
      const { assertSessionNoteReviewCurrent } = await import("./session-notes");
      await assertSessionNoteReviewCurrent(review.payload, actor);
    }
    if (isWorkspaceProposalOperation(review.kind)) {
      const { assertWorkspaceProposalReviewCurrent } = await import("./proposal-actions");
      await assertWorkspaceProposalReviewCurrent(review.kind, review.payload, actor);
    }
    if (isVersionProposalOperation(review.kind)) {
      const { assertVersionProposalReviewCurrent } = await import("./version-proposal-actions");
      await assertVersionProposalReviewCurrent(review.kind, review.payload, actor);
    }
  } catch (error) {
    if (error instanceof StaleCharacterCreationError || error instanceof CharacterContextUnavailable || error instanceof OperationBlockError) unavailable();
    throw error;
  }
}

async function lockReviewedSubject(row: OperationRow) {
  if (row.characterId) await db.select({ id: characters.id }).from(characters).where(eq(characters.id, row.characterId)).for("update");
  if (row.kind === "character_create" || row.kind === "character_edit" || row.kind === "character_advancement" || row.kind === "character_piece" || row.kind === "session_play_action" ||
    isWorkspaceProposalOperation(row.kind) || isVersionProposalOperation(row.kind)) {
    await acquirePublishingLock();
  }
}

async function lockedOperation<T>(work: () => Promise<T>): Promise<T> {
  return withDatabaseTransaction(async () => {
    await db.execute(sql`set transaction isolation level read committed`);
    return work();
  });
}

async function ownedOperation(actor: McpActor, operationId: string, lock = false): Promise<OperationRow> {
  const query = db.select().from(companionOperations).where(and(eq(companionOperations.id, parseId(operationId)), eq(companionOperations.ownerId, actor.id)));
  const [row] = await (lock ? query.for("update") : query);
  if (!row || row.expiresAt.getTime() <= Date.now() || !isOperationKind(row.kind)) unavailable();
  return row;
}

function policy(config: McpConfig, actor: McpActor, value: string, action: "read" | "write", channel: OperationChannel): OperationKind {
  if (!isOperationKind(value) || !permitsOperation(config, actor, value, action, channel)) unavailable();
  return value;
}

async function subjectPermission(actor: McpActor, characterId: string | null) {
  if (!characterId) return null;
  try {
    return (await requireCharacterAccess(actor, characterId)).permission;
  } catch (error) {
    if (error instanceof CharacterContextUnavailable) unavailable();
    throw error;
  }
}

function reviewFor(row: OperationRow): Review {
  const parsed = reviewSchema.safeParse(row.proposal);
  if (!parsed.success || row.schemaVersion !== 1 || !sameDigest(row.proposalDigest, digestJson(row.proposal))) unavailable();
  const review = parsed.data;
  if (review.operationId !== row.id || review.ownerId !== row.ownerId || review.kind !== row.kind ||
      review.subject.id !== row.subjectId || review.subject.characterId !== row.characterId || review.subject.kind !== row.subjectKind) unavailable();
  return review;
}

async function operationSteps(operationId: string): Promise<StepRow[]> {
  return db.select().from(companionOperationSteps).where(eq(companionOperationSteps.operationId, operationId)).orderBy(asc(companionOperationSteps.ordinal));
}

function exactSteps(review: Review, rows: StepRow[]) {
  if (review.steps.length !== rows.length || review.steps.some((step, i) => rows[i]?.stepId !== step.id || rows[i]?.kind !== step.kind || rows[i]?.ordinal !== i)) unavailable();
}

async function progressionDocument(row: OperationRow, review: Review): Promise<ProgressionDocument> {
  const binding = z.object({ documentId: operationUuid, documentDigest: z.string() }).safeParse(review.payload);
  if (!binding.success || binding.data.documentId !== row.id) unavailable();
  const [stored] = await db.select().from(companionProgressionDocuments).where(eq(companionProgressionDocuments.operationId, row.id));
  const parsed = documentSchema.safeParse(stored);
  if (!stored || !parsed.success || !sameDigest(stored.digest, binding.data.documentDigest) ||
      !sameDigest(stored.digest, digestJson({ title: stored.title, ideas: stored.ideas }))) unavailable();
  return parsed.data;
}

interface PrepareOperationArgs {
  actor: McpActor;
  kind: OperationKind;
  subject: { kind: Subject["kind"]; id?: string; characterId?: string };
  summary: unknown;
  payload: unknown;
  steps?: readonly (string | { kind: string })[];
  supersedesOperationId?: string;
  document?: ProgressionDocument;
}

function resolveSubject(kind: OperationKind, input: PrepareOperationArgs["subject"], previous?: OperationRow): Subject {
  if (kind === "character_create" || kind === "progression_pdf") {
    const seriesKind = kind === "character_create" ? "creation_series" : "progression_series";
    if (input.kind !== seriesKind || input.id || input.characterId) unavailable();
    return { kind: seriesKind, id: previous?.subjectId ?? randomUUID(), characterId: null };
  }
  const characterId = parseId(input.characterId ?? (input.kind === "character" ? input.id ?? "" : ""));
  if (kind === "character_proposal_decide" || kind === "character_version_proposal_decide") {
    if (input.kind !== "proposal") unavailable();
    return { kind: "proposal", id: parseId(input.id ?? ""), characterId };
  }
  if (input.kind !== "character" || (input.id && parseId(input.id) !== characterId)) unavailable();
  return { kind: "character", id: characterId, characterId };
}

export async function prepareOperation(args: PrepareOperationArgs) {
  const { actor, kind, supersedesOperationId } = args;
  const config = readConfig();
  policy(config, actor, kind, "write", "mcp");
  return lockedOperation(async () => {
    const previous = supersedesOperationId ? await ownedOperation(actor, supersedesOperationId, true) : undefined;
    const subject = resolveSubject(kind, args.subject, previous);
    const now = new Date();
    if (previous && (previous.kind !== kind || previous.subjectKind !== subject.kind || previous.subjectId !== subject.id ||
        previous.characterId !== subject.characterId || !["pending_approval", "approved"].includes(previous.status) ||
        (await operationSteps(previous.id)).some(step => step.status === "committed"))) unavailable();
    await activeActor(actor);
    const permission = await subjectPermission(actor, subject.characterId);
    if (!allowsOperationRole(kind, permission) || !allowsOperationPayload(kind, args.payload, permission)) unavailable();
    const id = randomUUID();
    const expiresAt = operationExpiry(kind, "prepare", now);
    const document = kind === "progression_pdf" ? documentSchema.parse(args.document) : undefined;
    const documentDigest = document ? digestJson(document) : undefined;
    const rawSteps = args.steps ?? (kind === "character_create" ? ["character"] : []);
    if (rawSteps.length > 20 || (kind === "character_create" ? rawSteps.length < 1 : rawSteps.length !== 0)) unavailable();
    const steps = rawSteps.map(step => ({ id: randomUUID(), kind: stepKind.parse(typeof step === "string" ? step : step.kind) }));
    const envelope = { version: 1, operationId: id, ownerId: actor.id, kind, subject, summary: args.summary,
      payload: document ? { documentId: id, documentDigest } : args.payload, steps };
    // Normalize to the same value PostgreSQL JSONB will return before hashing it.
    const encoded = JSON.stringify(envelope);
    if (Buffer.byteLength(encoded, "utf8") > 64 * 1024) unavailable();
    const proposal = reviewSchema.parse(JSON.parse(encoded));
    await db.insert(companionOperations).values({ id, ownerId: actor.id, kind, schemaVersion: 1, subjectKind: subject.kind,
      subjectId: subject.id, characterId: subject.characterId, proposal, proposalDigest: digestJson(proposal), status: "pending_approval",
      lastActivityAt: now, expiresAt });
    if (steps.length) await db.insert(companionOperationSteps).values(steps.map((step, ordinal) => ({ operationId: id, stepId: step.id, kind: step.kind, ordinal, status: "pending" })));
    if (document && documentDigest) await db.insert(companionProgressionDocuments).values({ operationId: id, ...document, digest: documentDigest });
    if (previous) {
      await db.update(companionOperations).set({ status: "superseded", supersededBy: id, proposal: null, nonceDigest: null,
        nonceExpiresAt: null, approvedAt: null, approvalSource: null, lastActivityAt: now }).where(eq(companionOperations.id, previous.id));
      if (kind === "progression_pdf") await db.delete(companionProgressionDocuments).where(eq(companionProgressionDocuments.operationId, previous.id));
    }
    return { operationId: id, summary: proposal.summary, approvalUrl: new URL(operationReviewPath(id), config.resource).href, expiresAt: expiresAt.toISOString() };
  });
}

async function projectOperation(config: McpConfig, actor: McpActor, row: OperationRow, channel: OperationChannel) {
  const kind = policy(config, actor, row.kind, "read", channel);
  const state = statuses.parse(row.status);
  await activeActor(actor);
  const permission = await subjectPermission(actor, row.characterId);
  if ((kind === "session_note" || kind === "session_play_action" || kind === "character_advancement" || kind === "character_piece") &&
    !allowsOperationRole(kind, permission)) unavailable();
  const storedReceipt = versionedReceipt.safeParse(row.terminalReceipt);
  const receipt = storedReceipt.success ? parseOperationReceipt(kind, storedReceipt.data.receipt) : null;
  const failure = failedReceipt.safeParse(row.terminalReceipt);
  if (kind === "session_play_action" && permission !== "OWNER" &&
      ((row.proposal && isOwnerOnlyPlayPayload(reviewFor(row).payload)) ||
        (receipt && ("occurrenceId" in receipt || "applicationId" in receipt)) || failure.data?.ownerOnly)) unavailable();
  if (receipt && "characterId" in receipt && receipt.characterId !== row.characterId) await subjectPermission(actor, receipt.characterId);
  const steps = kind === "character_create" ? await operationSteps(row.id) : [];
  const candidates = steps.map(step => creationStepReceipt.safeParse({ entityKind: step.entityKind, entityId: step.entityId, versionPin: step.versionPin ?? undefined }).data);
  const primitiveIds = candidates.flatMap(candidate => candidate?.entityKind === "primitive" ? Number(candidate.entityId) : []);
  const primitivePins = new Set<string>();
  if (primitiveIds.length) {
    const versions = await db.select({ id: primitives.id, versionId: primitiveVersions.id }).from(primitives)
      .innerJoin(primitiveVersions, eq(primitiveVersions.primitiveId, primitives.id)).where(and(
        eq(primitives.userId, actor.clerkId), inArray(primitives.id, primitiveIds),
        inArray(primitiveVersions.id, candidates.flatMap(candidate => candidate?.entityKind === "primitive" ? candidate.versionPin : [])),
      ));
    versions.forEach(version => primitivePins.add(`${version.id}:${version.versionId}`));
  }
  const capabilityReceipts = candidates.filter(candidate => candidate?.entityKind === "capability");
  const capabilityPins = new Set<string>();
  if (capabilityReceipts.length) {
    const versions = await db.select({ id: capabilities.id, versionId: capabilityVersions.id }).from(capabilities)
      .innerJoin(capabilityVersions, eq(capabilityVersions.capabilityId, capabilities.id)).where(and(
        eq(capabilities.userId, actor.clerkId), inArray(capabilities.id, capabilityReceipts.map(candidate => candidate.entityId)),
        inArray(capabilityVersions.id, capabilityReceipts.map(candidate => candidate.versionPin)),
      ));
    versions.forEach(version => capabilityPins.add(`${version.id}:${version.versionId}`));
  }
  const visibleSteps = [];
  for (const [index, step] of steps.entries()) {
    const result = candidates[index];
    if (result?.entityKind === "character" && !(receipt && "characterId" in receipt && result.entityId === receipt.characterId)) {
      await subjectPermission(actor, result.entityId);
    }
    const visible = result?.entityKind === "character" ||
      (result?.entityKind === "primitive" && primitivePins.has(`${result.entityId}:${result.versionPin}`)) ||
      (result?.entityKind === "capability" && capabilityPins.has(`${result.entityId}:${result.versionPin}`));
    visibleSteps.push({ stepId: step.stepId, kind: step.kind, state: step.status,
      result: visible ? result : null,
      failureCode: failureCodes.safeParse(step.failureCode).data ?? null });
  }
  const progressionReady = kind === "progression_pdf" && state === "approved" && row.approvalSource === "staging_browser" &&
    (await progressionDocument(row, reviewFor(row))).ideas.length > 0;
  const writable = permitsOperation(config, actor, kind, "write", channel);
  const canAct = writable && allowsOperationRole(kind, permission) && (state === "pending_approval" || state === "approved") &&
    (!row.proposal || allowsOperationPayload(kind, reviewFor(row).payload, permission));
  const nextStep = state === "approved" && canAct ? visibleSteps.find(step => step.state === "pending") ?? null : null;
  let projectedReceipt: OperationReceipt | ProjectedProposalReceipt | ProjectedVersionProposalReceipt | null = receipt;
  if (receipt && isVersionProposalOperation(kind)) {
    const cursorSecret = getCatalogueCursorSecret();
    if (!cursorSecret) unavailable();
    const { projectVersionProposalReceipt } = await import("./version-proposal-actions");
    projectedReceipt = await projectVersionProposalReceipt(actor, receipt, { resource: config.resource, cursorSecret, versionProposalReads: true });
  } else if (receipt && isWorkspaceProposalOperation(kind)) {
    const cursorSecret = getCatalogueCursorSecret();
    if (!cursorSecret) unavailable();
    const { projectWorkspaceProposalReceipt } = await import("./proposal-actions");
    projectedReceipt = await projectWorkspaceProposalReceipt(actor, workspaceProposalReceipt.parse(receipt), { resource: config.resource, cursorSecret });
  }
  return { operationId: row.id, kind, state, expiresAt: row.expiresAt.toISOString(), receipt: projectedReceipt, steps: visibleSteps,
    failureCode: failure.success ? failure.data.failureCode : null, nextStep,
    nextAction: progressionReady ? "download" : !canAct ? null : state === "pending_approval" ? "review" : state === "approved" ? "execute" : null,
    approvalUrl: state === "pending_approval" && canAct ? new URL(operationReviewPath(row.id), config.resource).href : null,
    downloadUrl: progressionReady ? operationDownloadUrl(config, row.id) : null,
    sheetUrl: receipt && "characterId" in receipt ? characterSheetUrl(config.resource, receipt.characterId) : null,
    ...(kind === "character_create" && receipt && "characterId" in receipt ? {
      sheetPdfUrl: new URL(characterSheetPdfPath(receipt.characterId), config.resource).href,
    } : {}),
    supersededBy: row.supersededBy,
  };
}

export async function getOperationStatus(actor: McpActor, operationId: string, channel: OperationChannel = "mcp") {
  const config = readConfig();
  return projectOperation(config, actor, await ownedOperation(actor, operationId), channel);
}

export async function getOperationReview(actor: McpActor, operationId: string) {
  const config = readConfig();
  return lockedOperation(async () => {
    const row = await ownedOperation(actor, operationId, true);
    const status = await projectOperation(config, actor, row, "browser");
    if (!status.approvalUrl) return { status, confirmation: null };
    const review = reviewFor(row);
    const kind = policy(config, actor, row.kind, "write", "browser");
    await lockReviewedSubject(row);
    await activeActor(actor, true);
    const permission = await subjectPermission(actor, row.characterId);
    if (!allowsOperationRole(kind, permission) || !allowsOperationPayload(kind, review.payload, permission)) unavailable();
    await verifyReviewDependencies(actor, review);
    if (row.expiresAt.getTime() <= Date.now()) unavailable();
    const document = row.kind === "progression_pdf" ? await progressionDocument(row, review) : null;
    exactSteps(review, await operationSteps(row.id));
    const nonce = randomBytes(32).toString("base64url");
    await db.update(companionOperations).set({ nonceDigest: digestText(nonce),
      nonceExpiresAt: new Date(Math.min(Date.now() + operationNonceLifetime, row.expiresAt.getTime())) })
      .where(eq(companionOperations.id, row.id));
    return { status, confirmation: { nonce, digest: row.proposalDigest, summary: review.summary, document,
      // The authenticated review can inspect exactly what the saved envelope will execute.
      payload: document || isWorkspaceProposalOperation(kind) || isVersionProposalOperation(kind) ? null : review.payload } };
  });
}

export async function approveStagingOperation(actor: McpActor, input: { operationId: string; nonce: string; digest: string; origin: string | null }) {
  const config = readConfig();
  if (input.origin !== new URL(config.resource).origin || !/^[a-zA-Z0-9_-]{43}$/.test(input.nonce)) unavailable();
  return lockedOperation(async () => {
    const row = await ownedOperation(actor, input.operationId, true);
    const kind = policy(config, actor, row.kind, "write", "browser");
    await lockReviewedSubject(row);
    await activeActor(actor, true);
    const permission = await subjectPermission(actor, row.characterId);
    if (!allowsOperationRole(kind, permission)) unavailable();
    if (!sameDigest(row.proposalDigest, input.digest)) unavailable();
    if (["approved", "completed", "blocked"].includes(row.status) && row.approvedAt && row.approvalSource === "staging_browser") {
      await projectOperation(config, actor, row, "browser");
      return row.id;
    }
    if (row.status !== "pending_approval" || !row.nonceExpiresAt || row.nonceExpiresAt.getTime() <= Date.now() ||
        !sameDigest(row.nonceDigest, digestText(input.nonce))) unavailable();
    const review = reviewFor(row);
    if (!allowsOperationPayload(kind, review.payload, permission)) unavailable();
    await verifyReviewDependencies(actor, review);
    exactSteps(review, await operationSteps(row.id));
    if (kind === "progression_pdf") await progressionDocument(row, review);
    const now = new Date();
    if (row.expiresAt <= now || row.nonceExpiresAt <= now) unavailable();
    await db.update(companionOperations).set({ status: "approved", approvedAt: now, approvalSource: "staging_browser", nonceDigest: null,
      nonceExpiresAt: null, lastActivityAt: now, expiresAt: operationExpiry(kind, "approve", now, row.expiresAt) })
      .where(eq(companionOperations.id, row.id));
    return row.id;
  });
}

export async function getApprovedProgressionDocument(actor: McpActor, operationId: string, channel: OperationChannel = "mcp") {
  const config = readConfig();
  policy(config, actor, "progression_pdf", "read", channel);
  return lockedOperation(async () => {
    const row = await ownedOperation(actor, operationId, true);
    if (row.kind !== "progression_pdf" || row.status !== "approved" || row.approvalSource !== "staging_browser" || !row.approvedAt) unavailable();
    await activeActor(actor);
    const document = await progressionDocument(row, reviewFor(row));
    if (row.expiresAt.getTime() <= Date.now()) unavailable();
    return document;
  });
}

interface ExecuteOperationArgs {
  actor: McpActor;
  operationId: string;
  expectedKind: OperationKind;
  stepId?: string;
  execute: (input: { payload: unknown; actor: McpActor; subject: Subject; operationId: string; step: { id: string; kind: string } | null }) => Promise<unknown>;
  afterCommit?: () => void;
}

interface Attempt {
  digest: string;
  stepId: string | null;
}

async function eligibleForExecution(args: ExecuteOperationArgs, config: McpConfig, lock: boolean) {
  policy(config, args.actor, args.expectedKind, "write", "mcp");
  const row = await ownedOperation(args.actor, args.operationId, lock);
  if (row.kind !== args.expectedKind || row.kind === "progression_pdf" || row.approvalSource !== "staging_browser" || !row.approvedAt ||
      !["approved", "completed", "blocked"].includes(row.status)) unavailable();
  return row;
}

export async function executeApprovedOperation(args: ExecuteOperationArgs) {
  const config = readConfig();
  const deadline = Date.now() + 10_000;
  // Capture the next step before waiting on the operation lock. A concurrent call for that
  // step can replay it after the first transaction commits. Explicit step IDs also bind retries.
  const initial = await eligibleForExecution(args, config, false);
  const stepId = args.stepId ? parseId(args.stepId) : (await operationSteps(initial.id)).find(step => step.status === "pending")?.stepId;
  let attempted: Attempt | undefined;
  try {
    await lockedOperation(async () => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new OperationAttemptTimeout();
      await db.execute(sql`select set_config('statement_timeout', ${String(remaining)}, true)`);
      const row = await eligibleForExecution(args, config, true);
      if (row.status !== "approved") return;
      const review = reviewFor(row);
      const steps = await operationSteps(row.id);
      exactSteps(review, steps);
      const step = steps.find(candidate => candidate.status === "pending");
      if (steps.length && step?.stepId !== stepId) {
        if (steps.some(candidate => candidate.stepId === stepId && candidate.status === "committed")) return;
        unavailable();
      }
      if (!steps.length && stepId) unavailable();
      await lockReviewedSubject(row);
      await activeActor(args.actor, true);
      const permission = await subjectPermission(args.actor, row.characterId);
      if (!allowsOperationRole(args.expectedKind, permission) || !allowsOperationPayload(args.expectedKind, review.payload, permission)) unavailable();
      if (row.expiresAt.getTime() <= Date.now()) unavailable();
      attempted = { digest: row.proposalDigest, stepId: step?.stepId ?? null };
      const result = await args.execute({ payload: review.payload, actor: args.actor, subject: review.subject,
        operationId: row.id, step: step ? { id: step.stepId, kind: step.kind } : null });
      if (Date.now() >= deadline) throw new OperationAttemptTimeout();
      const now = new Date();
      const complete = !step || steps.every(candidate => candidate.stepId === step.stepId || candidate.status === "committed");
      const resultAsReceipt = parseOperationReceipt(args.expectedKind, result);
      if (step) {
        const stepResult = creationStepReceipt.parse(resultAsReceipt && "characterId" in resultAsReceipt
          ? { entityKind: "character", entityId: resultAsReceipt.characterId }
          : result);
        await db.update(companionOperationSteps).set({ status: "committed", entityKind: stepResult.entityKind, entityId: stepResult.entityId,
          versionPin: stepResult.versionPin ?? null }).where(and(eq(companionOperationSteps.operationId, row.id), eq(companionOperationSteps.stepId, step.stepId)));
      }
      if (complete && (!resultAsReceipt || (row.characterId && "characterId" in resultAsReceipt && resultAsReceipt.characterId !== row.characterId))) {
        throw new Error("The operation returned an invalid durable receipt");
      }
      await db.update(companionOperations).set({ status: complete ? "completed" : "approved", proposal: complete ? null : row.proposal,
        terminalReceipt: complete ? { version: 1, receipt: resultAsReceipt } : null, lastActivityAt: now,
        expiresAt: operationExpiry(args.expectedKind, complete ? "finish" : "advance", now, row.expiresAt) })
        .where(eq(companionOperations.id, row.id));
    });
  } catch (error) {
    if (!(error instanceof OperationBlockError) || !attempted) throw error;
    await recordTerminalBlock(args, config, attempted, error.code);
    return getOperationStatus(args.actor, args.operationId);
  }
  if (attempted) args.afterCommit?.();
  return getOperationStatus(args.actor, args.operationId);
}

async function recordTerminalBlock(args: ExecuteOperationArgs, config: McpConfig, attempted: Attempt, failureCode: OperationFailureCode) {
  return lockedOperation(async () => {
    const row = await eligibleForExecution(args, config, true);
    if (row.status !== "approved" || !sameDigest(row.proposalDigest, attempted.digest)) return;
    const step = (await operationSteps(row.id)).find(candidate => candidate.status === "pending");
    if ((step?.stepId ?? null) !== attempted.stepId) return;
    await activeActor(args.actor);
    const permission = await subjectPermission(args.actor, row.characterId);
    const review = reviewFor(row);
    if (!allowsOperationRole(args.expectedKind, permission) || !allowsOperationPayload(args.expectedKind, review.payload, permission)) unavailable();
    const ownerOnly = args.expectedKind === "session_play_action" && isOwnerOnlyPlayPayload(review.payload);
    if (step) await db.update(companionOperationSteps).set({ status: "blocked", failureCode })
      .where(and(eq(companionOperationSteps.operationId, row.id), eq(companionOperationSteps.stepId, step.stepId)));
    const now = new Date();
    await db.update(companionOperations).set({ status: "blocked", proposal: null, nonceDigest: null,
      nonceExpiresAt: null, terminalReceipt: { version: 1, failureCode, ...(ownerOnly ? { ownerOnly } : {}) }, lastActivityAt: now,
      expiresAt: operationExpiry(args.expectedKind, "finish", now, row.expiresAt) }).where(eq(companionOperations.id, row.id));
  });
}

export async function expireCompanionOperations() {
  let removed = 0;
  for (let batch = 0; batch < 5; batch++) {
    const deleted = await withDatabaseTransaction(async (tx) => {
      const lock = await tx.execute<{ locked: boolean }>(sql`select pg_try_advisory_xact_lock(8842354124) as locked`);
      if (!lock.rows[0]?.locked) return 0;
      const cutoff = new Date();
      const expired = await tx.select({ id: companionOperations.id }).from(companionOperations)
        .where(lte(companionOperations.expiresAt, cutoff)).orderBy(asc(companionOperations.expiresAt), asc(companionOperations.id))
        .limit(200).for("update", { skipLocked: true });
      if (!expired.length) return 0;
      const deleted = await tx.delete(companionOperations)
        .where(and(inArray(companionOperations.id, expired.map(({ id }) => id)), lte(companionOperations.expiresAt, cutoff)))
        .returning({ id: companionOperations.id });
      return deleted.length;
    });
    removed += deleted;
    if (deleted < 200) break;
  }
  return removed;
}
