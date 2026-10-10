"use client";
import {
  ArrowRight,
  Check,
  Eye,
  Swords,
  Users,
  AlertTriangle,
} from "lucide-react";
import { Markdown } from "@/components/ui/markdown";
import { MonsterPortrait } from "@/components/monsters/monster-portrait";
import { EncounterBudgetReadout } from "./encounter-budget-readout";
import type {
  EncounterDefinition,
  CreatureSummary,
  appraiseEncounter,
} from "@/lib/encounters/model";

export function EncounterReview({
  draft,
  creatures,
  appraisal,
  dirty,
  onEdit,
  onPreview,
}: {
  draft: EncounterDefinition;
  creatures: CreatureSummary[];
  appraisal: ReturnType<typeof appraiseEncounter>;
  dirty: boolean;
  onEdit: (stage: number) => void;
  onPreview: (id: string, version: number) => void;
}) {
  const ready = draft.name.trim() && draft.entries.length && !appraisal.missing;
  const scale = Math.max(appraisal.enemyTotal, appraisal.partyTotal ?? 0, 1);
  return (
    <div className="sw-encounter-review">
      <header className="sw-encounter-review-hero">
        <div>
          <p className="v12-kicker">Your encounter · Table briefing</p>
          <h2>{draft.name || "Untitled encounter"}</h2>
          <p>
            {appraisal.count} creatures ·{" "}
            {draft.partySize === null
              ? "Party size unspecified"
              : `${draft.partySize} party members`}{" "}
            ·{" "}
            {draft.budgetSource === "characters"
              ? "Calculated party budget"
              : draft.budgetSource === "override"
                ? "Party budget override"
                : "Manual party budget"}
          </p>
        </div>
        <span className={`sw-encounter-readiness${ready ? " is-ready" : ""}`}>
          {ready ? <Check size={16} /> : <AlertTriangle size={16} />}{" "}
          {ready
            ? dirty
              ? "Ready to save"
              : "Ready to run"
            : "Preparation incomplete"}
        </span>
        {draft.note && (
          <div className="sw-encounter-review-note">
            <Markdown>{draft.note}</Markdown>
          </div>
        )}
        <button
          className="sw-encounter-text-action"
          type="button"
          onClick={() => onEdit(0)}
        >
          Edit scene
        </button>
      </header>
      <div className="sw-encounter-review-columns">
        <section className="sw-encounter-review-roster">
          <header>
            <div>
              <p className="v12-kicker">The opposition</p>
              <h3>Cast of creatures</h3>
            </div>
            <button
              type="button"
              className="sw-encounter-text-action"
              onClick={() => onEdit(2)}
            >
              Edit roster <ArrowRight size={14} />
            </button>
          </header>
          {!draft.entries.length && (
            <p>Choose creatures before starting a run.</p>
          )}
          {draft.entries.map((entry) => {
            const c = creatures.find(
              (c) =>
                c.templateId === entry.templateId &&
                c.version === entry.version,
            );
            return (
              <article
                className="sw-encounter-review-creature"
                key={`${entry.templateId}:${entry.version}`}
              >
                <span className="v12-entry-glyph"><MonsterPortrait imageUrl={c?.imageUrl} name={c?.name} size={40}/></span>
                <div>
                  <strong>
                    <span className="sw-encounter-review-quantity">
                      {entry.quantity}×
                    </span>{" "}
                    {c?.unavailable
                      ? "Unavailable creature"
                      : (c?.name ?? "Unresolved creature")}
                  </strong>
                  <small>
                    {c?.role ?? "Creature"}
                    {c?.environment ? ` · ${c.environment}` : ""} · v
                    {entry.version}
                  </small>
                  <small>
                    {c && !c.unavailable
                      ? `${c.budget * entry.quantity} BU + ${c.itemBu * entry.quantity} Item BU`
                      : "Refresh or remove this reference."}
                  </small>
                </div>
                <button
                  type="button"
                  className="sw-metal-button sw-encounter-icon-action"
                  aria-label={`Inspect ${c?.name ?? "creature"}`}
                  disabled={!c || c.unavailable}
                  onClick={() => onPreview(entry.templateId, entry.version)}
                >
                  <Eye size={16} />
                </button>
              </article>
            );
          })}
          <div className="sw-encounter-review-tactics">
            <p className="v12-kicker">At the table</p>
            {appraisal.largestShare >= 0.5 && !appraisal.missing && (
              <p>
                <strong>Budget concentration:</strong> one creature accounts for{" "}
                {Math.round(appraisal.largestShare * 100)}% of the creature BU.
              </p>
            )}
            {creatures
              .filter(
                (c) =>
                  !c.unavailable &&
                  c.tactics &&
                  draft.entries.some(
                    (e) =>
                      e.templateId === c.templateId && e.version === c.version,
                  ),
              )
              .map((c) => (
                <details key={`${c.templateId}:${c.version}`}>
                  <summary>{c.name} · tactics</summary>
                  <Markdown>{c.tactics!}</Markdown>
                </details>
              ))}
            <p>
              Comparable BU totals do not guarantee comparable difficulty.
              Positioning, control, area effects and coordinated abilities
              matter.
            </p>
          </div>
        </section>
        <aside className="sw-encounter-review-brief">
          <p className="v12-kicker">Budgets, separately</p>
          <div
            className="sw-encounter-review-bars"
            aria-label="Combined budget comparison"
          >
            {(
              [
                ["Party", appraisal.partyTotal, Users],
                [
                  "Opposition",
                  appraisal.missing ? null : appraisal.enemyTotal,
                  Swords,
                ],
              ] as const
            ).map(([name, total, Icon]) => (
              <div key={name}>
                <header>
                  <span>
                    <Icon size={14} />
                    {name}
                  </span>
                  <strong>{total === null ? "Unknown" : `${total} BU`}</strong>
                </header>
                <div className="sw-encounter-budget-track">
                  <span
                    style={{
                      width: total === null ? "0" : `${(total / scale) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <EncounterBudgetReadout
            draft={draft}
            appraisal={appraisal}
            onEditParty={() => onEdit(1)}
          />
          <section className="sw-encounter-review-rhythm">
            <p className="v12-kicker">When play begins</p>
            <ol>
              {["Council", "Fast", "Measured", "Heavy"].map((phase) => (
                <li key={phase}>{phase}</li>
              ))}
            </ol>
            <p>
              Start creates {appraisal.count} independent, private play{" "}
              {appraisal.count === 1 ? "copy" : "copies"}. Phase changes never
              apply damage or alter sheets automatically.
            </p>
            <p>
              {dirty
                ? "Save preparation before starting."
                : "Starting a new run preserves previous runs."}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
