import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { collectionTargetTables } from "@/lib/collections/service";
const allowed = new Set([
  "PRIMITIVE",
  "EFFECT",
  "CAPABILITY",
  "ITEM",
  "LINEAGE_TEMPLATE",
  "UPBRINGING_TEMPLATE",
  "MANIFEST_TEMPLATE",
]);
/** A return token is device metadata. The saved entity's current owner is verified server-side. */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json(
      { error: "Sign in to resume character creation." },
      { status: 401 },
    );
  const type = req.nextUrl.searchParams.get("targetType") ?? "",
    id = req.nextUrl.searchParams.get("targetId") ?? "";
  if (!allowed.has(type) || !id)
    return NextResponse.json(
      { error: "Invalid saved entry." },
      { status: 400 },
    );
  const table = collectionTargetTables[type]!;
  const kind =
    table === "heritage"
      ? sql`AND e.kind=${type.replace("_TEMPLATE", "")}`
      : sql``;
  const result = await db.execute(
    sql`SELECT e.id::text AS "targetId",${type} AS "targetType",e.name FROM ${sql.identifier(table)} e WHERE e.id::text=${id} AND e.user_id=${userId} ${kind} LIMIT 1`,
  );
  if (!result.rows[0])
    return NextResponse.json(
      { error: "This saved entry is not owned by your account." },
      { status: 404 },
    );
  return NextResponse.json({ entry: result.rows[0] });
}
