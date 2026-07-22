import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { asc, eq, inArray, and, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  itemCapabilities,
  itemEffects,
  itemPrimitives,
  items,
  primitives,
} from "@/db/schema";
import { ITEM_PRIMITIVE_CATEGORY } from "../route";
import {
  dispatchEntitySave,
  type SaveTargetType,
} from "@/lib/publishing/dispatch-save";
import { parseSaveIntent } from "@/lib/publishing/save-intent";
import { getCallerIsAdmin, resolveUserIdByClerkId } from "@/lib/auth/author-resolver";
import { recordForkAttribution } from "@/lib/publishing/fork-attribution";
import type { ReactionTargetType } from "@/lib/engagement/version-helpers";
import { computeUniqueForkName } from "@/lib/publishing/fork-naming";
import { computeTransitiveBu } from "@/lib/engine/transitive-bu";
import {
  buildCanonicalItemPayload,
  isItemDraftEmpty,
  computeItemContentHash,
} from "@/lib/publishing/hash-content";
import { recordVersion } from "@/lib/versions/auto-snapshot";

const TARGET_TYPE: SaveTargetType = "ITEM";

const VALID_TYPES = [
  "WEAPON",
  "ARMOR",
  "TRINKET",
  "ARTIFACT",
  "CONSUMABLE",
] as const;
const VALID_RARITIES = ["COMMON", "RARE", "EPIC", "LEGENDARY"] as const;

function parseType(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase();
  if ((VALID_TYPES as readonly string[]).includes(upper)) return upper;
  return null;
}

function parseRarity(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase();
  if ((VALID_RARITIES as readonly string[]).includes(upper)) return upper;
  return null;
}

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((t) => t.trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(",").map((t) => t.trim()).filter(Boolean);
  }
  return [];
}

function parseIntInRange(value: unknown, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isInteger(n)) return min;
  return Math.max(min, Math.min(max, n));
}

/**
 * Phase 2: build a sync-existence predicate for the (name, sourceOrigin)
 * pair the new fork row will use, so the forked name doesn't collide
 * with the user's existing rows.
 *
 * Mashu 2026-07-09: predicate now preloads every name in the user's
 * (sourceOrigin) namespace that matches the `${name} (fork)%` prefix.
 * See effects/[id]/route.ts for the full rationale.
 */
async function buildItemTakenNamesSet(
  name: string,
  sourceOrigin: string | null,
  userId: string,
): Promise<(candidate: string) => boolean> {
  const forkPrefix = `${name} (fork)`;
  const rows = await db
    .select({ name: items.name })
    .from(items)
    .where(
      and(
        sourceOrigin === null
          ? isNull(items.sourceOrigin)
          : eq(items.sourceOrigin, sourceOrigin),
        eq(items.userId, userId),
        sql`${items.name} LIKE ${forkPrefix + "%"}`,
      ),
    );
  const taken = new Set(rows.map((r) => r.name));
  return (candidate: string) => taken.has(candidate);
}

