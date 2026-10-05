import {
  authoringReferences,
  assertAuthoringReferenceAccess,
} from "@/lib/publishing/assert-authoring-references";
import { auth } from "@clerk/nextjs/server";
import { readBoundedJson, RequestSizeError } from "@/lib/http/read-bounded-json";
import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db, withDatabaseTransaction } from "@/db/client";
import {
  collections,
  setSourceCollection,
  collectionTargetTables,
  collectionEntries,
} from "./service";
class RejectedSourceSave extends Error {
  constructor(readonly response: Response) {
    super("Save rejected");
  }
}
/** Keep collection membership separate from free text source and fork provenance. */
export async function withSourceCollection(
  request: Request,
  type: string,
  work: () => Promise<Response>,
) {
  let data: Record<string, unknown>;
  try { data = await readBoundedJson(request.clone()) as Record<string, unknown>; }
  catch (error) {
    return NextResponse.json({ error: error instanceof RequestSizeError ? error.message : "Invalid JSON body." },
      { status: error instanceof RequestSizeError ? 413 : 400 });
  }
  if (!data || typeof data !== "object" || Array.isArray(data))
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  const source = data["sourceCollectionId"];
  if (authoringReferences(data).length) {
    const { userId: actorId } = await auth();
    if (!actorId)
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    try {
      await assertAuthoringReferenceAccess(request, type, data, actorId);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Selected component unavailable",
        },
        { status: 400 },
      );
    }
  }
  if (source === undefined) return work();
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (
    source !== null &&
    (typeof source !== "string" || !/^[-0-9a-f]{36}$/i.test(source))
  )
    return NextResponse.json(
      { error: "Invalid source collection" },
      { status: 400 },
    );
  const [owned] =
    source === null
      ? [null]
      : await db
          .select()
          .from(collections)
          .where(
            and(eq(collections.id, source), eq(collections.ownerId, userId)),
          );
  if (source !== null && (!owned || owned.systemKind))
    return NextResponse.json(
      { error: "Select your own custom source collection" },
      { status: 400 },
    );
  try {
    return await withDatabaseTransaction(async () => {
      const response = await work();
      if (!response.ok) throw new RejectedSourceSave(response);
      const payload = await response.clone().json();
      const entity =
        payload.primitive ??
        payload.effect ??
        payload.capability ??
        payload.item ??
        payload.template ??
        payload.character ??
        payload.build ??
        payload.monster;
      let resolved =
        type === "HERITAGE" ? `${entity?.kind ?? data["kind"]}_TEMPLATE` : type;
      let targetId = entity?.id;
      if (!targetId && payload.dispatchOutcome?.kind === "no-op") {
        targetId =
          data["sourceId"] ??
          data["id"] ??
          new URL(request.url).pathname.split("/").at(-1);
        const table =
          type === "HERITAGE" ? "heritage" : collectionTargetTables[resolved];
        if (table && targetId) {
          const rows = await db.execute(
            sql`SELECT id,user_id${type === "HERITAGE" ? sql`,kind` : sql``} FROM ${sql.identifier(table)} WHERE id::text=${String(targetId)}`,
          );
          const row = rows.rows[0];
          if (type === "HERITAGE" && row) resolved = `${row["kind"]}_TEMPLATE`;
          if (!row || row["user_id"] !== userId) {
            // An unchanged borrowed entry can be bookmarked, but its author's source stays authoritative.
            if (source && row) {
              await db
                .insert(collectionEntries)
                .values({
                  collectionId: source,
                  targetType: resolved,
                  targetId: String(targetId),
                })
                .onConflictDoNothing();
            }
            return response;
          }
          if (type === "HERITAGE") resolved = `${row["kind"]}_TEMPLATE`;
        } else targetId = null;
      }
      if (targetId)
        await setSourceCollection(userId, resolved, String(targetId), source);
      return response;
    });
  } catch (error) {
    if (error instanceof RejectedSourceSave) return error.response;
    throw error;
  }
}
