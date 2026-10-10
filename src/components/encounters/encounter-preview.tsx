"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Swords, Users, Shield, ArrowUpRight } from "lucide-react";
import { useModalStack } from "@/components/ui/modal-stack";
import { MonsterTemplatePreview } from "@/components/monsters/monster-template-preview";
import { Markdown } from "@/components/ui/markdown";
import { EncounterActions, encounterVisibilityLabel } from "./encounter-card";
import type {
  EncounterDefinition,
  CreatureSummary,
  appraiseEncounter,
} from "@/lib/encounters/model";
import "./encounters.css";
export type EncounterPreviewData = {
  id: string;
  revision: number;
  isOwner: boolean;
  definition: EncounterDefinition;
  creatures: CreatureSummary[];
  runs: { id: string; name: string; createdAt: string }[];
  appraisal: ReturnType<typeof appraiseEncounter>;
};
export function EncounterPreview({
  id,
  initial,
}: {
  id: string;
  initial?: EncounterPreviewData;
}) {
  const { userId, isLoaded } = useAuth();
  const [initialViewer] = useState(userId);
  if (!isLoaded) return <p role="status">Loading encounter preparation…</p>;
  return (
    <AccountEncounterPreview
      key={`${userId ?? "anonymous"}:${id}`}
      id={id}
      {...(initial && initialViewer === userId ? { initial } : {})}
    />
  );
}
function AccountEncounterPreview({
  id,
  initial,
}: {
  id: string;
  initial?: EncounterPreviewData;
}) {
  const [data, setData] = useState(initial ?? null),
    [error, setError] = useState("");
  const stack = useModalStack();
  useEffect(() => {
    if (initial) return;
    const controller = new AbortController();
    fetch(`/api/encounters/${id}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error ?? "Encounter unavailable.");
        if (!controller.signal.aborted) setData(result);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason.message);
      });
    return () => controller.abort();
  }, [id, initial]);
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p role="status">Loading encounter preparation…</p>;
  const { definition: d, appraisal: a } = data;
  return (
    <div className="sw-encounter-readout">
      <header className="sw-encounter-readout-header">
        <span className="sw-encounter-entry-glyph">
          <Swords size={26} />
        </span>
        <div>
          <p className="v12-kicker">
            {encounterVisibilityLabel(d.visibility)} · Encounter preparation
          </p>
          <h2>{d.name}</h2>
        </div>
      </header>
      <EncounterActions
        row={{
          id,
          revision: data.revision,
          isOwner: data.isOwner,
          creatureCount: a.count,
          unavailable: a.missing,
          latestRunId: data.runs[0]?.id ?? null,
        }}
      />
      <div className="sw-encounter-readout-meters">
        <section>
          <Swords size={18} />
          <h3>Opposition</h3>
          <strong>{a.missing ? "Incomplete" : `${a.enemyBu} BU`}</strong>
          <small>
            + {a.missing ? "—" : a.enemyItemBu} Item BU · {a.count} creatures
          </small>
        </section>
        <section>
          <Users size={18} />
          <h3>Party</h3>
          <strong>{d.partyBu ?? "—"} BU</strong>
          <small>
            + {d.partyItemBu ?? "—"} Item BU
            {d.partySize ? ` · ${d.partySize} characters` : ""}
          </small>
        </section>
      </div>
      {a.ratio !== null && (
        <p className="sw-encounter-readout-comparison">
          <Shield size={15} />
          Opposition / party {a.ratio.toFixed(2)}× · difference{" "}
          {a.difference! > 0 ? "+" : ""}
          {a.difference} combined BU
        </p>
      )}
      {d.note && (
        <section className="sw-encounter-readout-note">
          <h3 className="v12-kicker">At the table</h3>
          <Markdown copyRole="narrative">{d.note}</Markdown>
        </section>
      )}
      <section>
        <h3 className="v12-kicker">The opposition · pinned versions</h3>
        <div className="sw-encounter-readout-roster">
          {d.entries.map((entry) => {
            const creature = data.creatures.find(
              (c) =>
                c.templateId === entry.templateId &&
                c.version === entry.version,
            );
            return (
              <div key={`${entry.templateId}:${entry.version}`}>
                <span className="sw-encounter-readout-quantity">
                  {entry.quantity}×
                </span>
                <div>
                  <strong>{creature?.name ?? "Unavailable creature"}</strong>
                  <small>
                    {creature?.unavailable
                      ? "Template no longer accessible"
                      : `${creature?.budget ?? 0} BU + ${creature?.itemBu ?? 0} Item BU each · v${entry.version}`}
                  </small>
                  {creature?.role && (
                    <small>
                      {creature.environment} · {creature.role}
                    </small>
                  )}
                  {creature?.tactics && (
                    <p data-copy-role="narrative">{creature.tactics}</p>
                  )}
                </div>
                {creature && !creature.unavailable && (
                  <button
                    type="button"
                    className="sw-metal-button"
                    aria-label={`Preview ${creature.name}`}
                    onClick={() => {
                      if (stack.canPush)
                        stack.push({
                          key: `encounter-monster:${entry.templateId}:${entry.version}`,
                          label: creature.name,
                          category: "MONSTER",
                          content: (
                            <MonsterTemplatePreview
                              id={entry.templateId}
                              version={entry.version}
                              compact
                            />
                          ),
                        });
                    }}
                  >
                    <ArrowUpRight size={16} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>
      <p className="sw-encounter-help">
        Comparable BU totals do not guarantee comparable difficulty. Starting
        creates independent private creature sheets. Rhythm, notes and gameplay
        are saved in your own run.
      </p>
      {data.runs.length > 0 && (
        <section>
          <h3 className="v12-kicker">Your saved runs</h3>
          <div className="sw-encounter-readout-runs">
            {data.runs.map((run) => (
              <Link
                key={run.id}
                className="sw-metal-button"
                href={`/encounters/runs/${run.id}`}
              >
                {run.name}
                <small>{new Date(run.createdAt).toLocaleDateString()}</small>
                <ArrowUpRight size={14} />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
