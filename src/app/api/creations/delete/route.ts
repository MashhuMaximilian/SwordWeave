// =============================================================================
// POST /api/creations/delete — delete a user-owned creation
//
// Body: { targetType, targetId }
//
// Safety gate: refuses to delete if the row is currently visible to anyone
// other than the author. "Visible to anyone else" = a publications row with
// visibility ∈ {PUBLIC, FOLLOWERS_ONLY} AND unpublishedAt IS NULL.
//
// Once a creation is fully unpublished (no active publication OR the only
// publication is unpublished), the author is the only person who can see
// it, so deletion is safe — no one else's content depends on it.
//
// We also check authorship of any publications row (visibility can change
// hands via re-publish). The author of the underlying row is the only
// person allowed to delete it.
//
// FK behavior (from migrations):
//   - primitives: capability_primitives / effect_primitives cascade; but
//     character_primitives / template_primitives / item_primitives RESTRICT.
//     So deleting a primitive that any character / template / item is
//     currently slotting will fail with a FK constraint error. We surface
//     a 409 with a clear "in use by N entities" message so the user
//     knows what to fix.
//   - heritage: builds.race_id / builds.background_id SET NULL — safe to
//     delete; orphan builds just clear their race/background reference.
//     template_capabilities RESTRICT — fails if any template currently
//     composes a capability.
//   - capabilities: character_capabilities / template_capabilities
//     RESTRICT — fails if slotted. capability_primitives cascade.
//   - effects: effect_effects (parent/child) cascade, capability_effects
//     cascade. Self-contained.
//   - items: character_items RESTRICT — fails if slotted.
//   - characters: all character_* cascade. Safe to delete.
//
// We do the FK check explicitly before deleting so we can return a
// friendly 409 with the actual blocker table name + count, instead of
// a generic DB constraint error.
//
// Endpoint is intentionally POST (not DELETE) so we can carry a JSON body
// without query-string length limits — the IDs are short but the body
// pattern matches the rest of /api/creations/*.
// =============================================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { publications } from "@/db/schema/engagement";
import {
  capabilities,
  characters,
  characterCapabilities,
  characterItems,
  characterPrimitives,
  effects,
  items,
  itemPrimitives,
  primitives,
  heritageCapabilities,
  heritagePrimitives,
  heritage,
} from "@/db/schema";
import { resolveUserIdByClerkId } from "@/lib/auth/author-resolver";

const BodySchema = z.object({
  targetType: z.enum([
    "PRIMITIVE",
    "CAPABILITY",
    "EFFECT",
    "ITEM",
    "LINEAGE_TEMPLATE",
    "UPBRINGING_TEMPLATE",
    "MANIFEST_TEMPLATE",
    "CHARACTER",
  ]),
  targetId: z.string().min(1),
});

/**
 * Returns null if safe to delete, or a string describing the blocker.
 * Each table is checked separately so we can return granular counts.
 *
 * @param targetType Source table key (PRIMITIVE, TEMPLATE, etc.)
 * @param targetId The row's id within that table.
 */
