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
import { ArrowRight, Plus, UserRound, UsersRound } from "lucide-react";
import {
  CharacterListTabs,
  type CharacterTab,
} from "@/components/characters/character-list-tabs";
import { NewCharacterButton } from "@/components/characters/new-character-button";
import { db } from "@/db/client";
import { characters } from "@/db/schema";
import { aggregateCharacterSheet } from "@/lib/engine";
import { queryLibrary } from "@/lib/publishing/library-query";
import { listSharedCharacters } from "@/lib/character/list-shared-characters";
import { resolveLocalAuthorIdentity } from "@/lib/auth/author-resolver";
import { portraitFrameStyle } from "@/lib/character/portrait-frame";

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
          sharedRows={sharedRows}
          publicItems={publicResult.items}
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

async function CharacterCard({
  character,
}: {
  character: typeof characters.$inferSelect & {
    primitiveLinks: Array<{
      isMirrored: boolean | null;
      primitive: {
        id: number;
        name: string;
        category: string;
        buCost: number;
        isMirrorable: boolean;
        mirrorBuCredit: number;
        // Phase 8.3d (Mashu 2026-07-27): included for parity with
        // /characters/[id]/page.tsx. The list page doesn't render
        // conditions directly, but the sheet aggregator's
        // PrimitiveLinkSnapshot requires the field.
        hardModifiers?: readonly unknown[];
      };
    }>;
    capabilityLinks: Array<{ capabilityId: string }>;
    itemLinks: Array<{ itemId: string; equipped: boolean }>;
  };
}) {
  const sheet = aggregateCharacterSheet({
    level: character.level,
    attrPhysical: character.attrPhysical,
    attrMental: character.attrMental,
    attrMagical: character.attrMagical,
    attrProficient: character.attrProficient,
    practiceSlices:
      (character.practiceSlices as Record<string, number> | null) ?? null,
    startingBu: character.startingBu,
    buSpent: character.buSpent,
    dmBonusBu: character.dmBonusBu,
    currentVitality: character.currentVitality,
    size: character.size,
    primitiveLinks: character.primitiveLinks.map((l) => ({
      primitiveId: l.primitive.id,
      source: "PERSONAL" as const,
      acquiredAtLevel: 1,
      isMirrored: l.isMirrored ?? false,
      primitive: {
        ...l.primitive,
        // Phase 8.3d: spread may not include hardModifiers if the
        // type loses it. Default to [] so PrimitiveLinkSnapshot's
        // hardModifiers: readonly unknown[] requirement is met.
        hardModifiers: l.primitive.hardModifiers ?? [],
      },
    })),
    capabilityLinks: [],
    itemLinks: character.itemLinks.map((l) => ({
      itemId: l.itemId,
      equipped: l.equipped,
      item: {
        id: l.itemId,
        name: "",
        itemType: "TRINKET",
        rarity: "COMMON",
        slotCost: 1,
        isTwoHanded: false,
        isConsumable: false,
        // Phase 8.4 v24.5: required by ItemLinkSnapshot.
        buCost: 0,
      },
    })),
  });

  const attrSum =
    character.attrPhysical + character.attrMental + character.attrMagical;

  // Phase 8.5 H-fix3 (Mashu 2026-08-03): the list page previously
  // showed `budgetVisible / pool (+budgetOverBy)` whenever the
  // raw `overBudget` flag was true, regardless of whether debt
  // already absorbed the overflow. Per the modal's canonical
  // formula in `tabbed-character-form.tsx`:
  //   budgetOverflowRemainder = max(0, budgetVisible - budget)
  //                              ↑ overflow STILL VISIBLE after
  //                                debt absorption — this is
  //                                what the `(+N)` indicator
  //                                should track, NOT the raw
  //                                `progressionSpent - pool`.
  // For Tessy (spent=240, pool=235, debt=20):
  //   budgetOverBy = 5, debtUsed = min(5, 20) = 5,
  //   budgetVisible = 235, budgetOverflowRemainder = 0
  //   → "235/235 debt 5/20"  (no `(+5)` — debt absorbed it).
  // For spent=260, pool=235, debt=20:
  //   budgetOverBy = 25, debtUsed = 20, budgetVisible = 240,
  //   budgetOverflowRemainder = 5 → "235/235 (+5) debt 20/20".
  const budgetOverBy = sheet.buBalance.progressionSpent - sheet.buBalance.progressionPool;
  const debtUsed = Math.min(Math.max(0, budgetOverBy), sheet.volatility.rating);
  const budgetVisible = Math.max(0, sheet.buBalance.progressionSpent - debtUsed);
  const budgetOverflowRemainder = Math.max(0, budgetVisible - sheet.buBalance.progressionPool);
  // Destructive styling only when there's STILL visible overflow past
  // the pool after debt absorption (matches the modal's `overBudget`
  // semantic).
  const trulyOverBudget = budgetOverflowRemainder > 0;
  const portrait = character.portraitUrl;

  return (
    <article className="v12-roster-card group">
      <div className="v12-roster-card-head">
        <div className="v12-roster-avatar-frame">
          <div className="v12-roster-avatar-crop">
          {portrait ? (
            <img
              src={portrait}
              alt={character.name}
              className="v12-roster-avatar"
              style={portraitFrameStyle(character.portraitFrame)}
            />
          ) : (
            <div className="v12-roster-avatar v12-roster-avatar--fallback">
              {character.name.charAt(0).toUpperCase()}
            </div>
          )}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="v12-roster-record-code">Sheet record · level {character.level}</p>
          <h3 className="truncate text-lg font-semibold">{character.name}</h3>
          <div className="v12-roster-lineage">
            <span className="v12-roster-level">
              L{character.level}
            </span>
            <span>{character.size}</span>
            {character.lineageName && <span>· {character.lineageName}</span>}
            {character.manifestName && (
              <span>· {character.manifestName}</span>
            )}
          </div>
        </div>
      </div>

      {/* BU bar */}
      <div className="v12-roster-budget">
        <div className="v12-roster-budget-line">
          <span>
            BU
          </span>
          <span
            className={`font-mono font-bold ${trulyOverBudget ? "text-destructive" : ""}`}
          >
            {budgetVisible}/{sheet.buBalance.progressionPool}
            {budgetOverflowRemainder > 0 && ` (+${budgetOverflowRemainder})`}
          </span>
          {sheet.volatility.rating > 0 && (
            <span className="font-mono text-muted-foreground">
              {" "}· debt {debtUsed}/{sheet.volatility.ceiling}
            </span>
          )}
        </div>
        <div className="v12-roster-budget-track">
          <div
          className={`v12-roster-budget-fill ${
            trulyOverBudget
              ? "bg-destructive"
              : budgetVisible >= sheet.buBalance.progressionPool
                ? "bg-amber-500"
                : "bg-primary"
          }`}
          style={{
            width: `${Math.min(100, sheet.buBalance.progressionPool > 0 ? (budgetVisible / sheet.buBalance.progressionPool) * 100 : 0)}%`,
            }}
          />
        </div>
      </div>

      {/* Stats grid */}
      <div className="v12-roster-stats">
        <Stat label="P" value={character.attrPhysical} />
        <Stat label="M" value={character.attrMental} />
        <Stat label="Mg" value={character.attrMagical} />
      </div>
      <div className="v12-roster-footnote">
        <span>Sum: {attrSum}/10</span>
        <span>{sheet.capabilityCount} caps</span>
      </div>

      {/* Actions */}
      <div className="v12-roster-card-actions">
        <Link
          href={`/characters/${character.id}`}
          className="v12-roster-open"
        >
          Open sheet <ArrowRight aria-hidden="true" />
        </Link>
        {/* Original page had CharacterEditButton + Clone button here.
            Edit/clone affordances live on the sheet itself in the
            PDF-aligned layout — list-page keeps just Open Sheet. */}
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="v12-roster-stat">
      <div>
        {label}
      </div>
      <div className="mt-0.5 font-mono text-sm font-bold">
        {value >= 0 ? `+${value}` : value}
      </div>
    </div>
  );
}
