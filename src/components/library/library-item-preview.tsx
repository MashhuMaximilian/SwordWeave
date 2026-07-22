"use client";

// =============================================================================
// LibraryItemPreview — thin wrapper that renders the UNIFIED EntityPreview.
//
// Historically this file held a second, divergent copy of the preview
// renderer (its own header, its own raw `mirrorVector` display, its own
// footer). That was the root cause of "the Atelier preview looks different
// from My Creations / the library detail page." We now delegate 100% to
// <EntityPreview> so every surface — My Creations, the library detail page,
// the library modal, and the Atelier sandbox modal — renders the SAME
// component with the SAME action bar (PreviewActions: Edit / Source /
// Versions / Delete + visibility).
//
// This module keeps the public type + helper exports that other files
// depend on (SandboxPreviewItem, libraryCompositeId, previewHeadingLabel,
// PreviewCallbacks, etc.). The rendering lives in entity-preview.tsx.
// =============================================================================

import { useMemo } from "react";
import { useModalStack } from "@/components/ui/modal-stack";
import {
  EntityPreview,
  type EntityPreviewOwner,
  type PreviewActionProps,
} from "@/components/preview/entity-preview";
import {
  type PreviewEngagement,
  type PreviewSubLink,
  type PreviewCallbacks,
} from "@/components/preview/preview-shared";

// =============================================================================
// Public type exports (imported by grammar-library, atelier-sandbox-client,
// sandbox-preview-modal, version-preview-button, primitive-preview, etc.)
// These are the canonical shapes for a previewable row.
// =============================================================================

type WithVersion = { versionNumber?: number | null | undefined };

export type SandboxPrimitiveRow = {
  id: number;
  name: string;
  category: string;
  buCost: number;
  isPublic: boolean;
  costTier: string;
  mechanicalOutputText: string;
  narrativeRule: string;
  isMirrorable: boolean;
  mirrorVector: string;
  mirrorBuCredit: number;
  mirrorEligibilityNotes: string;
  sourceOrigin: string | null;
  tags: string[];
  hardModifiers?: unknown;
  iconSource: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string;
};

export type SandboxEffectRow = {
  id: string;
  name: string;
  narrativeDescription: string;
  sourceOrigin: string | null;
  tags: string[];
  isPublic: boolean;
  primitiveLinks: Array<{
    primitiveId: number;
    quantity: number;
    primitive: { id: number; name: string; category: string; buCost: number };
  } & WithVersion>;
  iconSource: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string;
};

export type SandboxCapabilityRow = {
  id: string;
  name: string;
  type: string;
  sourceType: string;
  verboseDescription: string;
  sourceOrigin: string | null;
  tags: string[];
  isPublic: boolean;
  primitiveLinks: Array<{
    primitiveId: number;
    role: string;
    quantity: number;
    sortOrder: number;
    slotLabel: string | null;
    primitive: { id: number; name: string; category: string; buCost: number };
  } & WithVersion>;
  effectLinks: Array<{
    effectId: string;
    sortOrder: number;
    slotLabel: string | null;
    notes: string | null;
    effect: {
      id: string;
      name: string;
      narrativeDescription: string | null;
      sourceOrigin: string | null;
      primitiveLinks?: Array<{
        primitiveId: number;
        quantity: number;
        primitive: { id: number; name: string; category: string; buCost: number };
      }>;
    };
  } & WithVersion>;
  iconSource: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string;
};

export type SandboxTemplateRow = {
  id: string;
  kind: "LINEAGE" | "UPBRINGING" | "MANIFEST";
  name: string;
  description: string | null;
  suggestedTraits: string | null;
  isPublic: boolean;
  primitiveLinks: Array<{
    primitiveId: number;
    primitive: { id: number; name: string; category: string; buCost: number };
  } & WithVersion>;
  capabilityLinks: Array<{
    capabilityId: string;
    capability: {
      id: string;
      name: string;
      type: string;
      primitiveLinks?: Array<{
        primitiveId: number;
        primitive: { id: number; name: string; category: string; buCost: number };
      }>;
      // Phase 8.1 batch 13.5 follow-up: capability rows now carry
      // their effect links so the preview can compute the
      // transitive BU per capability (effects contribute
      // primitives, and primitives are what costs BU per Mashu).
      // The /api/heritage/[id] etc endpoints attach this data.
      effectLinks?: Array<{
        effectId: string;
        effect: { id: string; name: string };
        primitiveLinks?: Array<{
          primitiveId: number;
          primitive: { id: number; name: string; category: string; buCost: number };
        }>;
      }>;
    };
  } & WithVersion>;
  iconSource: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string;
};

