import { asc, eq } from "drizzle-orm";
import { CharacterWizard } from "@/components/workshops/character-wizard";
import { db } from "@/db/client";
import { capabilities, items, templates } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function CharacterWizardSandboxPage() {
  const [races, backgrounds, allCapabilities, allItems] = await Promise.all([
    db.query.templates.findMany({
      where: eq(templates.kind, "RACE"),
      orderBy: [asc(templates.name)],
    }),
    db.query.templates.findMany({
      where: eq(templates.kind, "BACKGROUND"),
      orderBy: [asc(templates.name)],
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