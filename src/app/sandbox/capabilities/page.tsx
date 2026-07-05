import { asc } from "drizzle-orm";

import { SandboxLayout } from "@/components/sandbox/sandbox-layout";
import {
  CapabilityPreview,
  CapabilityPreviewEmpty,
} from "@/components/sandbox/capability-preview";
import { CapabilitiesLibrary } from "@/components/sandbox/capabilities-library";
import { CapabilityComposer } from "@/components/workshops/capability-composer";
import { db } from "@/db/client";
import { capabilities, primitives } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function CapabilitySandboxPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const params = await searchParams;

  let editingCapability:
    | (typeof capabilities.$inferSelect & {
        primitiveLinks: Array<{
          primitiveId: number;
          role: string;
          quantity: number;
          sortOrder: number;
          slotLabel: string | null;
          primitive: typeof primitives.$inferSelect;
        }>;
      })
    | undefined = undefined;

  if (params.edit) {
    const target = await db.query.capabilities.findFirst({
      where: (t, { eq }) => eq(t.id, params.edit!),
      with: {
        primitiveLinks: { with: { primitive: true } },
      },
    });
    editingCapability = target;
  }

  const [primitiveRows, allCapabilities] = await Promise.all([
    db.query.primitives.findMany({
      orderBy: [asc(primitives.name)],
    }),
    db.query.capabilities.findMany({
      with: {
        primitiveLinks: { with: { primitive: true } },
      },
      orderBy: [asc(capabilities.name)],
    }),
  ]);

  return (
    <SandboxLayout
      storageKey="capabilities"
      library={
        <CapabilitiesLibrary
          capabilities={allCapabilities}
          editingCapabilityId={editingCapability?.id ?? null}
        />
      }
      builder={
        <CapabilityComposer
          primitives={primitiveRows}
          initialCapabilities={allCapabilities}
          editingCapability={editingCapability ?? null}
        />
      }
      preview={
        editingCapability ? (
          <CapabilityPreview
            row={{
              id: editingCapability.id,
              name: editingCapability.name,
              type: editingCapability.type,
              sourceType: editingCapability.sourceType,
              verboseDescription: editingCapability.verboseDescription,
              sourceOrigin: editingCapability.sourceOrigin,
              tags: editingCapability.tags,
              isPublic: editingCapability.isPublic,
              primitiveLinks: editingCapability.primitiveLinks.map((link) => ({
                primitiveId: link.primitiveId,
                role: link.role,
                quantity: link.quantity,
                sortOrder: link.sortOrder,
                slotLabel: link.slotLabel,
                primitive: {
                  id: link.primitive.id,
                  name: link.primitive.name,
                  category: link.primitive.category,
                  buCost: link.primitive.buCost,
                },
              })),
            }}
          />
        ) : (
          <CapabilityPreviewEmpty />
        )
      }
    />
  );
}