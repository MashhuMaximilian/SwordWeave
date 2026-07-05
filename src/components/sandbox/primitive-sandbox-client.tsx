"use client";

// Client wrapper for /sandbox/primitives.
// Owns the live form state. Renders SandboxLayout with:
//   - library: passed through from parent (server-rendered table)
//   - builder: <PrimitiveForm> wired with onStateChange
//   - preview: <PrimitiveFormPreview> driven by the same state

import { useState } from "react";
import { SandboxLayout } from "./sandbox-layout";
import { PrimitiveForm } from "./primitive-form";
import {
  PrimitiveFormPreview,
  type PrimitiveFormState,
} from "./primitive-form-preview";

type ModifierDraft = {
  id: string;
  target: string;
  operation: string;
  value: string;
  valueKind: "number" | "text" | "boolean";
  conditionMode: "always" | "custom";
  conditionKey: string;
  conditionOperator: string;
  conditionValue: string;
  stacking: string;
};

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

export function PrimitiveSandboxClient({
  editingPrimitive,
  library,
}: {
  editingPrimitive: PrimitiveRow | null;
  library: React.ReactNode;
}) {
  const [form, setForm] = useState<PrimitiveFormState | null>(
    editingPrimitive
      ? {
          name: editingPrimitive.name,
          category: editingPrimitive.category,
          isPublic: editingPrimitive.isPublic,
          costTier: editingPrimitive.costTier,
          buCost: String(editingPrimitive.buCost),
          mechanicalOutputText: editingPrimitive.mechanicalOutputText,
          narrativeRule: editingPrimitive.narrativeRule,
          isMirrorable: editingPrimitive.isMirrorable,
          mirrorVector: editingPrimitive.mirrorVector,
          mirrorBuCredit: String(editingPrimitive.mirrorBuCredit),
          mirrorEligibilityNotes: editingPrimitive.mirrorEligibilityNotes,
        }
      : null,
  );
  const [modifiers, setModifiers] = useState<ModifierDraft[]>([]);

  return (
    <SandboxLayout
      storageKey="primitives"
      library={library}
      builder={
        <PrimitiveForm
          initialPrimitive={editingPrimitive ?? null}
          onStateChange={(state) => {
            setForm(state.form);
            setModifiers(state.modifiers);
          }}
          onSaved={() => {
            /* parent re-fetches via router.refresh inside PrimitiveForm */
          }}
        />
      }
      preview={
        form ? (
          <PrimitiveFormPreview form={form} modifiers={modifiers} />
        ) : (
          <PrimitiveFormPreview
            form={{
              name: "",
              category: "VERB_TIER",
              isPublic: false,
              costTier: "Tier 1: Minor (4 BU anchor)",
              buCost: "1",
              mechanicalOutputText: "",
              narrativeRule: "",
              isMirrorable: false,
              mirrorVector: "STANDARD_ONLY",
              mirrorBuCredit: "0",
              mirrorEligibilityNotes: "",
            }}
            modifiers={[]}
          />
        )
      }
    />
  );
}