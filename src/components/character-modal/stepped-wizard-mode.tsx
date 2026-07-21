"use client";

// =============================================================================
// SteppedWizardMode — the 5-step character creation wizard, rendered
// inside the CharacterModal (Phase 8.1 batch 3).
//
// Why a separate component: the wizard needs heritage, capabilities, and
// items lists. The legacy /sandbox/characters page fetches them server-
// side and passes them as props. The modal is mounted in AppShell with
// no per-page data, so this component fetches the same data on mount
// from the existing public APIs (/api/heritage, /api/capabilities,
// /api/items).
//
// Why we don't extract CharacterWizard into smaller pieces: the legacy
// page still uses it directly. Refactoring the 800-line component is
// risk without payoff for batch 3. The minimal change here is wrapping
// it with data fetching + an onCreated handler that closes the modal
// and opens the new character sheet in a new tab (per spec:
// "preview should always open in a new tab").
// =============================================================================

import { useEffect, useState } from "react";
import { CharacterWizard } from "@/components/workshops/character-wizard";
import { useCharacterModal } from "./character-modal-store";

type HeritageRow = {
  id: string;
  kind: string;
  name: string;
  imageUrl: string | null;
  description: string | null;
};
type CapabilityRow = {
  id: string;
  name: string;
  type: string;
  sourceType: string;
};
type ItemRow = {
  id: string;
  name: string;
  itemType: string;
  rarity: string;
};

interface WizardData {
  races: HeritageRow[];
  backgrounds: HeritageRow[];
  capabilities: CapabilityRow[];
  items: ItemRow[];
}

const EMPTY: WizardData = {
  races: [],
  backgrounds: [],
  capabilities: [],
  items: [],
};

export function SteppedWizardMode() {
  const { close, resetDraft, setDirty } = useCharacterModal();
  const [data, setData] = useState<WizardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Mark dirty when the wizard mounts (any state in the wizard's
  // internal form = content to come back to). We intentionally do NOT
  // clear this flag on unmount: if the user closes the modal mid-
  // wizard, the FAB dot stays on so they know there's something to come
  // back to. The flag clears on successful create (onCreated → resetDraft)
  // and on the explicit resetDraft() path. Future batches add real
  // state persistence (localStorage auto-save per the spec) so the
  // user can re-open and find their progress intact.
  useEffect(() => {
    setDirty(true);
  }, [setDirty]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [lineagesRes, upbringingsRes, capsRes, itemsRes] = await Promise.all([
          fetch("/api/heritage?kind=LINEAGE"),
          fetch("/api/heritage?kind=UPBRINGING"),
          fetch("/api/capabilities"),
          fetch("/api/items"),
        ]);
        if (cancelled) return;
        if (
          !lineagesRes.ok ||
          !upbringingsRes.ok ||
          !capsRes.ok ||
          !itemsRes.ok
        ) {
          setError("Failed to load library data. Try again.");
          return;
        }
        const [lineagesJson, upbringingsJson, capsJson, itemsJson] =
          await Promise.all([
            lineagesRes.json(),
            upbringingsRes.json(),
            capsRes.json(),
            itemsRes.json(),
          ]);
        if (cancelled) return;
        setData({
          races: (lineagesJson.heritage ?? []) as HeritageRow[],
          backgrounds: (upbringingsJson.heritage ?? []) as HeritageRow[],
          capabilities: (capsJson.capabilities ?? []) as CapabilityRow[],
          items: (itemsJson.items ?? []) as ItemRow[],
        });
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Unknown error loading wizard data.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        Loading library…
      </div>
    );
  }

  return (
    <CharacterWizard
      {...data}
      enablePersistence
      persistenceKey="swordweave:character-modal:draft"
      onCreated={(characterId) => {
        // Per spec: preview opens in a new tab. Close the modal and
        // reset the draft store so the FAB dot clears.
        window.open(`/characters/${characterId}`, "_blank", "noopener,noreferrer");
        resetDraft();
        close();
      }}
    />
  );
}