import { asc, eq } from "drizzle-orm";

import { EffectsLibrary } from "@/components/sandbox/effects-library";
import { EffectSandboxClient } from "@/components/sandbox/effect-sandbox-client";
import { db } from "@/db/client";
import { effects, primitives } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function EffectSandboxPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const params = await searchParams;

  let editingEffect:
    | {
        id: string;
        userId: string | null;
        name: string;
        narrativeDescription: string;
        sourceOrigin: string | null;
        tags: string[];
        isPublic: boolean;
        primitiveLinks: Array<{
          primitiveId: number;
          quantity: number;
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
    editingEffect = await db.query.effects.findFirst({
      where: eq(effects.id, params.edit),
      with: {
        primitiveLinks: {
          with: { primitive: true },
        },
      },
    });
  }

  const [primitiveRows, effectRows] = await Promise.all([
    db.query.primitives.findMany({
      where: eq(primitives.category, "ITEM_AUGMENT"),
      orderBy: [asc(primitives.name)],
    }),
    db.query.effects.findMany({
      orderBy: [asc(effects.name)],
      with: {
        primitiveLinks: {
          with: { primitive: true },
        },
      },
    }),
  ]);

  return (
    <EffectSandboxClient
      editingEffect={editingEffect ?? null}
      availablePrimitives={primitiveRows.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        buCost: p.buCost,
      }))}
      library={
        <EffectsLibrary
          effects={effectRows}
          editingEffectId={editingEffect?.id ?? null}
        />
      }
    />
  );
}