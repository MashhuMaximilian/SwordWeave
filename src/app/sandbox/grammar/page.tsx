// /sandbox/grammar
// One page hosting three Build modes: Primitive | Effect | Capability.
// ?build=<mode> selects the active mode (defaults to "primitive").
// ?edit=<id> pre-fills the form with the matching entity.

import { asc } from "drizzle-orm";

import {
  GrammarSandboxClient,
  type GrammarBuildMode,
} from "@/components/sandbox/grammar-sandbox-client";
import { db } from "@/db/client";
import { capabilities, effects, primitives } from "@/db/schema";
import {
  capabilityToLibraryItem,
  effectToLibraryItem,
  primitiveToLibraryItem,
} from "@/components/sandbox/sandbox-row-mapper";
import type { LibraryItem } from "@/lib/publishing/library-query";

export const dynamic = "force-dynamic";

function parseBuild(value: string | undefined): GrammarBuildMode {
  if (value === "effect" || value === "capability") return value;
  return "primitive";
}

export default async function GrammarSandboxPage({
  searchParams,
}: {
  searchParams: Promise<{ build?: string; edit?: string }>;
}) {
  const params = await searchParams;
  const build = parseBuild(params.build);
  const editId = params.edit;

  // Three parallel DB queries for primitives/effects/capabilities.
  // Wrap in try/catch so a transient DB failure doesn't 500 the entire
  // /sandbox/grammar page (previous behaviour: query throws → unhandled
  // error → user sees 'SANDBOX FAILED TO LOAD'). New behaviour: log,
  // render with empty arrays, user can still type in the form.
  //
  // We use the same `unknown[]` + Drizzle-cast pattern as
  // /sandbox/blueprint. The `dataLoadFailed` flag tells the render
  // layer to surface a banner explaining why the library is empty.
  let dataLoadFailed = false;
  let primitiveRows: unknown[] = [];
  let effectRows: unknown[] = [];
  let capabilityRows: unknown[] = [];

  try {
    const [pRows, eRows, cRows] = await Promise.all([
      db.query.primitives.findMany({
        orderBy: [asc(primitives.category), asc(primitives.name)],
      }),
      db.query.effects.findMany({
        orderBy: [asc(effects.name)],
        with: {
          primitiveLinks: { with: { primitive: true } },
        },
      }),
      db.query.capabilities.findMany({
        orderBy: [asc(capabilities.name)],
        with: {
          primitiveLinks: { with: { primitive: true } },
        },
      }),
    ]);
    primitiveRows = pRows as unknown[];
    effectRows = eRows as unknown[];
    capabilityRows = cRows as unknown[];
  } catch (err) {
    dataLoadFailed = true;
    // eslint-disable-next-line no-console
    console.error(
      "[grammar sandbox] DB query batch failed, rendering empty library:",
      err,
    );
  }

  // Resolve ?edit=<id> into a typed initial editing row.
  let initialEditing:
    | { kind: "primitive"; row: { id: number } }
    | { kind: "effect"; row: { id: string } }
    | { kind: "capability"; row: { id: string } }
    | null = null;

  if (editId) {
    if (build === "primitive") {
      const numId = Number(editId);
      if (Number.isFinite(numId)) {
        const row = primitiveRows.find(
          (p) => (p as { id: number }).id === numId,
        );
        if (row) {
          initialEditing = { kind: "primitive", row: row as { id: number } };
        }
      }
    } else if (build === "effect") {
      const row = effectRows.find(
        (e) => (e as { id: string }).id === editId,
      );
      if (row) initialEditing = { kind: "effect", row: row as { id: string } };
    } else if (build === "capability") {
      const row = capabilityRows.find(
        (c) => (c as { id: string }).id === editId,
      );
      if (row)
        initialEditing = { kind: "capability", row: row as { id: string } };
    }
  }

  // Build unified LibraryItem array for the left column. Sorted by name
  // so the LibraryTable sort UI has a stable baseline.
  const libraryItems: LibraryItem[] = [
    ...(primitiveRows as never[]).map((r) => primitiveToLibraryItem(r)),
    ...(effectRows as never[]).map((r) => effectToLibraryItem(r)),
    ...(capabilityRows as never[]).map((r) => capabilityToLibraryItem(r)),
  ];

  return (
    <GrammarSandboxClient
      initialBuild={build}
      initialEditing={initialEditing as never}
      primitives={(primitiveRows as never[]).map((p) => {
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
      capabilities={(capabilityRows as never[]).map((c) => {
        const row = c as {
          id: string;
          name: string;
          type: string;
          sourceType: string;
          sourceOrigin: string | null;
          tags: string[] | null;
          isPublic: boolean;
          verboseDescription: string;
          narrativeDescription: string | null;
        };
        return {
          id: row.id,
          name: row.name,
          type: row.type,
          sourceType: row.sourceType,
          sourceOrigin: row.sourceOrigin,
          tags: row.tags ?? [],
          isPublic: row.isPublic,
          verboseDescription: row.verboseDescription,
          // Capability's relational primitiveLinks have a richer shape
          // (role/sortOrder/slotLabel). The grammar sandbox's
          // capability form only needs id/name/category/buCost; the
          // actual primitiveLinks are populated by the load flow.
          // Cast empty array to never so TypeScript accepts it; the
          // runtime consumer treats primitiveLinks as optional.
          primitiveLinks: [] as never,
        };
      })}
      libraryItems={libraryItems}
      dataLoadFailed={dataLoadFailed}
    />
  );
}
