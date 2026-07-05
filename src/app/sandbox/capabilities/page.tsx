import { asc } from "drizzle-orm";

import { CapabilitiesLibrary } from "@/components/sandbox/capabilities-library";
import { CapabilitySandboxClient } from "@/components/sandbox/capability-sandbox-client";
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
    | {
        id: string;
        userId: string | null;
        name: string;
        type: string;
        sourceType: string;
        verboseDescription: string;
        isPublic: boolean;
        sourceOrigin: string | null;
        tags: string[];
        primitiveLinks: Array<{
          primitiveId: number;
          role: string;
          quantity: number;
          sortOrder: number;
          slotLabel: string | null;
          primitive: {
            id: number;
            name: string;
            category: string;
            buCost: number;
          };
        }>;
      }
    | null
    | undefined = null;

  if (params.edit) {
    editingCapability = await db.query.capabilities.findFirst({
      where: (t, { eq }) => eq(t.id, params.edit!),
      with: {
        primitiveLinks: { with: { primitive: true } },
      },
    });
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
    <CapabilitySandboxClient
      editingCapability={editingCapability ?? null}
      availablePrimitives={primitiveRows.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        buCost: p.buCost,
      }))}
      library={
        <CapabilitiesLibrary
          capabilities={allCapabilities}
          editingCapabilityId={editingCapability?.id ?? null}
        />
      }
    />
  );
}