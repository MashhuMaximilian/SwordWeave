import { asc, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { CapabilityComposer } from "@/components/workshops/capability-composer";
import { db } from "@/db/client";
import {
  capabilityPrimitives,
  capabilities,
  primitives,
} from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function CapabilitiesSandboxPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const params = await searchParams;
  const editId = params.edit;

  // Always load all primitives for the picker
  const primitiveRows = await db.query.primitives.findMany({
    orderBy: [asc(primitives.category), asc(primitives.name)],
  });

  // Load all capabilities for the library section
  const capabilityRows = await db.query.capabilities.findMany({
    orderBy: [desc(capabilities.createdAt), asc(capabilities.name)],
    with: {
      primitiveLinks: {
        orderBy: [asc(capabilityPrimitives.sortOrder)],
        with: {
          primitive: true,
        },
      },
    },
  });

  // Edit mode: load the target capability
  let editingCapability = null;
  if (editId) {
    const target = await db.query.capabilities.findFirst({
      where: eq(capabilities.id, editId),
      with: {
        primitiveLinks: {
          with: {
            primitive: true,
          },
        },
      },
    });
    if (!target) {
      notFound();
    }
    editingCapability = target;
  }

  return (
    <CapabilityComposer
      initialCapabilities={capabilityRows}
      primitives={primitiveRows}
      editingCapability={editingCapability}
    />
  );
}