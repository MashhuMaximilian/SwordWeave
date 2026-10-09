"use client";
import type {
  appraiseEncounter,
  EncounterDefinition,
} from "@/lib/encounters/model";
export function EncounterBudgetReadout({
  draft,
  appraisal,
  onEditParty,
}: {
  draft: EncounterDefinition;
  appraisal: ReturnType<typeof appraiseEncounter>;
  onEditParty: () => void;
}) {
  return (
    <section
      className="sw-encounter-readout"
      aria-label="Live encounter budget comparison"
    >
      <header>
        <strong>Budget comparison</strong>
        <button
          type="button"
          className="sw-encounter-text-action"
          onClick={onEditParty}
        >
          Edit party
        </button>
      </header>
      <table>
        <caption className="sr-only">
          Party and opposition budgets, with equipment counted separately
        </caption>
        <thead>
          <tr>
            <th scope="col">BU</th>
            <th scope="col">Party</th>
            <th scope="col">Opposition</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Creature</th>
            <td>{draft.partyBu ?? "—"}</td>
            <td>{appraisal.missing ? "…" : appraisal.enemyBu}</td>
          </tr>
          <tr>
            <th scope="row">Items</th>
            <td>{draft.partyItemBu ?? "—"}</td>
            <td>{appraisal.missing ? "…" : appraisal.enemyItemBu}</td>
          </tr>
          <tr className="sw-encounter-readout-total">
            <th scope="row">Combined</th>
            <td>{appraisal.partyTotal ?? "—"}</td>
            <td aria-live="polite">
              {appraisal.missing ? "…" : appraisal.enemyTotal}
            </td>
          </tr>
        </tbody>
      </table>
      {appraisal.difference !== null && (
        <p className="sw-encounter-help">
          Opposition{" "}
          {appraisal.difference === 0
            ? "matches the party total"
            : `${Math.abs(appraisal.difference)} BU ${appraisal.difference > 0 ? "above" : "below"} the party`}
          {appraisal.ratio === null ? "" : ` · ${appraisal.ratio.toFixed(2)}×`}.
        </p>
      )}
      <p className="sw-encounter-help">
        {appraisal.count} enemies
        {draft.partySize === null ? "" : ` · ${draft.partySize} party members`}.
        BU compares budgets, not difficulty.
      </p>
    </section>
  );
}
