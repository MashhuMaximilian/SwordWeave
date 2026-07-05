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

  // Load everything the Library + Build forms need in parallel.
  const [primitiveRows, effectRows, capabilityRows] = await Promise.all([
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

  // Resolve ?edit=<id> into a typed initial editing row.
  let initialEditing:
    | {
        kind: "primitive";
        row: (typeof primitiveRows)[number];
      }
    | {
        kind: "effect";
        row: (typeof effectRows)[number];
      }
    | {
        kind: "capability";
        row: (typeof capabilityRows)[number];
      }
    | null = null;

  if (editId) {
    if (build === "primitive") {
      const numId = Number(editId);
      if (Number.isFinite(numId)) {
        const row = primitiveRows.find((p) => p.id === numId);
        if (row) {
          initialEditing = { kind: "primitive", row };
        }
      }
    } else if (build === "effect") {
      const row = effectRows.find((e) => e.id === editId);
      if (row) initialEditing = { kind: "effect", row };
    } else if (build === "capability") {
      const row = capabilityRows.find((c) => c.id === editId);
      if (row) initialEditing = { kind: "capability", row };
    }
  }

  // Build unified LibraryItem array for the left column. Sorted by name
  // so the LibraryTable sort UI has a stable baseline.
  const libraryItems: LibraryItem[] = [
    ...primitiveRows.map(primitiveToLibraryItem),
    ...effectRows.map(effectToLibraryItem),
    ...capabilityRows.map(capabilityToLibraryItem),
  ];

  return (
    <GrammarSandboxClient
      initialBuild={build}
      initialEditing={initialEditing}
      primitives={primitiveRows}
      effects={effectRows}
      capabilities={capabilityRows}
      libraryItems={libraryItems}
    />
  );
}