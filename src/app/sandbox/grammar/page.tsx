// /sandbox/grammar
// One page hosting three Build modes: Primitive | Effect | Capability.
// ?build=<mode> selects the active mode (defaults to "primitive").
// ?edit=<id> pre-fills the form with the matching entity.
// ?intent=<fork|load> (Phase 1) records HOW the user entered the
//   sandbox. Clicked "Fork" button → intent=fork (always fork on save).
//   Clicked "Load into build" → intent=load (owner=version-update,
//   non-owner=fork). No ?intent= defaults to "load" semantics on save.

import { asc } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";

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
import {
  listPrimitiveCategories,
  type LibraryItem,
} from "@/lib/publishing/library-query";
import { loadLibraryEngagement } from "@/lib/engagement/library-engagement";
import { resolveUserIdByClerkId } from "@/lib/auth/author-resolver";
import { getVersionPayload } from "@/lib/versions/version-payload";
import { parseSaveIntent, type SaveIntent } from "@/lib/publishing/save-intent";
import {
  bulkResolveLatestVersionNumbers,
  getVersionNumber,
  type VersionNumberKey,
} from "@/lib/versions/bulk-resolve-latest-version-numbers";

export const dynamic = "force-dynamic";

function parseBuild(value: string | undefined): GrammarBuildMode {
  if (value === "effect" || value === "capability") return value;
  return "primitive";
}

