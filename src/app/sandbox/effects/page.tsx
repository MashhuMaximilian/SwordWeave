import { asc, desc } from "drizzle-orm";
import { EffectComposer } from "@/components/workshops/effect-composer";
import { db } from "@/db/client";
import { effectPrimitives, effects, primitives } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function EffectsSandboxPage() {
  const [primitiveRows, effectRows] = await Promise.all([
    db.query.primitives.findMany({
      orderBy: [asc(primitives.category), asc(primitives.name)],
    }),
    db.query.effects.findMany({
      orderBy: [desc(effects.createdAt), asc(effects.name)],
      with: {
        primitiveLinks: {
          orderBy: [asc(effectPrimitives.sortOrder)],
          with: {
            primitive: true,
          },
        },
      },
    }),
  ]);

  return <EffectComposer initialEffects={effectRows} primitives={primitiveRows} />;
}
