import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { asc, or, eq, isNull, and } from "drizzle-orm";
import { db } from "@/db/client";
import { primitives } from "@/db/schema";
import {
  isPrimitiveCategory,
  parseHardModifiers,
  type PrimitiveCategoryValue,
} from "@/lib/packages/primitive-package";
import type { HardModifier } from "@/types/swordweave";
import {
  decideSaveOutcome,
  loadPrimitiveOwner,
  type DispatchOutcome,
} from "@/lib/publishing/dispatch-save";
import { parseSaveIntent, type SaveIntent } from "@/lib/publishing/save-intent";
import { computeUniqueForkName } from "@/lib/publishing/fork-naming";
import {
  buildCanonicalPrimitivePayload,
  isPrimitiveDraftEmpty,
} from "@/lib/publishing/hash-content";

export async function GET() {
  const user = await currentUser();
  const rows = await db.query.primitives.findMany({
    where: user
      ? or(
          eq(primitives.isPublic, true),
          isNull(primitives.userId),
          eq(primitives.userId, user.id),
        )
      : or(eq(primitives.isPublic, true), isNull(primitives.userId)),
    orderBy: [asc(primitives.category), asc(primitives.name)],
  });

  return NextResponse.json({ primitives: rows });
}

/**
 * Build a sync-existence set of primitive names the caller has
 * already used for the given category. Used by computeUniqueForkName
 * to walk "(fork)", "(fork) 2", ... without hitting the DB per
 * iteration. Best-effort; the DB's unique constraint is the source
 * of truth and the onConflictDoUpdate below absorbs races.
 */
async function buildTakenNamesSet(
  category: string,
  userId: string,
): Promise<(candidate: string) => boolean> {
  const rows = await db
    .select({ name: primitives.name })
    .from(primitives)
    .where(
      and(eq(primitives.category, category as PrimitiveCategoryValue), eq(primitives.userId, userId)),
    );
  const taken = new Set(rows.map((r) => r.name));
  return (candidate: string) => taken.has(candidate);
}

/**
 * Build the values object shared by every primitive INSERT/UPDATE
 * path. Phase 1 doesn't yet add `source_origin` (that lands in
 * Phase 3's migration 0018); the field exists on capabilities/
 * effects/items/templates but not yet on primitives. The fork
 * marker is encoded into the name for now (existing pattern).
 */
