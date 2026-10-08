"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { usePlaySession } from "@/lib/hooks/use-play-session";
import {
  getEffectivePlayState,
  queuePlayChanges,
  resolvePlayConflict,
  retryPlaySync,
} from "@/lib/play-state/client-sync";
import { phases, type EncounterDefinition } from "@/lib/encounters/model";
import { MonsterPlaySheet } from "@/components/monsters/monster-play-sheet";
import { EntityTypeIcon } from "@/components/icons/entity-type-icon";
import "./encounters.css";
type Member = {
  id: string;
  copyId: string | null;
  name: string;
  currentVitality?: number;
  maximum?: number;
  budget?: number;
  itemBu?: number;
  tactics?: string;
  unavailable?: boolean;
};
type RunData = {
  run: {
    id: string;
    name: string;
    encounterId: string | null;
    party: Omit<EncounterDefinition, "entries">;
  };
  members: Member[];
  partyLinks: { id: string; name: string }[];
};
type Marker = {
  intent: string;
  track: "Unassigned" | "Fast" | "Measured" | "Heavy";
  resolved: boolean;
};
export function EncounterRun({ id }: { id: string }) {
  const { userId, isLoaded } = useAuth();
  return (
    <AccountRun
      key={`${userId ?? "anonymous"}:${id}`}
      id={id}
      account={userId ?? null}
      loaded={isLoaded}
    />
  );
}
function AccountRun({
  id,
  account,
  loaded,
}: {
  id: string;
  account: string | null;
  loaded: boolean;
}) {
  const endpoint = `/api/encounters/runs/${id}`;
  const { session } = usePlaySession(
    "ENCOUNTER_RUN",
    id,
    `${endpoint}?session=1`,
    [],
    { method: "PATCH" },
  );
  const [data, setData] = useState<RunData | null>(null),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<string | null>(null);
  const refreshing = useRef(false);
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      if (!account || refreshing.current) return;
      refreshing.current = true;
      try {
        const r = await fetch(endpoint, {
          cache: "no-store",
          ...(signal ? { signal } : {}),
        });
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? "Run unavailable.");
        if (signal?.aborted) return;
        setData(body);
        setError("");
        try {
          localStorage.setItem(
            `sw:encounter-run:${account}:${id}`,
            JSON.stringify(body),
          );
        } catch {
          /* Session storage reports its own errors. */
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError")
          setError(
            navigator.onLine
              ? (e as Error).message
              : "Offline · showing cached encounter.",
          );
      } finally {
        refreshing.current = false;
      }
    },
    [account, endpoint, id],
  );
  useEffect(() => {
    if (!account) return;
    try {
      const raw = localStorage.getItem(`sw:encounter-run:${account}:${id}`);
      if (raw) {
        const cached = JSON.parse(raw);
        queueMicrotask(() => setData(cached));
      }
    } catch {
      /* Ignore invalid cache. */
    }
    const controller = new AbortController();
    const initial = setTimeout(() => void refresh(controller.signal), 0);
    const wake = () => {
      if (document.visibilityState === "visible")
        void refresh(controller.signal);
    };
    const timer = setInterval(wake, 20000);
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    return () => {
      controller.abort();
      clearTimeout(initial);
      clearInterval(timer);
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
    };
  }, [account, id, refresh]);
  const state = getEffectivePlayState("ENCOUNTER_RUN", id).overrides;
  const round = typeof state["round"] === "number" ? state["round"] : 1;
  const phase = phases.includes(state["phase"] as (typeof phases)[number])
    ? (state["phase"] as (typeof phases)[number])
    : "Council";
  const completed = state["completed"] === true;
  const active = data?.members.find((m) => m.id === selected);
  function change(field: string, value: unknown) {
    try {
      queuePlayChanges("ENCOUNTER_RUN", id, [{ field, value }]);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function marker(m: Member): Marker {
    return (
      (state[`actor:${m.id}`] as Marker) ?? {
        intent: "",
        track: "Unassigned",
        resolved: false,
      }
    );
  }
  function nextRound() {
    if (!data) return;
    const changes = [
      { field: "round", value: (round + 1) as unknown },
      { field: "phase", value: "Council" as unknown },
      ...data.members.map((m) => ({ field: `actor:${m.id}`, value: null })),
    ];
    try {
      queuePlayChanges("ENCOUNTER_RUN", id, changes);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!loaded) return <main className="sw-encounters">Loading account…</main>;
  if (!account)
    return (
      <main className="sw-encounters">
        <h1>Encounter run</h1>
        <Link href="/sign-in" className="sw-metal-button">
          Sign in
        </Link>
      </main>
    );
  if (!data)
    return (
      <main className="sw-encounters">
        <p role="status">{error || "Opening encounter…"}</p>
        <Link href="/encounters">Encounters</Link>
      </main>
    );
  return (
    <main className="sw-encounters sw-encounter-running">
      <header className="sw-encounter-heading">
        <div>
          <p className="v12-kicker">
            Game Master · {completed ? "Completed run" : "Live encounter"}
          </p>
          <h1>{data.run.name}</h1>
        </div>
        <Link
          className="sw-metal-button"
          href={
            data.run.encounterId
              ? `/encounters/${data.run.encounterId}`
              : "/encounters"
          }
        >
          Preparation
        </Link>
      </header>
      {error && (
        <p role="alert" className="sw-encounter-notice">
          {error}
        </p>
      )}
      <section className="sw-encounter-panel">
        <div className="sw-encounter-section-heading">
          <h2>Round {round}</h2>
          <span role="status">
            {session.status}{" "}
            {session.pending ? `· ${session.pending} pending` : ""}
          </span>
        </div>
        <div className="sw-encounter-phase-controls">
          {phases.map((p) => (
            <button
              key={p}
              className="sw-metal-button"
              aria-pressed={phase === p}
              disabled={!session.ready || completed}
              onClick={() => change("phase", p)}
            >
              {p}
            </button>
          ))}
          <button
            className="sw-metal-button"
            disabled={!session.ready || completed}
            onClick={nextRound}
          >
            Next Council · round {round + 1}
          </button>
        </div>
        <p className="sw-encounter-help">
          Declare intent, assign complexity, then resolve Fast → Measured →
          Heavy. Phase controls record progress; they do not apply damage or
          expire effects.
        </p>
        {session.status === "conflict" && (
          <div>
            <p>
              Encounter markers changed on another device. Your local changes
              are preserved.
            </p>
            <button
              className="sw-metal-button"
              onClick={() =>
                void resolvePlayConflict("ENCOUNTER_RUN", id, "local")
              }
            >
              Use local markers
            </button>
            <button
              className="sw-metal-button"
              onClick={() =>
                void resolvePlayConflict("ENCOUNTER_RUN", id, "server")
              }
            >
              Use saved markers
            </button>
          </div>
        )}
        {session.status === "error" && (
          <button
            className="sw-metal-button"
            onClick={() => retryPlaySync("ENCOUNTER_RUN", id)}
          >
            Retry synchronization
          </button>
        )}
      </section>
      {data.partyLinks.length > 0 && (
        <div className="sw-encounter-actions">
          {data.partyLinks.map((c) => (
            <Link
              className="sw-metal-button"
              key={c.id}
              href={`/characters/${c.id}`}
            >
              {c.name} ↗
            </Link>
          ))}
        </div>
      )}
      {data.run.party.note && (
        <details className="sw-encounter-panel">
          <summary>Encounter note</summary>
          <p>{data.run.party.note}</p>
        </details>
      )}
      <div className={`sw-encounter-run-grid${active ? " has-active" : ""}`}>
        <section className="sw-encounter-roster">
          <h2>Creatures</h2>
          {data.members.map((m) => {
            const marks = marker(m);
            return (
              <article
                key={m.id}
                className={`sw-encounter-run-row${selected === m.id ? " is-active" : ""}`}
              >
                <button
                  className="sw-encounter-creature-opener"
                  aria-expanded={selected === m.id}
                  disabled={m.unavailable || !m.copyId}
                  onClick={() => {
                    setSelected(selected === m.id ? null : m.id);
                    void refresh();
                  }}
                >
                  <EntityTypeIcon type="MONSTER" />
                  <span>
                    <strong>{m.name}</strong>
                    <small>
                      {m.unavailable
                        ? "Play copy removed"
                        : `${m.currentVitality} / ${m.maximum} Vitality · ${m.budget} BU`}
                    </small>
                  </span>
                  <span aria-hidden="true">↗</span>
                </button>
                <label>
                  Main intent
                  <input
                    value={marks.intent}
                    maxLength={2000}
                    disabled={!session.ready || completed}
                    onChange={(e) =>
                      change(`actor:${m.id}`, {
                        ...marks,
                        intent: e.target.value,
                      })
                    }
                  />
                </label>
                <div className="sw-encounter-marker-controls">
                  <label>
                    Track
                    <select
                      value={marks.track}
                      disabled={!session.ready || completed}
                      onChange={(e) =>
                        change(`actor:${m.id}`, {
                          ...marks,
                          track: e.target.value,
                        })
                      }
                    >
                      {["Unassigned", "Fast", "Measured", "Heavy"].map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </label>
                  <label className="sw-encounter-check">
                    <input
                      type="checkbox"
                      checked={marks.resolved}
                      disabled={!session.ready || completed}
                      onChange={(e) =>
                        change(`actor:${m.id}`, {
                          ...marks,
                          resolved: e.target.checked,
                        })
                      }
                    />
                    Resolved
                  </label>
                </div>
                {m.tactics && (
                  <details>
                    <summary>Tactics</summary>
                    <p>{m.tactics}</p>
                  </details>
                )}
                {m.copyId && (
                  <Link href={`/monsters/play/${m.copyId}`}>
                    Open full sheet ↗
                  </Link>
                )}
              </article>
            );
          })}
        </section>
        {active?.copyId && !active.unavailable && (
          <section className="sw-encounter-active-creature">
            <div className="sw-encounter-section-heading">
              <h2>{active.name}</h2>
              <button
                className="sw-metal-button"
                onClick={() => {
                  setSelected(null);
                  void refresh();
                }}
              >
                Close creature
              </button>
            </div>
            <MonsterPlaySheet key={active.copyId} id={active.copyId} embedded />
          </section>
        )}
      </div>
      <details className="sw-encounter-panel">
        <summary>{completed ? "Run complete" : "Finish encounter"}</summary>
        <p>
          All creature state remains saved. Start a fresh run from Preparation
          when you want new creatures.
        </p>
        <button
          className="sw-metal-button"
          disabled={!session.ready}
          onClick={() => change("completed", !completed)}
        >
          {completed ? "Reopen run" : "End encounter"}
        </button>
      </details>
    </main>
  );
}
