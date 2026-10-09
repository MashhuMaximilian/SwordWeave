"use client";
import { useEffect, useState } from "react";
import { Markdown } from "@/components/ui/markdown";
import type { MonsterSlot, resolveMonster } from "@/lib/monsters/resolve";

/** Mounted only while quick details are open; no whole-catalogue hydration. */
export function MonsterQuickDetails({
  id,
  version,
  concept = "",
  tactics = "",
}: {
  id: string;
  version?: number;
  concept?: string | undefined;
  tactics?: string | undefined;
}) {
  const [data, setData] = useState<{
    sheet: ReturnType<typeof resolveMonster>;
    slots: MonsterSlot[];
    monster: { definition: { concept: string } };
  } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/monsters/${id}${version ? `?version=${version}` : ""}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("Creature mechanics are currently unavailable.");
        return response.json();
      })
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason.message);
      });
    return () => controller.abort();
  }, [id, version]);
  return (
    <>
      <Markdown copyRole="narrative">
        {data?.monster.definition.concept || concept}
      </Markdown>
      {tactics && (
        <>
          <strong>Tactics</strong>
          <Markdown>{tactics}</Markdown>
        </>
      )}
      {data ? (
        <>
          <p>
            {data.sheet.maximum} Vitality · {data.sheet.spent} creature BU spent
            · {data.sheet.itemBu} Item BU
          </p>
          {data.slots.map((slot, i) => (
            <div key={i} className="sw-catalogue-peek-rule">
              <strong>
                {slot.name}
                {slot.quantity > 1 ? ` × ${slot.quantity}` : ""}
                {slot.isMirrored ? " · Mirrored" : ""}
              </strong>
              <Markdown copyRole="mechanical">
                {slot.mechanicalDescription || slot.name}
              </Markdown>
            </div>
          ))}
        </>
      ) : (
        <p role={error ? "alert" : "status"}>{error || "Loading mechanics…"}</p>
      )}
    </>
  );
}
