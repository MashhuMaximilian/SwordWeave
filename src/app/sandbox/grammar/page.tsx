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
import {
  resolveEngagementMap,
  enrichItemsWithEngagement,
} from "@/lib/engagement/engagement-aggregates";
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

  // Phase 18D (2026-07-14, perf): collapse sequential awaits into one
  // Promise.all so the 4 round-trips (Clerk auth -> viewer-id -> 3 DB
  // queries) overlap instead of stacking. Previously this took
  // ~5×RTT sequentially on cold Neon (auth ~30ms, viewer resolve ~15ms,
  // primitives ~25ms, effects ~40ms, capabilities ~60ms = ~170ms).
  // Now it's max(~30, ~25, ~40, ~60) = ~60ms, plus viewer-id which
  // we *need* before the visibility filter so it stays sequential.
  //
  // The visibility filter still wants `sandboxViewerId` before the
  // arrays are populated, so we can't start the 3 queries fully in
  // parallel with auth — but we CAN start all 3 DB queries
  // concurrently and apply the visibility filter as they resolve.
  //
  // Per-query try/catch is preserved by wrapping each branch in a
  // helper that catches + logs + returns an empty array. The banner
  // surfaces only when ANY branch failed.

  let sandboxViewerId: string | null = null;
  try {
    const { userId } = await auth();
    if (userId) {
      sandboxViewerId = await resolveUserIdByClerkId(userId);
    }
  } catch { /* not logged in */ }

  const visibilityFilter = (r: { isPublic: boolean; userId: string | null }) =>
    r.isPublic || !r.userId || r.userId === sandboxViewerId;

  // Each query wraps in its own async IIFE so a rejection there
  // becomes a resolved empty result — the rest of the Promise.all
  // stays alive. Phase 18D (2026-07-14, perf).
  const primPromise = (async (): Promise<{ rows: unknown[]; failed: boolean }> => {
    try {
      const rows = await db.query.primitives.findMany({
        orderBy: [asc(primitives.category), asc(primitives.name)],
      });
      return {
        rows: (
          rows as Array<{ isPublic: boolean; userId: string | null }>
        ).filter(visibilityFilter),
        failed: false,
      };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[grammar sandbox] primitives query failed:", err);
      return { rows: [], failed: true };
    }
  })();

  const fxPromise = (async (): Promise<{ rows: unknown[]; failed: boolean }> => {
    try {
      const rows = await db.query.effects.findMany({
        orderBy: [asc(effects.name)],
        with: { primitiveLinks: { with: { primitive: true } } },
      });
      return {
        rows: (
          rows as Array<{ isPublic: boolean; userId: string | null }>
        ).filter(visibilityFilter),
        failed: false,
      };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[grammar sandbox] effects query failed:", err);
      return { rows: [], failed: true };
    }
  })();

  const capPromise = (async (): Promise<{ rows: unknown[]; failed: boolean }> => {
    try {
      const rows = await db.query.capabilities.findMany({
        orderBy: [asc(capabilities.name)],
        with: {
          primitiveLinks: { with: { primitive: true } },
          effectLinks: {
            with: {
              effect: {
                with: {
                  primitiveLinks: { with: { primitive: true } },
                },
              },
            },
          },
        },
      });
      return {
        rows: (
          rows as Array<{ isPublic: boolean; userId: string | null }>
        ).filter(visibilityFilter),
        failed: false,
      };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[grammar sandbox] capabilities query failed:", err);
      return { rows: [], failed: true };
    }
  })();

  const [primResult, fxResult, capResult] = await Promise.all([
    primPromise,
    fxPromise,
    capPromise,
  ]);
  primitiveRows = primResult.rows;
  effectRows = fxResult.rows;
  capabilityRows = capResult.rows;
  dataLoadFailed = primResult.failed || fxResult.failed || capResult.failed;

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
  // so the LibraryTable sort UI has a stable baseline. Enriched with
  // engagement counts (likes / dislikes / forks) so the sandbox cards
  // show real numbers — without this, every card reads ♥ 0 / ★ 0
  // even when the underlying entry has engagement.
  // Build unified LibraryItem array for the left column. The mapper sets
  // `id` to the composite `<TYPE>:<id>` so we can reuse it directly
  // for the engagement map lookup.
  const baseItems: LibraryItem[] = [
    ...(primitiveRows as never[]).map((r) => primitiveToLibraryItem(r)),
    ...(effectRows as never[]).map((r) => effectToLibraryItem(r)),
    ...(capabilityRows as never[]).map((r) => capabilityToLibraryItem(r)),
  ];

  // Phase 18D-2 (2026-07-14, perf): the engagement-fetch + categories
  // + version-number resolution were 3 more sequential awaits AFTER
  // the query Promise.all. They're all independent of each other
  // (and independent of the query Promise.all on the very first
  // render — they only need baseItems). Running them concurrently
  // with each other cuts another ~60ms off cold renders.
  //
  // Each wrapped in async IIFE so a rejection becomes an empty
  // default — same pattern as the query Phase 18D block above.

  const engagementMapPromise = (async (): Promise<
    Awaited<ReturnType<typeof resolveEngagementMap>>
  > => {
    try {
      return await resolveEngagementMap(baseItems.map((it) => it.id));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[grammar sandbox] resolveEngagementMap failed:", err);
      return new Map();
    }
  })();

  const categoriesPromise = (async (): Promise<
    Awaited<ReturnType<typeof listPrimitiveCategories>>
  > => {
    try {
      return await listPrimitiveCategories();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        "[grammar sandbox] listPrimitiveCategories failed:",
        err,
      );
      return [];
    }
  })();

  const versionsPromise = (async (): Promise<
    Map<VersionNumberKey, number>
  > => {
    try {
      return await bulkResolveLatestVersionNumbers([
        ...primitiveRows.map((p) => ({ kind: "primitive" as const, id: (p as { id: number }).id })),
        ...effectRows.map((e) => ({ kind: "effect" as const, id: (e as { id: string }).id })),
        ...capabilityRows.map((c) => ({ kind: "capability" as const, id: (c as { id: string }).id })),
      ]);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[grammar sandbox] version resolution failed:", err);
      return new Map();
    }
  })();

  // Resolve current user + pre-fetch engagement snapshot for the
  // library items. Same pattern /library/browse uses. Without this,
  // every card in the sandbox library shows an unfilled heart even
  // when the viewer has already liked the entry — looks like every
  // engagement action is broken. Wrapped in try/catch so a failure
  // here degrades to "empty engagement" instead of a 500 (the
  // loadLibraryEngagement function already handles this internally,
  // but we also catch here in case resolveUserIdByClerkId throws).
  const loadEngagementPromise = (async (): Promise<
    Awaited<ReturnType<typeof loadLibraryEngagement>>
  > => {
    try {
      return await loadLibraryEngagement(
        sandboxViewerId,
        baseItems.map((it) => ({
          id: it.id,
          targetType: it.targetType,
          targetId: it.targetId,
          authorId: it.authorId,
        })),
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[grammar sandbox] engagement prefetch failed:", err);
      return { reactions: {}, following: {} };
    }
  })();

  const [engagementMap, primitiveCategories, versionMap, engagement] =
    await Promise.all([
      engagementMapPromise,
      categoriesPromise,
      versionsPromise,
      loadEngagementPromise,
    ]);

  let libraryItems: LibraryItem[] = enrichItemsWithEngagement(
    baseItems,
    engagementMap,
  );
  // dataLoadFailed was set above when the query Promise.all resolved;
  // currentUserInternalId is just sandboxViewerId renamed for the
  // <GrammarSandboxClient> prop contract.
  const currentUserInternalId = sandboxViewerId;

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
          iconSource: string | null;
          iconKey: string | null;
          iconUrl: string | null;
          iconColor: string | null;
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
          iconSource: row.iconSource,
          iconKey: row.iconKey,
          iconUrl: row.iconUrl,
          // iconColor is NOT NULL in the DB with a '#ffffff' default
          // but the row type allows null defensively; coerce.
          iconColor: row.iconColor ?? "#ffffff",
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
          iconSource: string | null;
          iconKey: string | null;
          iconUrl: string | null;
          iconColor: string | null;
        };
        return {
          id: row.id,
          name: row.name,
          narrativeDescription: row.narrativeDescription,
          sourceOrigin: row.sourceOrigin,
          tags: row.tags ?? [],
          isPublic: row.isPublic,
          iconSource: row.iconSource,
          iconKey: row.iconKey,
          iconUrl: row.iconUrl,
          // See primitive-row mapping above — coerce nulls to default.
          iconColor: row.iconColor ?? "#ffffff",
          primitiveLinks: (row.primitiveLinks ?? []).map((l) => ({
            primitiveId: l.primitiveId,
            quantity: l.quantity,
            primitive: l.primitive,
            versionNumber: versionMap.get(`primitive:${l.primitiveId}`) ?? 1,
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
          iconSource: string | null;
          iconKey: string | null;
          iconUrl: string | null;
          iconColor: string | null;
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
          // Phase 8: per-entity iconography
          iconSource: row.iconSource,
          iconKey: row.iconKey,
          iconUrl: row.iconUrl,
          iconColor: row.iconColor ?? "#ffffff",
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
            versionNumber: versionMap.get(`primitive:${l.primitiveId}`) ?? 1,
          })),
          // Pass the real effectLinks so the preview can render the
          // "Composed effects" section. Capabilities like "Abyssal
          // Despair" nest effects (e.g. "Shattered Composure") that
          // carry their own narrative + primitiveLinks.
          effectLinks: (row.effectLinks ?? []).map((l) => {
            const effectWithLinks = l.effect as typeof l.effect & {
              primitiveLinks?: Array<{
                primitiveId: number;
                quantity: number;
                primitive: { id: number; name: string; category: string; buCost: number };
              }>;
            };
            return {
              effectId: l.effectId,
              sortOrder: l.sortOrder,
              slotLabel: l.slotLabel,
              notes: l.notes,
              versionNumber: versionMap.get(`effect:${l.effectId}`) ?? 1,
              effect: {
                id: effectWithLinks.id,
                name: effectWithLinks.name,
                narrativeDescription: effectWithLinks.narrativeDescription,
                sourceOrigin: effectWithLinks.sourceOrigin,
                primitiveLinks: (effectWithLinks.primitiveLinks ?? []).map((pl) => ({
                  primitiveId: pl.primitiveId,
                  quantity: pl.quantity,
                  primitive: pl.primitive,
                })),
              },
            };
          }),
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
