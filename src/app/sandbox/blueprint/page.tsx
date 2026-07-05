// /sandbox/blueprint
// One page hosting three Build modes: Template | Item | Monster.
// ?build=<mode> selects the active mode (defaults to "template").
// ?kind=<RACE|BACKGROUND|ARCHETYPE> only relevant when build=template.
// ?edit=<id> pre-fills the form with the matching entity.

import { asc } from "drizzle-orm";

import {
  BlueprintSandboxClient,
  type BlueprintBuildMode,
} from "@/components/sandbox/blueprint-sandbox-client";
import { db } from "@/db/client";
import { capabilities, effects, items, primitives, templates } from "@/db/schema";
import {
  itemToLibraryItem,
  primitiveToLibraryItem,
  templateToLibraryItem,
} from "@/components/sandbox/sandbox-row-mapper";
import type { LibraryItem } from "@/lib/publishing/library-query";

export const dynamic = "force-dynamic";

function parseBuild(value: string | undefined): BlueprintBuildMode {
  if (value === "item" || value === "monster") return value;
  return "template";
}

function parseKind(value: string | undefined): "RACE" | "BACKGROUND" | "ARCHETYPE" | undefined {
  if (value === "RACE" || value === "BACKGROUND" || value === "ARCHETYPE") return value;
  return undefined;
}

export default async function BlueprintSandboxPage({
  searchParams,
}: {
  searchParams: Promise<{ build?: string; kind?: string; edit?: string }>;
}) {
  const params = await searchParams;
  const build = parseBuild(params.build);
  const kind = parseKind(params.kind);
  const editId = params.edit;

  const [templateRows, itemRows, primitiveRows, capabilityRows, effectRows] =
    await Promise.all([
      db.query.templates.findMany({
        orderBy: [asc(templates.kind), asc(templates.name)],
        with: {
          primitiveLinks: { with: { primitive: true } },
          capabilityLinks: { with: { capability: true } },
        },
      }),
      db.query.items.findMany({
        orderBy: [asc(items.name)],
        with: {
          primitiveLinks: { with: { primitive: true } },
        },
      }),
      db.query.primitives.findMany({
        orderBy: [asc(primitives.name)],
      }),
      db.query.capabilities.findMany({
        orderBy: [asc(capabilities.name)],
      }),
      db.query.effects.findMany({
        orderBy: [asc(effects.name)],
      }),
    ]);

  let initialEditing:
    | { kind: "template"; row: (typeof templateRows)[number] }
    | { kind: "item"; row: (typeof itemRows)[number] }
    | null = null;

  if (editId) {
    if (build === "template") {
      const row = templateRows.find((t) => t.id === editId);
      if (row) initialEditing = { kind: "template", row };
    } else if (build === "item") {
      const row = itemRows.find((i) => i.id === editId);
      if (row) initialEditing = { kind: "item", row };
    }
  }

  // Build unified LibraryItem array for the left column.
  // Templates + Items are the primary entities. Primitives get included too
  // because Templates need to slot primitives during editing, and the user
  // can browse primitives while building an Item.
  const libraryItems: LibraryItem[] = [
    ...templateRows.map(templateToLibraryItem),
    ...itemRows.map(itemToLibraryItem),
    ...primitiveRows.map(primitiveToLibraryItem),
  ];

  return (
    <BlueprintSandboxClient
      initialBuild={build}
      initialKind={kind}
      initialEditing={initialEditing}
      templates={templateRows}
      items={itemRows}
      primitives={primitiveRows.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        buCost: p.buCost,
      }))}
      capabilities={capabilityRows.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        sourceType: c.sourceType,
      }))}
      effects={effectRows.map((e) => ({ id: e.id, name: e.name }))}
      libraryItems={libraryItems}
    />
  );
}