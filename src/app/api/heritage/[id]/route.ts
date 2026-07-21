import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq, inArray, and, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  primitives,
  heritageCapabilities,
  heritagePrimitives,
  heritage,
} from "@/db/schema";
// Mashu 2026-07-09: expectedCategoryForKind import removed — the
// category restriction is gone.
import {
  dispatchEntitySave,
  type SaveTargetType,
} from "@/lib/publishing/dispatch-save";
import { parseSaveIntent } from "@/lib/publishing/save-intent";
import { getCallerIsAdmin, resolveUserIdByClerkId } from "@/lib/auth/author-resolver";
import { recordForkAttribution } from "@/lib/publishing/fork-attribution";
import { computeUniqueForkName } from "@/lib/publishing/fork-naming";
import {
  buildCanonicalTemplatePayload,
  isTemplateDraftEmpty,
  computeTemplateContentHash,
} from "@/lib/publishing/hash-content";
import { recordVersion } from "@/lib/versions/auto-snapshot";

const TARGET_TYPE: SaveTargetType = "TEMPLATE";

type HeritageKind = "LINEAGE" | "UPBRINGING" | "MANIFEST";

const VALID_KINDS: HeritageKind[] = ["LINEAGE", "UPBRINGING", "MANIFEST"];

function parseKind(value: unknown): HeritageKind | null {
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase();
  if ((VALID_KINDS as string[]).includes(upper)) {
    return upper as HeritageKind;
  }
  return null;
}

/**
 * Phase 2: build a sync-existence predicate for the (name, userId, kind)
 * triple the new fork row will use. Templates have a unique constraint
 * on (name, user_id, kind) — different shape than effects/capabilities/items
 * which use (name, source_origin).
 *
 * Mashu 2026-07-09: predicate now preloads the FULL set of existing fork
 * names for this (userId, kind) pair, not just rows matching the form's
 * `name` field exactly. The previous version queried for `name = $name`
 * and returned false when checking `nameExists("Star-Touched (fork)")`,
 * so `computeUniqueForkName` returned a candidate that collided with an
 * existing fork of the same source — the INSERT then failed with a
 * unique-constraint violation (no error message bubbled to the user).
 *
 * The predicate must return true for ANY candidate that would clash,
 * including `"X (fork)"`, `"X (fork) 2"`, `"X (fork) 3"`, ... We preload
 * the prefix-matched set in one query so the predicate is accurate for
 * every candidate `computeUniqueForkName` will probe.
 */
async function buildTemplateTakenNamesSet(
  name: string,
  kind: HeritageKind,
  userId: string,
): Promise<(candidate: string) => boolean> {
  const forkPrefix = `${name} (fork)`;
  // Match `name (fork)`, `name (fork) 2`, `name (fork) 3`, ... The
  // computeUniqueForkName walker only produces these three shapes, so a
  // prefix LIKE is sufficient.
  const rows = await db
    .select({ name: heritage.name })
    .from(heritage)
    .where(
      and(
        eq(heritage.kind, kind),
        eq(heritage.userId, userId),
        // Drizzle doesn't have a `startsWith` helper; use sql template
        // for the LIKE pattern. Anchor the prefix so "Star" doesn't match
        // "Stardust (fork)".
        sql`${heritage.name} LIKE ${forkPrefix + "%"}`,
      ),
    );
  const taken = new Set(rows.map((r) => r.name));
  return (candidate: string) => taken.has(candidate);
}

