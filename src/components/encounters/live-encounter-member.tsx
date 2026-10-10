"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  Heart,
  Minus,
  Plus,
  ChevronDown,
  Swords,
  Shield,
} from "lucide-react";
import { EntityTypeIcon } from "@/components/icons/entity-type-icon";
import { usePlaySession } from "@/lib/hooks/use-play-session";
import {
  getEffectivePlayState,
  getPlaySessionMaximum,
  queuePlayChanges,
  retryPlaySync,
  resolvePlayConflict,
} from "@/lib/play-state/client-sync";
import { adjustVitality, type ActorMarker } from "@/lib/encounters/run-state";
import { Markdown } from "@/components/ui/markdown";
import { MarkerControls } from "./live-encounter-controls";

export type LiveMember = {
  id: string;
  copyId: string | null;
  name: string;
  currentVitality?: number;
  maximum?: number;
  budget?: number;
  itemBu?: number;
  tactics?: string;
  unavailable?: boolean;
  role?: string;
  artwork?: string | null;
  attack?: number;
  saveDc?: number;
  speed?: number;
  attributes?: { physical: number; mental: number; magical: number };
  consequences?: { id: string; title: string; recovery: string }[];
};
export function LiveEncounterMember({
  member,
  marker,
  active,
  disabled,
  onMarker,
  onOpen,
  onSaved,
}: {
  member: LiveMember;
  marker: ActorMarker;
  active: boolean;
  disabled: boolean;
  onMarker: (value: Partial<ActorMarker>) => void;
  onOpen: () => void;
  onSaved: () => void;
}) {
  const root = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false),
    [vitalityOpen, setVitalityOpen] = useState(false),
    [amount, setAmount] = useState("1"),
    [error, setError] = useState("");
  useEffect(() => {
    if (!root.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!!entry?.isIntersecting),
      { rootMargin: "200px" },
    );
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  const { session } = usePlaySession(
    "MONSTER_PLAY_COPY",
    member.copyId,
    member.copyId
      ? `/api/monsters/copies/${member.copyId}?session=1`
      : undefined,
    undefined,
    { method: "PATCH", enabled: !member.unavailable && (visible || active) },
  );
  const lastRevision = useRef<number | null>(null);
  useEffect(() => {
    if (!session.ready) return;
    if (
      lastRevision.current !== null &&
      lastRevision.current !== session.state.revision
    )
      onSaved();
    lastRevision.current = session.state.revision;
  }, [session.ready, session.state.revision, onSaved]);
  const state =
    member.copyId && session.ready
      ? getEffectivePlayState("MONSTER_PLAY_COPY", member.copyId).overrides
      : {};
  const maximum =
    (member.copyId && session.ready
      ? getPlaySessionMaximum("MONSTER_PLAY_COPY", member.copyId)
      : undefined) ??
    member.maximum ??
    0;
  const current = Math.min(
    maximum,
    typeof state["currentVitality"] === "number"
      ? state["currentVitality"]
      : (member.currentVitality ?? 0),
  );
  const canChange =
    !!member.copyId &&
    !member.unavailable &&
    session.ready &&
    !disabled &&
    !["conflict", "legacy", "error"].includes(session.status);
  function adjust(direction: "damage" | "heal") {
    if (!member.copyId || !canChange) return;
    try {
      queuePlayChanges("MONSTER_PLAY_COPY", member.copyId, [
        {
          field: "currentVitality",
          value: adjustVitality(current, maximum, Number(amount), direction),
        },
      ]);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <article
      ref={root}
      className={`sw-live-member${active ? " is-active" : ""}${marker.resolved ? " is-resolved" : ""}${marker.presence === "withdrawn" ? " is-withdrawn" : ""}`}
      aria-label={member.name}
    >
      <div className="sw-live-member-top">
        <button
          type="button"
          className="sw-live-opener"
          disabled={member.unavailable || !member.copyId}
          onClick={onOpen}
          aria-expanded={active}
          aria-label={`Inspect ${member.name}`}
        >
          <span className="sw-live-portrait">
            {member.artwork ? (
              <Image
                src={member.artwork}
                alt=""
                width={36}
                height={36}
                unoptimized
              />
            ) : (
              <EntityTypeIcon type="MONSTER" size={27} />
            )}
          </span>
          <span>
            <strong>{member.name}</strong>
            <small>
              {member.unavailable
                ? "Play copy removed"
                : `${member.role ?? "Creature"} · ${member.budget ?? "—"} BU + ${member.itemBu ?? "—"} Item`}
              {marker.presence === "withdrawn" ? " · Withdrawn" : ""}
            </small>
          </span>
        </button>
        {!member.unavailable && (
          <button
            type="button"
            className="sw-live-vitality-button"
            onClick={() => setVitalityOpen(!vitalityOpen)}
            aria-expanded={vitalityOpen}
            aria-label={`Vitality controls for ${member.name}`}
          >
            <Heart size={12} />
            <strong>{current}</strong>
            <span>/ {maximum}</span>
            <ChevronDown size={12} />
          </button>
        )}
      </div>
      {!member.unavailable && (
        <div
          className="sw-live-vitality-meter"
          role="meter"
          aria-label={`${member.name} Vitality`}
          aria-valuenow={current}
          aria-valuemin={0}
          aria-valuemax={Math.max(1, maximum)}
        >
          <span
            style={{ width: `${maximum ? (current / maximum) * 100 : 0}%` }}
          />
        </div>
      )}
      {current === 0 && !member.unavailable && (
        <p className="sw-live-zero">
          0 Vitality · resolve the outcome at your table.
        </p>
      )}
      {vitalityOpen && (
        <div className="sw-live-vitality-editor">
          <label>
            Amount
            <input
              aria-label={`Vitality amount for ${member.name}`}
              type="number"
              min={1}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={disabled}
            />
          </label>
          <button
            type="button"
            className="sw-metal-button"
            disabled={
              !canChange ||
              !Number.isSafeInteger(Number(amount)) ||
              Number(amount) < 1
            }
            onClick={() => adjust("damage")}
          >
            <Minus size={14} />
            Damage
          </button>
          <button
            type="button"
            className="sw-metal-button"
            disabled={
              !canChange ||
              !Number.isSafeInteger(Number(amount)) ||
              Number(amount) < 1
            }
            onClick={() => adjust("heal")}
          >
            <Plus size={14} />
            Heal
          </button>
          <small role="status">
            {session.status === "saved"
              ? "Vitality saved"
              : session.status === "offline"
                ? "Offline · changes queued"
                : session.status === "loading"
                  ? "Opening creature controls…"
                  : session.status === "pending"
                    ? "Saving Vitality…"
                    : "Creature session needs attention"}
          </small>
          {session.status === "error" && member.copyId && (
            <button
              type="button"
              className="sw-metal-button"
              onClick={() => retryPlaySync("MONSTER_PLAY_COPY", member.copyId!)}
            >
              Retry creature sync
            </button>
          )}
          {["conflict", "legacy"].includes(session.status) && member.copyId && (
            <>
              <p role="alert">
                Creature state differs on another device. Choose which changes
                to keep.
              </p>
              {(["local", "server"] as const).map((choice) => (
                <button
                  type="button"
                  className="sw-metal-button"
                  key={choice}
                  onClick={() =>
                    void resolvePlayConflict(
                      "MONSTER_PLAY_COPY",
                      member.copyId!,
                      choice,
                    ).catch((e) => setError(e.message))
                  }
                >
                  {choice === "local"
                    ? "Keep local changes"
                    : "Use saved creature"}
                </button>
              ))}
            </>
          )}
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      <MarkerControls
        name={member.name}
        value={marker}
        disabled={disabled || !!member.unavailable}
        onChange={onMarker}
      />
      {!!member.consequences?.length && (
        <div
          className="sw-live-consequence-tags"
          aria-label="Ongoing consequences"
        >
          {member.consequences.map((c) => (
            <span
              key={c.id}
              title={c.recovery || "Resolve through the creature sheet."}
            >
              {c.title}
            </span>
          ))}
        </div>
      )}
      <details className="sw-live-member-reference">
        <summary>
          Stats & tactics <ChevronDown size={13} />
        </summary>
        <div className="sw-live-stat-strip">
          <span>
            <Swords size={12} />
            ATK {member.attack ?? "—"}
          </span>
          <span>
            <Shield size={12} />
            DC {member.saveDc ?? "—"}
          </span>
          <span>Speed {member.speed ?? "—"}</span>
          {member.attributes && (
            <span>
              PHY {member.attributes.physical} · MEN {member.attributes.mental}{" "}
              · MAG {member.attributes.magical}
            </span>
          )}
        </div>
        {member.tactics && <Markdown>{member.tactics}</Markdown>}
        <label>
          Encounter presence
          <select
            aria-label={`Encounter presence for ${member.name}`}
            value={marker.presence ?? "in-play"}
            disabled={disabled}
            onChange={(e) =>
              onMarker({ presence: e.target.value as "in-play" | "withdrawn" })
            }
          >
            <option value="in-play">In play</option>
            <option value="withdrawn">Withdrawn / left the scene</option>
          </select>
        </label>
        {member.copyId && (
          <Link
            href={`/monsters/play/${member.copyId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open full sheet <ArrowUpRight size={13} />
          </Link>
        )}
      </details>
    </article>
  );
}
