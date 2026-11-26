"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { PawPrint, Plus, Trash2 } from "lucide-react";
import { MonsterTemplatePreview } from "@/components/monsters/monster-template-preview";
import { DetailModal } from "@/components/ui/detail-modal";
import { useModalStack } from "@/components/ui/modal-stack";
import { browserUuid } from "@/lib/browser-uuid";
import { characterCompanionBestiaryPath, characterCompanionPlayPath, MAX_CHARACTER_COMPANIONS, type CharacterCompanionCandidate, type CharacterCompanionSummary } from "@/lib/character/companion-types";
import type { DraftOperation } from "@/lib/character/workspace/draft-types";
import { readJsonResponse } from "@/lib/http/read-json-response";

type Load<T> = { items: T[]; error: string } | undefined;
type CompanionOperation = Extract<DraftOperation, { type: "companion" }>;
type CompanionUndo = { id: string; version: number; authorId: string };
const companionUndoKey = (characterId: string) => `sw:companion-undo:${characterId}`;

export function rememberCompanionUndo(characterId: string, receipt: CompanionUndo) {
  try { sessionStorage.setItem(companionUndoKey(characterId), JSON.stringify(receipt)); } catch { /* Undo is optional if browser storage is unavailable. */ }
}

function readCompanionUndo(characterId: string) {
  try { return sessionStorage.getItem(companionUndoKey(characterId)); } catch { return null; }
}

const subscribeToSession = () => () => {};

function useCompanionList<T>(url: string | null, field: "companions" | "candidates", delay = 0) {
  const { isLoaded, userId } = useAuth();
  const [result, setResult] = useState<{ key: string; value: Load<T> }>();
  const key = userId && url ? `${userId}:${url}` : null;
  useEffect(() => {
    if (!key || !url) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
        const payload = await readJsonResponse<Partial<Record<typeof field, T[]>> & { error?: string }>(response);
        const items = payload[field];
        if (!response.ok || !Array.isArray(items)) {
          throw new Error(payload.error || "Unable to load companions.");
        }
        if (!controller.signal.aborted) setResult({ key, value: { items, error: "" } });
      } catch (cause) {
        if (!controller.signal.aborted) {
          setResult({ key, value: { items: [], error: cause instanceof Error ? cause.message : "Unable to load companions." } });
        }
      }
    };
    const timer = window.setTimeout(() => void load(), delay);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [key, url, field, delay]);
  if (isLoaded && !userId) return { items: [], error: "Sign in to view companions." };
  return result?.key === key ? result.value : undefined;
}

