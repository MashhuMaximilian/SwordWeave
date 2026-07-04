import { asc, desc } from "drizzle-orm";
import { CapabilityComposer } from "@/components/workshops/capability-composer";
import { db } from "@/db/client";
import {
  capabilityPrimitives,
  capabilities,
  primitives,
} from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function CapabilitiesSandboxPage() {
  const [primitiveRows, capabilityRows] = await Promise.all([
    db.query.primitives.findMany({
      orderBy: [asc(primitives.category), asc(primitives.name)],
    }),
    db.query.capabilities.findMany({
      orderBy: [desc(capabilities.createdAt), asc(capabilities.name)],
      with: {
        primitiveLinks: {
          orderBy: [asc(capabilityPrimitives.sortOrder)],
          with: {
            primitive: true,
          },
        },
      },
    }),
  ]);

  return (
    <CapabilityComposer
      initialCapabilities={capabilityRows}
      primitives={primitiveRows}
    />
  );
}