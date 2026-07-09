/**
 * POST /api/versions/restore
 *
 * P5R-5: Restore a previous version of an entity.
 *
 * The endpoint:
 *  1. Loads the reconstructed payload for the (type, id, versionNumber) tuple.
 *  2. Verifies the caller owns the live row (or it's system content).
 *  3. Updates the live row's SCALAR fields to match the old version
 *     (name, description, buCost, isPublic, tags, etc.).
 *  4. Records a new version row representing the restore event.
 *  5. Returns success with a warning that slotted primitives/effects/
 *     capabilities/items are NOT restored (they live in join tables that
 *     aren't snapshotted — full join-table snapshotting is post-MVP).
 *
 * Slot links restoration is intentionally out of scope for P5R-5. The
 * version snapshot only captures the entity's own columns; join tables
 * (capabilityPrimitives, effectPrimitives, itemCapabilities, etc.) would
 * need their own version tracking. For P5R-5, restoring scalars gives
 * users most of the value (name/description/buCost corrections) without
 * the cost of a schema-wide change.
 *
 * Body: { type: "PRIMITIVE"|"EFFECT"|"CAPABILITY"|"ITEM"|"TEMPLATE",
 *         id: string|number,
 *         versionNumber: number }
 *
 * Response: { success: true, newVersionNumber, warnings?: string[] }
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db/client";
import {
  capabilities,
  capabilityEffects,
  capabilityPrimitives,
  effects,
  effectPrimitives,
  items,
  itemCapabilities,
  itemEffects,
  itemPrimitives,
  primitives,
  templates,
  templateCapabilities,
  templatePrimitives,
} from "@/db/schema";
import { recordVersion } from "@/lib/versions/auto-snapshot";
import {
  effectVersions,
  itemVersions,
  primitiveVersions,
  templateVersions,
} from "@/db/schema";
import { reconstructVersion, type VersionPayload } from "@/lib/versions/delta";
import {
  computeCapabilityContentHash,
  computeEffectContentHash,
  computeItemContentHash,
  computePrimitiveContentHash,
  computeTemplateContentHash,
} from "@/lib/publishing/hash-content";

type EntityType = "PRIMITIVE" | "EFFECT" | "CAPABILITY" | "ITEM" | "TEMPLATE";

const VALID_TYPES: ReadonlyArray<EntityType> = [
  "PRIMITIVE",
  "EFFECT",
  "CAPABILITY",
  "ITEM",
  "TEMPLATE",
];

function parseType(value: unknown): EntityType | null {
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase();
  return VALID_TYPES.includes(upper as EntityType)
    ? (upper as EntityType)
    : null;
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asInt(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.floor(v);
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? Math.floor(n) : fallback;
  }
  return fallback;
}

function asBool(v: unknown): boolean {
  return Boolean(v);
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x : String(x)))
    .filter(Boolean);
}

function asNumberArray(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => {
      if (typeof x === "number" && Number.isInteger(x)) return x;
      if (typeof x === "string") {
        const n = Number(x);
        return Number.isInteger(n) ? n : null;
      }
      return null;
    })
    .filter((n): n is number => n !== null);
}

/**
 * Fetch the live row + check ownership. Returns the row's userId, or null
 * if the row doesn't exist. The caller decides whether the row is owned.
 */
async function loadLiveRowUserId(
  type: EntityType,
  id: string | number,
): Promise<string | null | "NOT_FOUND"> {
  if (type === "PRIMITIVE") {
    const numId = typeof id === "string" ? Number(id) : id;
    if (!Number.isInteger(numId)) return "NOT_FOUND";
    const row = await db.query.primitives.findFirst({
      where: eq(primitives.id, numId),
      columns: { userId: true },
    });
    return row ? row.userId : "NOT_FOUND";
  }
  if (type === "EFFECT") {
    const row = await db.query.effects.findFirst({
      where: eq(effects.id, String(id)),
      columns: { userId: true },
    });
    return row ? row.userId : "NOT_FOUND";
  }
  if (type === "CAPABILITY") {
    const row = await db.query.capabilities.findFirst({
      where: eq(capabilities.id, String(id)),
      columns: { userId: true },
    });
    return row ? row.userId : "NOT_FOUND";
  }
  if (type === "ITEM") {
    const row = await db.query.items.findFirst({
      where: eq(items.id, String(id)),
      columns: { userId: true },
    });
    return row ? row.userId : "NOT_FOUND";
  }
  if (type === "TEMPLATE") {
    const row = await db.query.templates.findFirst({
      where: eq(templates.id, String(id)),
      columns: { userId: true },
    });
    return row ? row.userId : "NOT_FOUND";
  }
  return "NOT_FOUND";
}

