"use client";
import { useEffect, useRef, useState } from "react";
import { Shuffle, Check, Eye } from "lucide-react";
import { CatalogueQuickLook } from "@/components/library/catalogue-quick-look";
import { MonsterQuickDetails } from "@/components/monsters/monster-quick-details";
import { EntityTypeIcon } from "@/components/icons/entity-type-icon";
import type {
  EncounterDefinition,
  CreatureSummary,
} from "@/lib/encounters/model";
import type { EncounterGroup } from "@/lib/encounters/groups";

export function EncounterGroupPicker({
  partyBu,
  partySize,
  environment,
  role,
  disabled,
  selected,
  onChoose,
  onPreview,
}: {
  partyBu: number | null;
  partySize: number | null;
  environment: string;
  role: string;
  disabled: boolean;
  selected: EncounterDefinition["entries"];
  onChoose: (group: EncounterGroup) => void;
  onPreview: (creature: CreatureSummary) => void;
}) {
  const [customBudget, setCustomBudget] = useState("100");
  const [usePartyBudget, setUsePartyBudget] = useState(true);
  const budget =
    usePartyBudget && partyBu !== null && partyBu > 0
      ? String(partyBu)
      : customBudget;
  const [lastLimits, setLastLimits] = useState("");
  const [count, setCount] = useState(String(Math.min(20, partySize ?? 4)));
  const [items, setItems] = useState("");
  const [groups, setGroups] = useState<EncounterGroup[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const signature = (group: EncounterGroup) =>
    group.entries
      .map((e) => `${e.templateId}:${e.version}:${e.quantity}`)
      .sort()
      .join("|");
  const chosen = selected
    .map((e) => `${e.templateId}:${e.version}:${e.quantity}`)
    .sort()
    .join("|");
  async function shuffle() {
    if (pending) return;
    const limit = Number(budget),
      size = Number(count),
      itemLimit = items === "" ? null : Number(items);
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
          itemLimit > 10_000_000))
    ) {
      setError(
        "Enter a positive BU limit, 1–20 creatures, and an optional non-negative Item BU limit.",
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
          itemBudget: itemLimit,
          environment,
          role,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not suggest a group.");
      setGroups(data.groups);
      setLastLimits(
        `${size} creatures · up to ${limit} BU${itemLimit === null ? " · equipment uncapped" : ` · up to ${itemLimit} Item BU`} · ${environment || "all environments"} · ${role || "mixed roles"}`,
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
      <div className="sw-encounter-group-heading">
        <div>
          <p className="v12-kicker">Suggested groups</p>
          <h3>A starting cast for your encounter</h3>
          <p>
            Set the limits, shuffle, then inspect a group. Choose one to replace
            your selected creatures.
          </p>
        </div>
      </div>
      <div className="sw-encounter-shuffle-controls">
        <label>
          Creature BU limit
          <input
            type="number"
            min="1"
            max="10000000"
            step="1"
            value={budget}
            onChange={(event) => {
              setCustomBudget(event.target.value);
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
            onChange={(event) => setCount(event.target.value)}
          />
        </label>
        <label>
          Item BU limit <small>optional</small>
          <input
            type="number"
            min="0"
            max="10000000"
            step="1"
            placeholder="No limit"
            value={items}
            onChange={(event) => setItems(event.target.value)}
          />
        </label>
      </div>
      <div className="sw-encounter-actions">
        {partyBu !== null && partyBu > 0 && (
          <button
            type="button"
            className="sw-metal-button"
            onClick={() => setUsePartyBudget(true)}
          >
            Use party BU · {partyBu}
          </button>
        )}
        <button
          type="button"
          className="sw-metal-button"
          disabled={pending || disabled}
          onClick={() => void shuffle()}
        >
          <Shuffle size={17} />
          {pending
            ? "Finding groups…"
            : groups.length
              ? "Shuffle again"
              : "Shuffle groups"}
        </button>
      </div>
      <p className="sw-encounter-help">
        {environment || "All environments"} · {role || "Mixed roles"}. Creature
        and equipment limits stay separate. Similar totals do not guarantee
        similar difficulty.
      </p>
      {error && <p role="alert">{error}</p>}
      {groups.length > 0 && (
        <p className="sw-encounter-help">Last shuffle: {lastLimits}</p>
      )}
      <div className="sw-encounter-group-options">
        {groups.map((group, index) => (
          <section
            key={signature(group)}
            className={`sw-encounter-group-card${chosen === signature(group) ? " is-chosen" : ""}`}
          >
            <header>
              <span className="sw-encounter-group-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3>Group {index + 1}</h3>
                <small>
                  {group.count} creatures · {group.creatureBu} BU +{" "}
                  {group.itemBu} Item BU
                </small>
              </div>
            </header>
            {group.entries.map((entry) => {
              const creature = group.creatures.find(
                (c) =>
                  c.templateId === entry.templateId &&
                  c.version === entry.version,
              )!;
              return (
                <article
                  key={`${entry.templateId}:${entry.version}`}
                  data-preview-trigger="true"
                  className="sw-encounter-group-creature"
                >
                  <CatalogueQuickLook name={creature.name}>
                    <MonsterQuickDetails
                      id={entry.templateId}
                      version={entry.version}
                      tactics={creature.tactics}
                    />
                  </CatalogueQuickLook>
                  <span className="v12-entry-glyph">
                    <EntityTypeIcon type="MONSTER" size={20} />
                  </span>
                  <button
                    type="button"
                    className="sw-encounter-group-opener"
                    data-quick-look-opener
                    onClick={() => onPreview(creature)}
                  >
                    <strong>
                      {entry.quantity} × {creature.name}
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
                </article>
              );
            })}
            <button
              type="button"
              className="sw-metal-button sw-encounter-choose-group"
              disabled={disabled || pending}
              aria-pressed={chosen === signature(group)}
              onClick={() => {
                onChoose(group);
              }}
            >
              <Check size={16} />
              {chosen === signature(group)
                ? "Group chosen"
                : "Choose this group"}
            </button>
          </section>
        ))}
      </div>
      {!groups.length && !pending && (
        <div className="sw-encounter-group-empty">
          <Shuffle size={26} />
          <p>
            Shuffle to discover up to three different groups within your limits.
          </p>
          <small>You can fine-tune any group in Choose creatures.</small>
        </div>
      )}
    </div>
  );
}
