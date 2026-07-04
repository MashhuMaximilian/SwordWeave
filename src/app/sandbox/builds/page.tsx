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
    editingBuild = target;
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