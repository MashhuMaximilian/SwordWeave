"use client";

import { useState } from "react";
import { SandboxLayout } from "./sandbox-layout";
import { CapabilityForm } from "./capability-form";
import {
  CapabilityFormPreview,
  type CapabilityFormState,
  type CapabilitySlot,
} from "./capability-form-preview";

type CapabilityRow = {
  id: string;
  userId?: string | null;
  name: string;
  type: string;
  sourceType: string;
  verboseDescription: string;
  isPublic: boolean;
  sourceOrigin: string | null;
  tags: string[];
  primitiveLinks: Array<{
    primitiveId: number;
    role: string;
    quantity: number;
    sortOrder: number;
    slotLabel: string | null;
    primitive: {
      id: number;
      name: string;
      category: string;
      buCost: number;
    };
  }>;
};

export function CapabilitySandboxClient({
  editingCapability,
  availablePrimitives,
  library,
}: {
  editingCapability: CapabilityRow | null;
  availablePrimitives: Array<{
    id: number;
    name: string;
    category: string;
    buCost: number;
  }>;
  library: React.ReactNode;
}) {
  const [form, setForm] = useState<CapabilityFormState | null>(
    editingCapability
      ? {
          name: editingCapability.name,
          type: editingCapability.type,
          sourceType: editingCapability.sourceType,
          verboseDescription: editingCapability.verboseDescription,
          sourceOrigin: editingCapability.sourceOrigin ?? "",
          tags: (editingCapability.tags ?? []).join(", "),
          isPublic: editingCapability.isPublic,
        }
      : null,
  );
  const [slots, setSlots] = useState<CapabilitySlot[]>(
    editingCapability?.primitiveLinks.map((link) => ({
      primitiveId: link.primitiveId,
      role: link.role ?? "OTHER",
      quantity: link.quantity,
      sortOrder: link.sortOrder,
      slotLabel: link.slotLabel ?? link.primitive.name,
      primitive: link.primitive,
    })) ?? [],
  );

  return (
    <SandboxLayout
      storageKey="capabilities"
      library={library}
      builder={
        <CapabilityForm
          initialCapability={editingCapability ?? null}
          availablePrimitives={availablePrimitives}
          onStateChange={(state) => {
            setForm(state.form);
            setSlots(state.slots);
          }}
          onSaved={() => {
            /* parent re-fetches via router.refresh inside CapabilityForm */
          }}
        />
      }
      preview={
        form ? (
          <CapabilityFormPreview form={form} slots={slots} />
        ) : (
          <CapabilityFormPreview
            form={{
              name: "",
              type: "ACTIVE",
              sourceType: "PHYSICAL",
              verboseDescription: "",
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