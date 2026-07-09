import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { asc, eq, inArray, and, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  capabilities,
  capabilityEffects,
  capabilityPrimitives,
  effects,
  primitives,
} from "@/db/schema";
import {
  buildAssemblyAndComputeBU,
  parseCapabilityType,
  parseEffectSlots,
  parsePrimitiveSlots,
  parseSourceType,
  parseTags,
  safeMetadata,
  type PrimitiveLike,
} from "@/lib/api/capability-helpers";
import {
  dispatchEntitySave,
  type SaveTargetType,
} from "@/lib/publishing/dispatch-save";
import { parseSaveIntent } from "@/lib/publishing/save-intent";
import { computeUniqueForkName } from "@/lib/publishing/fork-naming";
import {
  buildCanonicalCapabilityPayload,
  isCapabilityDraftEmpty,
  computeCapabilityContentHash,
} from "@/lib/publishing/hash-content";
import { recordVersion } from "@/lib/versions/auto-snapshot";
import type { JsonValue } from "@/types/swordweave";

const TARGET_TYPE: SaveTargetType = "CAPABILITY";

/**
 * Phase 2: build a sync-existence predicate for the (name, sourceOrigin)
 * pair the new fork row will use, so the forked name doesn't collide
 * with the user's existing rows.
 *
 * Mashu 2026-07-09: predicate now preloads every name in the user's
 * (sourceOrigin) namespace that matches the `${name} (fork)%` prefix.
 * See effects/[id]/route.ts for the full rationale — the prior
 * exact-name match returned false for `nameExists("Strike (fork)")`
 * when an earlier fork already used that name, and the INSERT then
 * hit the unique `(name, source_origin)` constraint with no error
 * surfaced to the user.
 */
async function buildCapabilityTakenNamesSet(
  name: string,
  sourceOrigin: string | null,
  userId: string,
): Promise<(candidate: string) => boolean> {
  const forkPrefix = `${name} (fork)`;
  const rows = await db
    .select({ name: capabilities.name })
    .from(capabilities)
    .where(
      and(
        sourceOrigin === null
          ? isNull(capabilities.sourceOrigin)
          : eq(capabilities.sourceOrigin, sourceOrigin),
        eq(capabilities.userId, userId),
        sql`${capabilities.name} LIKE ${forkPrefix + "%"}`,
      ),
    );
  const taken = new Set(rows.map((r) => r.name));
  return (candidate: string) => taken.has(candidate);
}

