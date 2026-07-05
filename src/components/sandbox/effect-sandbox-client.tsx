"use client";

// Client wrapper for /sandbox/effects.
// Owns the live form state. Renders SandboxLayout with:
//   - library: passed through from parent
//   - builder: <EffectForm> with onStateChange
//   - preview: <EffectFormPreview> driven by same state

import { useState } from "react";
import { SandboxLayout } from "./sandbox-layout";
import { EffectForm } from "./effect-form";
import {
  EffectFormPreview,
  type EffectFormState,
  type SlottedPrimitive,
} from "./effect-form-preview";

type EffectRow = {
  id: string;
  userId?: string | null;
  name: string;
  narrativeDescription: string;
  sourceOrigin: string | null;
  tags: string[];
  isPublic: boolean;
  primitiveLinks: Array<{
    primitiveId: number;
    quantity: number;
    primitive: {
      id: number;
      name: string;
      category: string;
      buCost: number;
    };
  }>;
};

export function EffectSandboxClient({
  editingEffect,
  availablePrimitives,
  library,
}: {
  editingEffect: EffectRow | null;
  availablePrimitives: Array<{
    id: number;
    name: string;
    category: string;
    buCost: number;
  }>;
  library: React.ReactNode;
}) {
  const [form, setForm] = useState<EffectFormState | null>(
    editingEffect
      ? {
          name: editingEffect.name,
          narrativeDescription: editingEffect.narrativeDescription,
          sourceOrigin: editingEffect.sourceOrigin ?? "",
          tags: (editingEffect.tags ?? []).join(", "),
          isPublic: editingEffect.isPublic,
        }
      : null,
  );
  const [slots, setSlots] = useState<SlottedPrimitive[]>(
    editingEffect?.primitiveLinks.map((link) => ({
      primitiveId: link.primitiveId,
      quantity: link.quantity,
      primitive: link.primitive,
    })) ?? [],
  );

  return (
    <SandboxLayout
      storageKey="effects"
      library={library}
      builder={
        <EffectForm
          initialEffect={editingEffect ?? null}
          availablePrimitives={availablePrimitives}
          onStateChange={(state) => {
            setForm(state.form);
            setSlots(state.slots);
          }}
          onSaved={() => {
            /* parent re-fetches via router.refresh inside EffectForm */
          }}
        />
      }
      preview={
        form ? (
          <EffectFormPreview form={form} slots={slots} />
        ) : (
          <EffectFormPreview
            form={{
              name: "",
              narrativeDescription: "",
              sourceOrigin: "",
              tags: "",
              isPublic: false,
            }}
            slots={[]}
          />
        )
      }
    />
  );
}