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
import { asc, eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { Plus, UserRound } from "lucide-react";
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
import { resolveUserIdByClerkId } from "@/lib/auth/author-resolver";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function CharactersPage({ searchParams }: PageProps) {
  const { userId: clerkId } = await auth();
  const params = await searchParams;

  const initialTab: CharacterTab = (() => {
    const t = params.tab;
    if (t === "shared" || t === "public" || t === "mine") return t;
    return "mine";
  })();

  // Resolve internal user.id once for the shared-with-me query.
  const myInternalId = clerkId ? await resolveUserIdByClerkId(clerkId) : null;

  // Load all three lists in parallel. Each is independent. The
  // shared query short-circuits when myInternalId is null (no
  // user => no shares). The public query is always safe.
  const [ownRows, sharedRows, publicResult] = await Promise.all([
    clerkId
      ? db.query.characters.findMany({
          where: eq(characters.userId, clerkId),
          orderBy: [asc(characters.level), asc(characters.name)],
          with: {
            primitiveLinks: { with: { primitive: true } },
            capabilityLinks: { with: { capability: true } },
            itemLinks: { with: { item: true } },
          },
        })
      : Promise.resolve([]),
    myInternalId
      ? listSharedCharacters(myInternalId)
      : Promise.resolve([]),
    queryLibrary({ targetType: "CHARACTER", limit: 48 }),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Roster
          </p>
          <h1 className="mt-3 text-4xl font-semibold">Characters</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            Your own characters, characters shared with you, and the public
            library of builds you can fork as your own.
          </p>
        </div>
        <NewCharacterButton variant="primary" />
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
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {ownRows.map((c) => (
                  <CharacterCard key={c.id} character={c} />
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
    </div>
  );
}

function TabFallback() {
  return (
    <div className="mt-8 h-12 animate-pulse rounded-md border border-dashed border-border bg-card/40" />
  );
}

function OwnEmptyState() {
  return (
    <div className="mt-12 flex flex-col items-center justify-center rounded-md border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full border border-border bg-background">
        <UserRound className="size-7 text-muted-foreground" />
      </div>
      <h2 className="mt-6 text-2xl font-semibold">No characters yet</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Forge your first character using the 5-step wizard. You can fork builds
        from the Public library tab once you have a roster.
      </p>
      <Link
        href="/sandbox/characters"
        className="mt-6 flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-base font-medium text-primary-foreground hover:bg-primary/90"
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
    <div className="group relative flex flex-col rounded-md border border-border bg-card p-5 transition-colors hover:border-primary">
      <div className="flex items-start gap-3">
        {portrait ? (
          <img
            src={portrait}
            alt={character.name}
            className="size-14 rounded-md border border-border object-cover"
          />
        ) : (
          <div className="flex size-14 items-center justify-center rounded-md border border-border bg-background text-2xl font-bold text-muted-foreground">
            {character.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold">{character.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="rounded-full bg-secondary px-2 py-0.5 font-mono font-bold text-secondary-foreground">
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
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold uppercase text-muted-foreground">
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
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
          className={`h-full rounded-full transition-all ${
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
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        <Stat label="P" value={character.attrPhysical} />
        <Stat label="M" value={character.attrMental} />
        <Stat label="Mg" value={character.attrMagical} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>Sum: {attrSum}/10</span>
        <span>{sheet.capabilityCount} caps</span>
      </div>

      {/* Actions */}
      <div className="mt-5 flex gap-2">
        <Link
          href={`/characters/${character.id}`}
          className="flex-1 rounded-md bg-primary px-3 py-1.5 text-center text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          Open Sheet
        </Link>
        {/* Original page had CharacterEditButton + Clone button here.
            Edit/clone affordances live on the sheet itself in the
            PDF-aligned layout — list-page keeps just Open Sheet. */}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-background px-2 py-1.5">
      <div className="text-[10px] font-semibold uppercase text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-sm font-bold">
        {value >= 0 ? `+${value}` : value}
      </div>
    </div>
  );
}
