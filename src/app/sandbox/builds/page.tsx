import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { BuildComposer } from "@/components/workshops/build-composer";
import { db } from "@/db/client";
import { capabilities, builds, templates } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function BuildsSandboxPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const params = await searchParams;
  const editId = params.edit;

  // Load all races + backgrounds from templates library
  const [races, backgrounds, allCapabilities] = await Promise.all([
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
  ]);

  let editingBuild = null;
  if (editId) {
    const target = await db.query.builds.findFirst({
      where: eq(builds.id, editId),
      with: {
        capabilityLinks: { with: { capability: true } },
      },
    });
    if (!target) notFound();
    // Phase 8: spread icon fields through to the BuildComposer so the
    // IconSlot is pre-populated when editing an existing build. The
    // composer reads `editingBuild.iconSource` / `iconKey` / etc. via
    // its BuildRow type (see src/components/workshops/build-composer.tsx).
    editingBuild = {
      id: target.id,
      name: target.name,
      description: target.description,
      level: target.level,
      startingBu: target.startingBu,
      isArchetypeTemplate: target.isArchetypeTemplate,
      raceName: target.raceName,
      raceDescription: target.raceDescription,
      raceId: target.raceId,
      backgroundName: target.backgroundName,
      backgroundDescription: target.backgroundDescription,
      backgroundId: target.backgroundId,
      archetypeName: target.archetypeName,
      attrPhysical: target.attrPhysical,
      attrMental: target.attrMental,
      attrMagical: target.attrMagical,
      attrProficient: target.attrProficient,
      practiceSlices: target.practiceSlices,
      portraitUrl: target.portraitUrl,
      iconSource: target.iconSource,
      iconKey: target.iconKey,
      iconUrl: target.iconUrl,
      iconColor: target.iconColor,
      isPublic: target.isPublic,
      sourceOrigin: target.sourceOrigin,
      capabilityLinks: target.capabilityLinks,
    };
  }

  return (
    <BuildComposer
      races={races}
      backgrounds={backgrounds}
      capabilities={allCapabilities}
      editingBuild={editingBuild}
    />
  );
}