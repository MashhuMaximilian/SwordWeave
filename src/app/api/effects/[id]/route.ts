import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { asc, eq, and, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { effectPrimitives, effects } from "@/db/schema/engine";
import {
  dispatchEntitySave,
  type SaveTargetType,
} from "@/lib/publishing/dispatch-save";
import { parseSaveIntent } from "@/lib/publishing/save-intent";
import { getCallerIsAdmin, resolveUserIdByClerkId } from "@/lib/auth/author-resolver";
import { recordForkAttribution } from "@/lib/publishing/fork-attribution";
import type { ReactionTargetType } from "@/lib/engagement/version-helpers";
import { computeUniqueForkName } from "@/lib/publishing/fork-naming";
import {
  buildCanonicalEffectPayload,
  isEffectDraftEmpty,
  computeEffectContentHash,
} from "@/lib/publishing/hash-content";
import { recordVersion } from "@/lib/versions/auto-snapshot";

const TARGET_TYPE: SaveTargetType = "EFFECT";

/**
 * Phase 2: build a sync-existence predicate for the (name, sourceOrigin)
 * pair the new fork row will use, so the forked name doesn't collide
 * with the user's existing rows.
 *
 * Mashu 2026-07-09: predicate now preloads every name in the user's
 * (sourceOrigin) namespace that matches the `${name} (fork)%` prefix,
 * not just rows with `name = $name` exactly. The previous version
 * returned false for `nameExists("Strike (fork)")` when only
 * "Strike (fork)" existed in the namespace, so the unique-namer
 * returned a candidate that collided with the prior fork. The DB's
 * unique `(name, source_origin)` constraint then rejected the INSERT
 * with no user-visible error message.
 *
 * The predicate must return true for ANY existing candidate that would
 * clash with the suffix-walk — `"X (fork)"`, `"X (fork) 2"`, ... We
 * preload the prefix-matched set in one query.
 */
async function buildEffectTakenNamesSet(
  name: string,
  sourceOrigin: string | null,
  userId: string,
): Promise<(candidate: string) => boolean> {
  const forkPrefix = `${name} (fork)`;
  const rows = await db
    .select({ name: effects.name })
    .from(effects)
    .where(
      and(
        sourceOrigin === null
          ? isNull(effects.sourceOrigin)
          : eq(effects.sourceOrigin, sourceOrigin),
        eq(effects.userId, userId),
        sql`${effects.name} LIKE ${forkPrefix + "%"}`,
      ),
    );
  const taken = new Set(rows.map((r) => r.name));
  return (candidate: string) => taken.has(candidate);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const effect = await db.query.effects.findFirst({
    where: eq(effects.id, id),
    with: {
      primitiveLinks: {
        orderBy: [asc(effectPrimitives.sortOrder)],
        with: { primitive: true },
      },
    },
  });

  if (!effect) {
    return NextResponse.json({ error: "Effect not found." }, { status: 404 });
  }

  return NextResponse.json({ effect });
}

/**
 * PATCH /api/effects/[id] — Phase 2 deferred-fork entry point.
 *
 * The form's `?intent=fork|load` query param is read by the sandbox
 * client and threaded into the request body. This route uses it to
 * decide between:
 *   - intent=load + caller owns source → UPDATE in place (version-update)
 *   - intent=load + caller doesn't own → INSERT new fork row
 *   - intent=fork (any ownership) → INSERT new fork row
 *   - no-changes (contentHash matches) → no-op, return user-facing message
 *
 * The response shape mirrors the primitives route's POST:
 *   { effect, dispatchOutcome: { kind, newId, sourceId, swapTarget } | { kind: "no-op", message } }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth.protect();
    const { id } = await params;
    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const values = body as Record<string, unknown>;

    // Phase 2: parse intent from body. If absent, default to "load" — the
    // semantic for "I want to edit this in place" (the legacy behaviour
    // of the PATCH route before Phase 2). Forms that explicitly fork will
    // send `intent: "fork"`.
    const intent = parseSaveIntent(
      typeof values["intent"] === "string" ? (values["intent"] as string) : undefined,
    );
    const effectiveIntent = intent ?? "load";

    const name = String(values["name"] ?? "").trim();
    const narrativeDescription = String(
      values["narrativeDescription"] ?? "",
    ).trim();
    const userSourceOriginRaw = String(values["sourceOrigin"] ?? "").trim();
    const tags = Array.isArray(values["tags"])
      ? (values["tags"] as unknown[]).map(String).map((s) => s.trim()).filter(Boolean)
      : typeof values["tags"] === "string"
        ? values["tags"].split(",").map((s) => s.trim()).filter(Boolean)
        : [];
    const isPublic = Boolean(values["isPublic"]);
    const primitiveSlotsRaw = Array.isArray(values["primitiveSlots"])
      ? (values["primitiveSlots"] as unknown[]).map((slotValue) => {
          const slot = slotValue as Record<string, unknown>;
          return {
            primitiveId: Number(slot["primitiveId"]),
            quantity: Number(slot["quantity"] ?? 1),
            notes: String(slot["notes"] ?? "").trim() || undefined,
            // Phase 7 Q-M-UX: parse is_mirrored from payload.
            isMirrored: Boolean(
              slot["is_mirrored"] ?? slot["isMirrored"] ?? false,
            ),
          };
        })
      : [];

    if (!name) {
      return NextResponse.json({ error: "Effect name is required." }, { status: 400 });
    }

    if (primitiveSlotsRaw.length === 0) {
      return NextResponse.json(
        { error: "Slot at least one primitive into the effect." },
        { status: 400 },
      );
    }

    // Build the canonical payload + draftHash. The server's hash is the
    // source of truth for the no-op decision.
    const canonicalPayload = buildCanonicalEffectPayload({
      name,
      narrativeDescription,
      tags,
      isPublic,
      primitiveSlots: primitiveSlotsRaw.map((s) => ({
        primitiveId: s.primitiveId,
        quantity: s.quantity,
        notes: s.notes ?? "",
      })),
      // Phase 8: per-entity iconography
      iconSource: pickIconSource(values["iconSource"]),
      iconKey: pickStringOrNull(values["iconKey"]),
      iconUrl: pickStringOrNull(values["iconUrl"]),
      iconColor: pickStringOrDefault(values["iconColor"], "#ffffff"),
    });
    const draftIsEmpty = isEffectDraftEmpty(canonicalPayload);
    const draftHash = await computeEffectContentHash({
      name,
      narrativeDescription,
      tags,
      isPublic,
      primitiveSlots: primitiveSlotsRaw.map((s) => ({
        primitiveId: s.primitiveId,
        quantity: s.quantity,
        notes: s.notes ?? "",
      })),
      // Phase 8: per-entity iconography
      iconSource: pickIconSource(values["iconSource"]),
      iconKey: pickStringOrNull(values["iconKey"]),
      iconUrl: pickStringOrNull(values["iconUrl"]),
      iconColor: pickStringOrDefault(values["iconColor"], "#ffffff"),
    });

    // Dispatcher.
    // Phase 9 follow-up: pre-resolve callerIsAdmin once so we can pass it
    // through to dispatchEntitySave (admin canon-edit rule).
    const callerIsAdmin = await getCallerIsAdmin(userId);
    const { source, outcome } = await dispatchEntitySave({
      targetType: TARGET_TYPE,
      sourceId: id,
      intent: effectiveIntent,
      callerUserId: userId,
      callerIsAdmin,
      draftHash,
      draftIsEmpty,
    });

    // No-op short-circuit.
    if (outcome.kind === "no-op") {
      return NextResponse.json(
        {
          effect: null,
          dispatchOutcome: {
            kind: "no-op" as const,
            message: outcome.message,
            swapTarget: false as const,
          },
        },
        { status: 200 },
      );
    }

    if (outcome.kind === "version-update") {
      // Caller owns the source AND intent=load → update in place. Same
      // ownership gate as before: row must be owned by caller OR be
      // system content. Without this an attacker could rewrite any
      // effect just by guessing a UUID.
      const sourceEffect = await db.query.effects.findFirst({
        where: eq(effects.id, id),
      });
      if (!sourceEffect) {
        return NextResponse.json({ error: "Effect not found." }, { status: 404 });
      }

      const [updated] = await db
        .update(effects)
        .set({
          name,
          narrativeDescription,
          sourceOrigin: sourceEffect.sourceOrigin, // preserve
          tags,
          isPublic,
          contentHash: draftHash,
          updatedAt: new Date(),
          // Phase 8: per-entity iconography
          iconSource: pickIconSource(values["iconSource"]),
          iconKey: pickStringOrNull(values["iconKey"]),
          iconUrl: pickStringOrNull(values["iconUrl"]),
          iconColor: pickStringOrDefault(values["iconColor"], "#ffffff"),
        })
        .where(
          and(
            eq(effects.id, id),
            or(eq(effects.userId, userId), isNull(effects.userId)),
          ),
        )
        .returning();

      if (!updated) {
        return NextResponse.json(
          { error: "Effect not found or not owned by you. Refresh and try again." },
          { status: 404 },
        );
      }

      // Replace primitive slot links so they reflect the new draft.
      await db.delete(effectPrimitives).where(eq(effectPrimitives.effectId, updated.id));
      if (primitiveSlotsRaw.length > 0) {
        await db.insert(effectPrimitives).values(
          primitiveSlotsRaw.map((slot, index) => ({
            effectId: updated.id,
            primitiveId: slot.primitiveId,
            quantity: slot.quantity,
            sortOrder: index,
            notes: slot.notes,
            // Phase 7 Q-M-UX: persist per-slot Mirrored flag.
            isMirrored: slot.isMirrored,
          })),
        );
      }

      // Phase 4: auto-snapshot the updated effect.
      await recordVersion({
        entityKind: "effect",
        entityId: updated.id,
        contentHash: draftHash,
        snapshot: canonicalPayload as unknown as Record<string, unknown>,
        publishedByUserId: userId,
      });

      const effect = await db.query.effects.findFirst({
        where: eq(effects.id, updated.id),
        with: {
          primitiveLinks: {
            orderBy: [asc(effectPrimitives.sortOrder)],
            with: { primitive: true },
          },
        },
      });

      return NextResponse.json(
        {
          effect,
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

    // outcome.kind === "forked" — INSERT a new row.
    // sourceOrigin for the fork: "fork:<sourceId>" for non-greenfield,
    // or the user-supplied sourceOrigin for greenfield (rare via PATCH
    // — PATCH is typically for an existing row).
    const finalSourceOrigin = source !== null
      ? `fork:${source.id}`
      : (userSourceOriginRaw || null);

    const baseName = source !== null
      ? await computeUniqueForkName(
          name,
          await buildEffectTakenNamesSet(name, finalSourceOrigin, userId),
        )
      : name;

    const [created] = await db
      .insert(effects)
      .values({
        name: baseName,
        userId,
        narrativeDescription,
        sourceOrigin: finalSourceOrigin,
        tags,
        isPublic,
        contentHash: draftHash,
      })
      .returning();

    if (!created) {
      throw new Error("Unable to create effect.");
    }

    if (primitiveSlotsRaw.length > 0) {
      await db.insert(effectPrimitives).values(
        primitiveSlotsRaw.map((slot, index) => ({
          effectId: created.id,
          primitiveId: slot.primitiveId,
          quantity: slot.quantity,
          sortOrder: index,
          notes: slot.notes,
        })),
      );
    }

    // Phase 4: auto-snapshot the new fork.
    await recordVersion({
      entityKind: "effect",
      entityId: created.id,
      contentHash: draftHash,
      snapshot: canonicalPayload as unknown as Record<string, unknown>,
      publishedByUserId: userId,
    });

    // Phase 9 follow-up: record fork attribution (forks row +
    // fork_aggregates counter + user_stats bumps). Only when this is
    // a real fork (source !== null) — greenfield inserts don't get
    // attribution. System-authored sources still write the fork row;
    // the helper skips the source-author totalForksReceived bump when
    // sourceClerkUserId is null.
    if (source !== null) {
      const forkerInternalId = await resolveUserIdByClerkId(userId);
      if (forkerInternalId) {
        await recordForkAttribution({
          forkerInternalId,
          forkerClerkId: userId,
          sourceClerkUserId: source.userId,
          sourceTargetType: TARGET_TYPE as ReactionTargetType,
          sourceTargetId: String(source.id),
          forkedTargetType: TARGET_TYPE as ReactionTargetType,
          forkedTargetId: created.id,
          metadata: { name: baseName },
        });
      }
    }

    const effect = await db.query.effects.findFirst({
      where: eq(effects.id, created.id),
      with: {
        primitiveLinks: {
          orderBy: [asc(effectPrimitives.sortOrder)],
          with: { primitive: true },
        },
      },
    });

    return NextResponse.json(
      {
        effect,
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

/**
 * DELETE /api/effects/[id]
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await auth.protect();
    const { id } = await params;

    const [deleted] = await db
      .delete(effects)
      .where(eq(effects.id, id))
      .returning({ id: effects.id });

    if (!deleted) {
      return NextResponse.json({ error: "Effect not found." }, { status: 404 });
    }

    return NextResponse.json({ deleted: deleted.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * Phase 8: per-entity iconography helpers. See the matching block in
 * src/app/api/primitives/route.ts for the rationale.
 */
function pickIconSource(value: unknown): "GAME_ICONS" | "UPLOAD" | null {
  if (value === "GAME_ICONS" || value === "UPLOAD") return value;
  return null;
}
function pickStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
function pickStringOrDefault(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}
