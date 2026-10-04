import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { characters } from "@/db/schema";
import { aggregateCharacterSheet } from "@/lib/engine";
import type { PrimitiveLinkSnapshot, ItemLinkSnapshot, CapabilityLinkSnapshot } from "@/lib/engine/sheet";
import { rosterComposition } from "@/lib/character/roster-composition";
import { portraitFrameStyle } from "@/lib/character/portrait-frame";

export function RosterCharacterCard({
  character,
  attribution,
  actions,
}: {
  attribution?: React.ReactNode;
  actions?: React.ReactNode;
  character: RosterCharacter;
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
      ...(l.instanceId ? { instanceId: l.instanceId } : {}),
      source: l.source ?? "PERSONAL",
      directSource: l.directSource ?? null,
      originItemId: l.originItemId ?? null,
      acquiredAtLevel: l.acquiredAtLevel ?? 1,
      isMirrored: l.isMirrored ?? false,
      primitive: {
        ...l.primitive,
        // Phase 8.3d: spread may not include hardModifiers if the
        // type loses it. Default to [] so PrimitiveLinkSnapshot's
        // hardModifiers: readonly unknown[] requirement is met.
        hardModifiers: l.primitive.hardModifiers ?? [],
      },
    })),
    capabilityLinks: character.capabilityLinks.map(l => ({
      ...l, acquiredAtLevel: l.acquiredAtLevel ?? 1,
      capability: l.capability ?? {id:l.capabilityId,name:"",type:"ACTIVE",sourceType:"PHYSICAL"},
    })),
    itemLinks: character.itemLinks.map(l => ({
      ...l,
      item: l.item,
    })),
  });

  const composition = rosterComposition(character);
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
            <span>{sheet.resolvedSize}</span>
            {character.lineageName && <span>· {character.lineageName}</span>}
            {character.manifestName && (
              <span>· {character.manifestName}</span>
            )}
          </div>
        </div>
      </div>

      {attribution && <div className="v12-roster-attribution">{attribution}</div>}

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
        <Stat label="Physical" value={sheet.attributes.physical} />
        <Stat label="Mental" value={sheet.attributes.mental} />
        <Stat label="Magical" value={sheet.attributes.magical} />
      </div>
      <div className="v12-roster-footnote">
        <span>Sheet attributes · base allocation {attrSum}/10</span>
      </div>
      <dl className="v12-roster-composition" aria-label="Character composition">
        <div><dt>Primitives</dt><dd>{composition.primitives}</dd></div>
        <div><dt>Capabilities</dt><dd>{composition.capabilities}</dd></div>
        <div><dt>Drawbacks</dt><dd>{composition.drawbacks}</dd></div>
        <div><dt>Item BU <small>separate</small></dt><dd>{sheet.buBalance.itemBuSpent}</dd></div>
      </dl>
      <div className="v12-roster-status">
        <span>Vitality <b>{sheet.vitality.current}/{sheet.vitality.max}</b></span>
        <span><b>{sheet.equippedItemCount}</b> equipped · <b>{sheet.totalItemCount}</b> items</span>
      </div>

      {/* Actions */}
      <div className="v12-roster-card-actions">
        {actions ?? <Link
          href={`/characters/${character.id}`}
          className="v12-roster-open"
        >
          Open sheet <ArrowRight aria-hidden="true" />
        </Link>}
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

export type RosterCharacter = typeof characters.$inferSelect & {
  primitiveLinks: Array<Omit<PrimitiveLinkSnapshot, "isMirrored" | "source" | "acquiredAtLevel"> & {
    isMirrored: boolean | null;
    source?: string;
    acquiredAtLevel?: number;
    versionId?: string | null;
  }>;
  capabilityLinks: Array<Pick<CapabilityLinkSnapshot, "capabilityId"> & Partial<CapabilityLinkSnapshot>>;
  itemLinks: ItemLinkSnapshot[];
};
