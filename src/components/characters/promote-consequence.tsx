"use client";
import { useRef, useState } from "react";
import { PrimitiveForm } from "@/components/sandbox/primitive-form";
import type { ConsequenceOccurrence } from "@/lib/character/consequences/types";
export function PromoteConsequence({
  characterId,
  occurrence,
  onClose,
}: {
  characterId: string;
  occurrence: ConsequenceOccurrence;
  onClose: () => void;
}) {
  const [sourceOccurrence] = useState(occurrence);
  const [initialPrimitive] = useState(() => ({
    id: 0,
    name: sourceOccurrence.title,
    category: "CONDITION",
    isPublic: false,
    costTier: "Tier 1: Minor (4 BU anchor)",
    buCost: 1,
    mechanicalOutputText: sourceOccurrence.description,
    narrativeRule: sourceOccurrence.description,
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    mirrorEligibilityNotes: "",
    hardModifiers: sourceOccurrence.modifiers,
    tags: [...sourceOccurrence.tags],
    sourceOrigin: "manual",
    iconSource: null,
    iconKey: null,
    iconUrl: null,
    iconColor: "#ffffff",
    consequenceBehavior: {
      timing: "on-use" as const,
      vitalityDelta: sourceOccurrence.applicationSnapshot?.vitalityDelta ?? 0,
      restrictions: sourceOccurrence.restrictions ?? [],
      recovery: sourceOccurrence.recovery ?? "",
    },
  }));
  const command = useRef<{ draft: string; body: string; id: string } | null>(
    null,
  );
  const saveRequest: typeof fetch = async (_url, init) => {
    const draft = String(init?.body ?? "{}");
    if (command.current?.draft !== draft) {
      const response = await fetch(
        `/api/characters/${characterId}/consequences`,
        { cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok) return response;
      const record = data.records.find(
        (r: { id: string }) => r.id === occurrence.id,
      );
      if (!record)
        return Response.json(
          { error: "Wait for this consequence to sync before promoting." },
          { status: 409 },
        );
      if (canonical(record.occurrence) !== canonical(sourceOccurrence))
        return Response.json(
          {
            error:
              "This consequence changed. Close and reopen promotion to review the latest content.",
          },
          { status: 409 },
        );
      command.current = {
        draft,
        body: JSON.stringify({
          expectedRevision: record.revision,
          draft: JSON.parse(draft),
        }),
        id: crypto.randomUUID(),
      };
    }
    const { body, id } = command.current;
    return fetch(
      `/api/characters/${characterId}/consequences/${encodeURIComponent(occurrence.id)}/promote`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...JSON.parse(body), commandId: id }),
      },
    );
  };
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Promote consequence to primitive"
        className="mx-auto max-w-3xl space-y-3 rounded-lg border border-border bg-card p-5"
      >
        <div className="flex justify-between">
          <h2 className="text-xl font-semibold">Promote to primitive</h2>
          <button onClick={onClose}>Close</button>
        </div>
        <p className="text-sm text-muted-foreground">
          Save a reusable definition. This does not apply the consequence again
          or add another contribution to this character.
        </p>
        <PrimitiveForm
          saveRequest={saveRequest}
          intent={null}
          sourceId={null}
          initialPrimitive={initialPrimitive}
          onSaved={() => {
            window.dispatchEvent(new Event("focus"));
            window.dispatchEvent(new CustomEvent("sw:library-changed"));
            onClose();
          }}
        />
      </div>
    </div>
  );
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
