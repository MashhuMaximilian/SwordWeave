import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db, withDatabaseTransaction } from "@/db/client";
import { characters, characterShares, characterWorkspaceCommands, companionOperations } from "@/db/schema";
import { resolveAuthorByClerkId } from "@/lib/auth/author-resolver";
import { meetsCharacterPermission, permissionFromShare, type CharacterPermission } from "@/lib/character/permission-policy";
import type { McpActor } from "./auth";
import { getCatalogueCursorSecret } from "./catalogue";
import { getMcpRequestConfig } from "./request-config";

export type CharacterActor = Pick<McpActor, "id" | "clerkId">;
export type ContextConfig = { resource: string; cursorSecret: string; versionProposalReads?: boolean };
export const characterIdSchema = z.uuid().transform(value => value.toLowerCase());
export const contextCursorSchema = z.string().min(1).max(8192).optional();

export class CharacterContextUnavailable extends Error {
  constructor() {
    super("This character is unavailable.");
  }
}

export class ContextCursorError extends Error {
  constructor() {
    super("Invalid character context cursor.");
  }
}

export function readOnlyCharacterContext<T>(work: () => Promise<T>): Promise<T> {
  return withDatabaseTransaction(async (tx) => {
    await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`);
    return work();
  });
}

export async function assertCharacterActor(actor: CharacterActor) {
  const account = await resolveAuthorByClerkId(actor.clerkId);
  if (!account || account.id !== actor.id) throw new CharacterContextUnavailable();
}

export const ownsCharacter = (actor: CharacterActor, owner: string | null) =>
  owner === actor.clerkId || owner === actor.id;

export const activeCharacterShare = (actor: CharacterActor) => and(
  eq(characterShares.sharedWithUserId, actor.id),
  eq(characterShares.characterId, characters.id),
  isNull(characterShares.revokedAt),
);

export const characterShareRole = () => and(
  eq(characterWorkspaceCommands.characterId, characters.id),
  eq(characterWorkspaceCommands.commandId, sql`'share-role:' || ${characterShares.id}::text`),
);

export function privateTestCharacterFilter(actor: CharacterActor) {
  if (!getMcpRequestConfig()?.privateTest) return undefined;
  return sql`exists (
    select 1 from ${companionOperations}
    where ${companionOperations.ownerId} = ${actor.id}
      and ${companionOperations.kind} = 'character_create'
      and ${companionOperations.status} = 'completed'
      and ${companionOperations.approvalSource} = 'private_test_browser'
      and ${companionOperations.terminalReceipt}->'receipt'->>'characterId' = ${characters.id}::text
  )`;
}

/** Resolves an exact verified actor without the website's development identity fallback. */
export async function requireCharacterAccess(
  actor: CharacterActor,
  characterId: string,
  minimum: CharacterPermission = "VIEWER",
) {
  if (!characterIdSchema.safeParse(characterId).success) throw new CharacterContextUnavailable();
  await assertCharacterActor(actor);
  const [row] = await db.select({
    character: characters,
    share: { id: characterShares.id, canEdit: characterShares.canEdit },
    shareRole: characterWorkspaceCommands.result,
  }).from(characters)
    .leftJoin(characterShares, activeCharacterShare(actor))
    .leftJoin(characterWorkspaceCommands, characterShareRole())
    .where(and(eq(characters.id, characterId), privateTestCharacterFilter(actor))).limit(1);
  const permission = row && (ownsCharacter(actor, row.character.userId)
    ? "OWNER"
    : row.share ? permissionFromShare(row.share.canEdit, row.shareRole?.["canSuggest"] === true) : null);
  if (!row || !permission || !meetsCharacterPermission(permission, minimum)) {
    throw new CharacterContextUnavailable();
  }
  return { character: row.character, permission };
}

export function characterSheetUrl(resource: string, characterId: string) {
  return new URL(`/characters/${encodeURIComponent(characterId)}`, resource).toString();
}

/** Bind the keyset to its actor and endpoint without putting account IDs in the token. */
export function contextCursor<T>(
  actor: CharacterActor,
  config: ContextConfig,
  purpose: "character-roster" | "character-history",
  key: z.ZodType<T>,
  characterId?: string,
) {
  const { cursorSecret: secret, resource } = config;
  if (!getCatalogueCursorSecret({ MCP_CURSOR_HMAC_SECRET: secret })) throw new ContextCursorError();
  const expiresAfter = 10 * 60 * 1000;
  const envelope = z.strictObject({ expiresAt: z.number().int(), after: key });
  const mac = (value: string) => createHmac("sha256", secret).update(JSON.stringify([
    "swordweave-context-v1", resource, purpose, actor.id, actor.clerkId, characterId ?? null, value,
  ])).digest();
  return {
    sign(after: T): string | null {
      const body = Buffer.from(JSON.stringify({ expiresAt: Date.now() + expiresAfter, after })).toString("base64url");
      const token = `${body}.${mac(body).toString("base64url")}`;
      return token.length <= 8192 ? token : null;
    },
    parse(token: string | undefined): T | null {
      if (token === undefined) return null;
      try {
        const parts = token.split(".");
        if (token.length > 8192 || parts.length !== 2 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) {
          throw new ContextCursorError();
        }
        const [body, encodedSignature] = parts as [string, string];
        const signature = Buffer.from(encodedSignature, "base64url");
        if (signature.toString("base64url") !== encodedSignature || signature.length !== 32 || !timingSafeEqual(signature, mac(body))) {
          throw new ContextCursorError();
        }
        const { expiresAt, after } = envelope.parse(JSON.parse(Buffer.from(body, "base64url").toString("utf8")));
        if (expiresAt <= Date.now()) throw new ContextCursorError();
        return after;
      } catch {
        throw new ContextCursorError();
      }
    },
  };
}
