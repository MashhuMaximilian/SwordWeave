"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import {
  Plus,
  ArrowUpRight,
  Heart,
  Shield,
  Swords,
  Eye,
  X,
  ArrowLeft,
  ChevronRight,
  Users,
} from "lucide-react";
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
import { Markdown } from "@/components/ui/markdown";
import { browserUuid } from "@/lib/browser-uuid";
import {
  ForgeProgressRail,
  ForgeWorkbench,
} from "@/components/characters/forge-section";
import { EncounterBudgetReadout } from "./encounter-budget-readout";
import { EncounterGroupPicker } from "./encounter-group-picker";
import {
  EncounterPartyDirectory,
  type PartyDirectoryCharacter,
} from "./encounter-party-directory";
import { MonsterQuickDetails } from "@/components/monsters/monster-quick-details";
import { CatalogueQuickLook } from "@/components/library/catalogue-quick-look";
import { ColumnSearchBar } from "@/components/library/column-search-bar";
import type { LibraryView } from "@/lib/preferences/library-prefs";
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
  concept?: string;
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
export function EncounterWorkspace({
  id,
  startNew = false,
}: {
  id?: string;
  startNew?: boolean;
}) {
  const { userId } = useAuth();
  return (
    <AccountWorkspace
      key={`${userId ?? "anonymous"}:${id ?? "new"}`}
      startNew={startNew}
      {...(id ? { id } : {})}
    />
  );
}
function AccountWorkspace({
  id,
  startNew,
}: {
  id?: string;
  startNew: boolean;
}) {
  const { userId, isLoaded } = useAuth();
  const { isGameMaster, setGameMaster } = useAccount();
  const [list, setList] = useState<{ id: string; name: string }[]>([]),
    [editing, setEditing] = useState(!!id || startNew),
    [saved, setSaved] = useState<Saved | null>(null),
    [draft, setDraft] = useState<EncounterDefinition>(empty),
    [creatures, setCreatures] = useState<CreatureSummary[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [conflict, setConflict] = useState(false),
    [recovery, setRecovery] = useState<EncounterDefinition | null>(null);
  const [stage, setStage] = useState(id ? 2 : 0);
  const [catalogueView, setCatalogueView] = useState<LibraryView>("GRID");
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [archiveView, setArchiveView] = useState<LibraryView>("GRID");
  const [archiveSearch, setArchiveSearch] = useState("");
  const [oppositionMode, setOppositionMode] = useState<"groups" | "manual">(
    "groups",
  );
  const picker = editing && stage === 2;
  const [preview, setPreview] = useState<{
      id: string;
      version: number;
      entry?: Pick;
    } | null>(null),
    [catalogue, setCatalogue] = useState<Pick[]>([]),
    [catalogueLoading, setCatalogueLoading] = useState(true),
    [offset, setOffset] = useState(0),
    [hasMore, setHasMore] = useState(false),
    [q, setQ] = useState("");
  const [partySearch, setPartySearch] = useState("");
  const [partyPending, setPartyPending] = useState(false);
  const partyRequest = useRef<AbortController | null>(null);
  useEffect(() => () => partyRequest.current?.abort(), []);
  const [party, setParty] = useState<PartyDirectoryCharacter[]>([]),
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
                JSON.stringify(
                  "definition" in data
                    ? encounterDefinitionSchema.parse(data.definition)
                    : empty,
                )
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
    if (!userId || !picker || oppositionMode !== "manual") return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setCatalogueLoading(true);
      const p = new URLSearchParams({
        q,
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
  }, [userId, picker, oppositionMode, q, offset]);
  let appraisal = appraiseEncounter(empty, []);
  let appraisalError = "";
  try {
    appraisal = appraiseEncounter(draft, creatures);
  } catch (e) {
    appraisalError =
      e instanceof Error ? e.message : "Could not calculate budgets.";
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
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function loadParty(more = false, search = partySearch) {
    const nextOffset = more ? partyOffset : 0;
    partyRequest.current?.abort();
    const controller = new AbortController();
    partyRequest.current = controller;
    setPartyPending(true);
    try {
      const response = await fetch(
        `/api/encounters/party?offset=${nextOffset}&q=${encodeURIComponent(search)}`,
        { signal: controller.signal, cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not load characters.");
      if (controller.signal.aborted) return;
      setParty((p) =>
        nextOffset ? [...p, ...data.characters] : data.characters,
      );
      setPartyOffset(nextOffset + 50);
      setPartyMore(data.characters.length === 50);
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setPartyPending(false);
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
  const chapters = [
    {
      title: "The scene",
      short: "Scene",
      hint: "Name & encounter note",
      icon: Swords,
    },
    {
      title: "The party",
      short: "Party",
      hint: "Creature & item budgets",
      icon: Users,
    },
    {
      title: "The opposition",
      short: "Opposition",
      hint: "Choose your creatures",
      icon: Plus,
    },
    {
      title: "Review & run",
      short: "Review",
      hint: "Compare, save & play",
      icon: Shield,
    },
  ];
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
  if (!ready)
    return (
      <main className="sw-encounters">
        <h1>Encounter Builder</h1>
        <p role="status">{error || "Loading encounter preparation…"}</p>
        {error && (
          <button
            className="sw-metal-button"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        )}
      </main>
    );
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
          <Link
            href="/encounters"
            className="sw-metal-button sw-encounter-saved-link"
            aria-label="Saved encounters"
            title="Saved encounters"
          >
            <ArrowLeft size={16} />
            <span>Saved encounters</span>
          </Link>
        ) : (
          <button
            className="sw-metal-button"
            onClick={() => {
              setEditing(true);
              setStage(0);
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
        <section aria-label="Saved encounters">
          <ColumnSearchBar
            search={archiveSearch}
            onSearchChange={setArchiveSearch}
            view={archiveView}
            onViewChange={setArchiveView}
            placeholder="Search encounters…"
          />
          <div
            className={`sw-encounter-archive-results ${archiveView === "GRID" ? "is-grid" : "is-list"}`}
          >
            {list
              .filter((e) =>
                e.name.toLowerCase().includes(archiveSearch.toLowerCase()),
              )
              .map((e) => (
                <Link
                  className="sw-encounter-list-row"
                  key={e.id}
                  href={`/encounters/${e.id}`}
                >
                  <Swords size={20} />
                  <span>
                    <strong>{e.name}</strong>
                    <small>Private encounter · Preparation & runs</small>
                  </span>
                  <ArrowUpRight size={16} />
                </Link>
              ))}
          </div>
          {!list.length && (
            <p className="sw-encounter-help">
              No encounters yet. Start with a name, a party budget and a few
              creatures.
            </p>
          )}
        </section>
      ) : (
        <fieldset
          disabled={busy}
          className="sw-encounter-forge sw-character-forge"
        >
          <ForgeProgressRail label="Encounter preparation progress">
            <div className="sw-character-forge__rail-title">
              <span>Table instrument</span>
              <strong>{draft.name || "New encounter"}</strong>
            </div>
            <nav>
              {chapters.map((chapter, index) => (
                <button
                  type="button"
                  key={chapter.title}
                  aria-current={stage === index ? "step" : undefined}
                  className={stage === index ? "is-active" : ""}
                  onClick={() => setStage(index)}
                >
                  <span className="sw-character-forge__step-icon">
                    <chapter.icon size={20} />
                  </span>
                  <span>
                    <b>
                      <span className="sw-encounter-step-full">
                        {chapter.title}
                      </span>
                      <span className="sw-encounter-step-short">
                        {chapter.short}
                      </span>
                    </b>
                    <small>{chapter.hint}</small>
                  </span>
                  <em>{String(index + 1).padStart(2, "0")}</em>
                </button>
              ))}
            </nav>
            <div className="sw-encounter-rail-budget">
              <span>Selected creatures</span>
              <strong>{appraisal.count}</strong>
              <span>Enemy BU / Item BU</span>
              <b>
                {appraisal.enemyBu} / {appraisal.enemyItemBu}
              </b>
              <span>Party BU / Item BU</span>
              <b>
                {draft.partyBu ?? "—"} / {draft.partyItemBu ?? "—"}
              </b>
            </div>
          </ForgeProgressRail>
          <ForgeWorkbench
            header={
              <header className="sw-encounter-workbench-heading">
                <p className="v12-kicker">
                  {String(stage + 1).padStart(2, "0")} · Encounter preparation
                </p>
                <h2>{chapters[stage]!.title}</h2>
                <p>
                  {stage === 2
                    ? "Set your limits, choose a group, or build a roster yourself."
                    : chapters[stage]!.hint}
                </p>
              </header>
            }
            footer={
              <footer className="sw-encounter-workbench-footer">
                <div className="sw-encounter-step-actions">
                  <button
                    type="button"
                    className="sw-metal-button"
                    disabled={stage === 0 || busy}
                    onClick={() => setStage(stage - 1)}
                  >
                    <ArrowLeft size={16} />
                    Back
                  </button>
                  {stage < 3 && (
                    <button
                      type="button"
                      className="sw-metal-button"
                      onClick={() => setStage(stage + 1)}
                    >
                      Next
                      <ChevronRight size={16} />
                    </button>
                  )}
                </div>{" "}
                <div className="sw-encounter-actions">
                  <button
                    className="sw-metal-button"
                    disabled={busy || !draft.name.trim() || !ready}
                    onClick={() => void save()}
                  >
                    {busy ? "Working…" : dirty ? "Save encounter" : "Saved"}
                  </button>
                  <button
                    className="sw-metal-button"
                    disabled={
                      busy ||
                      dirty ||
                      !draft.entries.length ||
                      appraisal.missing
                    }
                    onClick={() => void start()}
                  >
                    {saved?.runs.length ? "Start new run" : "Start encounter"}
                  </button>
                  {dirty && <small>Save preparation before starting.</small>}
                </div>
              </footer>
            }
          >
            <section className="sw-encounter-chapter" hidden={stage !== 0}>
              {" "}
              <div className="sw-encounter-panel">
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
            </section>
            <section className="sw-encounter-chapter" hidden={stage !== 1}>
              {" "}
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
                <details
                  onToggle={(event) => {
                    if (
                      event.currentTarget.open &&
                      !party.length &&
                      !partyPending
                    )
                      void loadParty();
                  }}
                >
                  <summary>Use owned or shared characters instead</summary>
                  <EncounterPartyDirectory
                    characters={party}
                    selected={draft.characterIds}
                    search={partySearch}
                    pending={partyPending || busy}
                    onRefresh={() => void loadParty()}
                    onSearch={(value) => {
                      setPartySearch(value);
                      void loadParty(false, value);
                    }}
                    onToggle={(characterId) => {
                      patch({
                        characterIds: draft.characterIds.includes(characterId)
                          ? draft.characterIds.filter(
                              (id) => id !== characterId,
                            )
                          : [...draft.characterIds, characterId],
                      });
                      setPartySummary(null);
                    }}
                  />
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
            </section>
            <section
              className={`sw-encounter-chapter sw-encounter-selection-workspace${preview ? " is-previewing" : ""}${selectionOpen ? " is-selected-view" : ""}`}
              hidden={stage !== 2}
            >
              <div
                className="sw-encounter-opposition-modes"
                role="group"
                aria-label="Choose opposition mode"
              >
                <button
                  type="button"
                  className="sw-metal-button"
                  aria-pressed={oppositionMode === "groups"}
                  onClick={() => {
                    setOppositionMode("groups");
                    setPreview(null);
                    setSelectionOpen(false);
                  }}
                >
                  Suggested groups
                </button>
                <button
                  type="button"
                  className="sw-metal-button"
                  aria-pressed={oppositionMode === "manual"}
                  onClick={() => {
                    setOppositionMode("manual");
                    setPreview(null);
                    setSelectionOpen(false);
                  }}
                >
                  Choose creatures
                </button>
              </div>
              <div className="sw-encounter-catalogue-pane">
                <button
                  type="button"
                  className="sw-metal-button sw-encounter-mobile-selection"
                  onClick={() => setSelectionOpen(true)}
                >
                  Selected creatures <b>{appraisal.count}</b>
                </button>
                <div hidden={oppositionMode !== "groups"}>
                  <EncounterGroupPicker
                    selected={draft.entries}
                    partyBu={draft.partyBu}
                    partySize={draft.partySize}
                    disabled={busy}
                    onChoose={(group) => {
                      patch({ entries: group.entries });
                      setCreatures(group.creatures);
                      setPreview(null);
                    }}
                    onPreview={(creature) => {
                      setPreview({
                        id: creature.templateId,
                        version: creature.version,
                        entry: {
                          id: creature.templateId,
                          version: creature.version,
                          name: creature.name,
                          budget: creature.budget,
                        },
                      });
                      setSelectionOpen(true);
                    }}
                  />
                </div>
                {oppositionMode === "manual" && (
                  <>
                    <ColumnSearchBar
                      search={q}
                      onSearchChange={(value) => {
                        setQ(value);
                        setOffset(0);
                      }}
                      view={catalogueView}
                      onViewChange={setCatalogueView}
                      placeholder="Search creatures…"
                    />
                    <div className="sw-encounter-catalogue-heading">
                      <p className="v12-kicker">Creature catalogue</p>
                      <small>Click to preview · + to add</small>
                    </div>
                    <div
                      className={`sw-encounter-catalogue ${catalogueView === "GRID" ? "is-grid" : "is-list"}`}
                    >
                      {catalogue.map((monster) => {
                        const quantity =
                          draft.entries.find(
                            (e) =>
                              e.templateId === monster.id &&
                              e.version === monster.version,
                          )?.quantity ?? 0;
                        return (
                          <article
                            key={monster.id}
                            data-preview-trigger="true"
                            className={`sw-encounter-catalogue-row${preview?.id === monster.id ? " is-selected" : ""}`}
                          >
                            <button
                              type="button"
                              className="sw-encounter-catalogue-opener"
                              aria-label={`Preview ${monster.name}`}
                              onClick={() =>
                                setPreview({
                                  id: monster.id,
                                  version: monster.version,
                                  entry: monster,
                                })
                              }
                            >
                              <span className="v12-entry-glyph">
                                <EntityTypeIcon type="MONSTER" size={24} />
                              </span>
                              <span className="sw-encounter-catalogue-copy">
                                <strong>{monster.name}</strong>
                                {monster.concept && (
                                  <span className="sw-catalogue-row-summary">
                                    {monster.concept
                                      .split("**Encounter use:")[0]
                                      ?.replace(/[*_`]/g, "")}
                                  </span>
                                )}
                                <small>
                                  {monster.catalogue?.environment ?? "Creature"}{" "}
                                  · {monster.catalogue?.role ?? "Versatile"}
                                  {quantity ? ` · ${quantity} selected` : ""}
                                </small>
                              </span>
                            </button>
                            <div className="sw-encounter-catalogue-end">
                              <b>{monster.budget} BU</b>
                              <div>
                                <CatalogueQuickLook name={monster.name}>
                                  <MonsterQuickDetails
                                    id={monster.id}
                                    version={monster.version}
                                    concept={monster.concept}
                                    tactics={monster.catalogue?.tactics}
                                  />
                                </CatalogueQuickLook>
                                <button
                                  type="button"
                                  className="sw-metal-button sw-encounter-icon-action"
                                  aria-label={`Add ${monster.name}`}
                                  title={`Add ${monster.name}`}
                                  disabled={busy || quantity >= 200}
                                  onClick={() => void add(monster)}
                                >
                                  <Plus size={18} />
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                      {catalogueLoading ? (
                        <p role="status">Loading creatures…</p>
                      ) : (
                        !catalogue.length && <p>No matching creatures.</p>
                      )}
                    </div>
                    <nav
                      className="sw-encounter-actions"
                      aria-label="Creature pages"
                    >
                      <button
                        type="button"
                        className="sw-metal-button"
                        disabled={!offset || catalogueLoading}
                        onClick={() => setOffset(Math.max(0, offset - 24))}
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        className="sw-metal-button"
                        disabled={!hasMore || catalogueLoading}
                        onClick={() => setOffset(offset + 24)}
                      >
                        More creatures
                      </button>
                    </nav>
                  </>
                )}
              </div>
              <aside
                className="sw-encounter-selection-pane"
                aria-label={preview ? "Creature preview" : "Selected creatures"}
              >
                <button
                  type="button"
                  className="sw-metal-button sw-encounter-mobile-browse"
                  onClick={() => {
                    setSelectionOpen(false);
                    setPreview(null);
                  }}
                >
                  <ArrowLeft size={16} />
                  Browse creatures
                </button>
                <div className="sw-encounter-selection-tabs">
                  <button
                    type="button"
                    className="sw-metal-button"
                    aria-pressed={!preview}
                    onClick={() => {
                      setPreview(null);
                      setSelectionOpen(true);
                    }}
                  >
                    Roster <b>{appraisal.count}</b>
                  </button>
                  <span>
                    {preview
                      ? "Creature preview"
                      : `${appraisal.enemyBu} BU + ${appraisal.enemyItemBu} Item`}
                  </span>
                </div>
                {preview ? (
                  <div className="sw-encounter-preview">
                    <button
                      type="button"
                      className="sw-metal-button sw-encounter-add-preview"
                      disabled={busy}
                      onClick={() => {
                        const found =
                          preview.entry ??
                          catalogue.find(
                            (m) =>
                              m.id === preview.id &&
                              m.version === preview.version,
                          );
                        const selected = creatures.find(
                          (c) =>
                            c.templateId === preview.id &&
                            c.version === preview.version,
                        );
                        if (found) void add(found);
                        else if (selected)
                          void add({
                            id: preview.id,
                            version: preview.version,
                            name: selected.name ?? "Creature",
                            budget: selected.budget ?? 0,
                          });
                      }}
                    >
                      <Plus size={16} />
                      Add to encounter
                    </button>
                    <MonsterTemplatePreview
                      key={`${preview.id}:${preview.version}`}
                      id={preview.id}
                      version={preview.version}
                      compact
                      hideActions
                    />
                  </div>
                ) : (
                  <div className="sw-encounter-selected">
                    {" "}
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
                          data-preview-trigger="true"
                        >
                          <EntityTypeIcon type="MONSTER" />
                          <div>
                            <button
                              type="button"
                              className="sw-encounter-selected-opener"
                              data-quick-look-opener
                              disabled={c?.unavailable}
                              onClick={() =>
                                setPreview({
                                  id: entry.templateId,
                                  version: entry.version,
                                })
                              }
                            >
                              <strong>{c?.name ?? "Creature"}</strong>
                            </button>
                            <small>
                              {c?.unavailable
                                ? "Access unavailable"
                                : `${c?.budget ?? "…"} BU + ${c?.itemBu ?? "…"} Item BU · v${entry.version}`}
                            </small>
                          </div>
                          <label>
                            <span className="sr-only">Quantity</span>
                            <input
                              type="number"
                              aria-label={`Quantity for ${c?.name ?? "creature"}`}
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
                            className="sw-metal-button sw-encounter-icon-action"
                            aria-label={`Remove ${c?.name ?? "creature"}`}
                            title="Remove creature"
                            onClick={() =>
                              patch({
                                entries: draft.entries.filter(
                                  (_, i) => i !== index,
                                ),
                              })
                            }
                          >
                            <X size={16} />
                          </button>
                          {!c?.unavailable && (
                            <button
                              className="sw-metal-button sw-encounter-icon-action"
                              aria-label={`Preview ${c?.name ?? "creature"}`}
                              title="Preview creature"
                              onClick={() => {
                                setPreview({
                                  id: entry.templateId,
                                  version: entry.version,
                                });
                              }}
                            >
                              <Eye size={16} />
                            </button>
                          )}
                          {!c?.unavailable && (
                            <CatalogueQuickLook name={c?.name ?? "Creature"}>
                              <MonsterQuickDetails
                                id={entry.templateId}
                                version={entry.version}
                                tactics={c?.tactics}
                              />
                            </CatalogueQuickLook>
                          )}
                        </div>
                      );
                    })}
                    {!!draft.entries.length && (
                      <button
                        type="button"
                        className="sw-encounter-text-action"
                        disabled={busy}
                        onClick={() => {
                          patch({ entries: [] });
                          setCreatures([]);
                        }}
                      >
                        Clear roster
                      </button>
                    )}
                    <EncounterBudgetReadout
                      draft={draft}
                      appraisal={appraisal}
                      onEditParty={() => {
                        setStage(1);
                        setSelectionOpen(false);
                        setPreview(null);
                      }}
                    />
                    {!draft.entries.length && (
                      <p className="sw-encounter-help">
                        Add a template, then choose how many creatures will
                        appear.
                      </p>
                    )}
                  </div>
                )}
              </aside>
            </section>
            <section className="sw-encounter-chapter" hidden={stage !== 3}>
              {" "}
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
                  Numbers, positioning, control and coordinated abilities
                  matter.
                </p>
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
                      <small>
                        {new Date(r.createdAt).toLocaleDateString()}
                      </small>
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
          </ForgeWorkbench>
        </fieldset>
      )}
    </main>
  );
}
