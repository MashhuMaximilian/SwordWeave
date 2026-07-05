"use client";

import { useState } from "react";
import { SandboxLayout } from "./sandbox-layout";
import { TemplateForm } from "./template-form";
import {
  TemplateFormPreview,
  type TemplateFormState,
  type TemplateSlot,
} from "./template-form-preview";

type TemplateRow = {
  id: string;
  userId?: string | null;
  kind: "RACE" | "BACKGROUND" | "ARCHETYPE";
  name: string;
  imageUrl: string | null;
  description: string | null;
  suggestedTraits: string | null;
  isPublic: boolean;
  primitiveLinks: Array<{
    primitiveId: number;
    primitive: {
      id: number;
      name: string;
      category: string;
      buCost: number;
    };
  }>;
};

export function TemplateSandboxClient({
  editingTemplate,
  initialKind,
  availablePrimitives,
  availableCapabilities,
  library,
}: {
  editingTemplate: TemplateRow | null;
  initialKind?: "RACE" | "BACKGROUND" | "ARCHETYPE";
  availablePrimitives: Array<{
    id: number;
    name: string;
    category: string;
    buCost: number;
  }>;
  availableCapabilities: Array<{
    id: string;
    name: string;
    type: string;
    sourceType: string;
  }>;
  library: React.ReactNode;
}) {
  const [form, setForm] = useState<TemplateFormState | null>(
    editingTemplate
      ? {
          kind: editingTemplate.kind,
          name: editingTemplate.name,
          imageUrl: editingTemplate.imageUrl ?? "",
          description: editingTemplate.description ?? "",
          suggestedTraits: editingTemplate.suggestedTraits ?? "",
          isPublic: editingTemplate.isPublic,
        }
      : null,
  );
  const [primitives, setPrimitives] = useState<TemplateSlot[]>([]);
  const [capabilities, setCapabilities] = useState<TemplateSlot[]>([]);

  return (
    <SandboxLayout
      storageKey="templates"
      library={library}
      builder={
        <TemplateForm
          initialTemplate={editingTemplate ?? null}
          initialKind={initialKind ?? undefined}
          availablePrimitives={availablePrimitives}
          availableCapabilities={availableCapabilities}
          onStateChange={(state) => {
            setForm(state.form);
            setPrimitives(state.primitives);
            setCapabilities(state.capabilities);
          }}
          onSaved={() => {
            /* parent re-fetches via router.refresh inside TemplateForm */
          }}
        />
      }
      preview={
        form ? (
          <TemplateFormPreview
            form={form}
            primitives={primitives}
            capabilities={capabilities}
          />
        ) : (
          <TemplateFormPreview
            form={{
              kind: initialKind ?? "RACE",
              name: "",
              imageUrl: "",
              description: "",
              suggestedTraits: "",
              isPublic: false,
            }}
            primitives={[]}
            capabilities={[]}
          />
        )
      }
    />
  );
}