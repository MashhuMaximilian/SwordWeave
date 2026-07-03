import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db/client";
import { primitives } from "@/db/schema";
import {
  createPrimitivePackage,
  type PrimitivePackageRecord,
} from "@/lib/packages/primitive-package";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.query.primitives.findMany({
    orderBy: [asc(primitives.category), asc(primitives.name)],
  });

  const records: PrimitivePackageRecord[] = rows.map((primitive) => ({
    name: primitive.name,
    category: primitive.category,
    costTier: primitive.costTier,
    buCost: primitive.buCost,
    mechanicalOutputText: primitive.mechanicalOutputText,
    narrativeRule: primitive.narrativeRule,
    isPublic: primitive.isPublic,
    isMirrorable: primitive.isMirrorable,
    mirrorVector: primitive.mirrorVector,
    mirrorBuCredit: primitive.mirrorBuCredit,
    mirrorEligibilityNotes: primitive.mirrorEligibilityNotes,
    hardModifiers: primitive.hardModifiers,
  }));

  return NextResponse.json(createPrimitivePackage(records));
}
