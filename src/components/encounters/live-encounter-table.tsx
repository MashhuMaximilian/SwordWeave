"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Plus,
  X,
  Minus,
  Check,
  Dice5,
  Users,
  Flag,
  NotebookPen,
} from "lucide-react";
import type { PlayOverrides } from "@/lib/play-state/model";
import { rollDice } from "@/lib/engine/runtime-resolver";
import { browserUuid } from "@/lib/browser-uuid";
import {
  guestMarkerSchema,
  objectiveSchema,
  clockSchema,
  journalSchema,
  runEntries,
  readMarker,
  emptyMarker,
  validDiceExpression,
} from "@/lib/encounters/run-state";
import type { EncounterDefinition, phases } from "@/lib/encounters/model";
import { MarkerControls, RunText } from "./live-encounter-controls";
import { Markdown } from "@/components/ui/markdown";

export type PartyLink = { id: string; name: string };
export function LiveEncounterTable({
  state,
  party,
  links,
  round,
  phase,
  disabled,
  change,
}: {
  state: PlayOverrides;
  party: Omit<EncounterDefinition, "entries">;
  links: PartyLink[];
  round: number;
  phase: (typeof phases)[number];
  disabled: boolean;
  change: (field: string, value: unknown) => void;
}) {
  const [tab, setTab] = useState<"party" | "scene" | "dice" | "journal">(
    "scene",
  );
  const [guest, setGuest] = useState(""),
    [objective, setObjective] = useState(""),
    [clock, setClock] = useState(""),
    [steps, setSteps] = useState("4"),
    [entry, setEntry] = useState(""),
    [dice, setDice] = useState("1d20"),
    [result, setResult] = useState("");
  const guests = runEntries(state, "guest", guestMarkerSchema),
    objectives = runEntries(state, "objective", objectiveSchema),
    clocks = runEntries(state, "clock", clockSchema),
    journal = runEntries(state, "log", journalSchema).sort(
      (a, b) => b.value.at - a.value.at,
    );
  function addLog(text: string) {
    if (!text.trim() || journal.length >= 200 || disabled) return;
    change(`log:${browserUuid()}`, {
      text: text.trim(),
      round,
      phase,
      at: Date.now(),
    });
  }
  function roll(expression = dice) {
    if (!validDiceExpression(expression)) {
      setResult("Use 1–20 dice: 1d20, 2d6+3, 1d100…");
      return;
    }
    const rolled = rollDice(expression);
    const text = `${expression}: ${rolled.rolls.join(" + ")} → ${rolled.total}`;
    setResult(text);
    addLog(text);
  }
  return (
    <section className="sw-live-table" aria-label="Game Master table tools">
      <nav className="sw-live-tool-tabs" aria-label="Table tools">
        {(
          [
            {
              key: "party",
              name: "Party",
              icon: Users,
              count: links.length + guests.length,
            },
            {
              key: "scene",
              name: "Scene",
              icon: Flag,
              count: objectives.filter((o) => !o.value.done).length,
            },
            { key: "dice", name: "Dice", icon: Dice5, count: 0 },
            {
              key: "journal",
              name: "Journal",
              icon: NotebookPen,
              count: journal.length,
            },
          ] as const
        ).map((t) => (
          <button
            className="sw-metal-button"
            type="button"
            key={t.key}
            aria-pressed={tab === t.key}
            onClick={() => setTab(t.key)}
          >
            <t.icon size={14} />
            {t.name}
            {t.count > 0 && <small>{t.count}</small>}
          </button>
        ))}
      </nav>
      {tab === "party" && (
        <div className="sw-live-table-body">
          <header>
            <p className="v12-kicker">At your table</p>
            <h2>Party declarations</h2>
            <p className="sw-live-help">
              Track intent here. Vitality and consequences stay on each player’s
              sheet.
            </p>
          </header>
          <div className="sw-live-party-budgets">
            <span>
              Party <b>{party.partyBu ?? "—"} BU</b>
            </span>
            <span>
              Equipment <b>{party.partyItemBu ?? "—"} Item BU</b>
            </span>
            <span>
              Party size <b>{party.partySize ?? "—"}</b>
            </span>
          </div>
          {links.map((p) => (
            <article className="sw-live-party-actor" key={p.id}>
              <header>
                <strong>{p.name}</strong>
                <Link
                  href={`/characters/${p.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${p.name} sheet`}
                >
                  Open sheet <ArrowUpRight size={13} />
                </Link>
              </header>
              <MarkerControls
                name={p.name}
                value={readMarker(state, `party:${p.id}`)}
                disabled={disabled}
                onChange={(value) => change(`party:${p.id}`, value)}
              />
            </article>
          ))}
          {guests.map((g) => (
            <article className="sw-live-party-actor" key={g.field}>
              <header>
                <strong>{g.value.name}</strong>
                <button
                  type="button"
                  className="sw-metal-button sw-live-icon"
                  aria-label={`Remove ${g.value.name} from encounter tracking`}
                  disabled={disabled}
                  onClick={() => change(g.field, null)}
                >
                  <X size={14} />
                </button>
              </header>
              <MarkerControls
                name={g.value.name}
                value={g.value}
                disabled={disabled}
                onChange={(value) =>
                  change(g.field, { ...value, name: g.value.name })
                }
              />
            </article>
          ))}
          {!links.length && !guests.length && (
            <p className="sw-live-empty">
              No party declarations yet. Add names to track manual party members
              or NPC allies.
            </p>
          )}
          <form
            className="sw-live-add-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (guest.trim() && guests.length < 50) {
                change(`guest:${browserUuid()}`, {
                  name: guest.trim(),
                  ...emptyMarker(),
                });
                setGuest("");
              }
            }}
          >
            <label>
              Manual participant
              <input
                aria-label="Manual participant name"
                placeholder="Player character or ally"
                value={guest}
                maxLength={100}
                disabled={disabled}
                onChange={(e) => setGuest(e.target.value)}
              />
            </label>
            <button
              type="submit"
              className="sw-metal-button sw-live-icon"
              aria-label="Add manual participant"
              disabled={disabled || !guest.trim() || guests.length >= 50}
            >
              <Plus size={16} />
            </button>
          </form>
        </div>
      )}
      {tab === "scene" && (
        <div className="sw-live-table-body">
          {party.note && (
            <details className="sw-live-prepared-note">
              <summary>Prepared encounter note</summary>
              <Markdown>{party.note}</Markdown>
            </details>
          )}
          <section className="sw-live-tool-section">
            <header>
              <Flag size={16} />
              <h2>Objectives</h2>
              <small>
                {objectives.filter((o) => o.value.done).length}/
                {objectives.length}
              </small>
            </header>
            {!objectives.length && (
              <p className="sw-live-empty">
                What needs to happen beyond defeating creatures?
              </p>
            )}
            {objectives.map((o) => (
              <div
                className={`sw-live-objective${o.value.done ? " is-done" : ""}`}
                key={o.field}
              >
                <label>
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={o.value.done}
                    onChange={(e) =>
                      change(o.field, { ...o.value, done: e.target.checked })
                    }
                  />
                  <span>{o.value.text}</span>
                </label>
                <button
                  className="sw-live-remove"
                  type="button"
                  aria-label={`Remove objective ${o.value.text}`}
                  disabled={disabled}
                  onClick={() => change(o.field, null)}
                >
                  <X size={13} />
                </button>
              </div>
            ))}
            <form
              className="sw-live-add-row"
              onSubmit={(e) => {
                e.preventDefault();
                if (objective.trim() && objectives.length < 50) {
                  change(`objective:${browserUuid()}`, {
                    text: objective.trim(),
                    done: false,
                  });
                  setObjective("");
                }
              }}
            >
              <input
                aria-label="New objective"
                placeholder="Keep the crossing open…"
                maxLength={1000}
                value={objective}
                disabled={disabled}
                onChange={(e) => setObjective(e.target.value)}
              />
              <button
                type="submit"
                className="sw-metal-button sw-live-icon"
                aria-label="Add objective"
                disabled={
                  disabled || !objective.trim() || objectives.length >= 50
                }
              >
                <Plus size={16} />
              </button>
            </form>
          </section>
          <section className="sw-live-tool-section">
            <header>
              <h2>Countdowns & progress</h2>
            </header>
            <p className="sw-live-help">
              Advance manually for reinforcements, rituals, hazards or escape.
              No effects are applied automatically.
            </p>
            {clocks.map((c) => (
              <article className="sw-live-clock" key={c.field}>
                <header>
                  <strong>{c.value.label}</strong>
                  <span>
                    {c.value.value}/{c.value.maximum}
                  </span>
                  <button
                    type="button"
                    className="sw-live-remove"
                    aria-label={`Remove countdown ${c.value.label}`}
                    disabled={disabled}
                    onClick={() => change(c.field, null)}
                  >
                    <X size={13} />
                  </button>
                </header>
                <div className="sw-live-clock-controls">
                  <button
                    type="button"
                    className="sw-metal-button sw-live-icon"
                    disabled={disabled || c.value.value === 0}
                    onClick={() =>
                      change(c.field, { ...c.value, value: c.value.value - 1 })
                    }
                    aria-label={`Decrease ${c.value.label}`}
                  >
                    <Minus size={14} />
                  </button>
                  <div
                    className="sw-live-clock-meter"
                    role="meter"
                    aria-label={c.value.label}
                    aria-valuemin={0}
                    aria-valuemax={c.value.maximum}
                    aria-valuenow={c.value.value}
                  >
                    <span
                      style={{
                        width: `${(100 * c.value.value) / c.value.maximum}%`,
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    className="sw-metal-button sw-live-icon"
                    disabled={disabled || c.value.value === c.value.maximum}
                    onClick={() =>
                      change(c.field, { ...c.value, value: c.value.value + 1 })
                    }
                    aria-label={`Advance ${c.value.label}`}
                  >
                    {c.value.value === c.value.maximum ? (
                      <Check size={14} />
                    ) : (
                      <Plus size={14} />
                    )}
                  </button>
                </div>
                {c.value.value === c.value.maximum && (
                  <small>Complete · decide the outcome at the table.</small>
                )}
              </article>
            ))}
            <form
              className="sw-live-add-row sw-live-clock-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (
                  clock.trim() &&
                  Number.isInteger(Number(steps)) &&
                  Number(steps) >= 1 &&
                  Number(steps) <= 1000 &&
                  clocks.length < 30
                ) {
                  change(`clock:${browserUuid()}`, {
                    label: clock.trim(),
                    value: 0,
                    maximum: Number(steps),
                  });
                  setClock("");
                }
              }}
            >
              <label>
                Countdown
                <input
                  aria-label="Countdown name"
                  placeholder="Reinforcements arrive"
                  maxLength={200}
                  value={clock}
                  disabled={disabled}
                  onChange={(e) => setClock(e.target.value)}
                />
              </label>
              <label>
                Steps
                <input
                  aria-label="Countdown steps"
                  type="number"
                  min={1}
                  max={1000}
                  value={steps}
                  disabled={disabled}
                  onChange={(e) => setSteps(e.target.value)}
                />
              </label>
              <button
                type="submit"
                className="sw-metal-button sw-live-icon"
                aria-label="Add countdown"
                disabled={
                  disabled ||
                  !clock.trim() ||
                  !Number.isInteger(Number(steps)) ||
                  Number(steps) < 1 ||
                  Number(steps) > 1000 ||
                  clocks.length >= 30
                }
              >
                <Plus size={16} />
              </button>
            </form>
          </section>
          <section className="sw-live-tool-section">
            <header>
              <NotebookPen size={16} />
              <h2>Live notes</h2>
            </header>
            <RunText
              multiline
              aria-label="Live encounter notes"
              value={typeof state["notes"] === "string" ? state["notes"] : ""}
              placeholder="Positions, environmental effects, rulings, recovery reminders…"
              maxLength={10000}
              disabled={disabled}
              onCommit={(value) => change("notes", value)}
            />
          </section>
        </div>
      )}
      {tab === "dice" && (
        <div className="sw-live-table-body">
          <p className="v12-kicker">At the table</p>
          <h2>Dice tray</h2>
          <p className="sw-live-help">
            Roll independently. Results go into the journal; they never apply
            damage or change tracks.
          </p>
          <div className="sw-live-dice-presets">
            {[4, 6, 8, 10, 12, 20, 100].map((sides) => (
              <button
                type="button"
                className="sw-metal-button"
                key={sides}
                disabled={disabled || journal.length >= 200}
                onClick={() => roll(`1d${sides}`)}
              >
                d{sides}
              </button>
            ))}
          </div>
          <form
            className="sw-live-add-row"
            onSubmit={(e) => {
              e.preventDefault();
              roll();
            }}
          >
            <label>
              Dice expression
              <input
                aria-label="Dice expression"
                value={dice}
                maxLength={30}
                disabled={disabled}
                onChange={(e) => setDice(e.target.value)}
              />
            </label>
            <button
              type="submit"
              className="sw-metal-button"
              disabled={
                disabled || !validDiceExpression(dice) || journal.length >= 200
              }
            >
              <Dice5 size={16} />
              Roll
            </button>
          </form>
          {result && (
            <output className="sw-live-dice-result" aria-live="polite">
              {result}
            </output>
          )}
          {journal.length >= 200 && (
            <p role="status">
              The journal is full. Remove an old entry to save more rolls.
            </p>
          )}
        </div>
      )}
      {tab === "journal" && (
        <div className="sw-live-table-body">
          <p className="v12-kicker">Encounter record</p>
          <h2>Table journal</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addLog(entry);
              setEntry("");
            }}
          >
            <label>
              Record an event
              <textarea
                aria-label="Journal event"
                rows={3}
                placeholder="What changed at the table?"
                maxLength={2000}
                disabled={disabled}
                value={entry}
                onChange={(e) => setEntry(e.target.value)}
              />
            </label>
            <button
              type="submit"
              className="sw-metal-button"
              disabled={disabled || !entry.trim() || journal.length >= 200}
            >
              Add to journal
            </button>
          </form>
          {!journal.length && (
            <p className="sw-live-empty">
              Rulings, scene events and dice rolls will appear here.
            </p>
          )}
          {journal.length >= 200 && (
            <p role="status">
              200 entries saved. Remove an old entry to make room.
            </p>
          )}
          <ol className="sw-live-journal">
            {journal.map((e) => (
              <li key={e.field}>
                <div>
                  <small>
                    Round {e.value.round} · {e.value.phase}
                  </small>
                  <p>{e.value.text}</p>
                </div>
                <button
                  type="button"
                  className="sw-live-remove"
                  disabled={disabled}
                  onClick={() => change(e.field, null)}
                  aria-label={`Remove journal entry ${e.value.text.slice(0, 50)}`}
                >
                  <X size={13} />
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
