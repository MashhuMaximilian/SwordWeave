// /sandbox/blueprint
// One page hosting three Build modes: Template | Item | Monster.
// ?build=<mode> selects the active mode (defaults to "template").
// ?kind=<RACE|BACKGROUND|ARCHETYPE> only relevant when build=template.
// ?edit=<id> pre-fills the form with the matching entity.

import { asc } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";

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
import { loadLibraryEngagement } from "@/lib/engagement/library-engagement";
import { resolveUserIdByClerkId } from "@/lib/auth/author-resolver";
import { getVersionPayload } from "@/lib/versions/version-payload";

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
  searchParams: Promise<{
    build?: string;
    kind?: string;
    edit?: string;
    version?: string;
  }>;
}) {
  const params = await searchParams;
  const build = parseBuild(params.build);
  const kind = parseKind(params.kind);
  const editId = params.edit;
  // Optional `?version=N` deep-link from the version-history page —
  // when present, the sandbox fetches the reconstructed payload for
  // that exact version and uses it to pre-fill the form. Otherwise
  // the live row is used.
  const versionNumber = params.version
    ? Number(params.version)
    : Number.NaN;

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
  // Each query is wrapped in its own try/catch so a failure in one
  // table (e.g. items breaking on a schema drift) doesn't empty the
  // whole library. Previous behaviour: a single failure in
  // Promise.all → all 5 row arrays empty → user sees "No entries
  // match" in the library column. The user reported this after the
  // quantity migration: the items query started returning rows but
  // something downstream caused Promise.all to reject, taking
  // templates down with it. Per-query isolation keeps the rest of
  // the corpus visible. We log the per-table failure and surface a
  // banner via dataLoadFailed (any failure → true).
  let dataLoadFailed = false;
  let templateRows: unknown[] = [];
  let itemRows: unknown[] = [];
  let primitiveRows: unknown[] = [];
  let capabilityRows: unknown[] = [];
  let effectRows: unknown[] = [];

  // TEMPLATES
  try {
    const rows = await db.query.templates.findMany({
      orderBy: [asc(templates.kind), asc(templates.name)],
      with: {
        primitiveLinks: { with: { primitive: true } },
        capabilityLinks: { with: { capability: true } },
      },
    });
    templateRows = rows as unknown[];
  } catch (err) {
    dataLoadFailed = true;
    // eslint-disable-next-line no-console
    console.error("[blueprint sandbox] templates query failed:", err);
  }

  // ITEMS
  try {
    const rows = await db.query.items.findMany({
      orderBy: [asc(items.name)],
      with: {
        primitiveLinks: { with: { primitive: true } },
      },
    });
    itemRows = rows as unknown[];
  } catch (err) {
    dataLoadFailed = true;
    // eslint-disable-next-line no-console
    console.error("[blueprint sandbox] items query failed:", err);
  }

  // PRIMITIVES
  try {
    const rows = await db.query.primitives.findMany({
      orderBy: [asc(primitives.name)],
    });
    primitiveRows = rows as unknown[];
  } catch (err) {
    dataLoadFailed = true;
    // eslint-disable-next-line no-console
    console.error("[blueprint sandbox] primitives query failed:", err);
  }

  // CAPABILITIES
  try {
    const rows = await db.query.capabilities.findMany({
      orderBy: [asc(capabilities.name)],
      with: {
        primitiveLinks: { with: { primitive: true } },
        effectLinks: { with: { effect: true } },
      },
    });
    capabilityRows = rows as unknown[];
  } catch (err) {
    dataLoadFailed = true;
    // eslint-disable-next-line no-console
    console.error("[blueprint sandbox] capabilities query failed:", err);
  }

  // EFFECTS
  try {
    const rows = await db.query.effects.findMany({
      orderBy: [asc(effects.name)],
      with: {
        primitiveLinks: { with: { primitive: true } },
      },
    });
    effectRows = rows as unknown[];
  } catch (err) {
    dataLoadFailed = true;
    // eslint-disable-next-line no-console
    console.error("[blueprint sandbox] effects query failed:", err);
  }

  let initialEditing:
    | { kind: "template"; row: { id: string } }
    | { kind: "item"; row: { id: string } }
    | null = null;

  if (editId) {
    if (build === "template") {
      // If a version is requested, fetch the reconstructed payload and
      // shallow-merge it onto the row so the form pre-fills with
      // version-N's values. If the version fetch fails or the version
      // number is invalid, fall back to the live row.
      let baseRow: Record<string, unknown> | null = null;
      if (Number.isFinite(versionNumber)) {
        // Pick the right targetType string based on `kind`. The kind
        // param is set when the user clicked "Slot into build" from
        // the version history page; for legacy links without kind we
        // fall back to RACE.
        const targetType =
          kind === "BACKGROUND"
            ? "BACKGROUND_TEMPLATE"
            : kind === "ARCHETYPE"
              ? "ARCHETYPE_TEMPLATE"
              : "RACE_TEMPLATE";
        try {
          const ver = await getVersionPayload(targetType, editId, versionNumber);
          if (ver) baseRow = ver.payload;
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("[blueprint sandbox] version load failed:", err);
        }
      }
      const row = templateRows.find(
        (t) => (t as { id: string }).id === editId,
      ) as { id: string } | undefined;
      if (row) {
        const merged = baseRow
          ? ({ ...row, ...baseRow } as { id: string })
          : row;
        initialEditing = { kind: "template", row: merged };
      }
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

  // Resolve current user + pre-fetch engagement snapshot for the
  // library items. Same pattern /library/browse uses. Without this,
  // every card in the sandbox library shows an unfilled heart even
  // when the viewer has already liked the entry.
  let currentUserInternalId: string | null = null;
  let engagement: Awaited<ReturnType<typeof loadLibraryEngagement>> = {
    reactions: {},
    following: {},
  };
  try {
    const { userId: clerkUserId } = await auth();
    if (clerkUserId) {
      currentUserInternalId = await resolveUserIdByClerkId(clerkUserId);
    }
    engagement = await loadLibraryEngagement(
      currentUserInternalId,
      libraryItems.map((it) => ({
        id: it.id,
        targetType: it.targetType,
        targetId: it.targetId,
        authorId: it.authorId,
      })),
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[blueprint sandbox] engagement prefetch failed:", err);
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
      engagement={engagement}
      currentUserInternalId={currentUserInternalId}
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
          primitiveLinks?: Array<{
            primitiveId: number;
            role: string;
            quantity: number;
            sortOrder: number;
            slotLabel: string | null;
            primitive: {
              id: number;
              name: string;
              category: string;
              buCost: number;
            };
          }>;
          effectLinks?: Array<{
            effectId: string;
            sortOrder: number;
            slotLabel: string | null;
            notes: string | null;
            effect: {
              id: string;
              name: string;
              narrativeDescription: string | null;
              sourceOrigin: string | null;
            };
          }>;
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
          // Pass the real primitiveLinks so previews AND forms see the
          // composed primitives. The form reads from this when loading
          // a capability into the build.
          primitiveLinks: (row.primitiveLinks ?? []).map((l) => ({
            primitiveId: l.primitiveId,
            role: l.role,
            quantity: l.quantity,
            sortOrder: l.sortOrder,
            slotLabel: l.slotLabel,
            primitive: l.primitive,
          })),
          effectLinks: (row.effectLinks ?? []).map((l) => ({
            effectId: l.effectId,
            sortOrder: l.sortOrder,
            slotLabel: l.slotLabel,
            notes: l.notes,
            effect: l.effect,
          })),
        };
      })}
      dataLoadFailed={dataLoadFailed}
    />
  );
}