export type SandboxItemRow = {
  id: string;
  name: string;
  itemType: string;
  rarity: string;
  buCost: number;
  description: string;
  slotCost: number;
  isTwoHanded: boolean;
  isConsumable: boolean;
  actsAsFocus: boolean;
  isPublic: boolean;
  sourceOrigin: string | null;
  tags: string[];
  primitiveLinks: Array<{
    primitiveId: number;
    primitive: { id: number; name: string; category: string; buCost: number };
  } & WithVersion>;
  effectLinks: Array<{
    effectId: string;
    sortOrder: number;
    slotLabel: string | null;
    notes: string | null;
    effect: {
      id: string;
      name: string;
      narrativeDescription: string | null;
      primitiveLinks?: Array<{
        primitiveId: number;
        quantity: number;
        primitive: { id: number; name: string; category: string; buCost: number };
      }>;
    };
  } & WithVersion>;
  capabilityLinks: Array<{
    capabilityId: string;
    sortOrder: number;
    slotLabel: string | null;
    notes: string | null;
    capability: {
      id: string;
      name: string;
      type: string;
      primitiveLinks?: Array<{
        primitiveId: number;
        primitive: { id: number; name: string; category: string; buCost: number };
      }>;
      // Phase 8.1 batch 13.5 follow-up: capability rows now carry
      // their effect links so the preview can compute transitive
      // BU per capability. See SandboxTemplateRow for full context.
      effectLinks?: Array<{
        effectId: string;
        effect: { id: string; name: string };
        primitiveLinks?: Array<{
          primitiveId: number;
          primitive: { id: number; name: string; category: string; buCost: number };
        }>;
      }>;
    };
  } & WithVersion>;
  iconSource: string | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string;
};

export type SandboxPreviewItem =
  | { kind: "primitive"; row: SandboxPrimitiveRow; latestVersionNumber?: number | null }
  | { kind: "effect"; row: SandboxEffectRow; latestVersionNumber?: number | null }
  | { kind: "capability"; row: SandboxCapabilityRow; latestVersionNumber?: number | null }
  | { kind: "heritage"; row: SandboxTemplateRow; latestVersionNumber?: number | null }
  | { kind: "item"; row: SandboxItemRow; latestVersionNumber?: number | null };

export function libraryCompositeId(item: SandboxPreviewItem): string {
  switch (item.kind) {
    case "primitive":
      return `PRIMITIVE:${item.row.id}`;
    case "effect":
      return `EFFECT:${item.row.id}`;
    case "capability":
      return `CAPABILITY:${item.row.id}`;
    case "item":
      return `ITEM:${item.row.id}`;
    case "heritage":
      return `${item.row.kind}_TEMPLATE:${item.row.id}`;
  }
}

function previewHeadingLabel(item: SandboxPreviewItem): string {
  switch (item.kind) {
    case "primitive":
      return "Primitive";
    case "effect":
      return "Effect";
    case "capability":
      return `Capability · ${item.row.type}`;
    case "heritage":
      return `Template · ${item.row.kind}`;
    case "item":
      return `Item · ${item.row.itemType}`;
  }
}
export { previewHeadingLabel };

// Re-export the shared preview types so existing importers
// (`grammar-library`, `atelier-sandbox-client`, `sandbox-preview-modal`,
// `version-preview-button`, etc.) that pull them from this module keep
// working. The canonical definitions live in preview-shared.tsx.
export type {
  PreviewEngagement,
  PreviewSubLink,
  PreviewCallbacks,
} from "@/components/preview/preview-shared";

// -----------------------------------------------------------------------------
// Hook: handles sub-link clicks. If the caller registered onSubLinkClick,
// invoke it; otherwise push a breadcrumb modal linking to the canonical
// library page.
// -----------------------------------------------------------------------------

function useSubLinkClick(cb: PreviewCallbacks["onSubLinkClick"]) {
  const stack = useModalStack();
  return useMemo(() => {
    return (link: PreviewSubLink) => {
      if (cb) {
        cb(link);
        return;
      }
      if (!stack.canPush) return;
      const url = `/library/item/${link.targetType}:${link.targetId}`;
      stack.push({
        key: `sublink:${link.targetType}:${link.targetId}`,
        label: link.label,
        category: link.targetType,
        content: (
          <div className="space-y-3 p-1">
            <p className="text-sm text-muted-foreground">
              {link.label} — full details open in a new modal.
            </p>
            <a
              href={url}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Open in library
            </a>
          </div>
        ),
      });
    };
  }, [cb, stack]);
}

// -----------------------------------------------------------------------------
// LibraryItemPreview — delegates to the single unified renderer.
// -----------------------------------------------------------------------------

export function LibraryItemPreview({
  item,
  callbacks,
  owner,
  actionBar,
}: {
  item: SandboxPreviewItem;
  callbacks?: PreviewCallbacks;
  owner?: EntityPreviewOwner;
  actionBar?: PreviewActionProps;
}) {
  const onSubLink = useSubLinkClick(callbacks?.onSubLinkClick);
  return (
    <EntityPreview
      item={item}
      variant="read"
      callbacks={callbacks}
      owner={owner}
      actionBar={actionBar}
    />
  );
}
