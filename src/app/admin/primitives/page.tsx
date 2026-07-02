import { asc } from "drizzle-orm";
import { db } from "@/db/client";
import { primitives } from "@/db/schema";
import { PrimitiveRegistry } from "./primitive-registry";

export const dynamic = "force-dynamic";

export default async function AdminPrimitivesPage() {
  const rows = await db.query.primitives.findMany({
    orderBy: [asc(primitives.category), asc(primitives.name)],
  });

  return <PrimitiveRegistry initialPrimitives={rows} />;
}
