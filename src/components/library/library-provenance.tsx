"use client";

import { useEffect, useState } from "react";
import type { ForkMapResult } from "@/lib/publishing/fork-map";

export function LibraryProvenance({ targetType, targetId, name, author }: { targetType: string; targetId: string; name: string; author: string }) {
  const [result, setResult] = useState<{ key: string; data?: ForkMapResult; failed?: boolean } | null>(null);
  const key = `${targetType}:${targetId}`;
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ targetType, targetId, limit: "1" });
    fetch(`/api/forks/map?${params}`, { signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error("Lineage unavailable"); return response.json() as Promise<ForkMapResult>; })
      .then(data => setResult({ key, data }))
      .catch(() => { if (!controller.signal.aborted) setResult({ key, failed: true }); });
    return () => controller.abort();
  }, [key, targetId, targetType]);
  const data = result?.key === key ? result.data : undefined;
  const root = data?.ancestry[0];
  const parent = data?.ancestry.at(-1);
  return <div className="v12-provenance-chain">
    {root ? <div><b>Root entry</b><a href={`/library/item/${root.key}`}>{root.name ?? root.key}</a>{root.authorName ? <small>by {root.authorName}</small> : null}</div> : null}
    {parent ? <div><b>Direct parent</b><a href={`/library/item/${parent.key}`}>{parent.name ?? parent.key}</a>{parent.authorName ? <small>by {parent.authorName}</small> : null}</div> : null}
    <div><b>This entry</b><span>{name}</span><small>by {author}</small></div>
    {!data ? <p role="status">{result?.key === key && result.failed ? "Lineage could not be loaded. Open the source page to inspect its provenance." : "Loading source lineage…"}</p> : <p>{data.ancestry.length ? `${data.ancestry.length} ancestors` : "No recorded parent"} · {data.totalChildren} direct forks</p>}
  </div>;
}
