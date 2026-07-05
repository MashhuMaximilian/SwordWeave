import { asc } from "drizzle-orm";

import { SandboxLayout } from "@/components/sandbox/sandbox-layout";
import {
  TemplatePreview,
  TemplatePreviewEmpty,
} from "@/components/sandbox/template-preview";
import { TemplatesLibrary } from "@/components/sandbox/templates-library";
import { TemplateComposer } from "@/components/workshops/template-composer";
import { db } from "@/db/client";
import { capabilities, primitives, templates } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function TemplatesSandboxPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; kind?: string }>;
}) {
  const params = await searchParams;

  const initialKind =
    params.kind === "RACE" || params.kind === "BACKGROUND" || params.kind === "ARCHETYPE"
      ? params.kind
      : "RACE";

  let editingTemplate:
    | (typeof templates.$inferSelect & {
        primitiveLinks: Array<{
          primitiveId: number;
          primitive: typeof primitives.$inferSelect;
        }>;
        capabilityLinks: Array<{
          capabilityId: string;
          capability: typeof capabilities.$inferSelect;
        }>;
      })
    | null = null;

  if (params.edit) {
    const target = await db.query.templates.findFirst({
      where: (t, { eq }) => eq(t.id, params.edit!),
      with: {
        primitiveLinks: { with: { primitive: true } },
        capabilityLinks: { with: { capability: true } },
      },
    });
    editingTemplate = target ?? null;
  }

  const [allTemplates, primitiveRows, capabilityRows] = await Promise.all([
    db.query.templates.findMany({
      with: {
        primitiveLinks: { with: { primitive: true } },
      },
      orderBy: [asc(templates.kind), asc(templates.name)],
    }),
    db.query.primitives.findMany({
      orderBy: [asc(primitives.name)],
    }),
    db.query.capabilities.findMany({
      orderBy: [asc(capabilities.name)],
    }),
  ]);

  return (
    <SandboxLayout
      storageKey="templates"
      library={
        <TemplatesLibrary
          templates={allTemplates}
          editingTemplateId={editingTemplate?.id ?? null}
        />
      }
      builder={
        <TemplateComposer
          initialKind={initialKind}
          primitives={primitiveRows}
          capabilities={capabilityRows}
          editingTemplate={editingTemplate}
        />
      }
      preview={
        editingTemplate ? (
          <TemplatePreview
            row={{
              id: editingTemplate.id,
              kind: editingTemplate.kind,
              name: editingTemplate.name,
              imageUrl: editingTemplate.imageUrl ?? null,
              description: editingTemplate.description ?? null,
              suggestedTraits: editingTemplate.suggestedTraits ?? null,
              isPublic: editingTemplate.isPublic,
              primitiveLinks: editingTemplate.primitiveLinks.map((link) => ({
                primitiveId: link.primitiveId,
                primitive: {
                  id: link.primitive.id,
                  name: link.primitive.name,
                  category: link.primitive.category,
                  buCost: link.primitive.buCost,
                },
              })),
              capabilityLinks: editingTemplate.capabilityLinks?.map((link) => ({
                capabilityId: link.capabilityId,
                capability: {
                  id: link.capability.id,
                  name: link.capability.name,
                  type: link.capability.type,
                },
              })) ?? [],
            }}
          />
        ) : (
          <TemplatePreviewEmpty />
        )
      }
    />
  );
}