export function CharacterCompanions({
  characterId,
  onEdit,
}: {
  characterId: string;
  onEdit?: () => void;
}) {
  const companions = useCompanionList<CharacterCompanionSummary>(
    `/api/characters/${encodeURIComponent(characterId)}/companions`, "companions",
  );
  return (
    <section className="space-y-3" aria-label="Character companions">
      {onEdit && <div className="flex flex-wrap gap-2">
        <button type="button" className="sheet-button" onClick={onEdit}><PawPrint size={16} aria-hidden="true" /> Edit companions</button>
        <UndoCompanionSave characterId={characterId} />
      </div>}
      {!companions ? <p role="status">Loading companions…</p> : companions.error ? (
        <p role="alert" className="text-sm text-muted-foreground">{companions.error}</p>
      ) : companions.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No companions to show.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {companions.items.map(companion => (
            <li key={companion.id} className="rounded-md border border-border p-3">
              <h3 className="font-semibold">{companion.name}</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {companion.playCopyId && (
                  <Link className="sheet-button is-gold" href={characterCompanionPlayPath(companion.playCopyId, characterId)}>
                    Open play sheet <span className="sr-only">for {companion.name}</span>
                  </Link>
                )}
                {companion.bestiary && <BestiaryLink monster={companion.bestiary} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function UndoCompanionSave({ characterId }: { characterId: string }) {
  const { userId } = useAuth();
  const saved = useSyncExternalStore(subscribeToSession, () => readCompanionUndo(characterId), () => null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  let receipt: CompanionUndo | null = null;
  try { receipt = JSON.parse(saved ?? "null") as CompanionUndo | null; } catch { /* Ignore invalid browser state. */ }
  if (!receipt || !userId || receipt.authorId !== userId || typeof receipt.id !== "string" || !Number.isInteger(receipt.version)) return null;
  const { id, version } = receipt;

  async function undo() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/characters/${encodeURIComponent(characterId)}/workspace/draft`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "undo", draftId: id, expectedVersion: version }),
      });
      const result = await readJsonResponse<{ error?: string }>(response);
      if (!response.ok) throw new Error(result.error || "Unable to undo the saved changes.");
      try { sessionStorage.removeItem(companionUndoKey(characterId)); } catch { /* The server also guards replay. */ }
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to undo the saved changes.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className="sheet-button" onClick={() => setOpen(true)}>Undo companion draft</button>
      <DetailModal isOpen={open} title="Undo companion draft?" onClose={() => { if (!pending) setOpen(false); }}>
        <div className="space-y-3">
          <p>Undo all changes in the last saved draft. Current Vitality and consequences are kept.</p>
          {error && <p role="alert">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="sheet-button" disabled={pending} onClick={() => setOpen(false)}>Keep changes</button>
            <button type="button" className="sheet-button is-gold" disabled={pending} onClick={() => void undo()}>
              {pending ? "Undoing…" : "Undo saved draft"}
            </button>
          </div>
        </div>
      </DetailModal>
    </>
  );
}

function BestiaryLink({ monster }: { monster: CharacterCompanionCandidate }) {
  const modal = useModalStack();
  const href = characterCompanionBestiaryPath(monster.id, monster.version);
  return (
    <Link className="sheet-button" href={href} onClick={event => {
      if (!modal.canPush || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      event.preventDefault();
      modal.push({
        key: `companion-bestiary:${monster.id}:${monster.version}`,
        label: monster.name,
        category: "Bestiary",
        content: (
          <>
            <MonsterTemplatePreview id={monster.id} version={monster.version} compact hideActions />
            <Link className="sheet-button mt-3" href={href}>Open full Bestiary entry</Link>
          </>
        ),
      });
    }}>
      View Bestiary <span className="sr-only">entry for {monster.name}</span>
    </Link>
  );
}

export function CompanionDraftPanel({
  characterId,
  operations,
  disabled,
  onStage,
}: {
  characterId: string;
  operations: readonly DraftOperation[];
  disabled: boolean;
  onStage: (operation: CompanionOperation) => Promise<unknown>;
}) {
  const endpoint = `/api/characters/${encodeURIComponent(characterId)}/companions`;
  const saved = useCompanionList<CharacterCompanionSummary>(endpoint, "companions");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [choice, setChoice] = useState("");
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const picker = useCompanionList<CharacterCompanionCandidate>(
    pickerOpen ? `${endpoint}?${new URLSearchParams({ picker: "1", q: query.trim() })}` : null, "candidates", 200,
  );
  const selected = picker?.items.find(candidate => candidate.id === choice);
  const companions = new Map(saved?.items.map(companion => [companion.id, { name: companion.name, added: false }]));
  for (const operation of operations) {
    if (operation.type !== "companion") continue;
    if (operation.payload.action === "add") {
      companions.set(operation.id, { name: operation.payload.name || "Monster companion", added: true });
    } else {
      companions.delete(operation.payload.attachmentId);
    }
  }
  const blocked = disabled || pending || !saved || Boolean(saved.error);
  const canAdd = !blocked && companions.size < MAX_CHARACTER_COMPANIONS;

  async function stage(operation: CompanionOperation) {
    setError("");
    setPending(true);
    try {
      await onStage(operation);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to stage this companion change.");
      return false;
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="space-y-3" aria-labelledby="companion-draft-heading">
      <h2 id="companion-draft-heading" className="text-lg font-semibold">Companions</h2>
      {!saved ? <p role="status">Loading companions…</p> : saved.error ? (
        <p role="alert" className="text-sm text-muted-foreground">{saved.error}</p>
      ) : companions.size === 0 ? (
        <p className="text-sm text-muted-foreground">No companions in this draft.</p>
      ) : (
        <ul className="space-y-2">
          {[...companions].map(([id, companion]) => (
            <li key={id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
              <span className="font-medium">{companion.name}{companion.added && <small className="ml-2 text-muted-foreground">Pending add</small>}</span>
              <button type="button" className="sheet-button" disabled={blocked} aria-label={`Remove ${companion.name}`}
                onClick={() => void stage({ id: browserUuid(), type: "companion", label: companion.name, payload: { action: "remove", attachmentId: id } })}>
                <Trash2 size={15} aria-hidden="true" /> Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {companions.size >= MAX_CHARACTER_COMPANIONS && <p className="text-sm text-muted-foreground">This draft has the maximum of {MAX_CHARACTER_COMPANIONS} companions.</p>}
      <button type="button" className="sheet-button is-gold" disabled={!pickerOpen && !canAdd} aria-expanded={pickerOpen} onClick={() => setPickerOpen(value => !value)}>
        <Plus size={16} aria-hidden="true" /> {pickerOpen ? "Close Bestiary picker" : "Add companion"}
      </button>
      {pickerOpen && (
        <form className="grid gap-3 rounded-md border border-border p-3" onSubmit={event => {
          event.preventDefault();
          if (!selected || !canAdd) return;
          const copyName = name.trim() || selected.name;
          void stage({
            id: browserUuid(),
            type: "companion",
            label: copyName,
            payload: { action: "add", templateId: selected.id, version: selected.version, name: copyName },
          }).then(added => { if (added) setName(""); });
        }}>
          <label className="grid gap-1 text-sm">
            Search Bestiary
            <input type="search" className="rounded-md border border-border bg-background p-2"
              maxLength={100} value={query} onChange={event => { setQuery(event.target.value); setChoice(""); }} />
          </label>
          {!picker && <p role="status">Searching Bestiary…</p>}
          {picker?.error && <p role="alert" className="text-sm">{picker.error}</p>}
          {picker && !picker.error && !picker.items.length && <p className="text-sm text-muted-foreground">No matching monsters.</p>}
          {!!picker?.items.length && (
            <>
              <label className="grid gap-1 text-sm">
                Bestiary monster
                <select className="rounded-md border border-border bg-background p-2" value={choice} onChange={event => setChoice(event.target.value)}>
                  <option value="">Choose a monster</option>
                  {picker.items.map(monster => <option key={monster.id} value={monster.id}>{monster.name} (v{monster.version})</option>)}
                </select>
              </label>
              {selected && <BestiaryLink monster={selected} />}
              <label className="grid gap-1 text-sm">
                Companion name (optional)
                <input className="rounded-md border border-border bg-background p-2" maxLength={120} value={name}
                  placeholder={selected?.name} onChange={event => setName(event.target.value)} />
              </label>
              <button type="submit" className="sheet-button is-gold justify-self-start" disabled={!canAdd || !selected}>
                Add to draft
              </button>
            </>
          )}
        </form>
      )}
      {error && <p role="alert" className="text-sm">{error}</p>}
    </section>
  );
}