async function findForeignKeyBlockers(
  targetType: string,
  targetId: string,
): Promise<string | null> {
  if (targetType === "PRIMITIVE") {
    const numId = Number(targetId);
    if (!Number.isInteger(numId)) {
      return "Primitive id must be a positive integer";
    }
    const blockers: Array<{ table: string; n: number }> = [];
    for (const table of [
      { name: "character_primitives", q: characterPrimitives },
      { name: "template_primitives", q: heritagePrimitives },
      { name: "item_primitives", q: itemPrimitives },
    ]) {
      const r = await db
        .select({ c: sql<number>`COUNT(*)::int` })
        .from(table.q)
        .where(eq(table.q.primitiveId, numId));
      const count = Number(r[0]?.c ?? 0);
      if (count > 0) blockers.push({ table: table.name, n: count });
    }
    if (blockers.length === 0) return null;
    return `Cannot delete: primitive is slotting into ${blockers
      .map((b) => `${b.n} ${b.table.replace(/_/g, " ")}`)
      .join(", ")}. Remove these slots first.`;
  }

  if (
    targetType === "LINEAGE_TEMPLATE" ||
    targetType === "UPBRINGING_TEMPLATE" ||
    targetType === "MANIFEST_TEMPLATE"
  ) {
    const blockers: Array<{ table: string; n: number }> = [];
    const r = await db
      .select({ c: sql<number>`COUNT(*)::int` })
      .from(heritageCapabilities)
      .where(eq(heritageCapabilities.templateId, targetId));
    const count = Number(r[0]?.c ?? 0);
    if (count > 0) blockers.push({ table: "template_capabilities", n: count });
    if (blockers.length === 0) return null;
    return `Cannot delete: template composes ${blockers
      .map((b) => `${b.n} ${b.table.replace(/_/g, " ")}`)
      .join(", ")}. Remove these first.`;
  }

  if (targetType === "CAPABILITY") {
    const blockers: Array<{ table: string; n: number }> = [];
    for (const table of [
      { name: "character_capabilities", q: characterCapabilities },
      { name: "template_capabilities", q: heritageCapabilities },
    ]) {
      const r = await db
        .select({ c: sql<number>`COUNT(*)::int` })
        .from(table.q)
        .where(eq(table.q.capabilityId, targetId));
      const count = Number(r[0]?.c ?? 0);
      if (count > 0) blockers.push({ table: table.name, n: count });
    }
    // capability_primitives cascade; no check needed
    // capability_effects cascade; no check needed
    if (blockers.length === 0) return null;
    return `Cannot delete: capability is used by ${blockers
      .map((b) => `${b.n} ${b.table.replace(/_/g, " ")}`)
      .join(", ")}. Remove these first.`;
  }

  if (targetType === "ITEM") {
    // character_items RESTRICTs; item_capabilities / item_effects /
    // item_primitives cascade. Count character_items references.
    const r = await db
      .select({ c: sql<number>`COUNT(*)::int` })
      .from(characterItems)
      .where(eq(characterItems.itemId, targetId));
    const count = Number(r[0]?.c ?? 0);
    if (count === 0) return null;
    return `Cannot delete: item is held by ${count} character(s). Unequip first.`;
  }

  if (targetType === "CHARACTER") {
    // All character_* relations cascade. No blocker check needed.
    return null;
  }

  if (targetType === "EFFECT") {
    // capability_effects, effect_effects, effect_primitives, effect_conditions,
    // item_effects all cascade. Self-contained.
    return null;
  }

  return null;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const authorId = await resolveUserIdByClerkId(userId);
  if (!authorId) {
    return NextResponse.json(
      { error: "User profile not found" },
      { status: 404 },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { targetType, targetId } = parsed.data;

  // Step 1: ownership + publication safety gate.
  //
  // "Safe to delete" means: no publications row that is currently
  // visible to anyone but the author. We check:
  //   - any publications row where (targetType, targetId) matches AND
  //     visibility IN ('PUBLIC', 'FOLLOWERS_ONLY') AND unpublishedAt IS NULL
  //   → refuse deletion.
  const activePubs = await db
    .select()
    .from(publications)
    .where(
      and(
        eq(publications.targetType, targetType as never),
        eq(publications.targetId, targetId),
        isNull(publications.unpublishedAt),
      ),
    );
  const visiblePub = activePubs.find(
    (p) => p.visibility === "PUBLIC" || p.visibility === "FOLLOWERS_ONLY",
  );
  if (visiblePub) {
    return NextResponse.json(
      {
        error:
          "Cannot delete: this creation is currently published. Unpublish it first (set visibility to PRIVATE in My Creations).",
        visibility: visiblePub.visibility,
      },
      { status: 409 },
    );
  }

  // Step 2: ownership check on the underlying row. The row's user_id
  // column stores the Clerk user ID (text), so compare to userId directly.
  // For PRIMITIVE, targetId is an integer.
  let ownerCheck: { userId: string | null } | undefined;
  switch (targetType) {
    case "PRIMITIVE": {
      const numId = Number(targetId);
      if (!Number.isInteger(numId)) {
        return NextResponse.json(
          { error: "Primitive id must be a positive integer" },
          { status: 400 },
        );
      }
      const row = await db.query.primitives.findFirst({
        where: eq(primitives.id, numId),
        columns: { userId: true },
      });
      ownerCheck = row;
      break;
    }
    case "CAPABILITY": {
      const row = await db.query.capabilities.findFirst({
        where: eq(capabilities.id, targetId),
        columns: { userId: true },
      });
      ownerCheck = row;
      break;
    }
    case "EFFECT": {
      const row = await db.query.effects.findFirst({
        where: eq(effects.id, targetId),
        columns: { userId: true },
      });
      ownerCheck = row;
      break;
    }
    case "ITEM": {
      const row = await db.query.items.findFirst({
        where: eq(items.id, targetId),
        columns: { userId: true },
      });
      ownerCheck = row;
      break;
    }
    case "LINEAGE_TEMPLATE":
    case "UPBRINGING_TEMPLATE":
    case "MANIFEST_TEMPLATE": {
      const row = await db.query.heritage.findFirst({
        where: eq(heritage.id, targetId),
        columns: { userId: true },
      });
      ownerCheck = row;
      break;
    }
    case "CHARACTER": {
      const row = await db.query.characters.findFirst({
        where: eq(characters.id, targetId),
        columns: { userId: true },
      });
      ownerCheck = row;
      break;
    }
  }

  if (!ownerCheck) {
    return NextResponse.json(
      { error: "Creation not found" },
      { status: 404 },
    );
  }
  if (ownerCheck.userId !== userId) {
    return NextResponse.json(
      { error: "Forbidden: you do not own this creation" },
      { status: 403 },
    );
  }

  // Step 3: FK blocker check — surface a friendly 409 before the DB throws.
  const blocker = await findForeignKeyBlockers(targetType, targetId);
  if (blocker) {
    return NextResponse.json({ error: blocker }, { status: 409 });
  }

  // Step 4: delete the row. Cascade deletes handle children.
  try {
    switch (targetType) {
      case "PRIMITIVE": {
        await db.delete(primitives).where(eq(primitives.id, Number(targetId)));
        break;
      }
      case "CAPABILITY":
        await db.delete(capabilities).where(eq(capabilities.id, targetId));
        break;
      case "EFFECT":
        await db.delete(effects).where(eq(effects.id, targetId));
        break;
      case "ITEM":
        await db.delete(items).where(eq(items.id, targetId));
        break;
      case "LINEAGE_TEMPLATE":
      case "UPBRINGING_TEMPLATE":
      case "MANIFEST_TEMPLATE":
        await db.delete(heritage).where(eq(heritage.id, targetId));
        break;
      case "CHARACTER":
        await db.delete(characters).where(eq(characters.id, targetId));
        break;
    }
  } catch (err) {
    // FK constraint that we didn't pre-check, or another DB error.
    console.error("[creations/delete] DB error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Database error: ${err.message}`
            : "Database error",
      },
      { status: 500 },
    );
  }

  // Step 5: clean up any lingering publications rows (private ones).
  // Safe because we already verified there's no visible publication.
  await db
    .delete(publications)
    .where(
      and(
        eq(publications.targetType, targetType as never),
        eq(publications.targetId, targetId),
      ),
    );

  return NextResponse.json({
    ok: true,
    deleted: { targetType, targetId },
  });
}
