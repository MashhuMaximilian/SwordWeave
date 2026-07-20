import { asc, eq } from "drizzle-orm";
import { CharacterWizard } from "@/components/workshops/character-wizard";
import { db } from "@/db/client";
import { capabilities, items, heritage } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function CharacterWizardSandboxPage() {
  const [races, backgrounds, allCapabilities, allItems] = await Promise.all([
    db.query.heritage.findMany({
      where: eq(heritage.kind, "LINEAGE"),
      orderBy: [asc(heritage.name)],
    }),
    db.query.heritage.findMany({
      where: eq(heritage.kind, "UPBRINGING"),
      orderBy: [asc(heritage.name)],
    }),
    db.query.capabilities.findMany({
      orderBy: [asc(capabilities.name)],
    }),
    db.query.items.findMany({
      orderBy: [asc(items.name)],
    }),
  ]);

  return (
    <CharacterWizard
      races={races}
      backgrounds={backgrounds}
      capabilities={allCapabilities}
      items={allItems}
    />
  );
}