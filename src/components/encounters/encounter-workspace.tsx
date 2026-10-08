"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Plus, ArrowUpRight, Heart, Shield, Swords } from "lucide-react";
import { useAccount } from "@/components/account/account-provider";
import { EntityTypeIcon } from "@/components/icons/entity-type-icon";
import { MonsterTemplatePreview } from "@/components/monsters/monster-template-preview";
import {
  encounterDefinitionSchema,
  appraiseEncounter,
  type EncounterDefinition,
  type CreatureSummary,
} from "@/lib/encounters/model";
import { ZodError } from "zod";
import { browserUuid } from "@/lib/browser-uuid";
import "./encounters.css";
type Saved = {
  id: string;
  revision: number;
  definition: EncounterDefinition;
  creatures: CreatureSummary[];
  runs: { id: string; name: string; createdAt: string }[];
};
type Pick = {
  id: string;
  name: string;
  version: number;
  budget: number;
  catalogue?: { environment: string; role: string; tactics: string } | null;
};
const empty: EncounterDefinition = {
  name: "",
  note: "",
  partyBu: null,
  partyItemBu: null,
  partySize: null,
  budgetSource: "manual",
  characterIds: [],
  entries: [],
};
async function api<T>(url: string, method = "GET", data?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    cache: "no-store",
    ...(data === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }),
  });
  const body = await res.json();
  if (!res.ok)
    throw Object.assign(new Error(body.error ?? "Could not load encounter."), {
      status: res.status,
    });
  return body;
}
export function EncounterWorkspace({ id }: { id?: string }) {
  const { userId } = useAuth();
  return (
    <AccountWorkspace
      key={`${userId ?? "anonymous"}:${id ?? "new"}`}
      {...(id ? { id } : {})}
    />
  );
}
function AccountWorkspace({ id }: { id?: string }) {
  const { userId, isLoaded } = useAuth();
  const { isGameMaster, setGameMaster } = useAccount();
  const [list, setList] = useState<{ id: string; name: string }[]>([]),
    [editing, setEditing] = useState(!!id),
    [saved, setSaved] = useState<Saved | null>(null),
    [draft, setDraft] = useState<EncounterDefinition>(empty),
    [creatures, setCreatures] = useState<CreatureSummary[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [conflict, setConflict] = useState(false),
    [recovery, setRecovery] = useState<EncounterDefinition | null>(null);
  const [picker, setPicker] = useState(false),
    [preview, setPreview] = useState<{ id: string; version: number } | null>(
      null,
    ),
    [catalogue, setCatalogue] = useState<Pick[]>([]),
    [catalogueLoading, setCatalogueLoading] = useState(false),
    [offset, setOffset] = useState(0),
    [hasMore, setHasMore] = useState(false),
    [q, setQ] = useState(""),
    [env, setEnv] = useState(""),
    [role, setRole] = useState(""),
    [min, setMin] = useState(""),
    [max, setMax] = useState("");
  const [party, setParty] = useState<{ id: string; name: string }[]>([]),
    [partyOffset, setPartyOffset] = useState(0),
    [partyMore, setPartyMore] = useState(false),
    [partySummary, setPartySummary] = useState<
      | {
          id: string;
          name?: string;
          partyBu?: number;
          partyItemBu?: number;
          unavailable?: boolean;
        }[]
      | null
    >(null);
  const startOp = useRef<string | null>(null);
  const cacheKey = userId
    ? `sw:encounter-draft:${userId}:${id ?? "new"}`
    : null;
  useEffect(() => {
    if (!isLoaded || !userId) return;
    let active = true;
    void (
      id
        ? api<Saved>(`/api/encounters/${id}`)
        : api<{ encounters: { id: string; name: string }[] }>("/api/encounters")
    )
      .then((data) => {
        if (!active) return;
        if ("definition" in data) {
          setSaved(data);
          setDraft(data.definition);
          setCreatures(data.creatures);
        } else setList(data.encounters);
        try {
          const raw = cacheKey ? localStorage.getItem(cacheKey) : null;
          if (raw) {
            const parsed = JSON.parse(raw);
            const recovered = encounterDefinitionSchema.safeParse(
              parsed.definition,
            );
            if (
              recovered.success &&
              JSON.stringify(recovered.data) !==
                JSON.stringify("definition" in data ? encounterDefinitionSchema.parse(data.definition) : empty)
            )
              setRecovery(recovered.data);
          }
        } catch {
          /* Ignore malformed drafts. */
        }
        setReady(true);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id, userId, isLoaded, cacheKey]);
  useEffect(() => {
    if (ready && editing && cacheKey && !recovery)
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ definition: draft }));
      } catch {
        queueMicrotask(() =>
          setError(
            "Browser draft storage is unavailable. Save before leaving.",
          ),
        );
      }
  }, [ready, editing, cacheKey, draft, recovery]);
  useEffect(() => {
    if (!userId || !picker) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setCatalogueLoading(true);
      const p = new URLSearchParams({
        q,
        environment: env,
        role,
        min,
        max,
        offset: String(offset),
      });
      void fetch(`/api/encounters/catalogue?${p}`, {
        signal: controller.signal,
        cache: "no-store",
      })
        .then(async (r) => {
          if (!r.ok) throw new Error("Catalogue could not load.");
          return r.json();
        })
        .then((r) => {
          setCatalogue(r.monsters);
          setHasMore(r.hasMore);
        })
        .catch((e) => {
          if (e.name !== "AbortError") setError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setCatalogueLoading(false);
        });
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [userId, picker, q, env, role, min, max, offset]);
  let appraisal = appraiseEncounter(empty, []);
  let appraisalError = "";
  try {
    appraisal = appraiseEncounter(draft, creatures);
  } catch (e) {
    appraisalError = e instanceof Error ? e.message : "Could not calculate budgets.";
    appraisal.missing = true;
  }
  const dirty =
    !saved || JSON.stringify(draft) !== JSON.stringify(saved.definition);
  function patch(value: Partial<EncounterDefinition>) {
    setDraft((d) => ({ ...d, ...value }));
    startOp.current = null;
  }
  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      encounterDefinitionSchema.parse(draft);
      const next = await api<Saved>(
        saved ? `/api/encounters/${saved.id}` : "/api/encounters",
        saved ? "PATCH" : "POST",
        saved ? { revision: saved.revision, definition: draft } : draft,
      );
      setSaved(next);
      setDraft(next.definition);
      setCreatures(next.creatures);
      setConflict(false);
      if (cacheKey) localStorage.removeItem(cacheKey);
      if (!id) window.location.assign(`/encounters/${next.id}`);
      return next;
    } catch (e) {
      setError(
        e instanceof ZodError
          ? e.issues.map((i) => i.message).join(" ")
          : e instanceof Error
            ? e.message
            : "Save failed.",
      );
      if ((e as { status?: number }).status === 409) setConflict(true);
    } finally {
      setBusy(false);
    }
  }
  async function reload(keepLocal = false) {
    if (!saved) return;
    setBusy(true);
    try {
      const next = await api<Saved>(`/api/encounters/${saved.id}`);
      setSaved(next);
      setCreatures(next.creatures);
      if (!keepLocal) setDraft(next.definition);
      setConflict(false);
      setError(
        keepLocal
          ? "Latest revision loaded. Review your local draft, then Save to reapply it."
          : "",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function start() {
    if (busy || dirty || !saved) return;
    setBusy(true);
    setError("");
    startOp.current ??= browserUuid();
    try {
      const run = await api<{ id: string }>(
        `/api/encounters/${saved.id}/runs`,
        "POST",
        { revision: saved.revision, opId: startOp.current },
      );
      window.location.assign(`/encounters/runs/${run.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function add(monster: Pick) {
    setBusy(true);
    try {
      const data = await api<{
        monster: {
          definition: {
            name: string;
            budget: number;
            catalogue?: Pick["catalogue"];
          };
        };
        sheet: { itemBu: number; maximum: number };
      }>(`/api/monsters/${monster.id}?version=${monster.version}`);
      const index = draft.entries.findIndex(
        (e) => e.templateId === monster.id && e.version === monster.version,
      );
      patch({
        entries:
          index >= 0
            ? draft.entries.map((e, i) =>
                i === index ? { ...e, quantity: e.quantity + 1 } : e,
              )
            : [
                ...draft.entries,
                {
                  templateId: monster.id,
                  version: monster.version,
                  quantity: 1,
                },
              ],
      });
      setCreatures((c) => [
        ...c.filter(
          (c) => c.templateId !== monster.id || c.version !== monster.version,
        ),
        {
          templateId: monster.id,
          version: monster.version,
          name: data.monster.definition.name,
          budget: data.monster.definition.budget,
          itemBu: data.sheet.itemBu,
          maximum: data.sheet.maximum,
          ...data.monster.definition.catalogue,
        },
      ]);
      setPicker(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function updatePin(index: number) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const entry = draft.entries[index]!;
      const data = await api<{
        monster: {
          version: number;
          definition: {
            name: string;
            budget: number;
            catalogue?: Pick["catalogue"];
          };
        };
        sheet: { itemBu: number; maximum: number };
      }>(`/api/monsters/${entry.templateId}`);
      const version = data.monster.version;
      if (
        draft.entries.some(
          (e, i) =>
            i !== index &&
            e.templateId === entry.templateId &&
            e.version === version,
        )
      )
        throw new Error(
          "This version is already present. Adjust its quantity instead.",
        );
      patch({
        entries: draft.entries.map((e, i) =>
          i === index ? { ...e, version } : e,
        ),
      });
      setCreatures((c) => [
        ...c,
        {
          templateId: entry.templateId,
          version,
          name: data.monster.definition.name,
          budget: data.monster.definition.budget,
          itemBu: data.sheet.itemBu,
          maximum: data.sheet.maximum,
          ...data.monster.definition.catalogue,
        },
      ]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function loadParty(more = false) {
    const nextOffset = more ? partyOffset : 0;
    setBusy(true);
    try {
      const data = await api<{ characters: { id: string; name: string }[] }>(
        `/api/encounters/party?offset=${nextOffset}`,
      );
      setParty((p) =>
        nextOffset ? [...p, ...data.characters] : data.characters,
      );
      setPartyOffset(nextOffset + 50);
      setPartyMore(data.characters.length === 50);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function calculate() {
    setBusy(true);
    try {
      const data = await api<{ characters: NonNullable<typeof partySummary> }>(
        "/api/encounters/party",
        "POST",
        { ids: draft.characterIds },
      );
      setPartySummary(data.characters);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!isLoaded) return <main className="sw-encounters">Loading account…</main>;
  if (!userId)
    return (
      <main className="sw-encounters">
        <h1>Encounter Builder</h1>
        <p>Prepare creatures for your table.</p>
        <Link className="sw-metal-button" href="/sign-in">
          Sign in
        </Link>
      </main>
    );
  if (!ready) return <main className="sw-encounters"><h1>Encounter Builder</h1><p role="status">{error || "Loading encounter preparation…"}</p>{error && <button className="sw-metal-button" onClick={() => window.location.reload()}>Retry</button>}</main>;
  return (
    <main className="sw-encounters">
      <header className="sw-encounter-heading">
        <div>
          <p className="v12-kicker">Game Master · prepare & play</p>
          <h1>{editing ? "Prepare an encounter" : "Encounter Builder"}</h1>
          <p>
            Choose the opposition. Keep your party and equipment budgets
            separate.
          </p>
        </div>
        {editing ? (
          <Link href="/encounters" className="sw-metal-button">
            Saved encounters
          </Link>
        ) : (
          <button
            className="sw-metal-button"
            onClick={() => {
              setEditing(true);
              setReady(true);
              setDraft(empty);
              setSaved(null);
            }}
          >
            {" "}
            <Plus size={18} />
            New encounter
          </button>
        )}
      </header>
      {!isGameMaster && (
        <div className="sw-encounter-notice">
          Show encounters and creature tools in navigation.{" "}
          <button
            className="sw-metal-button"
            onClick={() => void setGameMaster(true)}
          >
            Enable Game Master tools
          </button>
        </div>
      )}
      {error && (
        <p className="sw-encounter-notice" role="alert">
          {error}
        </p>
      )}
      {recovery && (
        <div className="sw-encounter-notice">
          An unsaved draft is available on this device.{" "}
          <button
            className="sw-metal-button"
            onClick={() => {
              setDraft(recovery);
              setEditing(true);
              setRecovery(null);
            }}
          >
            Recover draft
          </button>
          <button className="sw-metal-button" onClick={() => setRecovery(null)}>
            Use saved version
          </button>
        </div>
      )}
      {!editing ? (
        <section className="sw-encounter-list">
          {list.map((e) => (
            <Link
              className="sw-encounter-list-row"
              key={e.id}
              href={`/encounters/${e.id}`}
            >
              <Swords size={20} />
              <strong>{e.name}</strong>
              <ArrowUpRight size={18} />
            </Link>
          ))}
          {ready && !list.length && (
            <p>
              No encounters yet. Start with a name, a party budget and a few
              creatures.
            </p>
          )}
        </section>
      ) : (
        <fieldset
          disabled={busy}
          className={`sw-encounter-preparation${picker ? " is-picking" : ""}`}
        >
          <section className="sw-encounter-editor">
            <div className="sw-encounter-panel">
              <h2>The scene</h2>
              <label>
                Name
                <input
                  maxLength={200}
                  value={draft.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder="The lantern bridge"
                />
              </label>
              <label>
                Encounter note
                <textarea
                  maxLength={5000}
                  rows={2}
                  value={draft.note}
                  onChange={(e) => patch({ note: e.target.value })}
                  placeholder="What brings the party here?"
                />
              </label>
            </div>
            <div className="sw-encounter-panel">
              <h2>
                Party budget{" "}
                <small>
                  {draft.budgetSource === "characters"
                    ? "From linked characters"
                    : draft.budgetSource === "override"
                      ? "Manual override"
                      : "Manual"}
                </small>
              </h2>
              <div className="sw-encounter-fields">
                {(
                  [
                    ["partyBu", "Party BU"],
                    ["partyItemBu", "Party Item BU"],
                    ["partySize", "Party size (optional)"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      type="number"
                      min={key === "partySize" ? 1 : 0}
                      step="1"
                      value={draft[key] ?? ""}
                      onChange={(e) => {
                        if (
                          e.target.value !== "" &&
                          !Number.isSafeInteger(Number(e.target.value))
                        )
                          return;
                        patch({
                          [key]:
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                          budgetSource:
                            draft.budgetSource === "characters"
                              ? "override"
                              : draft.budgetSource,
                        });
                      }}
                    />
                  </label>
                ))}
              </div>
              <p className="sw-encounter-help">
                Enter the party&apos;s totals. Leave unknown budgets blank;
                enter 0 for no equipment.
              </p>
              <details>
                <summary>Use owned or shared characters instead</summary>
                <button
                  disabled={busy}
                  className="sw-metal-button"
                  onClick={() => void loadParty()}
                >
                  {party.length
                    ? "Refresh character list"
                    : "Choose characters"}
                </button>
                {party.map((c) => (
                  <label className="sw-encounter-check" key={c.id}>
                    <input
                      type="checkbox"
                      checked={draft.characterIds.includes(c.id)}
                      onChange={(e) => {
                        patch({
                          characterIds: e.target.checked
                            ? [...draft.characterIds, c.id]
                            : draft.characterIds.filter((id) => id !== c.id),
                        });
                        setPartySummary(null);
                      }}
                    />
                    {c.name}
                    <Link href={`/characters/${c.id}`}>Open sheet ↗</Link>
                  </label>
                ))}
                {draft.characterIds
                  .filter((id) => !party.some((c) => c.id === id))
                  .map((id) => (
                    <div key={id}>
                      Linked character{" "}
                      <button
                        className="sw-metal-button"
                        onClick={() => {
                          patch({
                            characterIds: draft.characterIds.filter(
                              (c) => c !== id,
                            ),
                          });
                          setPartySummary(null);
                        }}
                      >
                        Remove link
                      </button>
                    </div>
                  ))}
                {partyMore && (
                  <button
                    className="sw-metal-button"
                    disabled={busy}
                    onClick={() => void loadParty(true)}
                  >
                    More characters
                  </button>
                )}
                <button
                  disabled={busy || !draft.characterIds.length}
                  className="sw-metal-button"
                  onClick={() => void calculate()}
                >
                  Calculate / refresh selected totals
                </button>
                {partySummary && (
                  <div className="sw-encounter-party-review">
                    {partySummary.map((c) => (
                      <p key={c.id}>
                        {c.unavailable
                          ? "Character no longer accessible"
                          : `${c.name}: ${c.partyBu} BU + ${c.partyItemBu} Item BU`}
                      </p>
                    ))}
                    <button
                      className="sw-metal-button"
                      disabled={partySummary.some((c) => c.unavailable)}
                      onClick={() =>
                        patch({
                          partyBu: partySummary.reduce(
                            (n, c) => n + (c.partyBu ?? 0),
                            0,
                          ),
                          partyItemBu: partySummary.reduce(
                            (n, c) => n + (c.partyItemBu ?? 0),
                            0,
                          ),
                          partySize: partySummary.length,
                          budgetSource: "characters",
                        })
                      }
                    >
                      Use these totals
                    </button>
                  </div>
                )}
              </details>
            </div>
            <div className="sw-encounter-panel">
              <div className="sw-encounter-section-heading">
                <h2>Opposition</h2>
                <button
                  className="sw-metal-button"
                  disabled={busy}
                  onClick={() => setPicker(!picker)}
                >
                  <Plus size={18} />
                  {picker ? "Close picker" : "Add creatures"}
                </button>
              </div>
              {draft.entries.map((entry, index) => {
                const c = creatures.find(
                  (c) =>
                    c.templateId === entry.templateId &&
                    c.version === entry.version,
                );
                return (
                  <div
                    key={`${entry.templateId}:${entry.version}`}
                    className="sw-encounter-entry"
                  >
                    <EntityTypeIcon type="MONSTER" />
                    <div>
                      <strong>{c?.name ?? "Creature"}</strong>
                      <small>
                        {c?.unavailable
                          ? "Access unavailable"
                          : `${c?.budget ?? "…"} BU + ${c?.itemBu ?? "…"} Item BU · v${entry.version}`}
                      </small>
                    </div>
                    <label>
                      Quantity
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={entry.quantity}
                        onChange={(e) => {
                          const quantity = Number(e.target.value);
                          if (
                            Number.isSafeInteger(quantity) &&
                            quantity >= 1 &&
                            quantity <= 200
                          )
                            patch({
                              entries: draft.entries.map((x, i) =>
                                i === index ? { ...x, quantity } : x,
                              ),
                            });
                        }}
                      />
                    </label>
                    <button
                      className="sw-metal-button"
                      onClick={() =>
                        patch({
                          entries: draft.entries.filter((_, i) => i !== index),
                        })
                      }
                    >
                      Remove
                    </button>
                    {!c?.unavailable && (
                      <button
                        className="sw-metal-button"
                        onClick={() => {
                          setPreview({
                            id: entry.templateId,
                            version: entry.version,
                          });
                          setPicker(true);
                        }}
                      >
                        Preview
                      </button>
                    )}
                    <button
                      className="sw-metal-button sw-encounter-update-pin"
                      disabled={busy}
                      onClick={() => void updatePin(index)}
                    >
                      Use current version
                    </button>
                    {c?.tactics && (
                      <p className="sw-encounter-tactics">{c.tactics}</p>
                    )}
                  </div>
                );
              })}
              {!draft.entries.length && (
                <p className="sw-encounter-help">
                  Add a template, then choose how many creatures will appear.
                </p>
              )}
            </div>
            <div className="sw-encounter-panel">
              <h2>Encounter appraisal</h2>
              {appraisalError && <p role="alert">{appraisalError}</p>}
              <div className="sw-encounter-budget-grid">
                <div>
                  <Swords size={18} />
                  <small>Enemy BU</small>
                  <strong>
                    {appraisal.missing ? "Incomplete" : appraisal.enemyBu}
                  </strong>
                </div>
                <div>
                  <Shield size={18} />
                  <small>Enemy Item BU</small>
                  <strong>
                    {appraisal.missing ? "Incomplete" : appraisal.enemyItemBu}
                  </strong>
                </div>
                <div>
                  <Heart size={18} />
                  <small>Party BU</small>
                  <strong>{draft.partyBu ?? "—"}</strong>
                </div>
                <div>
                  <Shield size={18} />
                  <small>Party Item BU</small>
                  <strong>{draft.partyItemBu ?? "—"}</strong>
                </div>
              </div>
              {appraisal.partyTotal !== null && !appraisal.missing && (
                <p>
                  Enemy total {appraisal.enemyTotal} · Party total{" "}
                  {appraisal.partyTotal} · Difference {appraisal.difference}{" "}
                  {appraisal.ratio !== null
                    ? `· Ratio ${appraisal.ratio.toFixed(2)}`
                    : ""}
                </p>
              )}
              <p>
                {appraisal.count} enemies
                {draft.partySize !== null
                  ? ` against ${draft.partySize} party members`
                  : ""}
                .{" "}
                {appraisal.largestShare >= 0.5
                  ? "At least half the creature budget is concentrated in one enemy."
                  : ""}
              </p>
              <p className="sw-encounter-help">
                Comparable BU totals do not guarantee comparable difficulty.
                Numbers, positioning, control and coordinated abilities matter.
              </p>
            </div>
            <div className="sw-encounter-actions">
              <button
                className="sw-metal-button"
                disabled={busy || !draft.name.trim() || !ready}
                onClick={() => void save()}
              >
                {busy
                  ? "Working…"
                  : dirty
                    ? "Save encounter"
                    : "Saved · Save again"}
              </button>
              <button
                className="sw-metal-button"
                disabled={
                  busy || dirty || !draft.entries.length || appraisal.missing
                }
                onClick={() => void start()}
              >
                {saved?.runs.length ? "Start new run" : "Start encounter"}
              </button>
              {dirty && <small>Save preparation before starting.</small>}
            </div>
            {conflict && (
              <div className="sw-encounter-actions">
                <button
                  className="sw-metal-button"
                  onClick={() => void reload()}
                >
                  Reload saved encounter
                </button>
                <button
                  className="sw-metal-button"
                  onClick={() => void reload(true)}
                >
                  Keep local draft for reapply
                </button>
              </div>
            )}
            {saved && (
              <details className="sw-encounter-panel">
                <summary>Previous runs & management</summary>
                {saved.runs.map((r) => (
                  <Link
                    key={r.id}
                    className="sw-encounter-list-row"
                    href={`/encounters/runs/${r.id}`}
                  >
                    Resume {r.name}
                    <small>{new Date(r.createdAt).toLocaleDateString()}</small>
                  </Link>
                ))}
                <details>
                  <summary>Delete preparation</summary>
                  <p>Runs and playable creatures are preserved.</p>
                  <button
                    disabled={busy}
                    className="sw-metal-button"
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await api(`/api/encounters/${saved.id}`, "DELETE");
                        if (cacheKey) localStorage.removeItem(cacheKey);
                        window.location.assign("/encounters");
                      } catch (e) {
                        setError((e as Error).message);
                        setBusy(false);
                      }
                    }}
                  >
                    Confirm deletion
                  </button>
                </details>
              </details>
            )}
          </section>
          {picker && (
            <aside className="sw-encounter-picker">
              <div className="sw-encounter-section-heading">
                <h2>Choose a creature</h2>
                <button
                  className="sw-metal-button"
                  onClick={() => {
                    setPicker(false);
                    setPreview(null);
                  }}
                >
                  Close
                </button>
              </div>
              <label>
                Search
                <input
                  placeholder="Name…"
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setOffset(0);
                  }}
                />
              </label>
              <div className="sw-encounter-fields">
                <label>
                  Minimum BU
                  <input
                    type="number"
                    min="0"
                    value={min}
                    onChange={(e) => {
                      setMin(e.target.value);
                      setOffset(0);
                    }}
                  />
                </label>
                <label>
                  Maximum BU
                  <input
                    type="number"
                    min="0"
                    value={max}
                    onChange={(e) => {
                      setMax(e.target.value);
                      setOffset(0);
                    }}
                  />
                </label>
              </div>
              <div className="sw-encounter-fields">
                <label>
                  Environment
                  <select
                    value={env}
                    onChange={(e) => {
                      setEnv(e.target.value);
                      setOffset(0);
                    }}
                  >
                    <option value="">All environments</option>
                    {[
                      "Wilderness",
                      "Subterranean",
                      "Urban",
                      "Aquatic",
                      "Aerial",
                      "Undead",
                      "Constructs",
                      "Arcane anomalies",
                      "Infernal",
                      "Ancient guardians",
                    ].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Role
                  <select
                    value={role}
                    onChange={(e) => {
                      setRole(e.target.value);
                      setOffset(0);
                    }}
                  >
                    <option value="">All roles</option>
                    {[
                      "Melee",
                      "Ranged",
                      "Defender",
                      "Ambusher",
                      "Controller",
                      "Support",
                      "Solo",
                    ].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="sw-encounter-catalogue">
                {catalogue.map((m) => (
                  <div key={m.id} className="sw-encounter-catalogue-row">
                    <button
                      onClick={() =>
                        setPreview({ id: m.id, version: m.version })
                      }
                    >
                      <EntityTypeIcon type="MONSTER" />
                      <span>
                        <strong>{m.name}</strong>
                        <small>
                          {m.budget} BU · {m.catalogue?.role ?? "Creature"}
                        </small>
                      </span>
                    </button>
                    <button
                      aria-label={`Add ${m.name}`}
                      className="sw-metal-button"
                      disabled={busy}
                      onClick={() => void add(m)}
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                ))}
                {catalogueLoading ? <p role="status">Loading creatures…</p> : !catalogue.length && <p>No matching creatures.</p>}
              </div>
              <div className="sw-encounter-actions">
                <button
                  className="sw-metal-button"
                  disabled={!offset}
                  onClick={() => setOffset(Math.max(0, offset - 24))}
                >
                  Previous
                </button>
                <button
                  className="sw-metal-button"
                  disabled={!hasMore}
                  onClick={() => setOffset(offset + 24)}
                >
                  More creatures
                </button>
              </div>
              {preview && (
                <div className="sw-encounter-preview">
                  <MonsterTemplatePreview
                    key={`${preview.id}:${preview.version}`}
                    id={preview.id}
                    version={preview.version}
                    compact
                  />
                </div>
              )}
            </aside>
          )}
        </fieldset>
      )}
    </main>
  );
}
