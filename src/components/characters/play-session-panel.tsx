"use client";
import { useState } from "react";
import { getEffectivePlayState, getPlaySessionAccountId, getPlaySessionComparison, queuePlayChanges, resolvePlayConflict, retryPlaySync } from "@/lib/play-state/client-sync";
import { consequenceJson } from "@/lib/character/consequences/json";
import { usePlaySession } from "@/lib/hooks/use-play-session";
import { sessionBackup, previewSessionBackup, type PlayOverrides, type SubjectKind } from "@/lib/play-state/model";
export function PlaySessionPanel({ subjectKind = "CHARACTER", subjectId, endpoint, buildRefs, method }: { subjectKind?: SubjectKind; subjectId: string; endpoint?: string; buildRefs?: string[]; method?: "POST" | "PATCH" }) {
  const { session, accountId, isLoaded } = usePlaySession(subjectKind, subjectId, endpoint, buildRefs, method ? { method } : {});
  const [preview, setPreview] = useState<PlayOverrides | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scope = `${accountId}:${subjectKind}:${subjectId}`;
  const [previewScope, setPreviewScope] = useState(scope);
  if (previewScope !== scope) { setPreviewScope(scope); setPreview(null); setError(null); }
  function download() {
    const state = getEffectivePlayState(subjectKind, subjectId);
    const blob = new Blob([JSON.stringify(sessionBackup(subjectKind, subjectId, session?.buildRefs ?? buildRefs ?? [], state), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `swordweave-session-${subjectId}.json`;
    document.body.appendChild(a);
    a.click(); a.remove();
    // Allow the browser to start reading the download before releasing its URL.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function resolve(choice: "local" | "server") { const resolvingAccount = accountId; try { await resolvePlayConflict(subjectKind, subjectId, choice); if (getPlaySessionAccountId() === resolvingAccount) setError(null); } catch (e) { if (getPlaySessionAccountId() === resolvingAccount) setError(e instanceof Error ? e.message : "Session choice failed."); } }
  const comparison = session.ready && accountId === getPlaySessionAccountId() ? getPlaySessionComparison(subjectKind, subjectId) : [];
  const currentOverrides = getEffectivePlayState(subjectKind, subjectId).overrides;
  const backupChanges = preview ? [...new Set([...Object.keys(currentOverrides), ...Object.keys(preview)])]
    .filter(field => consequenceJson(currentOverrides[field]) !== consequenceJson(preview[field]))
    .map(field => ({ field, local: currentOverrides[field], saved: preview[field] })) : [];
  const labels = { loading: "Loading session…", saved: "Session saved", pending: "Saving session…", offline: "Offline · session edits stay on this device", conflict: "Session conflict · choose which changes to keep", legacy: "Browser session differs from saved session", error: "Session needs attention" };
  return <section className="rounded-lg border border-border bg-card px-3 py-2 text-xs" aria-label="Session synchronization">
    <div className="flex flex-wrap items-center gap-3"><span role="status">{!accountId ? isLoaded ? "Sign in to continue your session" : "Loading account…" : labels[session.status]}{session?.pending ? ` · ${session.pending} queued` : ""}</span>
      <button type="button" disabled={!session.ready} onClick={download} className="underline">Export session JSON</button>
      <label className="cursor-pointer underline">Preview session backup<input disabled={!session.ready} type="file" accept="application/json,.json" className="sr-only" onChange={async event => {
        const file = event.target.files?.[0]; if (!file) return;
        const importingAccount = accountId;
        try { if (file.size > 1048576) throw new Error("Session backup exceeds 1MB."); const data = JSON.parse(await file.text()); if (getPlaySessionAccountId() !== importingAccount) return; setPreview(previewSessionBackup(data, subjectKind, subjectId, session?.buildRefs ?? buildRefs ?? [])); setError(null); } catch (e) { if (getPlaySessionAccountId() === importingAccount) setError(e instanceof Error ? e.message : "Invalid session backup."); }
        event.target.value = "";
      }} /></label>
      {session?.status === "error" && <button type="button" className="underline" onClick={() => retryPlaySync(subjectKind, subjectId)}>Retry</button>}
    </div>
    {(session?.status === "legacy" || session?.status === "conflict") && <div className="mt-2 flex flex-wrap items-center gap-3">
      <span>{session.status === "legacy" ? "Continue with this device's browser session or the saved session. A recovery copy is retained." : `Conflicting fields: ${session.conflicts.join(", ") || "session fields"}.`}</span>
      <button type="button" onClick={() => void resolve("local")} className="underline">Keep local changes</button><button type="button" onClick={() => void resolve("server")} className="underline">Use saved session</button>
    </div>}
    {comparison.length > 0 && <SessionValues rows={comparison} first="This device" second="Saved session" caption="Session differences" />}
    {preview && <div className="mt-2"><p>Backup matches this sheet and its build. Restoring changes {backupChanges.length} session overrides (vitality, inactive toggles and Consequences), including {backupChanges.filter(change => change.saved === undefined).length} removals.</p>
      <SessionValues rows={backupChanges} first="Current session" second="Backup" caption="Backup changes" />
      <button type="button" className="mr-3 underline" disabled={!session.ready || session.status === "legacy"} onClick={() => { try { const current = getEffectivePlayState(subjectKind, subjectId).overrides; const changes = [...new Set([...Object.keys(current), ...Object.keys(preview)])].filter(field => consequenceJson(current[field]) !== consequenceJson(preview[field])).map(field => ({ field, value: preview[field] ?? null })); if (changes.length) queuePlayChanges(subjectKind, subjectId, changes); setPreview(null); } catch (e) { setError(e instanceof Error ? e.message : "Restore failed."); } }}>Restore session values</button>
      <button type="button" className="underline" onClick={() => setPreview(null)}>Cancel</button></div>}
    {(error || session?.error) && <p className="mt-2 text-destructive" role="alert">{error ?? session?.error}</p>}
  </section>;
}

function SessionValues({ rows, first, second, caption }: { rows: { field: string; local: unknown; saved: unknown }[]; first: string; second: string; caption: string }) {
  const value = (entry: unknown) => entry === undefined ? "Default (override removed)" : JSON.stringify(entry, null, 2);
  return <div className="mt-2 max-h-64 overflow-auto"><table className="w-full text-left">
    <caption className="text-left font-medium">{caption}</caption>
    <thead><tr><th scope="col" className="p-1">Field</th><th scope="col" className="p-1">{first}</th><th scope="col" className="p-1">{second}</th></tr></thead>
    <tbody>{rows.map(row => <tr key={row.field}><th scope="row" className="p-1 align-top">{row.field}</th><td className="p-1 align-top"><pre className="whitespace-pre-wrap break-all">{value(row.local)}</pre></td><td className="p-1 align-top"><pre className="whitespace-pre-wrap break-all">{value(row.saved)}</pre></td></tr>)}</tbody>
  </table></div>;
}
