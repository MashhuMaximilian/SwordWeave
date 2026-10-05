"use client";
import { useState } from "react";
import {
  createCreationReturn,
  creationModeKey,
  type CreationMode,
  type CreationAuthorKind,
} from "@/lib/character/creation-return/model";
import { pendingCreationReturnKey } from "@/lib/character/creation-return/client";
export function CreationAtelierAction({
  accountId,
  draftId,
  mode,
  persistDraft,
  quick = false,
}: {
  accountId: string | null;
  draftId: string | null;
  mode: CreationMode;
  persistDraft: () => void;
  quick?: boolean;
}) {
  const [choice, setChoice] = useState("primitive"),
    [error, setError] = useState("");
  function open() {
    if (!accountId || !draftId) return;
    try {
      persistDraft();
      localStorage.setItem(creationModeKey(accountId), mode);
      const token = crypto.randomUUID();
      const heritage = ["LINEAGE", "UPBRINGING", "MANIFEST"].includes(choice)
        ? (choice as "LINEAGE" | "UPBRINGING" | "MANIFEST")
        : undefined;
      const url = createCreationReturn(localStorage, {
        token,
        draftId,
        accountId,
        mode,
        kind: heritage ? "heritage" : (choice as CreationAuthorKind),
        ...(heritage ? { heritageKind: heritage } : {}),
        createdAt: Date.now(),
      });
      sessionStorage.setItem(pendingCreationReturnKey(accountId), token);
      const next = window.open(url, "_blank", "noopener");
      if (!next) {
        /* noopener browsers may return null even after successfully opening. */
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Your draft could not be saved before opening Atelier.",
      );
    }
  }
  return (
    <section className="my-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="What to create in Atelier"
          className="rounded border bg-background p-2 text-sm"
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
        >
          <option value="primitive">Primitive</option>
          {quick && (
            <>
              <option value="LINEAGE">Lineage</option>
              <option value="UPBRINGING">Upbringing</option>
              <option value="MANIFEST">Manifest</option>
              <option value="item">Item</option>
            </>
          )}
        </select>
        <button
          type="button"
          disabled={!accountId || !draftId}
          className="rounded border px-3 py-2 text-sm"
          onClick={open}
        >
          Create in Atelier ↗
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Opens a new tab. After saving, return here to select the new entry. Your
        character draft is saved on this device for this account.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
