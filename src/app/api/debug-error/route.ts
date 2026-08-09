import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import { characters } from "@/db/schema";
import { eq } from "drizzle-orm";
import { aggregateCharacterSheet } from "@/lib/engine";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const charId = searchParams.get("id");
    const row = await db.query.characters.findFirst({
      where: eq(characters.id, charId),
      with: {
        primitiveLinks: { with: { primitive: true } },
        capabilityLinks: { with: { capability: true } },
        itemLinks: { with: { item: true } },
        heritageLinks: { with: { heritage: true } },
      },
    });
    if (!row) return NextResponse.json({ error: "not found" });
    return NextResponse.json({ ok: true, hasPrimitives: row.primitiveLinks.length, hasCaps: row.capabilityLinks.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, stack: e.stack });
  }
}
