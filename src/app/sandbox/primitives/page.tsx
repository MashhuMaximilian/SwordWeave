import { asc, eq } from "drizzle-orm";

import { PrimitivesLibrary } from "@/components/sandbox/primitives-library";
import { PrimitiveSandboxClient } from "@/components/sandbox/primitive-sandbox-client";
import { db } from "@/db/client";
import { primitives } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function PrimitiveSandboxPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const params = await searchParams;

  let editingPrimitive:
    | {
        id: number;
        userId: string | null;
        name: string;
        category: string;
        isPublic: boolean;
        costTier: string;
        buCost: number;
        mechanicalOutputText: string;
        narrativeRule: string;
        isMirrorable: boolean;
        mirrorVector: string;
        mirrorBuCredit: number;
        mirrorEligibilityNotes: string;
        hardModifiers: unknown;
      }
    | null
    | undefined = null;

  if (params.edit) {
    const numId = Number(params.edit);
    if (Number.isFinite(numId)) {
      editingPrimitive = await db.query.primitives.findFirst({
        where: eq(primitives.id, numId),
      });
    }
  }

  const rows = await db.query.primitives.findMany({
    orderBy: [asc(primitives.category), asc(primitives.name)],
  });

  return (
    <PrimitiveSandboxClient
      editingPrimitive={editingPrimitive ?? null}
      library={
        <PrimitivesLibrary
          primitives={rows}
          editingPrimitiveId={editingPrimitive?.id ?? null}
        />
      }
    />
  );
}