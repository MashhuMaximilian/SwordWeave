import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { characters, characterPrimitives, primitives } from "@/db/schema";
import { eq } from "drizzle-orm";
import { type HardModifier } from "@/types/swordweave";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const charId = url.searchParams.get("charId") ?? "462f9048-b0da-4185-98db-d18027132c82";

  const charRow = await db.query.characters.findFirst({
    where: eq(characters.id, charId),
  });

  if (!charRow) return NextResponse.json({ error: "not found" });

  const slotRows = await db
    .select({
      primitiveId: characterPrimitives.primitiveId,
      primitiveName: primitives.name,
      primitiveHardModifiers: primitives.hardModifiers,
    })
    .from(characterPrimitives)
    .innerJoin(primitives, eq(primitives.id, characterPrimitives.primitiveId))
    .where(eq(characterPrimitives.characterId, charId));

  const PRIOF_MATCH = /^self:proficient_in\((\w+)\)/;
  const proficiencies = new Set<string>();
  const debug: { name: string; tokens: string[]; matched: string[] }[] = [];

  for (const row of slotRows) {
    const mods = (row.primitiveHardModifiers ?? []) as HardModifier[];
    for (const mod of mods) {
      const cond = mod.condition as unknown as { tokens?: string[] } | undefined;
      if (cond && Array.isArray(cond.tokens)) {
        const matched: string[] = [];
        for (const tok of cond.tokens) {
          const m = tok.match(PRIOF_MATCH);
          if (m && m[1]) {
            proficiencies.add(m[1]);
            matched.push(m[1]);
          }
        }
        debug.push({ name: row.primitiveName, tokens: cond.tokens, matched });
      }
    }
  }

  return NextResponse.json({
    attrProficient: charRow.attrProficient,
    proficiencies: [...proficiencies],
    debug: debug.filter(d => d.name === "Expertise Fieldcraft"),
    allDebug: debug,
  });
}