interface ReconstructedRow {
  versionId: string;
  versionNumber: number;
  payload: Record<string, unknown>;
}

/**
 * Fetch + reconstruct the payload for a specific (type, id, versionNumber).
 * Dispatches to the right *_versions table and walks the chain.
 * Returns null if the version doesn't exist.
 */
async function loadRestoredPayload(
  type: EntityType,
  id: string | number,
  versionNumber: number,
): Promise<ReconstructedRow | null> {
  if (type === "PRIMITIVE") {
    const numId = typeof id === "string" ? Number(id) : id;
    if (!Number.isInteger(numId)) return null;
    const rows = await db
      .select({
        id: primitiveVersions.id,
        versionNumber: primitiveVersions.versionNumber,
        snapshot: primitiveVersions.snapshot,
      })
      .from(primitiveVersions)
      .where(eq(primitiveVersions.primitiveId, numId))
      .orderBy(primitiveVersions.versionNumber);
    const target = rows.find((r) => r.versionNumber === versionNumber);
    if (!target) return null;
    const chain = rows.map((r) => ({
      versionNumber: r.versionNumber,
      payload: r.snapshot as unknown as unknown as VersionPayload,
    }));
    let reconstructed: Record<string, unknown> | null = null;
    try {
      reconstructed = reconstructVersion(chain, versionNumber);
    } catch {
      // Fallback: use the raw snapshot if reconstruction fails (corrupted chain)
      // The snapshot is a VersionPayload, so we need to extract the data
      const snapshot = target.snapshot as unknown as VersionPayload;
      if (snapshot && typeof snapshot === "object" && "kind" in snapshot) {
        if (snapshot.kind === "FULL") {
          reconstructed = snapshot.data;
        } else if (snapshot.kind === "DELTA") {
          reconstructed = snapshot.patch;
        }
      }
    }
    if (!reconstructed) return null;
    return { versionId: target.id, versionNumber: target.versionNumber, payload: reconstructed };
  }
  if (type === "EFFECT") {
    const rows = await db
      .select({
        id: effectVersions.id,
        versionNumber: effectVersions.versionNumber,
        snapshot: effectVersions.snapshot,
      })
      .from(effectVersions)
      .where(eq(effectVersions.effectId, String(id)))
      .orderBy(effectVersions.versionNumber);
    const target = rows.find((r) => r.versionNumber === versionNumber);
    if (!target) return null;
    const chain = rows.map((r) => ({
      versionNumber: r.versionNumber,
      payload: r.snapshot as unknown as unknown as VersionPayload,
    }));
    let reconstructed: Record<string, unknown> | null = null;
    try {
      reconstructed = reconstructVersion(chain, versionNumber);
    } catch {
      // Fallback: use the raw snapshot if reconstruction fails (corrupted chain)
      const snapshot = target.snapshot as unknown as VersionPayload;
      if (snapshot && typeof snapshot === "object" && "kind" in snapshot) {
        if (snapshot.kind === "FULL") {
          reconstructed = snapshot.data;
        } else if (snapshot.kind === "DELTA") {
          reconstructed = snapshot.patch;
        }
      }
    }
    if (!reconstructed) return null;
    return { versionId: target.id, versionNumber: target.versionNumber, payload: reconstructed };
  }
  if (type === "CAPABILITY") {
    const { capabilityVersions } = await import("@/db/schema");
    const rows = await db
      .select({
        id: capabilityVersions.id,
        versionNumber: capabilityVersions.versionNumber,
        snapshot: capabilityVersions.snapshot,
      })
      .from(capabilityVersions)
      .where(eq(capabilityVersions.capabilityId, String(id)))
      .orderBy(capabilityVersions.versionNumber);
    const target = rows.find((r) => r.versionNumber === versionNumber);
    if (!target) return null;
    const chain = rows.map((r) => ({
      versionNumber: r.versionNumber,
      payload: r.snapshot as unknown as unknown as VersionPayload,
    }));
    let reconstructed: Record<string, unknown> | null = null;
    try {
      reconstructed = reconstructVersion(chain, versionNumber);
    } catch {
      // Fallback: use the raw snapshot if reconstruction fails (corrupted chain)
      const snapshot = target.snapshot as unknown as VersionPayload;
      if (snapshot && typeof snapshot === "object" && "kind" in snapshot) {
        if (snapshot.kind === "FULL") {
          reconstructed = snapshot.data;
        } else if (snapshot.kind === "DELTA") {
          reconstructed = snapshot.patch;
        }
      }
    }
    if (!reconstructed) return null;
    return { versionId: target.id, versionNumber: target.versionNumber, payload: reconstructed };
  }
  if (type === "ITEM") {
    const rows = await db
      .select({
        id: itemVersions.id,
        versionNumber: itemVersions.versionNumber,
        snapshot: itemVersions.snapshot,
      })
      .from(itemVersions)
      .where(eq(itemVersions.itemId, String(id)))
      .orderBy(itemVersions.versionNumber);
    const target = rows.find((r) => r.versionNumber === versionNumber);
    if (!target) return null;
    const chain = rows.map((r) => ({
      versionNumber: r.versionNumber,
      payload: r.snapshot as unknown as unknown as VersionPayload,
    }));
    let reconstructed: Record<string, unknown> | null = null;
    try {
      reconstructed = reconstructVersion(chain, versionNumber);
    } catch {
      // Fallback: use the raw snapshot if reconstruction fails (corrupted chain)
      const snapshot = target.snapshot as unknown as VersionPayload;
      if (snapshot && typeof snapshot === "object" && "kind" in snapshot) {
        if (snapshot.kind === "FULL") {
          reconstructed = snapshot.data;
        } else if (snapshot.kind === "DELTA") {
          reconstructed = snapshot.patch;
        }
      }
    }
    if (!reconstructed) return null;
    return { versionId: target.id, versionNumber: target.versionNumber, payload: reconstructed };
  }
  // TEMPLATE
  const rows = await db
    .select({
      id: templateVersions.id,
      versionNumber: templateVersions.versionNumber,
      snapshot: templateVersions.snapshot,
    })
    .from(templateVersions)
    .where(eq(templateVersions.templateId, String(id)))
    .orderBy(templateVersions.versionNumber);
  const target = rows.find((r) => r.versionNumber === versionNumber);
  if (!target) return null;
  const chain = rows.map((r) => ({
    versionNumber: r.versionNumber,
    payload: r.snapshot as unknown as unknown as VersionPayload,
  }));
  let reconstructed: Record<string, unknown> | null = null;
  try {
    reconstructed = reconstructVersion(chain, versionNumber);
  } catch {
    // Fallback: use the raw snapshot if reconstruction fails (corrupted chain)
    const snapshot = target.snapshot as unknown as VersionPayload;
    if (snapshot && typeof snapshot === "object" && "kind" in snapshot) {
      if (snapshot.kind === "FULL") {
        reconstructed = snapshot.data;
      } else if (snapshot.kind === "DELTA") {
        reconstructed = snapshot.patch;
      }
    }
  }
  if (!reconstructed) return null;
  return { versionId: target.id, versionNumber: target.versionNumber, payload: reconstructed };
}