function buildPrimitiveValues(args: {
  name: string;
  userId: string;
  isPublic: boolean;
  category: string;
  costTier: string;
  buCost: number;
  mechanicalOutputText: string;
  narrativeRule: string;
  isMirrorable: boolean;
  mirrorVector: string;
  mirrorBuCredit: number;
  mirrorEligibilityNotes: string;
  hardModifiers: readonly HardModifier[];
}) {
  const {
    name,
    userId,
    isPublic,
    category,
    costTier,
    buCost,
    mechanicalOutputText,
    narrativeRule,
    isMirrorable,
    mirrorVector,
    mirrorBuCredit,
    mirrorEligibilityNotes,
    hardModifiers,
  } = args;
  return {
    name,
    userId,
    isPublic,
    category: category as PrimitiveCategoryValue,
    costTier: costTier || "Tier 1: Minor (4 BU anchor)",
    buCost,
    mechanicalOutputText,
    narrativeRule,
    isMirrorable,
    mirrorVector: isMirrorable ? mirrorVector || "VARIABLE_VECTOR" : "STANDARD_ONLY",
    mirrorBuCredit: isMirrorable ? mirrorBuCredit : 0,
    mirrorEligibilityNotes,
    hardModifiers,
  };
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth.protect();
    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const values = body as Record<string, unknown>;
    // Phase 1 (round 6 of edit-creates-fork): accept `intent` +
    // `sourceId` from the body. The form threads these in from
    // ?intent=fork|load + ?edit=<id> on the sandbox URL. SourceId is
    // the row the user is editing; intent records whether they
    // entered via the Fork button or Load into build. See §6.7 of
    // docs/architecture/edit-creates-fork.md for the matrix.
    const intent: SaveIntent = parseSaveIntent(
      typeof values["intent"] === "string" ? (values["intent"] as string) : undefined,
    );
    const sourceIdRaw = values["sourceId"];
    const sourceId =
      typeof sourceIdRaw === "number" && Number.isInteger(sourceIdRaw) && sourceIdRaw > 0
        ? sourceIdRaw
        : typeof sourceIdRaw === "string" && /^\d+$/.test(sourceIdRaw)
          ? Number(sourceIdRaw)
          : null;

    // Legacy `id` field — pre-Phase-1 forms still send this when
    // editing a row the caller owns. Phase 1 prefers sourceId +
    // intent, but we keep the legacy path working for the brief
    // window where the form hasn't been migrated. After Phase 2
    // lands the dispatch path becomes the only one.
    const editingIdRaw = values["id"];
    const legacyEditingId =
      typeof editingIdRaw === "number" && Number.isInteger(editingIdRaw) && editingIdRaw > 0
        ? editingIdRaw
        : typeof editingIdRaw === "string" && /^\d+$/.test(editingIdRaw)
          ? Number(editingIdRaw)
          : null;

    const name = String(values["name"] ?? "").trim();
    const isPublic = Boolean(values["isPublic"]);
    const category = String(values["category"] ?? "");
    const costTier = String(values["costTier"] ?? "").trim();
    const buCost = Number(values["buCost"]);
    const mechanicalOutputText = String(
      values["mechanicalOutputText"] ?? "",
    ).trim();
    const narrativeRule = String(values["narrativeRule"] ?? "").trim();
    const isMirrorable = Boolean(values["isMirrorable"]);
    const mirrorVector = String(values["mirrorVector"] ?? "STANDARD_ONLY").trim();
    const mirrorBuCredit = Number(values["mirrorBuCredit"] ?? 0);
    const mirrorEligibilityNotes = String(
      values["mirrorEligibilityNotes"] ?? "",
    ).trim();
    const hardModifiers = parseHardModifiers(values["hardModifiers"]);

    if (!name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }

    if (!isPrimitiveCategory(category)) {
      return NextResponse.json({ error: "Invalid category." }, { status: 400 });
    }

    if (!Number.isInteger(buCost) || buCost < 0) {
      return NextResponse.json(
        { error: "BU cost must be a non-negative integer." },
        { status: 400 },
      );
    }

    if (!Number.isInteger(mirrorBuCredit) || mirrorBuCredit < 0) {
      return NextResponse.json(
        { error: "Mirror BU credit must be a non-negative integer." },
        { status: 400 },
      );
    }

    // ---------------------------------------------------------------
    // Phase 4: build canonical payload + draftHash for no-op detection.
    // The form should compute this client-side and send it; we also
    // re-compute server-side as a defense-in-depth measure (an attacker
    // who sends the wrong hash still triggers no-op, which is at worst
    // an annoyance). The form-computed hash is preferred for legitimate
    // saves because it matches the user's mental model exactly.
    // ---------------------------------------------------------------
    const serverCanonicalPayload = buildCanonicalPrimitivePayload({
      name,
      category,
      costTier,
      buCost,
      mechanicalOutputText,
      narrativeRule,
      isPublic,
      isMirrorable,
      mirrorVector,
      mirrorBuCredit,
      mirrorEligibilityNotes,
      hardModifiers,
    });
    const draftIsEmpty = isPrimitiveDraftEmpty(serverCanonicalPayload);

    // The client should send draftHash; if missing, we compute one server-side
    // from the same canonical payload so the matrix can still decide.
    const clientDraftHash =
      typeof values["draftHash"] === "string"
        ? (values["draftHash"] as string)
        : null;

    // ---------------------------------------------------------------
    // Phase 1 dispatch: decide fork vs version-update vs no-op based
    // on intent + ownership + draftHash. See src/lib/publishing/dispatch-save.ts.
    // ---------------------------------------------------------------

    // Prefer sourceId (Phase 1 contract) over legacy `id` field. If
    // neither is set, this is a greenfield INSERT — no fork lineage.
    const effectiveSourceId = sourceId ?? legacyEditingId;
    const source = effectiveSourceId !== null
      ? await loadPrimitiveOwner(effectiveSourceId)
      : null;

    const outcome: DispatchOutcome = decideSaveOutcome({
      intent,
      source,
      callerUserId: userId,
      draftHash: clientDraftHash,
      draftIsEmpty,
    });

    // No-op short-circuit: don't touch the DB. Return the message so the
    // form can surface it. Status 200 (not 4xx) so the form's success path
    // doesn't surface an error toast — this is a deliberate non-event.
    if (outcome.kind === "no-op") {
      return NextResponse.json(
        {
          primitive: null,
          dispatchOutcome: {
            kind: "no-op" as const,
            message: outcome.message,
            swapTarget: false as const,
          },
        },
        { status: 200 },
      );
    }

    // Compute the server-side canonical hash for storing on the row.
    // This MUST match what the client sent (when it sent one); if it
    // doesn't, the next save will see sourceHash ≠ draftHash and re-run.
    const { hashPrimitiveContent } = await import(
      "@/lib/publishing/hash-content"
    );
    const serverDraftHash = await hashPrimitiveContent(serverCanonicalPayload);

    if (outcome.kind === "version-update") {
      // Caller owns the source AND intent=load → update in place.
      // Same ownership gate as the legacy path: row must be owned by
      // caller OR be system content. Without this an attacker could
      // rewrite any primitive just by guessing a numeric id.
      const [updated] = await db
        .update(primitives)
        .set({
          ...buildPrimitiveValues({
            name,
            userId,
            isPublic,
            category,
            costTier,
            buCost,
            mechanicalOutputText,
            narrativeRule,
            isMirrorable,
            mirrorVector,
            mirrorBuCredit,
            mirrorEligibilityNotes,
            hardModifiers,
          }),
          contentHash: serverDraftHash,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(primitives.id, effectiveSourceId!),
            or(eq(primitives.userId, userId), isNull(primitives.userId)),
          ),
        )
        .returning();

      if (!updated) {
        return NextResponse.json(
          {
            error:
              "Primitive not found or not owned by you. Refresh and try again.",
          },
          { status: 404 },
        );
      }

      return NextResponse.json(
        {
          primitive: updated,
          dispatchOutcome: {
            kind: "version-update" as const,
            newId: updated.id,
            sourceId: outcome.sourceId,
            swapTarget: false as const,
          },
        },
        { status: 200 },
      );
    }

    // outcome.kind === "forked"
    // Compute the unique fork name. Greenfield (source=null) uses
    // the user's chosen name verbatim. Otherwise we walk "(fork)",
    // "(fork) 2", "(fork) 3", ... until a unique name is found.
    //
    // Build a sync-existence set from a quick DB query, then pass
    // it to computeUniqueForkName as a sync predicate. (The
    // helper accepts Promise predicates too, but sync is faster
    // for the typical case where 0-2 collisions happen.)
    const baseName =
      source !== null
        ? await computeUniqueForkName(name, await buildTakenNamesSet(
            category as string,
            userId,
          ))
        : name;

    const [created] = await db
      .insert(primitives)
      .values({
        ...buildPrimitiveValues({
          name: baseName,
          userId,
          isPublic,
          category,
          costTier,
          buCost,
          mechanicalOutputText,
          narrativeRule,
          isMirrorable,
          mirrorVector,
          mirrorBuCredit,
          mirrorEligibilityNotes,
          hardModifiers,
        }),
        contentHash: serverDraftHash,
      })
      .onConflictDoUpdate({
        target: [primitives.name, primitives.category, primitives.userId],
        set: {
          costTier: costTier || "Tier 1: Minor (4 BU anchor)",
          userId,
          isPublic,
          buCost,
          mechanicalOutputText,
          narrativeRule,
          isMirrorable,
          mirrorVector: isMirrorable
            ? mirrorVector || "VARIABLE_VECTOR"
            : "STANDARD_ONLY",
          mirrorBuCredit: isMirrorable ? mirrorBuCredit : 0,
          mirrorEligibilityNotes,
          hardModifiers,
          contentHash: serverDraftHash,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!created) {
      return NextResponse.json(
        { error: "Failed to create primitive." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        primitive: created,
        dispatchOutcome: {
          kind: "forked" as const,
          newId: created.id,
          sourceId: outcome.sourceId,
          swapTarget: outcome.swapTarget,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}