/**
 * GET /api/heritage/[id]
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const row = await db.query.heritage.findFirst({
    where: eq(heritage.id, id),
    with: {
      primitiveLinks: { with: { primitive: true } },
      capabilityLinks: { with: { capability: true } },
    },
  });

  if (!row) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }

  const bu = row.primitiveLinks.reduce(
    (t, l) => t + (l.primitive?.buCost ?? 0),
    0,
  );

  return NextResponse.json({ template: { ...row, computedBu: bu } });
}

/**
 * PATCH /api/heritage/[id] — Phase 2 deferred-fork entry point.
 *
 * Same shape as /api/effects/[id] PATCH:
 *   - intent=load + caller owns source → UPDATE in place (version-update)
 *   - intent=fork (any ownership) → INSERT new fork row
 *   - load + caller doesn't own → INSERT new fork row
 *   - no-changes (contentHash matches) → no-op, return user-facing message
 *
 * The (name, user_id, kind) unique constraint is what makes fork-naming
 * tricky for heritage. The fork predicate filters by name + kind +
 * userId (not name + sourceOrigin like the other entities).
 *
 * Response shape:
 *   { template, dispatchOutcome: { kind, newId, sourceId, swapTarget } | { kind: "no-op", message } }
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

    // Phase 2: parse intent. Default to "load" (legacy in-place edit
    // behaviour). Forms that fork will send `intent: "fork"`.
    const intent = parseSaveIntent(
      typeof values["intent"] === "string" ? (values["intent"] as string) : undefined,
    );
    const effectiveIntent = intent ?? "load";

    // Need the current row first so we know the kind (the kind is part of
    // the canonical hash envelope). The form re-sends kind for safety,
    // but we treat the existing row's kind as authoritative — the form
    // can't switch a row between RACE / BACKGROUND / ARCHETYPE via PATCH.
    const current = await db.query.heritage.findFirst({
      where: eq(heritage.id, id),
    });
    if (!current) {
      return NextResponse.json({ error: "Template not found." }, { status: 404 });
    }

    // -------------------------------------------------------------------
    // Field parsing — preserve existing behaviour from the legacy PATCH.
    // -------------------------------------------------------------------
    const name = String(values["name"] ?? "").trim();
    const imageUrl =
      "imageUrl" in values
        ? String(values["imageUrl"]).trim() || null
        : current.imageUrl;
    const description =
      "description" in values
        ? String(values["description"]).trim() || null
        : current.description;
    const suggestedTraits =
      "suggestedTraits" in values
        ? String(values["suggestedTraits"]).trim() || null
        : current.suggestedTraits;
    const isPublic = "isPublic" in values
      ? Boolean(values["isPublic"])
      : current.isPublic;
    // Phase 8 rev 10: heritage parity — PATCH route now also reads
    // sourceOrigin + tags (POST did this already in the [base] route).
    // Preserves the existing values when the field is missing from the
    // patch body, matching the suggestedTraits pattern above.
    const sourceOrigin =
      "sourceOrigin" in values
        ? pickStringOrNull(values["sourceOrigin"])
        : current.sourceOrigin;
    const tagsInput = values["tags"];
    const tags: string[] = "tags" in values
      ? Array.isArray(tagsInput)
        ? (tagsInput as unknown[])
            .filter(
              (t): t is string => typeof t === "string" && t.trim().length > 0,
            )
            .map((t) => t.trim())
        : []
      : (current.tags ?? []);

    // Phase 7 Q-M-UX: accept primitiveSlots ({primitiveId, isMirrored}[])
    // for new clients. Fall back to primitiveIds (number[]) for legacy
    // payloads — those parse as non-mirrored (safe default).
    const primitiveSlotsInput = Array.isArray(values["primitiveSlots"])
      ? (values["primitiveSlots"] as unknown[]).map((slotValue) => {
          const slot = slotValue as Record<string, unknown>;
          return {
            primitiveId: Number(slot["primitiveId"] ?? slot["id"]),
            isMirrored: Boolean(
              slot["is_mirrored"] ?? slot["isMirrored"] ?? false,
            ),
          };
        })
      : [];
    const legacyPrimitiveIds = Array.isArray(values["primitiveIds"])
      ? (values["primitiveIds"] as unknown[])
          .map(Number)
          .filter((n) => Number.isInteger(n) && n > 0)
          .map((id) => ({ primitiveId: id, isMirrored: false }))
      : [];
    const primitiveSlots =
      primitiveSlotsInput.length > 0 ? primitiveSlotsInput : legacyPrimitiveIds;
    const capabilityIds = Array.isArray(values["capabilityIds"])
      ? (values["capabilityIds"] as unknown[]).filter(
          (c) => typeof c === "string",
        )
      : [];

    if (!name) {
      return NextResponse.json({ error: "Template name is required." }, { status: 400 });
    }

    // -------------------------------------------------------------------
    // Canonical payload + content hash (server is the source of truth).
    // kind comes from the existing row — it's the row's identity, not a
    // patchable field.
    // -------------------------------------------------------------------
    const kind: HeritageKind = current.kind;
    const canonicalPayload = buildCanonicalTemplatePayload({
      kind,
      name,
      description: description ?? "",
      suggestedTraits: suggestedTraits ?? "",
      isPublic,
      primitiveIds: primitiveSlots.map((s) => s.primitiveId),
      primitiveSlots,
      capabilityIds: capabilityIds as string[],
      // Phase 8: per-entity iconography
      iconSource: pickIconSource(values["iconSource"]),
      iconKey: pickStringOrNull(values["iconKey"]),
      iconUrl: pickStringOrNull(values["iconUrl"]),
      iconColor: pickStringOrDefault(values["iconColor"], "#ffffff"),
    });
    const draftIsEmpty = isTemplateDraftEmpty(canonicalPayload);
    const draftHash = await computeTemplateContentHash({
      kind,
      name,
      description: description ?? "",
      suggestedTraits: suggestedTraits ?? "",
      isPublic,
      primitiveIds: primitiveSlots.map((s) => s.primitiveId),
      primitiveSlots,
      capabilityIds: capabilityIds as string[],
      // Phase 8: per-entity iconography
      iconSource: pickIconSource(values["iconSource"]),
      iconKey: pickStringOrNull(values["iconKey"]),
      iconUrl: pickStringOrNull(values["iconUrl"]),
      iconColor: pickStringOrDefault(values["iconColor"], "#ffffff"),
    });

    // -------------------------------------------------------------------
    // Dispatcher.
    // -------------------------------------------------------------------
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
          template: null,
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
      const updatePayload: Record<string, unknown> = {
        name,
        imageUrl,
        description,
        suggestedTraits,
        isPublic,
        // Phase 8 rev 10: heritage parity — sourceOrigin + tags now flow
        // through PATCH. sourceOrigin preserves the existing value unless
        // the client explicitly sent one; tags overwrite with what the
        // client sent (or keep current if the field is absent).
        sourceOrigin: sourceOrigin ?? current.sourceOrigin,
        tags,
        contentHash: draftHash,
        updatedAt: new Date(),
        // Phase 8: per-entity iconography
        iconSource: pickIconSource(values["iconSource"]),
        iconKey: pickStringOrNull(values["iconKey"]),
        iconUrl: pickStringOrNull(values["iconUrl"]),
        iconColor: pickStringOrDefault(values["iconColor"], "#ffffff"),
      };

      const result = await db.transaction(async (tx) => {
        await tx
          .update(heritage)
          .set(updatePayload)
          .where(
            and(
              eq(heritage.id, id),
              or(eq(heritage.userId, userId), isNull(heritage.userId)),
            ),
          );

        // Replace primitive slot links with the new set.
        // Mashu 2026-07-09: category restriction removed — heritage
        // can slot any primitive. The previous HERITAGE_AUGMENT
        // filter is gone; designers decide what makes sense for the
        // race/background/archetype they're composing.
        if (
          ("primitiveSlots" in values || "primitiveIds" in values) &&
          primitiveSlots.length > 0
        ) {
          const ids = primitiveSlots.map((s) => s.primitiveId);
          const prims = await tx
            .select({ id: primitives.id })
            .from(primitives)
            .where(inArray(primitives.id, ids));
          const validIdSet = new Set(prims.map((p) => p.id));
          const validSlots = primitiveSlots.filter((s) =>
            validIdSet.has(s.primitiveId),
          );

          await tx
            .delete(heritagePrimitives)
            .where(eq(heritagePrimitives.templateId, id));
          await tx.insert(heritagePrimitives).values(
            validSlots.map((slot, idx) => ({
              templateId: id,
              primitiveId: slot.primitiveId,
              sortOrder: idx,
              // Phase 7 Q-M-UX: persist per-slot Mirrored flag.
              isMirrored: slot.isMirrored,
            })),
          );
        }

        // Replace capability slot links.
        if ("capabilityIds" in values) {
          await tx
            .delete(heritageCapabilities)
            .where(eq(heritageCapabilities.templateId, id));
          if (capabilityIds.length > 0) {
            await tx.insert(heritageCapabilities).values(
              capabilityIds.map((cid) => ({
                templateId: id,
                capabilityId: cid as string,
              })),
            );
          }
        }

        return tx.query.heritage.findFirst({
          where: eq(heritage.id, id),
          with: {
            primitiveLinks: { with: { primitive: true } },
            capabilityLinks: { with: { capability: true } },
          },
        });
      });

      // Phase 4: auto-snapshot the updated template.
      if (result) {
        await recordVersion({
          entityKind: "template",
          entityId: id,
          contentHash: draftHash,
          snapshot: canonicalPayload as unknown as Record<string, unknown>,
          publishedByUserId: userId,
        });
      }

      if (result) {
        const bu = result.primitiveLinks.reduce(
          (t, l) => t + (l.primitive?.buCost ?? 0),
          0,
        );
        return NextResponse.json(
          {
            template: { ...result, computedBu: bu },
            dispatchOutcome: {
              kind: "version-update" as const,
              newId: id,
              sourceId: outcome.sourceId,
              swapTarget: false as const,
            },
          },
          { status: 200 },
        );
      }
      throw new Error("Template not found after update.");
    }

    // outcome.kind === "forked" — INSERT a new row.
    // sourceOrigin for the fork: "fork:<sourceId>" for non-greenfield.
    // (PATCH is always non-greenfield — the route has a URL param.)
    const finalSourceOrigin = `fork:${source !== null ? source.id : id}`;

    const baseName = await computeUniqueForkName(
      name,
      await buildTemplateTakenNamesSet(name, kind, userId),
    );

    const created = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(heritage)
        .values({
          kind,
          name: baseName,
          imageUrl,
          description,
          suggestedTraits,
          isPublic,
          userId,
          sourceOrigin: finalSourceOrigin,
          // Phase 8 rev 10: heritage parity — tags carry over on fork.
          // sourceOrigin is intentionally `fork:<source>` regardless of
          // what the client sent (the fork marker is the metadata of
          // record; we don't want a user-supplied source origin
          // overriding it).
          tags,
          contentHash: draftHash,
        })
        .returning();

      if (!inserted) {
        throw new Error("Unable to create template.");
      }

      // Validate + insert primitive slots.
      // Mashu 2026-07-09: category restriction removed.
      if (primitiveSlots.length > 0) {
        const ids = primitiveSlots.map((s) => s.primitiveId);
        const prims = await tx
          .select({ id: primitives.id })
          .from(primitives)
          .where(inArray(primitives.id, ids));
        const validIdSet = new Set(prims.map((p) => p.id));
        const validSlots = primitiveSlots.filter((s) =>
          validIdSet.has(s.primitiveId),
        );

        await tx.insert(heritagePrimitives).values(
          validSlots.map((slot, idx) => ({
            templateId: inserted.id,
            primitiveId: slot.primitiveId,
            sortOrder: idx,
            // Phase 7 Q-M-UX: persist per-slot Mirrored flag.
            isMirrored: slot.isMirrored,
          })),
        );
      }

      // Insert capability slots.
      if (capabilityIds.length > 0) {
        await tx.insert(heritageCapabilities).values(
          capabilityIds.map((cid) => ({
            templateId: inserted.id,
            capabilityId: cid as string,
          })),
        );
      }

      return tx.query.heritage.findFirst({
        where: eq(heritage.id, inserted.id),
        with: {
          primitiveLinks: { with: { primitive: true } },
          capabilityLinks: { with: { capability: true } },
        },
      });
    });

    if (!created) {
      throw new Error("Unable to load forked template.");
    }

    // Phase 4: auto-snapshot the new fork.
    await recordVersion({
      entityKind: "template",
      entityId: created.id,
      contentHash: draftHash,
      snapshot: canonicalPayload as unknown as Record<string, unknown>,
      publishedByUserId: userId,
    });

    // Phase 9 follow-up: record fork attribution. Only when this is
    // a real fork (source !== null). Heritage is special — TARGET_TYPE
    // is "TEMPLATE" (the SaveTargetType) but the actual publish enum
    // depends on `created.kind` (LINEAGE_TEMPLATE / UPBRINGING_TEMPLATE /
    // MANIFEST_TEMPLATE). The fork's kind matches the source's kind by
    // definition, so we derive the targetType from `created.kind`.
    if (source !== null) {
      const forkerInternalId = await resolveUserIdByClerkId(userId);
      if (forkerInternalId) {
        const heritageTargetType =
          created.kind === "LINEAGE"
            ? "LINEAGE_TEMPLATE"
            : created.kind === "UPBRINGING"
              ? "UPBRINGING_TEMPLATE"
              : "MANIFEST_TEMPLATE";
        await recordForkAttribution({
          forkerInternalId,
          forkerClerkId: userId,
          sourceClerkUserId: source.userId,
          sourceTargetType: heritageTargetType,
          sourceTargetId: String(source.id),
          forkedTargetType: heritageTargetType,
          forkedTargetId: created.id,
          metadata: { name: baseName, kind: created.kind },
        });
      }
    }

    const bu = created.primitiveLinks.reduce(
      (t, l) => t + (l.primitive?.buCost ?? 0),
      0,
    );

    return NextResponse.json(
      {
        template: { ...created, computedBu: bu },
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
 * DELETE /api/heritage/[id]
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await auth.protect();
    const { id } = await params;

    const [deleted] = await db
      .delete(heritage)
      .where(eq(heritage.id, id))
      .returning({ id: heritage.id });

    if (!deleted) {
      return NextResponse.json({ error: "Template not found." }, { status: 404 });
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