/**
 * GET /api/items/[id]
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const row = await db.query.items.findFirst({
    where: eq(items.id, id),
    with: {
      primitiveLinks: { with: { primitive: true } },
      // Phase 8.1 batch 13.1 follow-up: deep-join so the returned
      // item carries the full transitive closure (capability
      // primitives + effect primitives + capability effect
      // primitives). Per Mashu 2026-07-22: "only primitives cost
      // BU. Capabilities, effects, heritages, and items are ways
      // to organize primitives for runtime use — they NEVER debit
      // BU on their own."
      capabilityLinks: {
        with: {
          capability: {
            with: {
              primitiveLinks: { with: { primitive: true } },
              effectLinks: {
                with: {
                  effect: { with: { primitiveLinks: { with: { primitive: true } } } },
                },
              },
            },
          },
        },
      },
      effectLinks: {
        with: {
          effect: {
            with: {
              primitiveLinks: { with: { primitive: true } },
            },
          },
        },
      },
    },
  });

  if (!row) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }

  // Phase 8.1 batch 13.1 follow-up: attach computedBu so the
  // library list filter / character-modal bundle display
  // reflect the full transitive closure.
  const computedBu = computeTransitiveBu({
    primitiveLinks: row.primitiveLinks,
    capabilityLinks: row.capabilityLinks.map((cl) => ({
      capabilityId: cl.capabilityId,
      primitiveLinks: cl.capability.primitiveLinks,
      effectLinks: cl.capability.effectLinks?.map((el) => ({
        effectId: el.effectId,
        primitiveLinks: el.effect.primitiveLinks,
      })),
    })),
    effectLinks: row.effectLinks.map((el) => ({
      effectId: el.effectId,
      primitiveLinks: el.effect.primitiveLinks,
    })),
  }).transitiveBu;

  return NextResponse.json({ item: { ...row, computedBu } });
}

/**
 * PATCH /api/items/[id] — Phase 2 deferred-fork entry point.
 *
 * Same shape as /api/effects/[id] PATCH:
 *   - intent=load + caller owns source → UPDATE in place (version-update)
 *   - intent=fork (any ownership) → INSERT new fork row
 *   - load + caller doesn't own → INSERT new fork row
 *   - no-changes (contentHash matches) → no-op, return user-facing message
 *
 * Response shape:
 *   { item, dispatchOutcome: { kind, newId, sourceId, swapTarget } | { kind: "no-op", message } }
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

    // -------------------------------------------------------------------
    // Field parsing — preserve all existing validations from the legacy
    // PATCH. The form sends a full draft.
    // -------------------------------------------------------------------
    const name = String(values["name"] ?? "").trim();

    let itemType: string | null = null;
    if ("itemType" in values) {
      itemType = parseType(values["itemType"]);
      if (!itemType) {
        return NextResponse.json(
          { error: `itemType must be one of: ${VALID_TYPES.join(", ")}.` },
          { status: 400 },
        );
      }
    }

    let rarity: string | null = null;
    if ("rarity" in values) {
      rarity = parseRarity(values["rarity"]);
      if (!rarity) {
        return NextResponse.json(
          { error: `rarity must be one of: ${VALID_RARITIES.join(", ")}.` },
          { status: 400 },
        );
      }
    }

    const buCost = "buCost" in values
      ? parseIntInRange(values["buCost"], 0, 1000)
      : 0;
    const description = "description" in values
      ? String(values["description"]).trim()
      : "";
    const slotCost = "slotCost" in values
      ? parseIntInRange(values["slotCost"], 1, 100)
      : 1;
    // Quantity: any positive integer, no upper cap.
    let quantity = 1;
    if ("quantity" in values) {
      const n = Number(values["quantity"]);
      quantity = Math.max(1, Number.isFinite(n) && n > 0 ? Math.floor(n) : 1);
    }

    const isTwoHanded = "isTwoHanded" in values
      ? Boolean(values["isTwoHanded"])
      : false;
    const isConsumable = "isConsumable" in values
      ? Boolean(values["isConsumable"])
      : false;
    const actsAsFocus = "actsAsFocus" in values
      ? Boolean(values["actsAsFocus"])
      : true;
    const isPublic = "isPublic" in values
      ? Boolean(values["isPublic"])
      : false;
    const userSourceOriginRaw = String(values["sourceOrigin"] ?? "").trim();
    const tags = "tags" in values ? parseTags(values["tags"]) : [];

    // Phase 7 Q-M-UX: accept primitiveSlots ({primitiveId, isMirrored}[]).
    // Fall back to primitiveIds (number[]) for legacy payloads.
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
    const effectIds = Array.isArray(values["effectIds"])
      ? (values["effectIds"] as unknown[]).filter(
          (e) => typeof e === "string",
        )
      : [];

    if (!name) {
      return NextResponse.json({ error: "Item name is required." }, { status: 400 });
    }

    // -------------------------------------------------------------------
    // Canonical payload + content hash (server is the source of truth).
    // -------------------------------------------------------------------
    const canonicalPayload = buildCanonicalItemPayload({
      name,
      itemType: itemType ?? "TRINKET",
      rarity: rarity ?? "COMMON",
      buCost,
      description,
      slotCost,
      quantity,
      isTwoHanded,
      isConsumable,
      actsAsFocus,
      isPublic,
      tags,
      primitiveIds: primitiveSlots.map((s) => s.primitiveId),
      primitiveSlots,
      capabilityIds: capabilityIds as string[],
      effectIds: effectIds as string[],
      // Phase 8: per-entity iconography
      iconSource: pickIconSource(values["iconSource"]),
      iconKey: pickStringOrNull(values["iconKey"]),
      iconUrl: pickStringOrNull(values["iconUrl"]),
      iconColor: pickStringOrDefault(values["iconColor"], "#ffffff"),
    });
    const draftIsEmpty = isItemDraftEmpty(canonicalPayload);
    const draftHash = await computeItemContentHash({
      name,
      itemType: itemType ?? "TRINKET",
      rarity: rarity ?? "COMMON",
      buCost,
      description,
      slotCost,
      quantity,
      isTwoHanded,
      isConsumable,
      actsAsFocus,
      isPublic,
      tags,
      primitiveIds: primitiveSlots.map((s) => s.primitiveId),
      primitiveSlots,
      capabilityIds: capabilityIds as string[],
      effectIds: effectIds as string[],
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
    // through to dispatchEntitySave (admin canon-edit rule) AND to the
    // fork-attribution call below (avoid duplicate DB queries).
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
          item: null,
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
      const sourceItem = await db.query.items.findFirst({
        where: eq(items.id, id),
      });
      if (!sourceItem) {
        return NextResponse.json({ error: "Item not found." }, { status: 404 });
      }

      const updatePayload: Record<string, unknown> = {
        name,
        ...(itemType !== null && { itemType }),
        ...(rarity !== null && { rarity }),
        buCost,
        description,
        slotCost,
        quantity,
        isTwoHanded,
        isConsumable,
        actsAsFocus,
        isPublic,
        tags,
        sourceOrigin: sourceItem.sourceOrigin, // preserve
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
          .update(items)
          .set(updatePayload)
          .where(
            and(
              eq(items.id, id),
              or(eq(items.userId, userId), isNull(items.userId)),
            ),
          );

        // Validate + replace primitive slots.
        if (
          ("primitiveSlots" in values || "primitiveIds" in values) &&
          primitiveSlots.length > 0
        ) {
          const ids = primitiveSlots.map((s) => s.primitiveId);
          const prims = await tx
            .select({
              id: primitives.id,
              category: primitives.category,
              name: primitives.name,
            })
            .from(primitives)
            .where(inArray(primitives.id, ids));
          const wrong = prims.filter(
            (p) => p.category !== ITEM_PRIMITIVE_CATEGORY,
          );
          if (wrong.length > 0) {
            throw new Error(
              `Items can only use ${ITEM_PRIMITIVE_CATEGORY} primitives. Invalid: ${wrong.map((p) => p.name).join(", ")}`,
            );
          }
          const validIdSet = new Set(prims.map((p) => p.id));
          const validSlots = primitiveSlots.filter((s) =>
            validIdSet.has(s.primitiveId),
          );
          await tx.delete(itemPrimitives).where(eq(itemPrimitives.itemId, id));
          await tx.insert(itemPrimitives).values(
            validSlots.map((slot, idx) => ({
              itemId: id,
              primitiveId: slot.primitiveId,
              sortOrder: idx,
              // Phase 7 Q-M-UX: persist per-slot Mirrored flag.
              isMirrored: slot.isMirrored,
            })),
          );
        } else if ("primitiveSlots" in values || "primitiveIds" in values) {
          // Empty primitiveSlots payload — clear all slots.
          await tx.delete(itemPrimitives).where(eq(itemPrimitives.itemId, id));
        }

        // Replace capability slots.
        if ("capabilityIds" in values) {
          await tx
            .delete(itemCapabilities)
            .where(eq(itemCapabilities.itemId, id));
          if (capabilityIds.length > 0) {
            await tx.insert(itemCapabilities).values(
              capabilityIds.map((cid) => ({
                itemId: id,
                capabilityId: cid as string,
              })),
            );
          }
        }

        // Replace effect slots.
        if ("effectIds" in values) {
          await tx.delete(itemEffects).where(eq(itemEffects.itemId, id));
          if (effectIds.length > 0) {
            await tx.insert(itemEffects).values(
              effectIds.map((eid) => ({
                itemId: id,
                effectId: eid as string,
              })),
            );
          }
        }

        return tx.query.items.findFirst({
          where: eq(items.id, id),
          with: {
            primitiveLinks: { with: { primitive: true } },
            capabilityLinks: { with: { capability: true } },
            effectLinks: { with: { effect: true } },
          },
        });
      });

      // Phase 4: auto-snapshot the updated item.
      await recordVersion({
        entityKind: "item",
        entityId: id,
        contentHash: draftHash,
        snapshot: canonicalPayload as unknown as Record<string, unknown>,
        publishedByUserId: userId,
      });

      return NextResponse.json(
        {
          item: result,
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
          await buildItemTakenNamesSet(name, finalSourceOrigin, userId),
        )
      : name;

    const created = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(items)
        .values({
          name: baseName,
          // Drizzle's typed-enum INSERT requires the exact union; the
          // parsed `itemType`/`rarity` are loosely typed (string) so
          // we cast at the boundary. The validation above already
          // guarantees these are valid enum values.
          itemType: (itemType ?? "TRINKET") as
            | "WEAPON"
            | "ARMOR"
            | "TRINKET"
            | "ARTIFACT"
            | "CONSUMABLE",
          rarity: (rarity ?? "COMMON") as
            | "COMMON"
            | "RARE"
            | "EPIC"
            | "LEGENDARY",
          buCost,
          description,
          slotCost,
          quantity,
          isTwoHanded,
          isConsumable,
          actsAsFocus,
          isPublic,
          userId,
          sourceOrigin: finalSourceOrigin,
          tags,
          contentHash: draftHash,
        })
        .returning();

      if (!inserted) {
        throw new Error("Unable to create item.");
      }

      // Validate + insert primitive slots.
      if (primitiveSlots.length > 0) {
        const ids = primitiveSlots.map((s) => s.primitiveId);
        const prims = await tx
          .select({
            id: primitives.id,
            category: primitives.category,
            name: primitives.name,
          })
          .from(primitives)
          .where(inArray(primitives.id, ids));
        const wrong = prims.filter(
          (p) => p.category !== ITEM_PRIMITIVE_CATEGORY,
        );
        if (wrong.length > 0) {
          throw new Error(
            `Items can only use ${ITEM_PRIMITIVE_CATEGORY} primitives. Invalid: ${wrong.map((p) => p.name).join(", ")}`,
          );
        }
        const validIdSet = new Set(prims.map((p) => p.id));
        const validSlots = primitiveSlots.filter((s) =>
          validIdSet.has(s.primitiveId),
        );
        await tx.insert(itemPrimitives).values(
          validSlots.map((slot, idx) => ({
            itemId: inserted.id,
            primitiveId: slot.primitiveId,
            sortOrder: idx,
            // Phase 7 Q-M-UX: persist per-slot Mirrored flag.
            isMirrored: slot.isMirrored,
          })),
        );
      }

      // Insert capability slots.
      if (capabilityIds.length > 0) {
        await tx.insert(itemCapabilities).values(
          capabilityIds.map((cid) => ({
            itemId: inserted.id,
            capabilityId: cid as string,
          })),
        );
      }

      // Insert effect slots.
      if (effectIds.length > 0) {
        await tx.insert(itemEffects).values(
          effectIds.map((eid) => ({
            itemId: inserted.id,
            effectId: eid as string,
          })),
        );
      }

      return tx.query.items.findFirst({
        where: eq(items.id, inserted.id),
        with: {
          primitiveLinks: { with: { primitive: true } },
          capabilityLinks: { with: { capability: true } },
          effectLinks: { with: { effect: true } },
        },
      });
    });

    if (!created) {
      throw new Error("Unable to load forked item.");
    }

    // Phase 4: auto-snapshot the new fork.
    await recordVersion({
      entityKind: "item",
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

    return NextResponse.json(
      {
        item: created,
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
 * DELETE /api/items/[id]
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth.protect();
    const { id } = await params;

    // Ownership gate: system content (user_id IS NULL) cannot be deleted via API.
    const existing = await db.query.items.findFirst({
      where: eq(items.id, id),
      columns: { id: true, userId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Item not found." }, { status: 404 });
    }
    if (existing.userId !== userId) {
      return NextResponse.json(
        { error: "You can only delete items you own." },
        { status: 403 },
      );
    }

    const [deleted] = await db
      .delete(items)
      .where(eq(items.id, id))
      .returning({ id: items.id });

    if (!deleted) {
      return NextResponse.json({ error: "Item not found." }, { status: 404 });
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
