"use client";
import { useState } from "react";

type VersionPage = { versions: Array<{ id: string; versionNumber: number; publishedAt: string }>; nextBefore: number | null };

export function ForkNodeVersions({ targetType, targetId }: { targetType: string; targetId: string }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<VersionPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  async function load(before?: number) {
    setLoading(true); setError(false);
    try {
      const query = new URLSearchParams({ targetType, targetId });
      if (before) query.set("before", String(before));
      const response = await fetch(`/api/versions/list?${query}`);
      if (!response.ok) throw new Error("Unavailable");
      const next = await response.json() as VersionPage;
      setPage(previous => before && previous ? { ...next, versions: [...previous.versions, ...next.versions] } : next);
    } catch { setError(true); } finally { setLoading(false); }
  }
  return <div className="v12-node-versions">
    <button type="button" aria-expanded={open} onClick={() => { setOpen(!open); if (!open && !page && !loading) void load(); }}>Versions {open ? "▴" : "▾"}</button>
    {open ? <div className="v12-node-version-list">
      {page?.versions.map(version => <a key={version.id} href={`/library/item/${targetType}:${targetId}/versions#v${version.versionNumber}`}><b>v{version.versionNumber}</b><time dateTime={version.publishedAt}>{new Date(version.publishedAt).toLocaleDateString()}</time></a>)}
      {page?.versions.length === 0 ? <p>No published versions yet.</p> : null}
      {error ? <button type="button" onClick={() => void load(page?.nextBefore ?? undefined)}>Retry loading versions</button> : null}
      {loading ? <p role="status">Loading versions…</p> : page?.nextBefore ? <button type="button" onClick={() => void load(page.nextBefore!)}>Earlier versions</button> : null}
    </div> : null}
  </div>;
}