/**
 * Apply a restored primitive payload to the live row.
 */
async function restorePrimitive(
  id: number,
  payload: Record<string, unknown>,
): Promise<string> {
  const update: Record<string, unknown> = {
    name: asString(payload["name"]),
    category: asString(payload["category"]) || "CORE",
    costTier: asString(payload["costTier"]) || "Tier 1: Minor (4 BU anchor)",
    buCost: asInt(payload["buCost"]),
    mechanicalOutputText: asString(payload["mechanicalOutputText"]),
    narrativeRule: asString(payload["narrativeRule"]),
    isPublic: asBool(payload["isPublic"]),
    isMirrorable: asBool(payload["isMirrorable"]),
    mirrorVector: asString(payload["mirrorVector"]) || "STANDARD_ONLY",
    mirrorBuCredit: asInt(payload["mirrorBuCredit"]),
    mirrorEligibilityNotes: asString(payload["mirrorEligibilityNotes"]),
    updatedAt: new Date(),
  };

  const hash = await computePrimitiveContentHash({
    name: update["name"] as string,
    category: update["category"] as string,
    costTier: update["costTier"] as string,
    buCost: update["buCost"] as number,
    mechanicalOutputText: update["mechanicalOutputText"] as string,
    narrativeRule: update["narrativeRule"] as string,
    isPublic: update["isPublic"] as boolean,
    isMirrorable: update["isMirrorable"] as boolean,
    mirrorVector: update["mirrorVector"] as string,
    mirrorBuCredit: update["mirrorBuCredit"] as number,
    mirrorEligibilityNotes: update["mirrorEligibilityNotes"] as string,
    hardModifiers: Array.isArray(payload["hardModifiers"])
      ? (payload["hardModifiers"] as unknown as readonly never[])
      : [],
  });
  update["contentHash"] = hash;

  await db
    .update(primitives)
    .set(update)
    .where(eq(primitives.id, id));
  return hash;
}

