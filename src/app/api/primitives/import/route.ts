import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { primitives } from "@/db/schema";
import { parsePrimitivePackage } from "@/lib/packages/primitive-package";

export async function POST(request: Request) {
  try {
    const { userId } = await auth.protect();
    const body: unknown = await request.json();
    const records = parsePrimitivePackage(body);

    if (records.length === 0) {
      return NextResponse.json(
        { error: "Primitive package has no records." },
        { status: 400 },
      );
    }

    const imported = await db
      .insert(primitives)
      .values(
        records.map((record) => ({
          ...record,
          userId,
          isPublic: false,
          // Phase 3: imported primitives live in the user's private
          // namespace under their Clerk id. The unique constraint
          // is (name, source_origin) so all imported records for a
          // given caller share the same source_origin and are
          // namespaced from any system/forked content.
          sourceOrigin: `user:${userId}`,
        })),
      )
      .onConflictDoUpdate({
        // Phase 3: identity is (name, source_origin) per migration 0020.
        target: [primitives.name, primitives.sourceOrigin],
        set: {
          costTier: sql`excluded.cost_tier`,
          userId: sql`excluded.user_id`,
          isPublic: false,
          buCost: sql`excluded.bu_cost`,
          mechanicalOutputText: sql`excluded.mechanical_output_text`,
          narrativeRule: sql`excluded.narrative_rule`,
          isMirrorable: sql`excluded.is_mirrorable`,
          mirrorVector: sql`excluded.mirror_vector`,
          mirrorBuCredit: sql`excluded.mirror_bu_credit`,
          mirrorEligibilityNotes: sql`excluded.mirror_eligibility_notes`,
          hardModifiers: sql`excluded.hard_modifiers`,
          updatedAt: new Date(),
        },
      })
      .returning();

    return NextResponse.json({ imported });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
