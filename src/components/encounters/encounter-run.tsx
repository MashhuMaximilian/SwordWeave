"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import type { PlayOverrides, PlayMutation } from "@/lib/play-state/model";
import type { PlaySessionSnapshot } from "@/lib/play-state/client-sync";
import { usePlaySession } from "@/lib/hooks/use-play-session";
import {
  getEffectivePlayState,
  queuePlayChanges,
  getPlaySessionMaximum,
  resolvePlayConflict,
  retryPlaySync,
} from "@/lib/play-state/client-sync";
import { phases, type EncounterDefinition } from "@/lib/encounters/model";
import { MonsterPlaySheet } from "@/components/monsters/monster-play-sheet";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Cloud,
  Download,
  NotebookPen,
  RefreshCw,
  Search,
  Swords,
  Users,
} from "lucide-react";
import { LiveEncounterMember, type LiveMember } from "./live-encounter-member";
import { LiveEncounterTable } from "./live-encounter-table";
import {
  tracks,
  emptyMarker,
  readMarker,
  nextCouncilChanges,
  runEntries,
  guestMarkerSchema,
  objectiveSchema,
  clockSchema,
  journalSchema,
} from "@/lib/encounters/run-state";
import "./encounters.css";
import "./live-encounter.css";
export type RunData = {
  run: {
    id: string;
    name: string;
    encounterId: string | null;
    party: Omit<EncounterDefinition, "entries">;
  };
  members: LiveMember[];
  partyLinks: { id: string; name: string }[];
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
    [error, setError] = useState("");
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
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    },
    [],
  );
  const creatureSaved = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      if (navigator.onLine) void refresh();
    }, 350);
  }, [refresh]);
  const change = useCallback(
    (field: string, value: unknown) => {
      try {
        const current = getEffectivePlayState("ENCOUNTER_RUN", id).overrides;
        const patched =
          /^(actor|party|guest):/.test(field) &&
          value &&
          typeof value === "object"
            ? {
                ...emptyMarker(),
                ...((current[field] as Record<string, unknown>) ?? {}),
                ...value,
              }
            : value;
        queuePlayChanges("ENCOUNTER_RUN", id, [{ field, value: patched }]);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [id],
  );
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
    <LiveEncounterBoard
      id={id}
      data={data}
      state={getEffectivePlayState("ENCOUNTER_RUN", id).overrides}
      session={session}
      error={error}
      change={change}
      changeMany={(changes) => queuePlayChanges("ENCOUNTER_RUN", id, changes)}
      readState={() => getEffectivePlayState("ENCOUNTER_RUN", id).overrides}
      refresh={() => void refresh()}
      retry={() => retryPlaySync("ENCOUNTER_RUN", id)}
      resolveConflict={(choice) =>
        resolvePlayConflict("ENCOUNTER_RUN", id, choice)
      }
      onError={setError}
      creatureSaved={creatureSaved}
    />
  );
}
export function LiveEncounterBoard({
  id,
  data,
  state,
  session,
  error,
  change,
  changeMany,
  readState,
  refresh,
  retry,
  resolveConflict,
  onError,
  creatureSaved,
  renderCreature,
}: {
  id: string;
  data: RunData;
  state: PlayOverrides;
  session: PlaySessionSnapshot;
  error: string;
  change: (field: string, value: unknown) => void;
  changeMany: (changes: PlayMutation["changes"]) => void;
  readState: () => PlayOverrides;
  refresh: () => void;
  retry: () => void;
  resolveConflict: (choice: "local" | "server") => Promise<void>;
  onError: (message: string) => void;
  creatureSaved: () => void;
  renderCreature?: (member: LiveMember) => React.ReactNode;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const round = typeof state["round"] === "number" ? state["round"] : 1;
  const phase = phases.includes(state["phase"] as (typeof phases)[number])
    ? (state["phase"] as (typeof phases)[number])
    : "Council";
  const completed = state["completed"] === true;
  const active = data?.members.find((m) => m.id === selected);
  const disabled =
    !session.ready ||
    completed ||
    ["legacy", "conflict"].includes(session.status);
  const [view, setView] = useState<"roster" | "creature" | "table">("roster");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const effectiveFilter =
    phase === "Council" && filter === "phase" ? "all" : filter;
  function nextRound() {
    if (!data || disabled) return;
    try {
      changeMany(
        nextCouncilChanges(
          readState(),
          round,
          data.members.map((m) => m.id),
          data.partyLinks.map((p) => p.id),
        ),
      );
    } catch (e) {
      onError((e as Error).message);
    }
  }
  function advance() {
    if (phase === "Heavy") nextRound();
    else change("phase", phases[phases.indexOf(phase) + 1]);
  }
  function exportNotes() {
    if (!data) return;
    const objectives = runEntries(state, "objective", objectiveSchema),
      clocks = runEntries(state, "clock", clockSchema),
      log = runEntries(state, "log", journalSchema).sort(
        (a, b) => a.value.at - b.value.at,
      );
    const text = [
      `# ${data.run.name}`,
      `Round ${round} · ${phase}${completed ? " · Complete" : ""}`,
      "## Prepared note",
      data.run.party.note || "—",
      "## Live notes",
      String(state["notes"] ?? "—"),
      "## Creatures",
      ...data.members.map((m) => {
        const mark = readMarker(state, `actor:${m.id}`);
        const cached = m.copyId
          ? getEffectivePlayState("MONSTER_PLAY_COPY", m.copyId)
          : undefined;
        const vitality =
          cached?.overrides["currentVitality"] ?? m.currentVitality ?? "—";
        const maximum = m.copyId
          ? (getPlaySessionMaximum("MONSTER_PLAY_COPY", m.copyId) ?? m.maximum)
          : m.maximum;
        return `- ${m.name}: ${vitality}/${maximum ?? "—"} Vitality; ${mark.track}; ${mark.resolved ? "resolved" : "unresolved"}${mark.presence === "withdrawn" ? "; withdrawn" : ""}\n  Intent: ${mark.intent || "—"}\n  Target: ${mark.target || "—"}\n  Reminder: ${mark.reminder || "—"}`;
      }),
      "## Party",
      `Party ${data.run.party.partyBu ?? "—"} BU · Equipment ${data.run.party.partyItemBu ?? "—"} Item BU · Size ${data.run.party.partySize ?? "—"}`,
      ...[
        ...data.partyLinks.map((p) => ({
          name: p.name,
          marker: readMarker(state, `party:${p.id}`),
        })),
        ...runEntries(state, "guest", guestMarkerSchema).map((g) => ({
          name: g.value.name,
          marker: g.value,
        })),
      ].map(
        ({ name, marker }) =>
          `- ${name}: ${marker.track}; ${marker.resolved ? "resolved" : "unresolved"}\n  Intent: ${marker.intent || "—"}\n  Target: ${marker.target || "—"}\n  Reminder: ${marker.reminder || "—"}`,
      ),
      "## Objectives",
      ...objectives.map(
        (o) => `- [${o.value.done ? "x" : " "}] ${o.value.text}`,
      ),
      "## Countdowns",
      ...clocks.map(
        (c) => `- ${c.value.label}: ${c.value.value}/${c.value.maximum}`,
      ),
      "## Journal",
      ...log.map(
        (e) => `- Round ${e.value.round} · ${e.value.phase}: ${e.value.text}`,
      ),
    ].join("\n\n");
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/markdown;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `encounter-${id}-notes.md`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const markers = [
    ...data.members
      .filter((m) => !m.unavailable)
      .map((m) => readMarker(state, `actor:${m.id}`)),
    ...data.partyLinks.map((p) => readMarker(state, `party:${p.id}`)),
    ...runEntries(state, "guest", guestMarkerSchema).map((g) => g.value),
  ].filter((m) => m.presence !== "withdrawn");
  const counts = Object.fromEntries(
    tracks.map((t) => [
      t,
      markers.filter((m) => m.track === t && !m.resolved).length,
    ]),
  );
  const resolved = markers.filter((m) => m.resolved).length;
  const pending =
    phase === "Council"
      ? markers.filter((m) => !m.resolved && !m.intent.trim()).length
      : (counts[phase] ?? 0);
  const visibleMembers = data.members.filter((m) => {
    const mark = readMarker(state, `actor:${m.id}`);
    return (
      m.name.toLowerCase().includes(search.toLowerCase()) &&
      (effectiveFilter === "all" ||
        (effectiveFilter === "unresolved" &&
          !mark.resolved &&
          mark.presence !== "withdrawn") ||
        (effectiveFilter === "phase" &&
          mark.track === phase &&
          !mark.resolved &&
          mark.presence !== "withdrawn") ||
        (effectiveFilter === "zero" &&
          !m.unavailable &&
          m.currentVitality === 0) ||
        (effectiveFilter === "withdrawn" && mark.presence === "withdrawn"))
    );
  });
  const statusLabels = {
    loading: "Opening session…",
    saved: "Encounter saved",
    pending: "Saving encounter…",
    offline: "Offline · edits queued on this device",
    conflict: "Changes need review",
    legacy: "Choose a saved session",
    error: "Sync needs attention",
  };
  return (
    <main
      className={`sw-encounters sw-encounter-running sw-live-encounter view-${view}`}
    >
      <header className="sw-live-heading">
        <div>
          <p className="v12-kicker">
            Game Master · {completed ? "Completed encounter" : "Live encounter"}
          </p>
          <h1>{data.run.name}</h1>
        </div>
        <div className="sw-live-heading-actions">
          <button
            className="sw-metal-button"
            type="button"
            onClick={exportNotes}
          >
            <Download size={14} />
            Export notes
          </button>
          <Link
            className="sw-metal-button"
            href={
              data.run.encounterId
                ? `/encounters/${data.run.encounterId}`
                : "/encounters"
            }
          >
            <ArrowLeft size={14} />
            Preparation
          </Link>
        </div>
      </header>
      {error && (
        <p role="alert" className="sw-encounter-notice">
          {error}
        </p>
      )}
      <section className="sw-live-command" aria-label="Encounter rhythm">
        <div className="sw-live-round">
          <span>Round</span>
          <strong>{round}</strong>
          <small>{completed ? "Complete" : phase}</small>
        </div>
        <div className="sw-live-rhythm">
          <div
            className="sw-live-phase-track"
            role="group"
            aria-label="Current phase"
          >
            {phases.map((p, i) => (
              <button
                type="button"
                key={p}
                className="sw-metal-button"
                aria-pressed={phase === p}
                disabled={disabled}
                onClick={() => change("phase", p)}
              >
                <small>0{i + 1}</small>
                <span>{p}</span>
                <b>
                  {p === "Council"
                    ? markers.filter((m) => !m.intent.trim() && !m.resolved)
                        .length
                    : counts[p]}
                </b>
              </button>
            ))}
          </div>
          <p>
            {phase === "Council"
              ? `${pending} awaiting intent`
              : `${pending} unresolved on ${phase}`}{" "}
            · {resolved}/{markers.length} resolved this round
          </p>
        </div>
        <div className="sw-live-advance">
          <button
            type="button"
            className="sw-metal-button"
            disabled={disabled}
            onClick={advance}
          >
            {phase === "Heavy"
              ? `Next Council · ${round + 1}`
              : `Next · ${phases[phases.indexOf(phase) + 1]}`}
            <ArrowRight size={14} />
          </button>
          <small>
            {phase === "Heavy"
              ? "Clears round declarations; keeps notes & scene progress."
              : "Advance manually; creature effects remain unchanged."}
          </small>
        </div>
      </section>
      <div
        className={`sw-live-sync${["conflict", "error", "legacy"].includes(session.status) ? " needs-attention" : ""}`}
      >
        <span role="status">
          <Cloud size={13} />
          {statusLabels[session.status]}
          {session.pending ? ` · ${session.pending} queued` : ""}
        </span>
        <button
          type="button"
          className="sw-live-link-action"
          onClick={() => {
            retry();
            void refresh();
          }}
        >
          <RefreshCw size={12} />
          Refresh
        </button>
        {["conflict", "legacy"].includes(session.status) && (
          <div>
            <p>
              Your local encounter changes are preserved. Choose which
              conflicting fields to keep.
            </p>
            {(["local", "server"] as const).map((choice) => (
              <button
                type="button"
                className="sw-metal-button"
                key={choice}
                onClick={() =>
                  void resolveConflict(choice).catch((e) => onError(e.message))
                }
              >
                {choice === "local"
                  ? "Keep local changes"
                  : "Use saved encounter"}
              </button>
            ))}
          </div>
        )}
        {session.error && <p role="alert">{session.error}</p>}
      </div>
      <nav className="sw-live-views" aria-label="Live encounter views">
        {(
          [
            { key: "roster", label: "Roster", icon: Users },
            {
              key: "creature",
              label: active?.name ?? "Creature",
              icon: Swords,
            },
            { key: "table", label: "Table tools", icon: NotebookPen },
          ] as const
        ).map((t) => (
          <button
            type="button"
            className="sw-metal-button"
            key={t.key}
            aria-pressed={view === t.key}
            disabled={t.key === "creature" && !active}
            onClick={() => setView(t.key)}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </nav>
      <div className="sw-live-workspace">
        <section className="sw-live-roster" aria-label="Creature roster">
          <header className="sw-live-roster-heading">
            <div>
              <p className="v12-kicker">The opposition</p>
              <h2>
                Creatures <small>{data.members.length}</small>
              </h2>
            </div>
            <span>
              {
                data.members.filter(
                  (m) => !m.unavailable && m.currentVitality === 0,
                ).length
              }{" "}
              at 0 Vitality
            </span>
          </header>
          <div className="sw-live-roster-tools">
            <label className="sw-live-search">
              <Search size={14} />
              <input
                aria-label="Search encounter creatures"
                placeholder="Find a creature…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <select
              aria-label="Show encounter creatures"
              value={effectiveFilter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All creatures</option>
              <option value="unresolved">Unresolved</option>
              {phase !== "Council" && (
                <option value="phase">Current track</option>
              )}
              <option value="zero">0 Vitality</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </div>
          {!visibleMembers.length && (
            <p className="sw-live-empty">No creatures match this view.</p>
          )}
          {visibleMembers.map((m) => (
            <LiveEncounterMember
              key={m.id}
              member={m}
              marker={readMarker(state, `actor:${m.id}`)}
              active={selected === m.id}
              disabled={disabled}
              onMarker={(value) => change(`actor:${m.id}`, value)}
              onOpen={() => {
                setSelected(m.id);
                setView("creature");
              }}
              onSaved={creatureSaved}
            />
          ))}
        </section>
        <aside
          className="sw-live-inspector"
          aria-label="Encounter detail panel"
        >
          <nav className="sw-live-inspector-tabs" aria-label="Detail panel">
            <button
              type="button"
              className="sw-metal-button"
              aria-pressed={view === "creature" && !!active}
              disabled={!active}
              onClick={() => setView("creature")}
            >
              <Swords size={14} />
              {active?.name ?? "Creature detail"}
            </button>
            <button
              type="button"
              className="sw-metal-button"
              aria-pressed={view !== "creature"}
              onClick={() => setView("table")}
            >
              <NotebookPen size={14} />
              Table tools
            </button>
          </nav>
          <div hidden={view === "creature" && !!active}>
            <LiveEncounterTable
              state={state}
              party={data.run.party}
              links={data.partyLinks}
              round={round}
              phase={phase}
              disabled={disabled}
              change={change}
            />
          </div>
          {view === "creature" && active?.copyId && !active.unavailable && (
            <section className="sw-encounter-active-creature sw-live-creature-detail">
              <header>
                <div>
                  <p className="v12-kicker">Independent play copy</p>
                  <h2>{active.name}</h2>
                </div>
                <Link
                  href={`/monsters/play/${active.copyId}`}
                  className="sw-metal-button"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open full ${active.name} sheet`}
                >
                  <ArrowUpRight size={16} />
                </Link>
              </header>
              <fieldset disabled={completed} className="sw-live-sheet-fieldset">
                {renderCreature ? (
                  renderCreature(active)
                ) : (
                  <MonsterPlaySheet
                    key={active.copyId}
                    id={active.copyId}
                    embedded
                  />
                )}
              </fieldset>
            </section>
          )}
        </aside>
      </div>
      <footer className="sw-live-footer">
        <details>
          <summary>
            {completed ? "Run complete · reopen" : "Finish encounter"}
          </summary>
          <p>
            All play copies, notes and scene progress remain saved. A new run
            starts fresh copies from Preparation.
          </p>
          <button
            type="button"
            className="sw-metal-button"
            disabled={
              !session.ready || ["conflict", "legacy"].includes(session.status)
            }
            onClick={() => change("completed", !completed)}
          >
            {completed ? "Reopen run" : "End encounter"}
          </button>
        </details>
        <small>Phase changes never apply damage or expire consequences.</small>
      </footer>
    </main>
  );
}