async function restoreEffect(
  id: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const update: Record<string, unknown> = {
    name: asString(payload["name"]),
    narrativeDescription: asString(payload["narrativeDescription"]),
    isPublic: asBool(payload["isPublic"]),
    tags: asStringArray(payload["tags"]),
    updatedAt: new Date(),
  };

  const hash = await computeEffectContentHash({
    name: update["name"] as string,
    narrativeDescription: update["narrativeDescription"] as string,
    tags: update["tags"] as string[],
    isPublic: update["isPublic"] as boolean,
    primitiveSlots: [],
  });
  update["contentHash"] = hash;

  await db.update(effects).set(update).where(eq(effects.id, id));
  return hash;
}

async function restoreCapability(
  id: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const update: Record<string, unknown> = {
    name: asString(payload["name"]),
    type: asString(payload["type"]) || "ACTIVE",
    sourceType: asString(payload["sourceType"]) || "PHYSICAL",
    verboseDescription: asString(payload["verboseDescription"]),
    isPublic: asBool(payload["isPublic"]),
    tags: asStringArray(payload["tags"]),
    updatedAt: new Date(),
  };

  const hash = await computeCapabilityContentHash({
    name: update["name"] as string,
    type: update["type"] as string,
    sourceType: update["sourceType"] as string,
    verboseDescription: update["verboseDescription"] as string,
    tags: update["tags"] as string[],
    isPublic: update["isPublic"] as boolean,
    primitiveSlots: [],
    effectIds: [],
  });
  update["contentHash"] = hash;

  await db.update(capabilities).set(update).where(eq(capabilities.id, id));
  return hash;
}

async function restoreItem(
  id: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const update: Record<string, unknown> = {
    name: asString(payload["name"]),
    itemType: asString(payload["itemType"]) || "TRINKET",
    rarity: asString(payload["rarity"]) || "COMMON",
    buCost: asInt(payload["buCost"]),
    description: asString(payload["description"]),
    slotCost: Math.max(1, asInt(payload["slotCost"], 1)),
    quantity: Math.max(1, asInt(payload["quantity"], 1)),
    isTwoHanded: asBool(payload["isTwoHanded"]),
    isConsumable: asBool(payload["isConsumable"]),
    actsAsFocus: asBool(payload["actsAsFocus"]),
    isPublic: asBool(payload["isPublic"]),
    tags: asStringArray(payload["tags"]),
    updatedAt: new Date(),
  };

  const hash = await computeItemContentHash({
    name: update["name"] as string,
    itemType: update["itemType"] as string,
    rarity: update["rarity"] as string,
    buCost: update["buCost"] as number,
    description: update["description"] as string,
    slotCost: update["slotCost"] as number,
    quantity: update["quantity"] as number,
    isTwoHanded: update["isTwoHanded"] as boolean,
    isConsumable: update["isConsumable"] as boolean,
    actsAsFocus: update["actsAsFocus"] as boolean,
    isPublic: update["isPublic"] as boolean,
    tags: update["tags"] as string[],
    primitiveIds: asNumberArray(payload["primitiveIds"]),
    capabilityIds: asStringArray(payload["capabilityIds"]),
    effectIds: asStringArray(payload["effectIds"]),
  });
  update["contentHash"] = hash;

  await db.update(items).set(update).where(eq(items.id, id));
  return hash;
}

async function restoreTemplate(
  id: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const update: Record<string, unknown> = {
    name: asString(payload["name"]),
    description: asString(payload["description"]) || null,
    suggestedTraits: asString(payload["suggestedTraits"]) || null,
    isPublic: asBool(payload["isPublic"]),
    updatedAt: new Date(),
  };

  const hash = await computeTemplateContentHash({
    kind: asString(payload["kind"]) || "RACE",
    name: update["name"] as string,
    description: (update["description"] as string) ?? "",
    suggestedTraits: (update["suggestedTraits"] as string) ?? "",
    isPublic: update["isPublic"] as boolean,
    primitiveIds: asNumberArray(payload["primitiveIds"]),
    capabilityIds: asStringArray(payload["capabilityIds"]),
  });
  update["contentHash"] = hash;

  await db.update(templates).set(update).where(eq(templates.id, id));
  return hash;
}

