// =============================================================================
// /characters — PLAN Eilxina Part B (Mashu 2026-09-09).
//
// 3-tab character roster:
// - My Characters       — original list (unchanged cards)
// - Shared with me      — characters where character_shares.shared_with = me
// - Public library      — codex: queryLibrary({targetType:'CHARACTER'})
//
// All three data sets are loaded server-side in parallel via
// Promise.all. The page streams the chrome (header + tab strip)
// immediately and the tab content follows. Tabs are client-side
// only (URL ?tab=...) — switching tabs is a pure-React re-render,
// no refetch.
//
// Counts on the tab strip come from each list's `.length`, so
// users can see at a glance which tabs have content.
// =============================================================================

import Link from "next/link";
import { Suspense } from "react";
import { asc, inArray } from "drizzle-orm";
import { auth, currentUser } from "@clerk/nextjs/server";
import { Plus, UserRound, UsersRound } from "lucide-react";
import {
  CharacterListTabs,
  type CharacterTab,
} from "@/components/characters/character-list-tabs";
import { NewCharacterButton } from "@/components/characters/new-character-button";
import { db } from "@/db/client";
import { effectivePrimitiveLinks } from "@/lib/character/workspace/effective-primitives";
import { characters } from "@/db/schema";
import { queryLibrary } from "@/lib/publishing/library-query";
import { listSharedCharacters } from "@/lib/character/list-shared-characters";
import { resolveLocalAuthorIdentity } from "@/lib/auth/author-resolver";
import { RosterCharacterCard as CharacterCard, type RosterCharacter } from "@/components/characters/roster-character-card";
import { PublicCharacterCard } from "@/components/characters/public-character-card";
import { SharedCharacterCard } from "@/components/characters/shared-character-card";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function CharactersPage({ searchParams }: PageProps) {
  const { userId: clerkId } = await auth();
  const clerkAccount = clerkId ? await currentUser() : null;
  const ownerIdentity = clerkId
    ? await resolveLocalAuthorIdentity(clerkId, clerkAccount?.username)
    : null;
  // The current session owns new rows; the local profile may own older rows.
  const ownerIds = [...new Set([clerkId, ownerIdentity?.clerkUserId, ownerIdentity?.internalUserId].filter((id): id is string => Boolean(id)))];
  const params = await searchParams;

  const initialTab: CharacterTab = (() => {
    const t = params.tab;
    if (t === "shared" || t === "public" || t === "mine") return t;
    return "mine";
  })();

  // Resolve internal user.id once for the shared-with-me query.
  const myInternalId = ownerIdentity?.internalUserId ?? null;

  // Load all three lists in parallel. Each is independent. The
  // shared query short-circuits when myInternalId is null (no
  // user => no shares). The public query is always safe.
  //
  // PLAN Eilxina Part F (Mashu 2026-09-10): the previous version
  // silently threw away the real error message in production
  // (Next.js shows "omitted in production builds" by default at
  // the framework boundary). We log to the server stdout so the
  // real cause appears in Vercel logs even when the user-facing
  // error.tsx can't render it.
  const [ownRows, sharedRows, publicResult] = (await (async () => {
    try {
      const ownedPromise: Promise<any[]> = ownerIds.length
        ? (db.query.characters.findMany({
            where: inArray(characters.userId, ownerIds),
            orderBy: [asc(characters.level), asc(characters.name)],
            with: {
              primitiveLinks: { with: { primitive: true } },
              capabilityLinks: { with: { capability: true } },
              itemLinks: { with: { item: true } },
            },
          }) as unknown as Promise<any[]>)
        : Promise.resolve([]);
      return await Promise.all([
        ownedPromise,
        myInternalId
          ? listSharedCharacters(myInternalId)
          : Promise.resolve([] as Awaited<ReturnType<typeof listSharedCharacters>>),
        queryLibrary({ targetType: "CHARACTER", limit: 48 }),
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : "";
      console.error("[characters/page] list load failed:", msg);
      console.error("[characters/page] stack:", stack);
      throw err;
    }
  })()) as [
    Awaited<ReturnType<typeof db.query.characters.findMany>>,
    Awaited<ReturnType<typeof listSharedCharacters>>,
    Awaited<ReturnType<typeof queryLibrary>>,
  ];

  // Reuse the same snapshots and presentation for every roster tab. Only load
  // IDs already authorized by the public/shared queries above.
  const otherIds = [...new Set([...sharedRows.map(r => r.id), ...publicResult.items.map(r => r.targetId)])];
  const otherRows = otherIds.length ? await db.query.characters.findMany({
    where: inArray(characters.id, otherIds),
    with: {
      primitiveLinks: { with: { primitive: true } },
      capabilityLinks: { with: { capability: true } },
      itemLinks: { with: { item: true } },
    },
  }) : [];
  // Resolve saved mechanics in one batch across all three tabs. A library
  // update must not silently change a character's roster attributes or debt.
  const rosterRows = [...ownRows, ...otherRows] as unknown as RosterCharacter[];
  const effectiveLinks = await effectivePrimitiveLinks(rosterRows.flatMap(row => row.primitiveLinks));
  let offset = 0;
  for (const row of rosterRows) {
    const count = row.primitiveLinks.length;
    row.primitiveLinks = effectiveLinks.slice(offset, offset + count);
    offset += count;
  }
  const otherById = new Map(otherRows.map(c => [c.id, c as unknown as RosterCharacter]));

  return (
    <main className="v12-roster-page">
      <header className="v12-roster-hero v12-archive-command">
        <div className="v12-archive-emblem" aria-hidden="true">
          <UsersRound />
        </div>
        <div className="v12-archive-heading">
          <p className="v12-kicker">Character registry · persistent records</p>
          <div className="v12-archive-title-line">
            <h1>Roster Matrix</h1>
            <span>Personal archive</span>
          </div>
          <p className="v12-roster-deck">
            Open a living character sheet, inspect a shared identity, or draw a
            public build into your own chronicle.
          </p>
        </div>
        <div className="v12-archive-actions">
          <NewCharacterButton variant="primary" />
        </div>
      </header>
      <div className="v12-archive-telemetry" aria-label="Roster summary">
        <span><b>{ownRows.length}</b> owned sheets</span>
        <span><b>{sharedRows.length}</b> shared links</span>
        <span><b>{publicResult.items.length}</b> public records</span>
      </div>

      {/* Suspense wraps the tab strip + content because
          useSearchParams (inside the tabs component) forces the
          page into a dynamic render. Better to opt into
          Suspense than to let Next warn about useSearchParams
          without a boundary. */}
      <Suspense fallback={<TabFallback />}>
        <CharacterListTabs
          mineContent={
            ownRows.length === 0 ? (
              <OwnEmptyState />
            ) : (
              <div className="v12-roster-grid">
                {ownRows.map((c) => (
                  <CharacterCard
                    key={c.id}
                    character={
                      // The relational findMany returns characters
                      // with their primitiveLinks/capabilityLinks/
                      // itemLinks relations; CharacterCard's type
                      // wants a slightly different shape, but the
                      // runtime contract is identical.
                      c as unknown as React.ComponentProps<
                        typeof CharacterCard
                      >["character"]
                    }
                  />
                ))}
              </div>
            )
          }
          sharedCount={sharedRows.length}
          publicCount={publicResult.items.length}
          sharedContent={sharedRows.length ? <div className="v12-roster-grid">{sharedRows.map(row => {
            const character = otherById.get(row.id);
            return character ? <SharedCharacterCard key={row.id} row={row} character={character} /> : null;
          })}</div> : <div className="v12-roster-empty"><h2>No characters shared with you yet</h2><p>Characters shared with your account appear here.</p></div>}
          publicContent={publicResult.items.length ? <div className="v12-roster-grid">{publicResult.items.map(item => {
            const character = otherById.get(item.targetId);
            return character ? <PublicCharacterCard key={item.id} item={item} character={character} /> : null;
          })}</div> : <div className="v12-roster-empty"><h2>No public characters yet</h2><p>Publish a character from its sheet to share a build with everyone.</p></div>}
          initialTab={initialTab}
          mineEmptyState={<OwnEmptyState />}
        />
      </Suspense>
    </main>
  );
}

function TabFallback() {
  return (
    <div className="v12-roster-loading animate-pulse" />
  );
}

function OwnEmptyState() {
  return (
    <div className="v12-roster-empty">
      <div className="v12-roster-sigil">
        <UserRound className="size-7 text-muted-foreground" />
      </div>
      <h2>No characters yet</h2>
      <p>
        Forge your first character using the 5-step wizard. You can fork builds
        from the Public library tab once you have a roster.
      </p>
      <Link
        href="/sandbox/characters"
        className="v12-metal-button v12-metal-button--primary"
      >
        <Plus className="size-5" />
        Create your first character
      </Link>
    </div>
  );
}
