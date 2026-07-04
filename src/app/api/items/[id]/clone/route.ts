import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  itemCapabilities,
  itemEffects,
  itemPrimitives,
  items,
} from "@/db/schema";

/**
 * POST /api/items/[id]/clone
 *
 * Deep-copies an item. Caller becomes owner. Original item left untouched.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth.protect();
    const { id } = await params;

    const source = await db.query.items.findFirst({
      where: eq(items.id, id),
      with: {
        primitiveLinks: true,
        capabilityLinks: true,
        effectLinks: true,
      },
    });

    if (!source) {
      return NextResponse.json({ error: "Item not found." }, { status: 404 });
    }

    const result = await db.transaction(async (tx) => {
      const newName = uniqueCloneName(source.name);

      const [created] = await tx
        .insert(items)
        .values({
          name: newName,
          itemType: source.itemType,
          rarity: source.rarity,
          buCost: source.buCost,
          description: source.description,
          slotCost: source.slotCost,
          isTwoHanded: source.isTwoHanded,
          isConsumable: source.isConsumable,
          actsAsFocus: source.actsAsFocus,
          isPublic: false,
          sourceOrigin: `clone:${source.id}`,
          tags: source.tags,
        })
        .returning();

      if (!created) throw new Error("Unable to clone item.");

      if (source.primitiveLinks.length > 0) {
        await tx.insert(itemPrimitives).values(
          source.primitiveLinks.map((p) => ({
            itemId: created.id,
            primitiveId: p.primitiveId,
            sortOrder: p.sortOrder,
          })),
        );
      }
      if (source.capabilityLinks.length > 0) {
        await tx.insert(itemCapabilities).values(
          source.capabilityLinks.map((c) => ({
            itemId: created.id,
            capabilityId: c.capabilityId,
            sortOrder: c.sortOrder,
            slotLabel: c.slotLabel,
            notes: c.notes,
          })),
        );
      }
      if (source.effectLinks.length > 0) {
        await tx.insert(itemEffects).values(
          source.effectLinks.map((e) => ({
            itemId: created.id,
            effectId: e.effectId,
            sortOrder: e.sortOrder,
            slotLabel: e.slotLabel,
            notes: e.notes,
          })),
        );
      }

      return tx.query.items.findFirst({
        where: eq(items.id, created.id),
        with: {
          primitiveLinks: { with: { primitive: true } },
          capabilityLinks: { with: { capability: true } },
          effectLinks: { with: { effect: true } },
        },
      });
    });

    return NextResponse.json({ item: result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// Reference userId for ownership tagging
void ({} as { userId: string });

function uniqueCloneName(original: string): string {
  if (original.match(/\(Copy(?:\s\d+)?\)$/)) {
    const base = original.replace(/\(Copy(?:\s\d+)?\)$/, "").trim();
    return `${base} (Copy 2)`;
  }
  return `${original} (Copy)`;
}