// /sandbox/atelier — unified sandbox.
// Merges the former /sandbox/grammar (primitive | effect | capability)
// and /sandbox/blueprint (template | item | monster) routes into one
// page with a 6-tab bottom bar. See atelier-sandbox-client.tsx.
//
// ?build=<tab> selects the active tab (defaults to "primitive").
// ?kind=<lineage|upbringing|manifest> only relevant when build=heritage.
// ?edit=<id> pre-fills the form with the matching entity.
// ?intent=<fork|load> (Phase 1) records HOW the user entered the sandbox.
// ?version=N deep-links a specific published version for pre-fill.

import { asc } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";

import {
  AtelierSandboxClient,
  type AtelierTab,
} from "@/components/sandbox/atelier-sandbox-client";
import { db } from "@/db/client";
import {
  capabilities,
  effects,
  items,
  primitives,
  heritage,
} from "@/db/schema";
import {
  capabilityToLibraryItem,
  effectToLibraryItem,
  itemToLibraryItem,
  primitiveToLibraryItem,
  heritageToLibraryItem,
} from "@/components/sandbox/sandbox-row-mapper";
import { resolveAuthorByClerkId } from "@/lib/auth/author-resolver";
import {
  listPrimitiveCategories,
  resolveAuthorMap,
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
} from "@/lib/versions/bulk-resolve-latest-version-numbers";

export const dynamic = "force-dynamic";

function parseBuild(value: string | undefined): AtelierTab {
  // primitive/effect/capability all collapse into the single Mechanics tab.
  // Heritage tab is the new name for the old "template" build.
  if (value === "heritage" || value === "item" || value === "monster") {
    return value;
  }
  return "mechanics";
}

function parseKind(
  value: string | undefined,
): "LINEAGE" | "UPBRINGING" | "MANIFEST" | undefined {
  if (value === "LINEAGE" || value === "UPBRINGING" || value === "MANIFEST")
    return value;
  return undefined;
}

