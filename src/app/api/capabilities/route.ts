import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { asc, eq, inArray } from "drizzle-orm";
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
  buildCanonicalCapabilityPayload,
  computeCapabilityContentHash,
} from "@/lib/publishing/hash-content";
import { recordVersion } from "@/lib/versions/auto-snapshot";
import { resolveUserIdByClerkId } from "@/lib/auth/author-resolver";
import { autoPublishOnCreate } from "@/lib/publishing/auto-publish";

/**
 * GET /api/capabilities
 *
 * Lists capabilities. Public + user-owned (if authenticated).
 * Returns capabilities with their primitive links.
 */
export async function GET() {
  const rows = await db.query.capabilities.findMany({
    where: eq(capabilities.isPublic, true),
    orderBy: [asc(capabilities.name)],
    with: {
      primitiveLinks: {
        orderBy: [asc(capabilityPrimitives.sortOrder)],
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

  return NextResponse.json({ capabilities: rows });
}

/**
 * POST /api/capabilities
 *
 * Atomically create a capability with its primitive slots.
 * The server computes totalBu from the provided primitives — clients
 * cannot lie about cost.
 *
 * Body:
 *   - name (required)
 *   - type: ACTIVE | PASSIVE | AUGMENT (required)
 *   - sourceType: PHYSICAL | MAGICAL | PSYCHIC (required)
 *   - verboseDescription (optional)
 *   - isPublic (default false)
 *   - sourceOrigin (optional)
 *   - tags (string[] or comma-separated)
 *   - metadata (object, optional — `previewBu` from client is IGNORED)
 *   - primitiveSlots (array of {primitiveId, role, quantity?, sortOrder?, slotLabel?, notes?})
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth.protect();
    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const values = body as Record<string, unknown>;
    const name = String(values["name"] ?? "").trim();
    const type = parseCapabilityType(values["type"]);
    const sourceType = parseSourceType(values["sourceType"]);
    const verboseDescription = String(values["verboseDescription"] ?? "").trim();
    const isPublic = Boolean(values["isPublic"]);
    const sourceOrigin = String(values["sourceOrigin"] ?? "").trim() || null;
    const tags = parseTags(values["tags"]);
    const clientMetadata = safeMetadata(values["metadata"]);

    if (!name) {
      return NextResponse.json({ error: "Capability name is required." }, { status: 400 });
    }
    if (!type) {
      return NextResponse.json(
        { error: "Type must be ACTIVE, PASSIVE, or AUGMENT." },
        { status: 400 },
      );
    }
    if (!sourceType) {
      return NextResponse.json(
        { error: "Source type must be PHYSICAL, MAGICAL, or PSYCHIC." },
        { status: 400 },
      );
    }

    // Parse primitive slots first (may throw on bad input)
    let slots: ReturnType<typeof parsePrimitiveSlots> = [];
    if ("primitiveSlots" in values && values["primitiveSlots"] != null) {
      slots = parsePrimitiveSlots(values["primitiveSlots"]);
    }

    // Parse effect slots (may throw on bad input)
    let effectSlots: ReturnType<typeof parseEffectSlots> = [];
    if ("effectSlots" in values && values["effectSlots"] != null) {
      effectSlots = parseEffectSlots(values["effectSlots"]);
    }

    // Server-authoritative BU computation
    let totalBu = 0;
    let primitivesById: ReadonlyMap<string, PrimitiveLike> = new Map();
    if (slots.length > 0) {
      const primitiveIds = slots.map((s) => s.primitiveId);
      const primitiveRows = await db
        .select()
        .from(primitives)
        .where(inArray(primitives.id, primitiveIds));

      if (primitiveRows.length !== new Set(primitiveIds).size) {
        const foundIds = new Set(primitiveRows.map((p) => p.id));
        const missing = primitiveIds.filter((id) => !foundIds.has(id));
        return NextResponse.json(
          { error: `Unknown primitiveIds: ${missing.join(", ")}` },
          { status: 400 },
        );
      }

      primitivesById = new Map(
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

      const result = buildAssemblyAndComputeBU(
        slots,
        primitivesById,
        {
          id: "temp", // server overwrites after insert
          name,
          type,
          sourceType,
          description: verboseDescription || undefined,
        },
      );
      totalBu = result.totalBu;
    }

    // Authoritative metadata: drop client's previewBu, inject server BU
    const metadata = {
      ...clientMetadata,
      totalBu,
      compiledAt: new Date().toISOString(),
    };
    // Strip the client-lied previewBu (if any) from the metadata
    if ("previewBu" in metadata) {
      delete (metadata as Record<string, unknown>)["previewBu"];
    }

    // Atomic insert: capability + primitive links in a transaction
    const result = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(capabilities)
        .values({
          name,
          type,
          sourceType,
          verboseDescription,
          isPublic,
          userId,
          sourceOrigin,
          tags,
          metadata,
          // Phase 8: per-entity iconography
          iconSource: pickIconSource(values["iconSource"]),
          iconKey: pickStringOrNull(values["iconKey"]),
          iconUrl: pickStringOrNull(values["iconUrl"]),
          iconColor: pickStringOrDefault(values["iconColor"], "#ffffff"),
        })
        .returning();

      if (!created) {
        throw new Error("Unable to create capability.");
      }

      if (slots.length > 0) {
        await tx.insert(capabilityPrimitives).values(
          slots.map((slot) => ({
            capabilityId: created.id,
            primitiveId: slot.primitiveId,
            role: slot.role,
            quantity: slot.quantity,
            sortOrder: slot.sortOrder,
            slotLabel: slot.slotLabel,
            notes: slot.notes,
            // Phase 7 Q-M-UX: persist per-slot Mirrored flag.
            isMirrored: slot.isMirrored,
          })),
        );
      }

      if (effectSlots.length > 0) {
        // Validate effectIds exist before insert to avoid FK errors.
        const effectIds = Array.from(new Set(effectSlots.map((s) => s.effectId)));
        const effectRows = await tx
          .select({ id: effects.id })
          .from(effects)
          .where(inArray(effects.id, effectIds));
        if (effectRows.length !== new Set(effectIds).size) {
          const foundIds = new Set(effectRows.map((e) => e.id));
          const missing = effectIds.filter((id) => !foundIds.has(id));
          throw new Error(`Unknown effectIds: ${missing.join(", ")}`);
        }
        await tx.insert(capabilityEffects).values(
          effectSlots.map((slot) => ({
            capabilityId: created.id,
            effectId: slot.effectId,
            sortOrder: slot.sortOrder,
            slotLabel: slot.slotLabel,
            notes: slot.notes,
          })),
        );
      }

      // Return full capability with links
      return tx.query.capabilities.findFirst({
        where: eq(capabilities.id, created.id),
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

    if (!result) {
      throw new Error("Unable to create capability.");
    }

    // Phase 9 round 8: auto-publish when isPublic=true so the
    // library visibility filter (publications-table-driven) treats
    // the new capability as public immediately.
    if (result.isPublic) {
      try {
        const authorUuid = await resolveUserIdByClerkId(userId);
        if (authorUuid) {
          await autoPublishOnCreate({
            targetType: "CAPABILITY",
            targetId: result.id,
            authorId: authorUuid,
            isPublic: true,
          });
        }
      } catch (err) {
        console.error("[capabilities POST] auto-publish failed:", err);
      }
    }

    // Phase 4: compute content hash + auto-snapshot.
    const contentHash = await computeCapabilityContentHash({
      name: result.name,
      type: result.type,
      sourceType: result.sourceType,
      verboseDescription: result.verboseDescription,
      tags: result.tags,
      isPublic: result.isPublic,
      primitiveSlots: slots.map((s) => ({
        primitiveId: s.primitiveId,
        role: s.role,
        quantity: s.quantity,
        slotLabel: s.slotLabel ?? "",
        notes: s.notes ?? "",
      })),
      effectIds: effectSlots.map((s) => s.effectId),
    });
    const canonicalPayload = buildCanonicalCapabilityPayload({
      name: result.name,
      type: result.type,
      sourceType: result.sourceType,
      verboseDescription: result.verboseDescription,
      tags: result.tags,
      isPublic: result.isPublic,
      primitiveSlots: slots.map((s) => ({
        primitiveId: s.primitiveId,
        role: s.role,
        quantity: s.quantity,
        slotLabel: s.slotLabel ?? "",
        notes: s.notes ?? "",
      })),
      effectIds: effectSlots.map((s) => s.effectId),
    });
    await db
      .update(capabilities)
      .set({ contentHash })
      .where(eq(capabilities.id, result.id));
    await recordVersion({
      entityKind: "capability",
      entityId: result.id,
      contentHash,
      snapshot: canonicalPayload as unknown as Record<string, unknown>,
      publishedByUserId: userId,
    });

    return NextResponse.json({ capability: result }, { status: 201 });
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
