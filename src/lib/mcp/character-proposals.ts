import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { and, desc, eq, like, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { characterProposals, characterWorkspaceCommands, characterWorkspaceState } from "@/db/schema";
import { workspaceBuildFingerprint } from "@/lib/character/workspace/drafts";
import { getCatalogueCursorSecret } from "./catalogue";
import { hasUnresolvedGraphDependencies, readVisibleGraph } from "./character-context";
import { readVersionProposalDetails } from "@/lib/character/version-proposal-details";
import {
  characterIdSchema, characterSheetUrl, readOnlyCharacterContext, requireCharacterAccess,
  type CharacterActor, type ContextConfig,
} from "./context-shared";

const kind = "character-draft-proposal";
const tokenInput = z.string().min(1).max(2048);
const nativeId = z.string().min(10).max(240).startsWith("proposal:");
const status = z.enum(["pending", "applied", "rejected", "withdrawn"]);
const baseRevision = z.string().regex(/^(0|[1-9][0-9]{0,9})$/).transform(Number)
  .pipe(z.number().int().nonnegative().max(2_147_483_647));
const sortKey = z.strictObject({ id: nativeId, timestamp: z.string().min(1).max(50) });
const versionSortKey = sortKey.extend({ id: z.uuid() });
const pageSize = 8;

export const listCharacterProposalsInput = z.strictObject({
  characterId: characterIdSchema,
  subtype: z.enum(["workspace", "version"]).optional(),
  cursor: tokenInput.optional(),
});
export const readCharacterProposalInput = z.strictObject({ characterId: characterIdSchema, proposalRef: tokenInput });

export class CharacterProposalUnavailable extends Error {
  constructor() {
    super("This proposal or proposal page is unavailable. Open the character sheet to review proposals.");
  }
}

function proposalAuthority(actor: CharacterActor, characterId: string, config: ContextConfig, subtype: "workspace" | "version" = "workspace") {
  const secret = getCatalogueCursorSecret({ MCP_CURSOR_HMAC_SECRET: config.cursorSecret });
  if (!secret) throw new CharacterProposalUnavailable();
  const key = Buffer.from(hkdfSync("sha256", secret, "swordweave-companion", "proposal-reference-v1", 32));
  function associatedData(purpose: "reference" | "cursor") {
    return Buffer.from(JSON.stringify(["swordweave-proposal-v1", config.resource, purpose, subtype, actor.id, actor.clerkId, characterId]));
  }
  function issue(purpose: "reference" | "cursor", value: unknown) {
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    cipher.setAAD(associatedData(purpose));
    const encrypted = Buffer.concat([cipher.update(JSON.stringify({ expiry: Date.now() + 600_000, value }), "utf8"), cipher.final()]);
    return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString("base64url");
  }
  function resolve<T>(purpose: "reference" | "cursor", token: string, schema: z.ZodType<T>): T {
    try {
      if (!/^[A-Za-z0-9_-]+$/.test(token) || token.length > 2048) throw new CharacterProposalUnavailable();
      const data = Buffer.from(token, "base64url");
      if (data.length < 29 || data.toString("base64url") !== token) throw new CharacterProposalUnavailable();
      const decipher = createDecipheriv("aes-256-gcm", key, data.subarray(0, 12));
      decipher.setAAD(associatedData(purpose));
      decipher.setAuthTag(data.subarray(12, 28));
      const raw = JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8"));
      const { expiry, value } = z.strictObject({ expiry: z.number().int(), value: schema }).parse(raw);
      if (expiry <= Date.now()) throw new CharacterProposalUnavailable();
      return value;
    } catch {
      throw new CharacterProposalUnavailable();
    }
  }
  return { issue, resolve };
}

const proposal = characterWorkspaceCommands;
function proposalScope(actor: CharacterActor, characterId: string, owner: boolean) {
  return and(
    eq(proposal.characterId, characterId),
    eq(proposal.kind, kind),
    sql`${proposal.commandId} = ${proposal.result}->>'id'`,
    like(proposal.commandId, "proposal:%"),
    sql`char_length(${proposal.commandId}) BETWEEN 10 AND 240`,
    owner ? undefined : sql`${proposal.result}->>'authorId' = ${actor.clerkId}`,
  );
}

export function resolveWorkspaceProposalRef(actor: CharacterActor, characterId: string, proposalRef: string, config: ContextConfig) {
  return proposalAuthority(actor, characterId, config).resolve("reference", proposalRef, nativeId);
}

export async function issueAuthorizedWorkspaceProposalRef(actor: CharacterActor, characterId: string, id: string, config: ContextConfig) {
  if (!nativeId.safeParse(id).success) throw new CharacterProposalUnavailable();
  const { permission } = await requireCharacterAccess(actor, characterId);
  const [row] = await db.select({ status: sql<string | null>`${proposal.result}->>'status'` }).from(proposal)
    .where(and(proposalScope(actor, characterId, permission === "OWNER"), eq(proposal.commandId, id))).limit(1);
  const state = status.safeParse(row?.status);
  if (!state.success) throw new CharacterProposalUnavailable();
  return { proposalRef: proposalAuthority(actor, characterId, config).issue("reference", id), currentStatus: state.data };
}

const projection = {
  id: proposal.commandId,
  status: sql<string | null>`${proposal.result}->>'status'`,
  baseRevision: sql<string | null>`${proposal.result}->>'baseRevision'`,
  updatedAt: proposal.updatedAt,
};

const versionProjection = {
  id: characterProposals.id,
  status: characterProposals.status,
  updatedAt: characterProposals.updatedAt,
};

function versionProposalScope(actor: CharacterActor, characterId: string, owner: boolean) {
  return and(
    eq(characterProposals.characterId, characterId),
    owner ? undefined : eq(characterProposals.proposerUserId, actor.clerkId),
  );
}

function summarizeVersion(row: Pick<typeof characterProposals.$inferSelect, "id" | "status" | "updatedAt">,
  authority: ReturnType<typeof proposalAuthority>) {
  return { proposalRef: authority.issue("reference", row.id), subtype: "version" as const,
    status: row.status, updatedAt: row.updatedAt.toISOString() };
}

export function resolveVersionProposalRef(actor: CharacterActor, characterId: string, reference: string, config: ContextConfig) {
  if (config.versionProposalReads !== true) throw new CharacterProposalUnavailable();
  return proposalAuthority(actor, characterId, config, "version").resolve("reference", reference, z.uuid());
}

export async function issueAuthorizedVersionProposalRef(actor: CharacterActor, characterId: string, proposalId: string, config: ContextConfig) {
  if (config.versionProposalReads !== true || !z.uuid().safeParse(proposalId).success) throw new CharacterProposalUnavailable();
  const { permission } = await requireCharacterAccess(actor, characterId);
  const [row] = await db.select(versionProjection).from(characterProposals).where(and(
    versionProposalScope(actor, characterId, permission === "OWNER"), eq(characterProposals.id, proposalId))).limit(1);
  if (!row) throw new CharacterProposalUnavailable();
  return { proposalRef: proposalAuthority(actor, characterId, config, "version").issue("reference", proposalId), currentStatus: row.status };
}

function summarize(row: {
  id: string; status: string | null; baseRevision: string | null; updatedAt: Date;
}, authority: ReturnType<typeof proposalAuthority>) {
  const native = nativeId.safeParse(row.id);
  const state = status.safeParse(row.status);
  const revision = baseRevision.safeParse(row.baseRevision);
  if (!native.success || !state.success || !revision.success) return null;
  return { proposalRef: authority.issue("reference", native.data), subtype: "workspace" as const,
    status: state.data, baseRevision: revision.data, updatedAt: row.updatedAt.toISOString() };
}

export async function listCharacterProposals(actor: CharacterActor, input: z.input<typeof listCharacterProposalsInput>, config: ContextConfig) {
  const { characterId, cursor, subtype = "workspace" } = listCharacterProposalsInput.parse(input);
  const authority = proposalAuthority(actor, characterId, config, subtype);
  if (subtype === "version") {
    if (config.versionProposalReads !== true) throw new CharacterProposalUnavailable();
    const after = cursor ? authority.resolve("cursor", cursor, versionSortKey) : null;
    return readOnlyCharacterContext(async () => {
      const { permission } = await requireCharacterAccess(actor, characterId);
      const rows = await db.select({ ...versionProjection, timestamp: sql<string>`${characterProposals.updatedAt}::text` })
        .from(characterProposals)
        .where(and(versionProposalScope(actor, characterId, permission === "OWNER"),
          after ? sql`(${characterProposals.updatedAt}, ${characterProposals.id}) < (${after.timestamp}::timestamptz, ${after.id}::uuid)` : undefined))
        .orderBy(desc(characterProposals.updatedAt), desc(characterProposals.id)).limit(pageSize + 1);
      const page = rows.slice(0, pageSize);
      const last = page.at(-1);
      const items = page.map(row => summarizeVersion(row, authority));
      const nextCursor = last && rows.length > pageSize ? authority.issue("cursor", { id: last.id, timestamp: last.timestamp }) : null;
      return { characterId, items, nextCursor, sheetUrl: characterSheetUrl(config.resource, characterId) };
    });
  }
  const after = cursor ? authority.resolve("cursor", cursor, sortKey) : null;
  return readOnlyCharacterContext(async () => {
    const { permission } = await requireCharacterAccess(actor, characterId);
    const rows = await db.select({ ...projection, timestamp: sql<string>`${proposal.updatedAt}::text` })
      .from(proposal)
      .where(and(
        proposalScope(actor, characterId, permission === "OWNER"),
        after ? sql`(${proposal.updatedAt}, ${proposal.commandId} COLLATE "C") < (${after.timestamp}::timestamptz, ${after.id}::text COLLATE "C")` : undefined,
      ))
      .orderBy(desc(proposal.updatedAt), desc(sql`${proposal.commandId} COLLATE "C"`)).limit(pageSize + 1);
    const page = rows.slice(0, pageSize);
    const items = page.map(row => summarize(row, authority)).filter(item => item !== null);
    const last = page.at(-1);
    const nextCursor = last && rows.length > pageSize ? authority.issue("cursor", { id: last.id, timestamp: last.timestamp }) : null;
    return { characterId, items, nextCursor, sheetUrl: characterSheetUrl(config.resource, characterId) };
  });
}

export async function readCharacterProposal(actor: CharacterActor, input: z.input<typeof readCharacterProposalInput>, config: ContextConfig) {
  const { characterId, proposalRef } = readCharacterProposalInput.parse(input);
  const authority = proposalAuthority(actor, characterId, config);
  let id: string;
  try {
    id = authority.resolve("reference", proposalRef, nativeId);
  } catch (error) {
    if (!(error instanceof CharacterProposalUnavailable) || config.versionProposalReads !== true) throw error;
    const versionAuthority = proposalAuthority(actor, characterId, config, "version");
    const versionId = resolveVersionProposalRef(actor, characterId, proposalRef, config);
    return readOnlyCharacterContext(async () => {
      const { permission } = await requireCharacterAccess(actor, characterId);
      const [row] = await db.select({
        ...versionProjection,
        characterId: characterProposals.characterId,
        targetKind: characterProposals.targetKind,
        targetId: characterProposals.targetId,
        currentVersionId: characterProposals.currentVersionId,
        proposedVersionId: characterProposals.proposedVersionId,
        instanceId: sql<string | null>`${characterProposals.proposedDiff}->>'instanceId'`,
        description: sql<string | null>`left(${characterProposals.rationale}, 1000)`,
      }).from(characterProposals).where(and(
        versionProposalScope(actor, characterId, permission === "OWNER"), eq(characterProposals.id, versionId))).limit(1);
      if (!row) throw new CharacterProposalUnavailable();
      const details = await readVersionProposalDetails(actor.clerkId, row);
      return { ...summarizeVersion(row, versionAuthority), characterId,
        description: details ? row.description ?? "" : "",
        reviewAvailable: details !== null, ...details, sheetUrl: characterSheetUrl(config.resource, characterId) };
    });
  }
  const metadata = await readOnlyCharacterContext(async () => {
    const { character, permission } = await requireCharacterAccess(actor, characterId);
    const [row] = await db.select({
      ...projection,
      description: sql<string | null>`left(${proposal.result}->>'rationale', 2000)`,
      baseHash: sql<string | null>`${proposal.result}->>'baseHash'`,
    }).from(proposal).where(and(proposalScope(actor, characterId, permission === "OWNER"), eq(proposal.commandId, id))).limit(1);
    const summary = row && summarize(row, authority);
    if (!row || !summary) throw new CharacterProposalUnavailable();
    let stale: boolean | null = null;
    if (summary.status === "pending") {
      const [current] = await db.select({ revision: characterWorkspaceState.revision })
        .from(characterWorkspaceState).where(eq(characterWorkspaceState.characterId, characterId)).limit(1);
      stale = (current?.revision ?? 0) !== summary.baseRevision ? true : null;
      if (stale === null && row.baseHash) {
        const view = await readVisibleGraph(actor, characterId);
        if (!view.restricted && !hasUnresolvedGraphDependencies(view.canonical)) {
          stale = workspaceBuildFingerprint(view.canonical, character) !== row.baseHash;
        }
      }
    }
    return { ...summary, characterId, description: row.description ?? "", stale, sheetUrl: characterSheetUrl(config.resource, characterId) };
  });
  if (metadata.status !== "pending") return { ...metadata, diffState: "not_pending" as const };
  if (metadata.stale === true) return { ...metadata, diffState: "stale" as const };
  const { previewStoredWorkspaceProposal } = await import("./proposal-actions");
  const preview = await previewStoredWorkspaceProposal(actor, characterId, id);
  return { ...metadata, ...preview, stale: preview.diffState === "stale" ? true : metadata.stale };
}
