"use client";

// Backwards-compatible entry point.
// Renders <PrimitiveForm> with onStateChange wired so callers that used
// PrimitiveRegistry directly keep working. The page-level SandboxLayout
// handles library, preview, and saved-records display.

import { useState } from "react";
import {
  PrimitiveForm,
  type ModifierDraft,
} from "./primitive-form";
import type { PrimitiveFormState } from "./primitive-form-preview";

type PrimitiveRow = {
  id: number;
  userId?: string | null;
  name: string;
  category: string;
  isPublic: boolean;
  costTier: string;
  buCost: number;
  mechanicalOutputText: string;
  narrativeRule: string;
  isMirrorable: boolean;
  mirrorVector: string;
  mirrorBuCredit: number;
  mirrorEligibilityNotes: string;
  hardModifiers: unknown;
};

export function PrimitiveRegistry({
  initialPrimitives,
  editingPrimitive,
  onStateChange,
  onSaved,
}: {
  initialPrimitives: PrimitiveRow[];
  editingPrimitive?: PrimitiveRow | null;
  onStateChange?: (state: {
    form: PrimitiveFormState;
    modifiers: ModifierDraft[];
  }) => void;
  onSaved?: (primitive: PrimitiveRow) => void;
}) {
  // initialPrimitives kept in signature for backwards compatibility but
  // no longer rendered here. Library is owned by the page.
  void initialPrimitives;
  const [, setLocalState] = useState<{
    form: PrimitiveFormState;
    modifiers: ModifierDraft[];
  } | null>(null);

  return (
    <PrimitiveForm
      initialPrimitive={editingPrimitive ?? null}
      onStateChange={(state) => {
        setLocalState(state);
        onStateChange?.({ form: state.form, modifiers: state.modifiers });
      }}
      onSaved={onSaved ?? (() => undefined)}
    />
  );
}