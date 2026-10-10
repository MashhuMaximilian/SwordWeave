"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Shuffle, Check, Eye, Crown } from "lucide-react";
import { CatalogueQuickLook } from "@/components/library/catalogue-quick-look";
import { MonsterQuickDetails } from "@/components/monsters/monster-quick-details";
import { MonsterPortrait } from "@/components/monsters/monster-portrait";
import type {
  EncounterDefinition,
  CreatureSummary,
} from "@/lib/encounters/model";
import { groupBudgetLimit, type EncounterGroup } from "@/lib/encounters/groups";

export function EncounterGroupPicker({
  partyBu,
  partySize,
  disabled,
  selected,
  onChoose,
  onPreview,
}: {
  partyBu: number | null;
  partySize: number | null;
  disabled: boolean;
  selected: EncounterDefinition["entries"];
  onChoose: (group: EncounterGroup) => void;
  onPreview: (creature: CreatureSummary) => void;
}) {
  const id = useId();
  const [mode, setMode] = useState<"total" | "perCreature">("total");
  const [customBudget, setCustomBudget] = useState("100"),
    [usePartyBudget, setUsePartyBudget] = useState(true);
  const budget =
    usePartyBudget && partyBu !== null && partyBu > 0
      ? String(partyBu)
      : customBudget;
  const [customCount, setCustomCount] = useState<string | null>(null);
  const count =
    customCount ?? String(Math.max(1, Math.min(20, partySize ?? 4)));
  const [items, setItems] = useState(""),
    [boss, setBoss] = useState("");
  const [groups, setGroups] = useState<EncounterGroup[]>([]),
    [active, setActive] = useState(0);
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [lastLimits, setLastLimits] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const signature = (entries: EncounterDefinition["entries"]) =>
    entries
      .map((e) => `${e.templateId}:${e.version}:${e.quantity}`)
      .sort()
      .join("|");
  const chosen = signature(selected),
    group = groups[active];
  const total = groupBudgetLimit(Number(budget), Number(count), {
    mode,
    bossBudget: boss === "" ? null : Number(boss),
  });
  async function shuffle() {
    if (pending || disabled) return;
    const limit = Number(budget),
      size = Number(count),
      itemLimit = items === "" ? null : Number(items),
      bossLimit = boss === "" ? null : Number(boss);
    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 10_000_000 ||
      !Number.isSafeInteger(size) ||
      size < 1 ||
      size > 20 ||
      (itemLimit !== null &&
        (!Number.isSafeInteger(itemLimit) ||
          itemLimit < 0 ||
          itemLimit > 10_000_000)) ||
      (bossLimit !== null &&
        (!Number.isSafeInteger(bossLimit) ||
          bossLimit < 1 ||
          bossLimit > 10_000_000))
    ) {
      setError(
        "Use whole numbers: a positive creature budget, 1–20 creatures, and optional positive boss / non-negative equipment limits.",
      );
      return;
    }
    setPending(true);
    setError("");
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    try {
      const response = await fetch("/api/encounters/groups", {
        method: "POST",
        cache: "no-store",
        signal: request.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budget: limit,
          count: size,
          mode,
          bossBudget: bossLimit,
          itemBudget: itemLimit,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not suggest a group.");
      if (!Array.isArray(data.groups) || !data.groups.length)
        throw new Error("No complete group fits these limits.");
      setGroups(data.groups);
      setActive(0);
      setLastLimits(
        `${size} creatures · ${mode === "total" ? `${limit} BU total` : `${limit} BU per regular creature`}${bossLimit === null ? "" : ` · boss ≤ ${bossLimit} BU`}${itemLimit === null ? "" : " · equipment ≤ " + itemLimit + " BU"}`,
      );
    } catch (reason) {
      if (!request.signal.aborted)
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not suggest a group.",
        );
    } finally {
      if (!request.signal.aborted) setPending(false);
    }
  }
  return (
    <div className="sw-encounter-group-picker">
      <fieldset
        className="sw-encounter-shuffle-kit"
        disabled={disabled || pending}
      >
        <legend>Build your opposition</legend>
        <div
          className="sw-encounter-budget-mode"
          role="group"
          aria-label="Shuffle budget mode"
        >
          <button
            type="button"
            className="sw-metal-button"
            aria-pressed={mode === "total"}
            onClick={() => setMode("total")}
          >
            Whole group
          </button>
          <button
            type="button"
            className="sw-metal-button"
            aria-pressed={mode === "perCreature"}
            onClick={() => {
              setMode("perCreature");
              setCustomBudget(budget);
              setUsePartyBudget(false);
            }}
          >
            Per creature
          </button>
        </div>
        <div className="sw-encounter-shuffle-controls">
          <label>
            {mode === "total" ? "Total creature BU" : "BU per regular creature"}
            <input
              type="number"
              min="1"
              max="10000000"
              step="1"
              value={budget}
              onChange={(e) => {
                setCustomBudget(e.target.value);
                setUsePartyBudget(false);
              }}
            />
          </label>
          <label>
            Creatures
            <input
              type="number"
              min="1"
              max="20"
              step="1"
              value={count}
              onChange={(e) => setCustomCount(e.target.value)}
            />
          </label>
          <label>
            Boss max BU <small>optional</small>
            <input
              type="number"
              min="1"
              max="10000000"
              step="1"
              placeholder="No boss"
              value={boss}
              onChange={(e) => setBoss(e.target.value)}
            />
          </label>
          <label>
            Group Item BU <small>optional</small>
            <input
              type="number"
              min="0"
              max="10000000"
              step="1"
              placeholder="No limit"
              value={items}
              onChange={(e) => setItems(e.target.value)}
            />
          </label>
        </div>
        <div className="sw-encounter-shuffle-summary">
          <span>
            {Number.isSafeInteger(total) && total > 0
              ? `Up to ${total} creature BU`
              : "Enter your limits"}
            {boss !== "" ? " · includes one boss" : ""}
          </span>
          {partyBu !== null && partyBu > 0 && (
            <button
              type="button"
              className="sw-encounter-text-action"
              onClick={() => {
                setMode("total");
                setUsePartyBudget(true);
              }}
            >
              Use party BU · {partyBu}
            </button>
          )}
        </div>
        {boss !== "" && (
          <p className="sw-encounter-help">
            The boss replaces one regular creature.
            {mode === "total"
              ? " Its BU is included in the whole-group limit."
              : " The other creatures each use the regular limit."}
          </p>
        )}
        <button
          type="button"
          className="sw-metal-button sw-encounter-shuffle-action"
          onClick={() => void shuffle()}
        >
          <Shuffle size={17} />
          {pending
            ? "Finding groups…"
            : groups.length
              ? "Shuffle again"
              : "Shuffle groups"}
        </button>
      </fieldset>
      {error && <p role="alert">{error}</p>}
      {groups.length > 0 && (
        <>
          <div
            className="sw-encounter-group-tabs"
            role="tablist"
            aria-label="Suggested groups"
          >
            {groups.map((option, index) => (
              <button
                type="button"
                key={signature(option.entries)}
                className="sw-metal-button"
                role="tab"
                aria-selected={active === index}
                  aria-controls={`${id}-roster`}
                id={`${id}-option-${index}`}
                tabIndex={active === index ? 0 : -1}
                onClick={() => setActive(index)}
                onKeyDown={(e) => {
                  if (
                    !["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
                  )
                    return;
                  e.preventDefault();
                  const next =
                    e.key === "Home"
                      ? 0
                      : e.key === "End"
                        ? groups.length - 1
                        : (index +
                            (e.key === "ArrowLeft" ? -1 : 1) +
                            groups.length) %
                          groups.length;
                  setActive(next);
                  e.currentTarget.parentElement
                    ?.querySelectorAll<HTMLButtonElement>("button")
                    [next]?.focus();
                }}
              >
                <span>Group {index + 1}</span>
                <small>
                  {option.creatureBu} BU
                  {option.itemBu ? ` + ${option.itemBu} Item` : ""}
                </small>
                {chosen === signature(option.entries) && (
                  <Check size={14} aria-label="Chosen" />
                )}
              </button>
            ))}
          </div>
          <p className="sw-encounter-help sw-encounter-last-limits">
            Generated with: {lastLimits}
          </p>
        </>
      )}
      {group ? (
        <section
          className={`sw-encounter-group-card${chosen === signature(group.entries) ? " is-chosen" : ""}`}
          role="tabpanel"
          id={`${id}-roster`}
          aria-labelledby={`${id}-option-${active}`}
        >
          <header>
            <div>
              <h3>Group {active + 1}</h3>
              <small>
                {group.count} creatures · {group.creatureBu} BU + {group.itemBu}{" "}
                Item BU
              </small>
            </div>
            <button
              type="button"
              className="sw-metal-button"
              disabled={disabled || pending}
              aria-pressed={chosen === signature(group.entries)}
              onClick={() => onChoose(group)}
            >
              <Check size={16} />
              {chosen === signature(group.entries)
                ? "Group chosen"
                : selected.length
                  ? "Replace roster"
                  : "Use this group"}
            </button>
          </header>
          {group.entries.map((entry) => {
            const creature = group.creatures.find(
              (c) =>
                c.templateId === entry.templateId &&
                c.version === entry.version,
            )!;
            const isBoss =
              group.boss?.templateId === entry.templateId &&
              group.boss.version === entry.version;
            return (
              <article
                key={`${entry.templateId}:${entry.version}`}
                data-preview-trigger="true"
                className="sw-encounter-group-creature"
              >
                <span className="v12-entry-glyph">
                  <MonsterPortrait imageUrl={creature.imageUrl} name={creature.name} size={32} />
                </span>
                <button
                  type="button"
                  className="sw-encounter-group-opener"
                  data-quick-look-opener
                  onClick={() => onPreview(creature)}
                >
                  <strong>
                    {entry.quantity} × {creature.name}
                    {isBoss && (
                      <span className="sw-encounter-boss-label">
                        <Crown size={12} />
                        Boss
                      </span>
                    )}
                  </strong>
                  <small>
                    {creature.role || "Creature"} · {creature.budget} BU each
                    {creature.itemBu ? ` + ${creature.itemBu} Item BU` : ""}
                  </small>
                </button>
                <button
                  type="button"
                  className="sw-metal-button sw-encounter-icon-action"
                  aria-label={`Preview ${creature.name}`}
                  onClick={() => onPreview(creature)}
                >
                  <Eye size={16} />
                </button>
                <CatalogueQuickLook name={creature.name}>
                  <MonsterQuickDetails
                    id={entry.templateId}
                    version={entry.version}
                    tactics={creature.tactics}
                  />
                </CatalogueQuickLook>
              </article>
            );
          })}
        </section>
      ) : (
        !pending && (
          <div className="sw-encounter-group-empty">
            <Shuffle size={22} />
            <p>
              Shuffle up to three groups, inspect their creatures, then choose a
              roster.
            </p>
          </div>
        )
      )}
      <p className="sw-encounter-help">
        Creature and equipment BU stay separate. Similar totals do not guarantee
        similar difficulty.
      </p>
    </div>
  );
}
