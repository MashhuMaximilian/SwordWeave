import { asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ItemComposer } from "@/components/workshops/item-composer";
import { db } from "@/db/client";
import { capabilities, effects, primitives } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function ItemSandboxPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const params = await searchParams;
  const editId = params.edit;

  // Items can only use ITEM_AUGMENT primitives. Filter server-side so the
  // composer never has to think about it.
  const primitiveRows = await db.query.primitives.findMany({
    where: (p, { eq }) => eq(p.category, "ITEM_AUGMENT"),
    orderBy: [asc(primitives.name)],
  });

  // Load all capabilities + effects so the composer can grant them
  const capabilityRows = await db.query.capabilities.findMany({
    orderBy: [asc(capabilities.name)],
  });

  const effectRows = await db.query.effects.findMany({
    orderBy: [asc(effects.name)],
  });

  // Edit mode: load the target item
  let editingItem = null;
  if (editId) {
    const target = await db.query.items.findFirst({
      where: (it, { eq }) => eq(it.id, editId),
      with: {
        primitiveLinks: { with: { primitive: true } },
      },
    });
    if (!target) {
      notFound();
    }
    editingItem = target;
  }

  return (
    <ItemComposer
      primitives={primitiveRows}
      capabilities={capabilityRows}
      effects={effectRows}
      editingItem={editingItem}
    />
  );
}