export default async function GrammarSandboxPage({
  searchParams,
}: {
  searchParams: Promise<{
    build?: string;
    edit?: string;
    version?: string;
    intent?: string;
  }>;
}) {
  const params = await searchParams;
  const build = parseBuild(params.build);
  const editId = params.edit;
  // Phase 1: parse ?intent=fork|load. The form threads this into
  // the save body so the server knows whether the user came in via
  // the Fork button (always fork on save) or Load into build button
  // (owner=version-update, non-owner=fork). See §6.7 of the
  // edit-creates-fork design doc for the full matrix.
  const intent: SaveIntent = parseSaveIntent(params.intent);
  // Optional `?version=N` deep-link from the version-history page —
  // when present, the sandbox fetches the reconstructed payload for
  // that exact version and uses it to pre-fill the form. Otherwise
  // the live row is used.
  const versionNumber = params.version
    ? Number(params.version)
    : Number.NaN;

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

  // Each query isolated in its own try/catch so one failure doesn't
  // empty the whole library. See blueprint/page.tsx for the same
  // pattern + the rationale.
  try {
    const rows = await db.query.primitives.findMany({
      orderBy: [asc(primitives.category), asc(primitives.name)],
    });
    primitiveRows = rows as unknown[];
  } catch (err) {
    dataLoadFailed = true;
    // eslint-disable-next-line no-console
    console.error("[grammar sandbox] primitives query failed:", err);
  }
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
    console.error("[grammar sandbox] effects query failed:", err);
  }
  try {
    const rows = await db.query.capabilities.findMany({
      orderBy: [asc(capabilities.name)],
      with: {
        primitiveLinks: { with: { primitive: true } },
        effectLinks: { with: { effect: { with: { primitiveLinks: { with: { primitive: true } } } } } },
      },
    });
    capabilityRows = rows as unknown[];
  } catch (err) {
    dataLoadFailed = true;
    // eslint-disable-next-line no-console
    console.error("[grammar sandbox] capabilities query failed:", err);
  }

  // Resolve ?edit=<id> into a typed initial editing row. If `?version=N`
  // is also present, fetch the reconstructed version payload and use
  // that as the row data instead of the live row. The form fields
  // pre-fill from whichever object we hand it — same shape either way.
  let initialEditing:
    | { kind: "primitive"; row: { id: number } }
    | { kind: "effect"; row: { id: string } }
    | { kind: "capability"; row: { id: string } }
    | null = null;

  if (editId) {
    if (build === "primitive") {
      const numId = Number(editId);
      if (Number.isFinite(numId)) {
        // If a version is requested, fetch the reconstructed payload
        // and shallow-merge it onto the row so the form pre-fills with
        // version-N's values (overriding any live-row fields that the
        // version snapshot contains). If the version fetch fails or
        // the version number is invalid, fall back to the live row.
        let baseRow: Record<string, unknown> | null = null;
        if (Number.isFinite(versionNumber)) {
          try {
            const ver = await getVersionPayload(
              "PRIMITIVE",
              String(numId),
              versionNumber,
            );
            if (ver) baseRow = ver.payload;
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error("[grammar sandbox] version load failed:", err);
          }
        }
        const row = primitiveRows.find(
          (p) => (p as { id: number }).id === numId,
        );
        if (row) {
          const merged: Record<string, unknown> = {
            ...(row as Record<string, unknown>),
            ...(baseRow ?? {}),
          };
          initialEditing = { kind: "primitive", row: merged as { id: number } };
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
      "[grammar sandbox] listPrimitiveCategories failed:",
      err,
    );
  }

  // Resolve current user + pre-fetch engagement snapshot for the
  // library items. Same pattern /library/browse uses. Without this,
  // every card in the sandbox library shows an unfilled heart even
  // when the viewer has already liked the entry — looks like every
  // engagement action is broken. Wrapped in try/catch so a failure
  // here degrades to "empty engagement" instead of a 500 (the
  // loadLibraryEngagement function already handles this internally,
  // but we also catch here in case resolveUserIdByClerkId throws).
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
    console.error("[grammar sandbox] engagement prefetch failed:", err);
  }

  // Resolve latest published version numbers for all entities. This
  // lets the modal preview show "v3" next to the entity name. Wrapped
  // in try/catch so a failure degrades to "no version" instead of 500.
  let versionMap: Map<VersionNumberKey, number> = new Map();
  try {
    versionMap = await bulkResolveLatestVersionNumbers([
      ...primitiveRows.map((p) => ({ kind: "primitive" as const, id: (p as { id: number }).id })),
      ...effectRows.map((e) => ({ kind: "effect" as const, id: (e as { id: string }).id })),
      ...capabilityRows.map((c) => ({ kind: "capability" as const, id: (c as { id: string }).id })),
    ]);
  } catch (err) {
    console.error("[grammar sandbox] version resolution failed:", err);
  }

  return (
    <GrammarSandboxClient
      initialBuild={build}
      initialEditing={initialEditing as never}
      // Phase 1: thread intent flag + the entity id being edited
      // ("sourceId") into the client. The form uses both to construct
      // the save body — see src/lib/publishing/dispatch-save.ts for
      // the full matrix.
      initialIntent={intent}
      initialSourceId={editId ?? null}
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
          sourceOrigin: row.sourceOrigin,
          tags: row.tags ?? [],
          isPublic: row.isPublic,
          verboseDescription: row.verboseDescription,
          // Pass the real primitiveLinks so the preview shows the
          // composed primitives. The form also reads from this when
          // loading a capability into the build.
          primitiveLinks: (row.primitiveLinks ?? []).map((l) => ({
            primitiveId: l.primitiveId,
            role: l.role,
            quantity: l.quantity,
            sortOrder: l.sortOrder,
            slotLabel: l.slotLabel,
            primitive: l.primitive,
          })),
          // Pass the real effectLinks so the preview can render the
          // "Composed effects" section. Capabilities like "Abyssal
          // Despair" nest effects (e.g. "Shattered Composure") that
          // carry their own narrative + primitiveLinks.
          effectLinks: (row.effectLinks ?? []).map((l) => ({
            effectId: l.effectId,
            sortOrder: l.sortOrder,
            slotLabel: l.slotLabel,
            notes: l.notes,
            effect: {
              id: l.effect.id,
              name: l.effect.name,
              narrativeDescription: l.effect.narrativeDescription,
              sourceOrigin: l.effect.sourceOrigin,
              primitiveLinks: (l.effect.primitiveLinks ?? []).map((pl) => ({
                primitiveId: pl.primitiveId,
                quantity: pl.quantity,
                primitive: pl.primitive,
              })),
            },
          })),
        };
      })}
      libraryItems={libraryItems}
      primitiveCategories={primitiveCategories}
      dataLoadFailed={dataLoadFailed}
      engagement={engagement}
      currentUserInternalId={currentUserInternalId}
      versionMap={Object.fromEntries(versionMap)}
    />
  );
}