/**
 * The standard slot-link reset that runs for every restore. We DELETE
 * existing slot links and INSERT the new ones from the version's payload.
 * This is the same logic a normal PATCH would run on slot updates.
 *
 * Returns the count of slot links written.
 */
async function rewriteSlotLinks(
  type: EntityType,
  id: string | number,
  payload: Record<string, unknown>,
): Promise<{ primitiveSlots: number; effectSlots: number; capabilitySlots: number }> {
  let primitiveSlots = 0;
  let effectSlots = 0;
  let capabilitySlots = 0;

  if (type === "EFFECT") {
    const effectId = String(id);
    const prims = asNumberArray(payload["primitiveIds"]);
    await db.delete(effectPrimitives).where(eq(effectPrimitives.effectId, effectId));
    if (prims.length > 0) {
      await db.insert(effectPrimitives).values(
        prims.map((pid, idx) => ({
          effectId,
          primitiveId: pid,
          quantity: 1,
          sortOrder: idx,
        })),
      );
      primitiveSlots = prims.length;
    }
  } else if (type === "CAPABILITY") {
    const capId = String(id);
    const prims = Array.isArray(payload["primitiveSlots"])
      ? (payload["primitiveSlots"] as Array<Record<string, unknown>>)
      : [];
    const effs = Array.isArray(payload["effectIds"])
      ? asStringArray(payload["effectIds"])
      : [];
    await db.delete(capabilityPrimitives).where(eq(capabilityPrimitives.capabilityId, capId));
    await db.delete(capabilityEffects).where(eq(capabilityEffects.capabilityId, capId));
    if (prims.length > 0) {
      await db.insert(capabilityPrimitives).values(
        prims.map((s, idx) => ({
          capabilityId: capId,
          primitiveId: asInt(s["primitiveId"]),
          role: (asString(s["role"]) || "PRIMARY") as
            | "DOMAIN"
            | "SIZING"
            | "RANGE"
            | "DURATION"
            | "OUTPUT"
            | "VERB"
            | "AUGMENT"
            | "OTHER",
          quantity: Math.max(1, asInt(s["quantity"], 1)),
          sortOrder: asInt(s["sortOrder"], idx),
          slotLabel: asString(s["slotLabel"]) || null,
          notes: asString(s["notes"]) || null,
        })),
      );
      primitiveSlots = prims.length;
    }
    if (effs.length > 0) {
      await db.insert(capabilityEffects).values(
        effs.map((eid, idx) => ({
          capabilityId: capId,
          effectId: eid,
          sortOrder: idx,
        })),
      );
      effectSlots = effs.length;
    }
  } else if (type === "ITEM") {
    const itemId = String(id);
    const prims = asNumberArray(payload["primitiveIds"]);
    const caps = asStringArray(payload["capabilityIds"]);
    const effs = asStringArray(payload["effectIds"]);
    await db.delete(itemPrimitives).where(eq(itemPrimitives.itemId, itemId));
    await db.delete(itemCapabilities).where(eq(itemCapabilities.itemId, itemId));
    await db.delete(itemEffects).where(eq(itemEffects.itemId, itemId));
    if (prims.length > 0) {
      await db.insert(itemPrimitives).values(
        prims.map((pid, idx) => ({
          itemId,
          primitiveId: pid,
          sortOrder: idx,
        })),
      );
      primitiveSlots = prims.length;
    }
    if (caps.length > 0) {
      await db.insert(itemCapabilities).values(
        caps.map((cid) => ({ itemId, capabilityId: cid })),
      );
      capabilitySlots = caps.length;
    }
    if (effs.length > 0) {
      await db.insert(itemEffects).values(
        effs.map((eid) => ({ itemId, effectId: eid })),
      );
      effectSlots = effs.length;
    }
  } else if (type === "TEMPLATE") {
    const templateId = String(id);
    const prims = asNumberArray(payload["primitiveIds"]);
    const caps = asStringArray(payload["capabilityIds"]);
    await db.delete(templatePrimitives).where(eq(templatePrimitives.templateId, templateId));
    await db.delete(templateCapabilities).where(eq(templateCapabilities.templateId, templateId));
    if (prims.length > 0) {
      await db.insert(templatePrimitives).values(
        prims.map((pid, idx) => ({
          templateId,
          primitiveId: pid,
          sortOrder: idx,
        })),
      );
      primitiveSlots = prims.length;
    }
    if (caps.length > 0) {
      await db.insert(templateCapabilities).values(
        caps.map((cid) => ({ templateId, capabilityId: cid })),
      );
      capabilitySlots = caps.length;
    }
  }
  // PRIMITIVE has no slot links of its own (primitives are slotted INTO other things).

  return { primitiveSlots, effectSlots, capabilitySlots };
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth.protect();
    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    const values = body as Record<string, unknown>;
    const type = parseType(values["type"]);
    if (!type) {
      return NextResponse.json(
        { error: "type must be PRIMITIVE, EFFECT, CAPABILITY, ITEM, or TEMPLATE." },
        { status: 400 },
      );
    }

    const versionNumber = asInt(values["versionNumber"]);
    if (versionNumber < 1) {
      return NextResponse.json(
        { error: "versionNumber must be a positive integer." },
        { status: 400 },
      );
    }

    // targetType for getVersionPayload is the same as our type.
    // targetId is the entity's id (string for uuid, number for primitive).
    const rawId = values["id"];
    const targetId: string | number =
      type === "PRIMITIVE"
        ? (typeof rawId === "number" ? rawId : Number(rawId))
        : String(rawId);
    if (
      (type === "PRIMITIVE" && !Number.isInteger(targetId)) ||
      (type !== "PRIMITIVE" && typeof rawId !== "string")
    ) {
      return NextResponse.json(
        { error: "id must be a number for PRIMITIVE, a string for others." },
        { status: 400 },
      );
    }

    // 1. Verify ownership of the live row.
    const ownerUserId = await loadLiveRowUserId(type, targetId);
    if (ownerUserId === "NOT_FOUND") {
      return NextResponse.json({ error: "Entity not found." }, { status: 404 });
    }
    // System content (userId === null) can be restored by anyone; otherwise
    // only the owner can restore.
    if (ownerUserId !== null && ownerUserId !== userId) {
      return NextResponse.json(
        { error: "You don't own this entity." },
        { status: 403 },
      );
    }

    // 2. Load the old version's reconstructed payload. Each entity type
    // has its own *_versions table — fetch directly to avoid the
    // version-payload helper's narrower target-type union.
    const reconstructed = await loadRestoredPayload(
      type,
      targetId,
      versionNumber,
    );
    if (!reconstructed) {
      return NextResponse.json(
        { error: `Version v${versionNumber} not found for ${type}:${String(targetId)}.` },
        { status: 404 },
      );
    }

    // 3. Apply the restore — entity type dispatch.
    let contentHash: string;
    if (type === "PRIMITIVE") {
      contentHash = await restorePrimitive(targetId as number, reconstructed.payload);
    } else if (type === "EFFECT") {
      contentHash = await restoreEffect(targetId as string, reconstructed.payload);
    } else if (type === "CAPABILITY") {
      contentHash = await restoreCapability(targetId as string, reconstructed.payload);
    } else if (type === "ITEM") {
      contentHash = await restoreItem(targetId as string, reconstructed.payload);
    } else {
      contentHash = await restoreTemplate(targetId as string, reconstructed.payload);
    }

    // 4. Rewrite slot links. If the version snapshot is missing the slot
    // data (old versions that pre-date slot capture), this clears the
    // entity's current slot links. The user gets a warning in that case.
    const slotLinkResult = await rewriteSlotLinks(type, targetId, reconstructed.payload);
    const totalSlots =
      slotLinkResult.primitiveSlots +
      slotLinkResult.effectSlots +
      slotLinkResult.capabilitySlots;

    // 5. Record a new version row representing the restore event.
    const versionRow = await recordVersion({
      entityKind: type.toLowerCase() as
        | "primitive"
        | "effect"
        | "capability"
        | "item"
        | "template",
      entityId: targetId,
      contentHash,
      snapshot: reconstructed.payload,
      publishedByUserId: userId,
    });

    return NextResponse.json(
      {
        success: true,
        newVersionNumber: versionRow.versionNumber,
        newVersionId: versionRow.versionId,
        restoredFromVersion: versionNumber,
        slotLinksRestored: slotLinkResult,
        warnings: [
          totalSlots === 0 && type !== "PRIMITIVE"
            ? "No slot links found in the restored version. Existing slot links were cleared."
            : `Restored ${totalSlots} slot link(s).`,
        ],
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    console.error("[versions/restore] Error:", message, error instanceof Error ? error.stack : "");
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
