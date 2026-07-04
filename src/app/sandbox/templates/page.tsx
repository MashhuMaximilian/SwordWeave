import { asc } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { TemplateComposer } from "@/components/workshops/template-composer";
import { db } from "@/db/client";
import { capabilities, primitives } from "@/db/schema";

export const dynamic = "force-dynamic";

type Kind = "RACE" | "BACKGROUND" | "ARCHETYPE";

function isValidKind(value: string | null | undefined): value is Kind {
  return value === "RACE" || value === "BACKGROUND" || value === "ARCHETYPE";
}

export default async function TemplateSandboxPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; edit?: string }>;
}) {
  const params = await searchParams;
  const editId = params.edit;

  // Edit mode: load existing template, derive kind from it
  if (editId) {
    const target = await db.query.templates.findFirst({
      where: (t, { eq }) => eq(t.id, editId),
      with: {
        primitiveLinks: { with: { primitive: true } },
      },
    });
    if (!target || !isValidKind(target.kind)) notFound();

    const [allPrimitives, allCapabilities] = await Promise.all([
      db.query.primitives.findMany({
        orderBy: [asc(primitives.category), asc(primitives.name)],
      }),
      db.query.capabilities.findMany({
        orderBy: [asc(capabilities.name)],
      }),
    ]);

    return (
      <TemplateComposer
        initialKind={target.kind}
        primitives={allPrimitives}
        capabilities={allCapabilities}
        editingTemplate={target}
      />
    );
  }

  // New mode: require kind param, redirect to default if missing
  const kindParam = params.kind;
  if (!kindParam) {
    redirect("/sandbox/templates/new?kind=race");
  }
  const kind = kindParam.toUpperCase();
  if (!isValidKind(kind)) {
    redirect("/sandbox/templates/new?kind=race");
  }

  const [allPrimitives, allCapabilities] = await Promise.all([
    db.query.primitives.findMany({
      orderBy: [asc(primitives.category), asc(primitives.name)],
    }),
    db.query.capabilities.findMany({
      orderBy: [asc(capabilities.name)],
    }),
  ]);

  return (
    <TemplateComposer
      initialKind={kind}
      primitives={allPrimitives}
      capabilities={allCapabilities}
    />
  );
}