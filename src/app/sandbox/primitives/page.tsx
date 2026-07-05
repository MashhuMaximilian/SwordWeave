import { asc, eq } from "drizzle-orm";

import { SandboxLayout } from "@/components/sandbox/sandbox-layout";
import {
  PrimitivePreview,
  PrimitivePreviewEmpty,
} from "@/components/sandbox/primitive-preview";
import { PrimitivesLibrary } from "@/components/sandbox/primitives-library";
import { PrimitiveRegistry } from "@/components/workshops/primitive-registry";
import { db } from "@/db/client";
import { primitives } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function PrimitiveSandboxPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const params = await searchParams;

  let editingPrimitive: typeof primitives.$inferSelect | undefined = undefined;

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
    <SandboxLayout
      storageKey="primitives"
      library={
        <PrimitivesLibrary
          primitives={rows}
          editingPrimitiveId={editingPrimitive?.id ?? null}
        />
      }
      builder={
        <PrimitiveRegistry
          initialPrimitives={rows}
          editingPrimitive={editingPrimitive ?? undefined}
        />
      }
      preview={
        editingPrimitive ? (
          <PrimitivePreview
            row={{
              id: editingPrimitive.id,
              name: editingPrimitive.name,
              category: editingPrimitive.category,
              costTier: editingPrimitive.costTier,
              buCost: editingPrimitive.buCost,
              isPublic: editingPrimitive.isPublic,
              isMirrorable: editingPrimitive.isMirrorable,
              mirrorVector: editingPrimitive.mirrorVector,
              mirrorBuCredit: editingPrimitive.mirrorBuCredit,
              mirrorEligibilityNotes: editingPrimitive.mirrorEligibilityNotes,
              mechanicalOutputText: editingPrimitive.mechanicalOutputText,
              narrativeRule: editingPrimitive.narrativeRule,
            }}
          />
        ) : (
          <PrimitivePreviewEmpty />
        )
      }
    />
  );
}