/**
 * GET /api/capabilities/[id]
 * Get a single capability with all its primitive links.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const row = await db.query.capabilities.findFirst({
    where: eq(capabilities.id, id),
    with: {
      primitiveLinks: {
        with: {
          primitive: true,
        },
      },
      effectLinks: {
        with: {
          effect: true,
        },
      },
    },
  });

  if (!row) {
    return NextResponse.json({ error: "Capability not found." }, { status: 404 });
  }

  return NextResponse.json({ capability: row });
}

/**
 * PATCH /api/capabilities/[id] — Phase 2 deferred-fork entry point.
 *
 * Same shape as /api/effects/[id] PATCH:
 *   - intent=load + caller owns source → UPDATE in place (version-update)
 *   - intent=fork (any ownership) → INSERT new fork row
 *   - load + caller doesn't own → INSERT new fork row
 *   - no-changes (contentHash matches) → no-op, return user-facing message
 *
 * The response shape mirrors the effects route:
 *   { capability, dispatchOutcome: { kind, newId, sourceId, swapTarget } | { kind: "no-op", message } }
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

    // Phase 2: parse intent. If absent, default to "load" (legacy in-place
    // edit behaviour). Forms that fork will send `intent: "fork"`.
    const intent = parseSaveIntent(
      typeof values["intent"] === "string" ? (values["intent"] as string) : undefined,
    );
    const effectiveIntent = intent ?? "load";

    // -------------------------------------------------------------------
    // Field parsing — preserve all existing validations from the legacy
    // PATCH. The form sends a full draft; we hash the full draft to
    // detect no-op saves.
    // -------------------------------------------------------------------
    const name = String(values["name"] ?? "").trim();

    const type = parseCapabilityType(values["type"]);
    if ("type" in values && !type) {
      return NextResponse.json(
        { error: "type must be ACTIVE, PASSIVE, or AUGMENT." },
        { status: 400 },
      );
    }

    const sourceType = parseSourceType(values["sourceType"]);
    if ("sourceType" in values && !sourceType) {
      return NextResponse.json(
        { error: "sourceType must be PHYSICAL, MAGICAL, or PSYCHIC." },
        { status: 400 },
      );
    }

    const verboseDescription = String(values["verboseDescription"] ?? "").trim();
    const isPublic = Boolean(values["isPublic"]);
    const userSourceOriginRaw = String(values["sourceOrigin"] ?? "").trim();
    const tags = parseTags(values["tags"]);

    const primitiveSlots = "primitiveSlots" in values && values["primitiveSlots"] != null
      ? parsePrimitiveSlots(values["primitiveSlots"])
      : [];

    const effectSlots = "effectSlots" in values && values["effectSlots"] != null
      ? parseEffectSlots(values["effectSlots"])
      : [];

    if (!name) {
      return NextResponse.json({ error: "Capability name is required." }, { status: 400 });
    }

    // -------------------------------------------------------------------
    // Canonical payload + content hash (server is the source of truth).
    // -------------------------------------------------------------------
    // `type` and `sourceType` are typed `string | null` by their parsers.
    // The validation above guarantees they're either valid (e.g.
    // "ACTIVE") or null. For the canonical hash, the form-supplied value
    // (or "" as a placeholder) is fine — the no-op detection only needs
    // a stable value that matches what the form serialized.
    const canonicalPayload = buildCanonicalCapabilityPayload({
      name,
      type: type ?? "",
      sourceType: sourceType ?? "",
      verboseDescription,
      tags,
      isPublic,
      primitiveSlots: primitiveSlots.map((s) => ({
        primitiveId: s.primitiveId,
        role: s.role,
        quantity: s.quantity,
        slotLabel: s.slotLabel ?? "",
        notes: s.notes ?? "",
      })),
      effectIds: effectSlots.map((s) => s.effectId),
    });
    const draftIsEmpty = isCapabilityDraftEmpty(canonicalPayload);
    const draftHash = await computeCapabilityContentHash({
      name,
      type: type ?? "",
      sourceType: sourceType ?? "",
      verboseDescription,
      tags,
      isPublic,
      primitiveSlots: primitiveSlots.map((s) => ({
        primitiveId: s.primitiveId,
        role: s.role,
        quantity: s.quantity,
        slotLabel: s.slotLabel ?? "",
        notes: s.notes ?? "",
      })),
      effectIds: effectSlots.map((s) => s.effectId),
    });

    // -------------------------------------------------------------------
    // Dispatcher.
    // -------------------------------------------------------------------
    const { source, outcome } = await dispatchEntitySave({
      targetType: TARGET_TYPE,
      sourceId: id,
      intent: effectiveIntent,
      callerUserId: userId,
      draftHash,
      draftIsEmpty,
    });

    // No-op short-circuit.
    if (outcome.kind === "no-op") {
      return NextResponse.json(
        {
          capability: null,
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
      // system content.
      const sourceCapability = await db.query.capabilities.findFirst({
        where: eq(capabilities.id, id),
      });
      if (!sourceCapability) {
        return NextResponse.json({ error: "Capability not found." }, { status: 404 });
      }

      // Server-authoritative metadata: if slots change, totalBu is recomputed.
      // Otherwise just preserve existing metadata (but strip previewBu).
      const updatePayload: Record<string, unknown> = {
        name,
        type,
        sourceType,
        verboseDescription,
        isPublic,
        tags,
        sourceOrigin: sourceCapability.sourceOrigin, // preserve
        contentHash: draftHash,
        updatedAt: new Date(),
      };

      const result = await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(capabilities)
          .set(updatePayload)
          .where(
            and(
              eq(capabilities.id, id),
              or(eq(capabilities.userId, userId), isNull(capabilities.userId)),
            ),
          )
          .returning();

        if (!updated) {
          throw new Error("Capability not found.");
        }

        // Replace primitive slot links so they reflect the new draft.
        // Server-compute BU from the new slots.
        let totalBu = 0;
        if (primitiveSlots.length > 0) {
          const primitiveIds = primitiveSlots.map((s) => s.primitiveId);
          const primitiveRows = await tx
            .select()
            .from(primitives)
            .where(inArray(primitives.id, primitiveIds));

          if (primitiveRows.length !== new Set(primitiveIds).size) {
            const foundIds = new Set(primitiveRows.map((p) => p.id));
            const missing = primitiveIds.filter((pid) => !foundIds.has(pid));
            throw new Error(`Unknown primitiveIds: ${missing.join(", ")}`);
          }

          const primitivesById: ReadonlyMap<string, PrimitiveLike> = new Map(
            primitiveRows.map((p) => [
              String(p.id),
              {
                id: String(p.id),
                name: p.name,
                category: p.category,
                buCost: p.buCost,
              },
            ]),
          );

          const { totalBu: computed } = buildAssemblyAndComputeBU(
            primitiveSlots,
            primitivesById,
            {
              id,
              name: updated.name,
              type: updated.type,
              sourceType: updated.sourceType,
              description: updated.verboseDescription || undefined,
            },
          );
          totalBu = computed;
        }

        await tx.delete(capabilityPrimitives).where(eq(capabilityPrimitives.capabilityId, id));
        if (primitiveSlots.length > 0) {
          await tx.insert(capabilityPrimitives).values(
            primitiveSlots.map((slot) => ({
              capabilityId: id,
              primitiveId: slot.primitiveId,
              role: slot.role,
              quantity: slot.quantity,
              sortOrder: slot.sortOrder,
              slotLabel: slot.slotLabel,
              notes: slot.notes,
            })),
          );
        }

        // Update metadata.totalBu + compiledAt.
        const current = await tx.query.capabilities.findFirst({
          where: eq(capabilities.id, id),
        });
        if (current) {
          const existingMd = safeMetadata(current.metadata);
          const newMd: Record<string, JsonValue> = {
            ...existingMd,
            totalBu,
            compiledAt: new Date().toISOString(),
          };
          if ("previewBu" in newMd) delete (newMd as Record<string, unknown>)["previewBu"];

          await tx
            .update(capabilities)
            .set({ metadata: newMd, updatedAt: new Date() })
            .where(eq(capabilities.id, id));
        }

        // Replace effect slot links.
        if (effectSlots.length > 0) {
          const effectIds = Array.from(new Set(effectSlots.map((s) => s.effectId)));
          const effectRows = await tx
            .select({ id: effects.id })
            .from(effects)
            .where(inArray(effects.id, effectIds));
          if (effectRows.length !== new Set(effectIds).size) {
            const foundIds = new Set(effectRows.map((e) => e.id));
            const missing = effectIds.filter((eid) => !foundIds.has(eid));
            throw new Error(`Unknown effectIds: ${missing.join(", ")}`);
          }
        }
        await tx.delete(capabilityEffects).where(eq(capabilityEffects.capabilityId, id));
        if (effectSlots.length > 0) {
          await tx.insert(capabilityEffects).values(
            effectSlots.map((slot) => ({
              capabilityId: id,
              effectId: slot.effectId,
              sortOrder: slot.sortOrder,
              slotLabel: slot.slotLabel,
              notes: slot.notes,
            })),
          );
        }

        // Return full capability with links.
        return tx.query.capabilities.findFirst({
          where: eq(capabilities.id, id),
          with: {
            primitiveLinks: {
              with: {
                primitive: true,
              },
            },
            effectLinks: {
              with: {
                effect: true,
              },
            },
          },
        });
      });

      // Phase 4: auto-snapshot the updated capability.
      await recordVersion({
        entityKind: "capability",
        entityId: id,
        contentHash: draftHash,
        snapshot: canonicalPayload as unknown as Record<string, unknown>,
        publishedByUserId: userId,
      });

      return NextResponse.json(
        {
          capability: result,
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

    // outcome.kind === "forked" — INSERT a new row.
    // sourceOrigin for the fork: "fork:<sourceId>" for non-greenfield,
    // or the user-supplied sourceOrigin for greenfield.
    const finalSourceOrigin = source !== null
      ? `fork:${source.id}`
      : (userSourceOriginRaw || null);

    const baseName = source !== null
      ? await computeUniqueForkName(
          name,
          await buildCapabilityTakenNamesSet(name, finalSourceOrigin, userId),
        )
      : name;

    const created = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(capabilities)
        .values({
          name: baseName,
          // `type` and `sourceType` are typed `string | null` by their
          // parsers; the form always sends valid values, so we cast at
          // the boundary. Drizzle's typed-enum INSERT requires the
          // exact union. The validation above already rejected invalid
          // enum strings, so this cast is safe.
          type: type as "AUGMENT" | "ACTIVE" | "PASSIVE",
          sourceType: sourceType as "PHYSICAL" | "MAGICAL" | "PSYCHIC",
          verboseDescription,
          isPublic,
          userId,
          sourceOrigin: finalSourceOrigin,
          tags,
          contentHash: draftHash,
          // metadata is a non-null jsonb column with a default; the
          // default isn't applied at the TypeScript type level. We
          // seed an empty object here, then UPDATE it with the
          // computed totalBu after the slot links are inserted.
          metadata: {},
        })
        .returning();

      if (!inserted) {
        throw new Error("Unable to create capability.");
      }

      // Validate + insert primitive slots.
      let totalBu = 0;
      if (primitiveSlots.length > 0) {
        const primitiveIds = primitiveSlots.map((s) => s.primitiveId);
        const primitiveRows = await tx
          .select()
          .from(primitives)
          .where(inArray(primitives.id, primitiveIds));

        if (primitiveRows.length !== new Set(primitiveIds).size) {
          const foundIds = new Set(primitiveRows.map((p) => p.id));
          const missing = primitiveIds.filter((pid) => !foundIds.has(pid));
          throw new Error(`Unknown primitiveIds: ${missing.join(", ")}`);
        }

        const primitivesById: ReadonlyMap<string, PrimitiveLike> = new Map(
          primitiveRows.map((p) => [
            String(p.id),
            {
              id: String(p.id),
              name: p.name,
              category: p.category,
              buCost: p.buCost,
            },
          ]),
        );

        const { totalBu: computed } = buildAssemblyAndComputeBU(
          primitiveSlots,
          primitivesById,
          {
            id: inserted.id,
            name: inserted.name,
            type: inserted.type,
            sourceType: inserted.sourceType,
            description: inserted.verboseDescription || undefined,
          },
        );
        totalBu = computed;

        await tx.insert(capabilityPrimitives).values(
          primitiveSlots.map((slot) => ({
            capabilityId: inserted.id,
            primitiveId: slot.primitiveId,
            role: slot.role,
            quantity: slot.quantity,
            sortOrder: slot.sortOrder,
            slotLabel: slot.slotLabel,
            notes: slot.notes,
          })),
        );

        // Persist metadata.totalBu + compiledAt on the new row.
        const newMd: Record<string, JsonValue> = {
          totalBu,
          compiledAt: new Date().toISOString(),
        };
        await tx
          .update(capabilities)
          .set({ metadata: newMd, updatedAt: new Date() })
          .where(eq(capabilities.id, inserted.id));
      }

      // Validate + insert effect slots.
      if (effectSlots.length > 0) {
        const effectIds = Array.from(new Set(effectSlots.map((s) => s.effectId)));
        const effectRows = await tx
          .select({ id: effects.id })
          .from(effects)
          .where(inArray(effects.id, effectIds));
        if (effectRows.length !== new Set(effectIds).size) {
          const foundIds = new Set(effectRows.map((e) => e.id));
          const missing = effectIds.filter((eid) => !foundIds.has(eid));
          throw new Error(`Unknown effectIds: ${missing.join(", ")}`);
        }

        await tx.insert(capabilityEffects).values(
          effectSlots.map((slot) => ({
            capabilityId: inserted.id,
            effectId: slot.effectId,
            sortOrder: slot.sortOrder,
            slotLabel: slot.slotLabel,
            notes: slot.notes,
          })),
        );
      }

      // Return full capability with links.
      return tx.query.capabilities.findFirst({
        where: eq(capabilities.id, inserted.id),
        with: {
          primitiveLinks: {
            with: {
              primitive: true,
            },
          },
          effectLinks: {
            with: {
              effect: true,
            },
          },
        },
      });
    });

    if (!created) {
      throw new Error("Unable to load forked capability.");
    }

    // Phase 4: auto-snapshot the new fork.
    await recordVersion({
      entityKind: "capability",
      entityId: created.id,
      contentHash: draftHash,
      snapshot: canonicalPayload as unknown as Record<string, unknown>,
      publishedByUserId: userId,
    });

    return NextResponse.json(
      {
        capability: created,
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
 * DELETE /api/capabilities/[id]
 * Delete a capability and all its primitive links (cascade).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth.protect();
    const { id } = await params;

    // Ownership gate: system content (user_id IS NULL) cannot be deleted via API.
    const existing = await db.query.capabilities.findFirst({
      where: eq(capabilities.id, id),
      columns: { id: true, userId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Capability not found." }, { status: 404 });
    }
    if (existing.userId !== userId) {
      return NextResponse.json(
        { error: "You can only delete capabilities you own." },
        { status: 403 },
      );
    }

    const [deleted] = await db
      .delete(capabilities)
      .where(eq(capabilities.id, id))
      .returning({ id: capabilities.id });

    if (!deleted) {
      return NextResponse.json({ error: "Capability not found." }, { status: 404 });
    }

    return NextResponse.json({ deleted: deleted.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
