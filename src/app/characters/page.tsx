import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { Plus, Swords, UserRound } from "lucide-react";
import { CharacterEditButton } from "@/components/characters/character-edit-button";
import { NewCharacterButton } from "@/components/characters/new-character-button";
import { db } from "@/db/client";
import { characters } from "@/db/schema";
import { aggregateCharacterSheet } from "@/lib/engine";

export const dynamic = "force-dynamic";

export default async function CharactersPage() {
  const { userId } = await auth();

  // List user's characters (or all if not logged in — should not happen since
  // route is auth-gated, but be defensive).
  const rows = userId
    ? await db.query.characters.findMany({
        where: eq(characters.userId, userId),
        orderBy: [asc(characters.level), asc(characters.name)],
        with: {
          primitiveLinks: { with: { primitive: true } },
          capabilityLinks: { with: { capability: true } },
          itemLinks: { with: { item: true } },
        },
      })
    : [];

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Roster
          </p>
          <h1 className="mt-3 text-4xl font-semibold">My Characters</h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            All your characters, sorted by level. Edit anytime; clones inherit
            the current snapshot.
          </p>
        </div>
        <NewCharacterButton variant="primary" />
      </div>

      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => (
            <CharacterCard key={c.id} character={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-12 flex flex-col items-center justify-center rounded-md border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full border border-border bg-background">
        <UserRound className="size-7 text-muted-foreground" />
      </div>
      <h2 className="mt-6 text-2xl font-semibold">No characters yet</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Forge your first character using the 5-step wizard. You can fork builds
        from the library or start from scratch.
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
        // Phase 8.2 batch 10: mirror vector for engine roll-up.
        mirrorVector: string | null;
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
      // Phase 8.2 batch 10: normalise mirrorVector so the
      // engine roll-up gets a known value. If the row somehow
      // has null/undefined, default to STANDARD_ONLY (no
      // mirror effect on stat roll-up — see mirror.ts).
      primitive: {
        id: l.primitive.id,
        name: l.primitive.name,
        category: l.primitive.category,
        buCost: l.primitive.buCost,
        isMirrorable: l.primitive.isMirrorable,
        mirrorBuCredit: l.primitive.mirrorBuCredit,
        mirrorVector: l.primitive.mirrorVector ?? "STANDARD_ONLY",
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
      },
    })),
  });

  const attrSum =
    character.attrPhysical + character.attrMental + character.attrMagical;
  const overBudget = sheet.buBalance.overBudget;
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
            className={`font-mono font-bold ${
              overBudget ? "text-destructive" : ""
            }`}
          >
            {sheet.buBalance.progressionSpent}/{sheet.buBalance.progressionPool}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full rounded-full transition-all ${
              overBudget
                ? "bg-destructive"
                : sheet.buBalance.progressionPercent > 90
                  ? "bg-amber-500"
                  : "bg-primary"
            }`}
            style={{
              width: `${Math.min(100, sheet.buBalance.progressionPercent)}%`,
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
        <CharacterEditButton characterId={character.id} />
        <Link
          href={`/characters/${character.id}/clone`}
          className="flex items-center justify-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-card"
          title="Clone (deep copy)"
        >
          <Swords className="size-3.5" />
          Clone
        </Link>
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