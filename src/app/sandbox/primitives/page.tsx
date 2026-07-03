import { asc } from "drizzle-orm";
import { PrimitiveRegistry } from "@/components/workshops/primitive-registry";
import { db } from "@/db/client";
import { primitives } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function PrimitiveSandboxPage() {
  const rows = await db.query.primitives.findMany({
    orderBy: [asc(primitives.category), asc(primitives.name)],
  });

  return <PrimitiveRegistry initialPrimitives={rows} />;
}