export default async function AtelierSandboxPage({
  searchParams,
}: {
  searchParams: Promise<{
    build?: string;
    kind?: string;
    edit?: string;
    version?: string;
    intent?: string;
  }>;
}) {
  const params = await searchParams;
  // `rawBuild` is the literal ?build= value (primitive/effect/capability/
  // template/...); `build` is the collapsed tab (mechanics/...). The
  // editing resolution keys off the concrete kind, so it uses rawBuild.
  const rawBuild = params.build;
  const build = parseBuild(rawBuild);
  const kind = parseKind(params.kind);
  const editId = params.edit;
  const intent: SaveIntent = parseSaveIntent(params.intent);
  const versionNumber = params.version ? Number(params.version) : Number.NaN;
  const initialMechanicsKindRaw =
    rawBuild === "effect" || rawBuild === "capability" ? rawBuild : "primitive";
  let initialMechanicsKind: "primitive" | "effect" | "capability" =
    initialMechanicsKindRaw;

  let dataLoadFailed = false;
  let primitiveRows: unknown[] = [];
  let effectRows: unknown[] = [];
  let capabilityRows: unknown[] = [];
  let heritageRows: unknown[] = [];
  let itemRows: unknown[] = [];

  let sandboxViewerId: string | null = null;
  try {
    const { userId } = await auth();
    if (userId) {
      sandboxViewerId = await resolveUserIdByClerkId(userId);
    }
  } catch {
    /* not logged in */
  }

  const visFilter = (r: { isPublic: boolean; userId: string | null }) =>
    r.isPublic || !r.userId || r.userId === sandboxViewerId;

  // PRIMITIVES
  try {
    const rows = await db.query.primitives.findMany({
      orderBy: [asc(primitives.category), asc(primitives.name)],
    });
    primitiveRows = (rows as Array<{ isPublic: boolean; userId: string | null }>).filter(visFilter) as unknown[];
  } catch (err) {
    dataLoadFailed = true;
    console.error("[atelier sandbox] primitives query failed:", err);
  }

  // EFFECTS
  try {
    const rows = await db.query.effects.findMany({
      orderBy: [asc(effects.name)],
      with: { primitiveLinks: { with: { primitive: true } } },
    });
    effectRows = (rows as Array<{ isPublic: boolean; userId: string | null }>).filter(visFilter) as unknown[];
  } catch (err) {
    dataLoadFailed = true;
    console.error("[atelier sandbox] effects query failed:", err);
  }

  // CAPABILITIES
  try {
    const rows = await db.query.capabilities.findMany({
      orderBy: [asc(capabilities.name)],
      with: {
        primitiveLinks: { with: { primitive: true } },
        effectLinks: {
          with: { effect: { with: { primitiveLinks: { with: { primitive: true } } } } },
        },
      },
    });
    capabilityRows = (rows as Array<{ isPublic: boolean; userId: string | null }>).filter(visFilter) as unknown[];
  } catch (err) {
    dataLoadFailed = true;
    console.error("[atelier sandbox] capabilities query failed:", err);
  }

  // HERITAGE
  try {
    const rows = await db.query.heritage.findMany({
      orderBy: [asc(heritage.kind), asc(heritage.name)],
      with: {
        primitiveLinks: { with: { primitive: true } },
        capabilityLinks: { with: { capability: { with: { primitiveLinks: { with: { primitive: true } } } } } },
      },
    });
    heritageRows = (rows as Array<{ isPublic: boolean; userId: string | null }>).filter(visFilter) as unknown[];
  } catch (err) {
    dataLoadFailed = true;
    console.error("[atelier sandbox] heritage query failed:", err);
  }

  // ITEMS
  try {
    const rows = await db.query.items.findMany({
      orderBy: [asc(items.name)],
      with: {
        primitiveLinks: { with: { primitive: true } },
        effectLinks: { with: { effect: { with: { primitiveLinks: { with: { primitive: true } } } } } },
        capabilityLinks: { with: { capability: { with: { primitiveLinks: { with: { primitive: true } } } } } },
      },
    });
    itemRows = (rows as Array<{ isPublic: boolean; userId: string | null }>).filter(visFilter) as unknown[];
  } catch (err) {
    dataLoadFailed = true;
    console.error("[atelier sandbox] items query failed:", err);
  }

  // Resolve ?edit=<id> into initial editing row (across all kinds).
  let initialEditing:
    | { kind: "primitive"; row: { id: number } }
    | { kind: "effect"; row: { id: string } }
    | { kind: "capability"; row: { id: string } }
    | { kind: "heritage"; row: { id: string } }
    | { kind: "item"; row: { id: string } }
    | null = null;

  if (editId) {
    if (rawBuild === "primitive") {
      const numId = Number(editId);
      if (Number.isFinite(numId)) {
        let baseRow: Record<string, unknown> | null = null;
        if (Number.isFinite(versionNumber)) {
          try {
            const ver = await getVersionPayload("PRIMITIVE", String(numId), versionNumber);
            if (ver) baseRow = ver.payload;
          } catch (err) {
            console.error("[atelier sandbox] version load failed:", err);
          }
        }
        const row = primitiveRows.find((p) => (p as { id: number }).id === numId);
        if (row) {
          initialEditing = {
            kind: "primitive",
            row: { ...(row as Record<string, unknown>), ...(baseRow ?? {}) } as { id: number },
          };
        }
      }
    } else if (rawBuild === "effect") {
      const row = effectRows.find((e) => (e as { id: string }).id === editId);
      if (row) initialEditing = { kind: "effect", row: row as { id: string } };
    } else if (rawBuild === "capability") {
      const row = capabilityRows.find((c) => (c as { id: string }).id === editId);
      if (row) initialEditing = { kind: "capability", row: row as { id: string } };
    } else if (build === "heritage") {
      let baseRow: Record<string, unknown> | null = null;
      if (Number.isFinite(versionNumber)) {
        const targetType =
          kind === "UPBRINGING"
            ? "UPBRINGING_TEMPLATE"
            : kind === "MANIFEST"
              ? "MANIFEST_TEMPLATE"
              : "LINEAGE_TEMPLATE";
        try {
          const ver = await getVersionPayload(targetType, editId, versionNumber);
          if (ver) baseRow = ver.payload;
        } catch (err) {
          console.error("[atelier sandbox] version load failed:", err);
        }
      }
      const row = heritageRows.find((t) => (t as { id: string }).id === editId) as { id: string } | undefined;
      if (row) {
        const merged = baseRow ? ({ ...row, ...baseRow } as { id: string }) : row;
        initialEditing = { kind: "heritage", row: merged };
      }
    } else if (build === "item") {
      const row = itemRows.find((i) => (i as { id: string }).id === editId) as { id: string } | undefined;
      if (row) initialEditing = { kind: "item", row };
    } else if (build === "mechanics") {
      // Collapsed Mechanics tab: the concrete kind isn't in the URL
      // (build=mechanics), so resolve the loaded entity by trying each
      // mechanics kind by id. Without this, `?build=mechanics&edit=<id>`
      // left initialEditing null and the in-session load / tab-switch
      // couldn't re-resolve the entity (the legacy /sandbox/grammar route
      // used concrete build=primitive, so it resolved fine).
      const numId = Number(editId);
      const pRow = Number.isFinite(numId)
        ? primitiveRows.find((p) => (p as { id: number }).id === numId)
        : undefined;
      if (pRow) {
        initialEditing = { kind: "primitive", row: pRow as { id: number } };
        initialMechanicsKind = "primitive";
      } else {
        const eRow = effectRows.find((e) => (e as { id: string }).id === editId) as
          | { id: string }
          | undefined;
        if (eRow) {
          initialEditing = { kind: "effect", row: eRow };
          initialMechanicsKind = "effect";
        } else {
          const cRow = capabilityRows.find((c) => (c as { id: string }).id === editId) as
            | { id: string }
            | undefined;
          if (cRow) {
            initialEditing = { kind: "capability", row: cRow };
            initialMechanicsKind = "capability";
          }
        }
      }
    }
  }

  // Unified LibraryItem[] for the left column.
  const baseItems: LibraryItem[] = [
    ...(heritageRows as never[]).map((r) => heritageToLibraryItem(r)),
    ...(itemRows as never[]).map((r) => itemToLibraryItem(r)),
    ...(primitiveRows as never[]).map((r) => primitiveToLibraryItem(r)),
    ...(effectRows as never[]).map((r) => effectToLibraryItem(r)),
    ...(capabilityRows as never[]).map((r) => capabilityToLibraryItem(r)),
  ];

  // Resolve authors so every preview can show a creator tag (the
  // *ToLibraryItem mappers above fill EMPTY_AUTHORS — they operate on raw
  // rows that don't carry the joined user record). User-reported (Phase 9
  // review): no "by @username" was visible in the atelier preview modal
  // because every author field was null.
  type RowWithUserId = { id: string | number; userId?: string | null };
  const userIdByRowKey = new Map<string, string | null>();
  const addRows = (rows: unknown[], targetType: string) => {
    for (const r of rows as RowWithUserId[]) {
      const compositeId = `${targetType}:${String(r.id)}`;
      userIdByRowKey.set(compositeId, r.userId ?? null);
    }
  };
  addRows(heritageRows, "HERITAGE");
  addRows(itemRows, "ITEM");
  addRows(primitiveRows, "PRIMITIVE");
  addRows(effectRows, "EFFECT");
  addRows(capabilityRows, "CAPABILITY");

  const allUserIds = Array.from(userIdByRowKey.values());
  const authorMap = await resolveAuthorMap(allUserIds).catch(
    () =>
      new Map<
        string,
        {
          username: string;
          displayName: string | null;
          avatarUrl: string | null;
          // Phase 9 follow-up: hoist isAdmin onto the catch-path map so
          // the type matches resolveAuthorMap's actual return shape.
          isAdmin: boolean;
        }
      >(),
  );

  // Map LibraryTargetType values used here to the composite-id prefix used
  // by the LibraryItem.id field. (Items use ITEM, heritage uses HERITAGE.)
  const targetPrefix: Record<string, string> = {
    PRIMITIVE: "PRIMITIVE",
    EFFECT: "EFFECT",
    CAPABILITY: "CAPABILITY",
    HERITAGE: "HERITAGE",
    ITEM: "ITEM",
  };

  for (const item of baseItems) {
    const prefix = targetPrefix[item.targetType] ?? item.targetType;
    const rowUserId = userIdByRowKey.get(`${prefix}:${item.targetId}`);
    if (!rowUserId) continue;
    const author = authorMap.get(rowUserId);
    if (!author) continue;
    item.authorId = rowUserId;
    item.authorUsername = author.username;
    item.authorDisplayName = author.displayName;
    item.authorAvatarUrl = author.avatarUrl;
    // Phase 9 follow-up: hoist isAdmin onto the LibraryItem so the
    // OwnerBar can mask admin authors to "by System".
    item.authorIsAdmin = author.isAdmin;
  }

  const engagementMapPromise = (async () => {
    try {
      return await resolveEngagementMap(baseItems.map((it) => it.id));
    } catch (err) {
      console.error("[atelier sandbox] resolveEngagementMap failed:", err);
      return new Map();
    }
  })();

  const categoriesPromise = (async () => {
    try {
      return await listPrimitiveCategories();
    } catch (err) {
      console.error("[atelier sandbox] listPrimitiveCategories failed:", err);
      return [];
    }
  })();

  const versionsPromise = (async () => {
    try {
      return await bulkResolveLatestVersionNumbers([
        ...primitiveRows.map((p) => ({ kind: "primitive" as const, id: (p as { id: number }).id })),
        ...effectRows.map((e) => ({ kind: "effect" as const, id: (e as { id: string }).id })),
        ...capabilityRows.map((c) => ({ kind: "capability" as const, id: (c as { id: string }).id })),
        ...heritageRows.map((t) => ({ kind: "heritage" as const, id: (t as { id: string }).id })),
        ...itemRows.map((i) => ({ kind: "item" as const, id: (i as { id: string }).id })),
      ]);
    } catch (err) {
      console.error("[atelier sandbox] version resolution failed:", err);
      return new Map();
    }
  })();

  const loadEngagementPromise = (async () => {
    try {
      return await loadLibraryEngagement(
        sandboxViewerId,
        baseItems.map((it) => ({ id: it.id, targetType: it.targetType, targetId: it.targetId, authorId: it.authorId })),
      );
    } catch (err) {
      console.error("[atelier sandbox] engagement prefetch failed:", err);
      return { reactions: {}, following: {} };
    }
  })();

  const [engagementMap, primitiveCategories, versionMap, engagement] = await Promise.all([
    engagementMapPromise,
    categoriesPromise,
    versionsPromise,
    loadEngagementPromise,
  ]);

  const libraryItems: LibraryItem[] = enrichItemsWithEngagement(baseItems, engagementMap);
  const currentUserInternalId = sandboxViewerId;

  // Resolve the current user's profile so fork previews (which aren't in
  // libraryItems and carry no author info) can still show the creator
  // (the forker = current user) with username + avatar + profile link.
  let currentUser: { username: string; displayName: string | null; avatarUrl: string | null } | null = null;
  if (sandboxViewerId) {
    const author = await resolveAuthorByClerkId(sandboxViewerId);
    if (author) {
      currentUser = {
        username: author.username,
        displayName: author.displayName,
        avatarUrl: author.avatarUrl,
      };
    }
  }

  return (
    <AtelierSandboxClient
      initialBuild={build}
      initialKind={kind}
      initialEditing={initialEditing as never}
      initialIntent={intent}
      initialSourceId={editId ?? null}
      initialMechanicsKind={initialMechanicsKind}
      dataLoadFailed={dataLoadFailed}
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
          sourceOrigin: string | null;
          tags: string[] | null;
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
          sourceOrigin: row.sourceOrigin ?? null,
          tags: row.tags ?? [],
          iconSource: row.iconSource,
          iconKey: row.iconKey,
          iconUrl: row.iconUrl,
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
            primitive: { id: number; name: string; category: string; buCost: number };
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
            primitive: { id: number; name: string; category: string; buCost: number };
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
          iconSource: row.iconSource,
          iconKey: row.iconKey,
          iconUrl: row.iconUrl,
          iconColor: row.iconColor ?? "#ffffff",
          primitiveLinks: (row.primitiveLinks ?? []).map((l) => ({
            primitiveId: l.primitiveId,
            role: l.role,
            quantity: l.quantity,
            sortOrder: l.sortOrder,
            slotLabel: l.slotLabel,
            primitive: l.primitive,
            versionNumber: versionMap.get(`primitive:${l.primitiveId}`) ?? 1,
          })),
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
      heritage={heritageRows as never}
      items={itemRows as never}
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
          sourceOrigin: string | null;
          tags: string[] | null;
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
          sourceOrigin: row.sourceOrigin ?? null,
          tags: row.tags ?? [],
          iconSource: row.iconSource,
          iconKey: row.iconKey,
          iconUrl: row.iconUrl,
          iconColor: row.iconColor ?? "#ffffff",
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
            primitive: { id: number; name: string; category: string; buCost: number };
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
          verboseDescription: row.verboseDescription,
          sourceOrigin: row.sourceOrigin,
          tags: row.tags ?? [],
          isPublic: row.isPublic,
          primitiveLinks: (row.primitiveLinks ?? []).map((l) => ({
            primitiveId: l.primitiveId,
            role: l.role,
            quantity: l.quantity,
            sortOrder: l.sortOrder,
            slotLabel: l.slotLabel,
            primitive: l.primitive,
            versionNumber: versionMap.get(`primitive:${l.primitiveId}`) ?? 1,
          })),
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
          iconSource: row.iconSource,
          iconKey: row.iconKey,
          iconUrl: row.iconUrl,
          iconColor: row.iconColor ?? "#ffffff",
        };
      })}
      libraryItems={libraryItems}
      primitiveCategories={primitiveCategories}
      engagement={engagement}
      currentUserInternalId={currentUserInternalId}
      currentUser={currentUser}
      versionMap={Object.fromEntries(versionMap)}
    />
  );
}
