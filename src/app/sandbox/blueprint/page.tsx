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
import type { SandboxCapabilityRow } from "@/components/library/library-item-preview";
import { db } from "@/db/client";
import { capabilities, effects, items, primitives, templates } from "@/db/schema";
import {
  capabilityToLibraryItem,
  effectToLibraryItem,
  itemToLibraryItem,
  primitiveToLibraryItem,
  templateToLibraryItem,
} from "@/components/sandbox/sandbox-row-mapper";
import {
  listPrimitiveCategories,
  type LibraryItem,
} from "@/lib/publishing/library-query";

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

  // Five parallel DB queries for templates/items/primitives/capabilities/effects.
  // Wrap the whole batch in try/catch so a transient failure in any one
  // query doesn't 500 the entire /sandbox/blueprint page. Previous behaviour:
  // query throws → unhandled error → user sees 'SANDBOX FAILED TO LOAD'
  // (Digest: 4107304400) and can do nothing until Vercel recovers. New
  // behaviour: log the error, render with empty arrays, user can still type
  // in the form and the library column just shows an empty list.
  //
  // Implementation: `safeBatchLoad` runs the Promise.all inside a try/catch
  // and returns either the full result tuple OR a sentinel "allFailed" flag
  // plus the empty-fallback tuple. The fallback tuple is typed as
  // `never[][]` because TypeScript can't unify the rich Drizzle row types
  // with the empty default — but the `dataLoadFailed` flag tells the rest
  // of the function to treat the rows as empty.
  let dataLoadFailed = false;
  let templateRows: unknown[] = [];
  let itemRows: unknown[] = [];
  let primitiveRows: unknown[] = [];
  let capabilityRows: unknown[] = [];
  let effectRows: unknown[] = [];

  try {
    const [
      tRows,
      iRows,
      pRows,
      cRows,
      eRows,
    ] = await Promise.all([
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
        with: {
          primitiveLinks: { with: { primitive: true } },
        },
      }),
    ]);
    templateRows = tRows as unknown[];
    itemRows = iRows as unknown[];
    primitiveRows = pRows as unknown[];
    capabilityRows = cRows as unknown[];
    effectRows = eRows as unknown[];
  } catch (err) {
    dataLoadFailed = true;
    // eslint-disable-next-line no-console
    console.error(
      "[blueprint sandbox] DB query batch failed, rendering empty library:",
      err,
    );
  }

  let initialEditing:
    | { kind: "template"; row: { id: string } }
    | { kind: "item"; row: { id: string } }
    | null = null;

  if (editId) {
    if (build === "template") {
      const row = templateRows.find(
        (t) => (t as { id: string }).id === editId,
      ) as { id: string } | undefined;
      if (row) initialEditing = { kind: "template", row };
    } else if (build === "item") {
      const row = itemRows.find(
        (i) => (i as { id: string }).id === editId,
      ) as { id: string } | undefined;
      if (row) initialEditing = { kind: "item", row };
    }
  }

  // Build unified LibraryItem array for the left column.
  // Templates + Items are the primary entities. Primitives, effects, and
  // capabilities are also included so the user can browse/filter them in
  // the kind filter (the filter chip exposes all types per the user's
  // spec). Sub-entity resolution uses the dedicated primitive/capability
  // row arrays below.
  const libraryItems: LibraryItem[] = [
    ...(templateRows as never[]).map((r) => templateToLibraryItem(r)),
    ...(itemRows as never[]).map((r) => itemToLibraryItem(r)),
    ...(primitiveRows as never[]).map((r) => primitiveToLibraryItem(r)),
    ...(effectRows as never[]).map((r) => effectToLibraryItem(r)),
    ...(capabilityRows as never[]).map((r) => capabilityToLibraryItem(r)),
  ];

  // Load primitive category chips for the filter panel. Wrapped in
  // try/catch so a category query failure doesn't 500 the page —
  // categories are non-critical; an empty list just hides the row.
  let primitiveCategories: Awaited<
    ReturnType<typeof listPrimitiveCategories>
  > = [];
  try {
    primitiveCategories = await listPrimitiveCategories();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      "[blueprint sandbox] listPrimitiveCategories failed:",
      err,
    );
  }

  return (
    <BlueprintSandboxClient
      initialBuild={build}
      initialKind={kind}
      initialEditing={initialEditing as never}
      templates={templateRows as never}
      items={itemRows as never}
      primitives={(primitiveRows as never[]).map((p) => {
        const row = p as {
          id: number;
          name: string;
          category: string;
          buCost: number;
        };
        return {
          id: row.id,
          name: row.name,
          category: row.category,
          buCost: row.buCost,
        };
      })}
      capabilities={(capabilityRows as never[]).map((c) => {
        const row = c as {
          id: string;
          name: string;
          type: string;
          sourceType: string;
        };
        return {
          id: row.id,
          name: row.name,
          type: row.type,
          sourceType: row.sourceType,
        };
      })}
      effects={(effectRows as never[]).map((e) => {
        const row = e as {
          id: string;
          name: string;
          narrativeDescription: string;
          sourceOrigin: string | null;
          tags: string[] | null;
          isPublic: boolean;
          primitiveLinks?: Array<{
            primitiveId: number;
            quantity: number;
            primitive: {
              id: number;
              name: string;
              category: string;
              buCost: number;
            };
          }>;
        };
        return {
          id: row.id,
          name: row.name,
          narrativeDescription: row.narrativeDescription,
          sourceOrigin: row.sourceOrigin,
          tags: row.tags ?? [],
          isPublic: row.isPublic,
          primitiveLinks: (row.primitiveLinks ?? []).map((l) => ({
            primitiveId: l.primitiveId,
            quantity: l.quantity,
            primitive: l.primitive,
          })),
        };
      })}
      libraryItems={libraryItems}
      primitiveCategories={primitiveCategories}
      sandboxPrimitives={(primitiveRows as never[]).map((p) => {
        const row = p as {
          id: number;
          name: string;
          category: string;
          buCost: number;
          isPublic: boolean;
          costTier: string;
          mechanicalOutputText: string;
          narrativeRule: string;
          isMirrorable: boolean;
          mirrorVector: string;
          mirrorBuCredit: number;
          mirrorEligibilityNotes: string;
          hardModifiers: unknown;
        };
        return {
          id: row.id,
          name: row.name,
          category: row.category,
          buCost: row.buCost,
          isPublic: row.isPublic,
          costTier: row.costTier,
          mechanicalOutputText: row.mechanicalOutputText,
          narrativeRule: row.narrativeRule,
          isMirrorable: row.isMirrorable,
          mirrorVector: row.mirrorVector,
          mirrorBuCredit: row.mirrorBuCredit,
          mirrorEligibilityNotes: row.mirrorEligibilityNotes,
          hardModifiers: row.hardModifiers,
        };
      })}
      sandboxCapabilities={(capabilityRows as never[]).map((c) => {
        const row = c as {
          id: string;
          name: string;
          type: string;
          sourceType: string;
          verboseDescription: string;
          sourceOrigin: string | null;
          tags: string[] | null;
          isPublic: boolean;
        };
        return {
          id: row.id,
          name: row.name,
          type: row.type,
          sourceType: row.sourceType,
          verboseDescription: row.verboseDescription,
          sourceOrigin: row.sourceOrigin,
          tags: row.tags ?? [],
          isPublic: row.isPublic,
          // Capability's relational primitiveLinks have a richer shape
          // (role/sortOrder/slotLabel) but the blueprint sandbox's
          // capability form only needs the id/name/category/buCost
          // basics. Cast the empty array to the SandboxCapabilityRow
          // type so TypeScript is happy; the actual primitiveLinks are
          // populated separately via the sandbox's load-capability flow.
          primitiveLinks: [] as unknown as SandboxCapabilityRow["primitiveLinks"],
        };
      })}
      dataLoadFailed={dataLoadFailed}
    />
  );
}
