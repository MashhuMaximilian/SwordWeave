"use client";

// =============================================================================
// VersionPreviewButton — opens a preview modal for a specific version.
//
// Maps the reconstructed version payload to a SandboxPreviewItem and
// renders it inside a SandboxPreviewModal. For primitives, the mapping
// is 1:1. For other entity types, shows a simplified read-only view
// of the payload fields.
// =============================================================================

import { useState } from "react";
import { Eye } from "lucide-react";
import {
  SandboxPreviewModal,
  type SandboxPreviewItem,
  type SandboxPrimitiveRow,
  type SandboxEffectRow,
  type SandboxCapabilityRow,
  type SandboxTemplateRow,
  type SandboxItemRow,
} from "@/components/sandbox/sandbox-preview-modal";

interface VersionPreviewButtonProps {
  targetType: string;
  targetId: string;
  versionNumber: number;
  payload: Record<string, unknown>;
  /** Pre-resolved entity names: "primitive:42" → "Strike", "effect:uuid" → "Shattered Composure" */
  nameMap?: Record<string, string>;
}

function mapPayloadToPreviewItem(
  targetType: string,
  targetId: string,
  payload: Record<string, unknown>,
  nameMap?: Record<string, string>,
): SandboxPreviewItem | null {
  if (targetType === "PRIMITIVE") {
    const numId = Number(targetId);
    if (!Number.isFinite(numId)) return null;
    const row: SandboxPrimitiveRow = {
      id: numId,
      name: String(payload["name"] ?? ""),
      category: String(payload["category"] ?? "CORE"),
      buCost: Number(payload["buCost"]) || 0,
      isPublic: Boolean(payload["isPublic"]),
      costTier: String(payload["costTier"] ?? ""),
      mechanicalOutputText: String(payload["mechanicalOutputText"] ?? ""),
      narrativeRule: String(payload["narrativeRule"] ?? ""),
      isMirrorable: Boolean(payload["isMirrorable"]),
      mirrorVector: String(payload["mirrorVector"] ?? "STANDARD_ONLY"),
      mirrorBuCredit: Number(payload["mirrorBuCredit"]) || 0,
      mirrorEligibilityNotes: String(payload["mirrorEligibilityNotes"] ?? ""),
      hardModifiers: payload["hardModifiers"],
    };
    return { kind: "primitive", row };
  }

  if (targetType === "EFFECT") {
    const primitiveLinks = Array.isArray(payload["primitiveSlots"])
      ? (payload["primitiveSlots"] as Array<Record<string, unknown>>).map((s, i) => {
          const pid = Number(s["primitiveId"]) || 0;
          const resolvedName = nameMap?.[`primitive:${pid}`];
          return {
            primitiveId: pid,
            quantity: Number(s["quantity"]) || 1,
            primitive: {
              id: pid,
              name: resolvedName ?? String(s["name"] ?? `Primitive ${pid}`),
              category: String(s["category"] ?? ""),
              buCost: Number(s["buCost"]) || 0,
            },
            versionNumber: undefined,
          };
        })
      : [];
    const row: SandboxEffectRow = {
      id: targetId,
      name: String(payload["name"] ?? ""),
      narrativeDescription: String(payload["narrativeDescription"] ?? ""),
      sourceOrigin: (payload["sourceOrigin"] as string) ?? null,
      tags: Array.isArray(payload["tags"]) ? (payload["tags"] as string[]) : [],
      isPublic: Boolean(payload["isPublic"]),
      primitiveLinks,
    };
    return { kind: "effect", row };
  }

  if (targetType === "CAPABILITY") {
    const primitiveLinks = Array.isArray(payload["primitiveSlots"])
      ? (payload["primitiveSlots"] as Array<Record<string, unknown>>).map((s, i) => {
          const pid = Number(s["primitiveId"]) || 0;
          const resolvedName = nameMap?.[`primitive:${pid}`];
          return {
            primitiveId: pid,
            role: String(s["role"] ?? "PRIMARY"),
            quantity: Number(s["quantity"]) || 1,
            sortOrder: Number(s["sortOrder"]) || i,
            slotLabel: (s["slotLabel"] as string) ?? null,
            primitive: {
              id: pid,
              name: resolvedName ?? String(s["name"] ?? `Primitive ${pid}`),
              category: String(s["category"] ?? ""),
              buCost: Number(s["buCost"]) || 0,
            },
            versionNumber: undefined,
          };
        })
      : [];
    const effectLinks = Array.isArray(payload["effectIds"])
      ? (payload["effectIds"] as string[]).map((eid, i) => ({
          effectId: eid,
          sortOrder: i,
          slotLabel: null,
          notes: null,
          effect: {
            id: eid,
            name: nameMap?.[`effect:${eid}`] ?? `Effect ${eid.slice(0, 8)}`,
            narrativeDescription: null,
            sourceOrigin: null,
          },
          versionNumber: undefined,
        }))
      : [];
    const row: SandboxCapabilityRow = {
      id: targetId,
      name: String(payload["name"] ?? ""),
      type: String(payload["type"] ?? "ACTIVE"),
      sourceType: String(payload["sourceType"] ?? "PHYSICAL"),
      verboseDescription: String(payload["verboseDescription"] ?? ""),
      sourceOrigin: (payload["sourceOrigin"] as string) ?? null,
      tags: Array.isArray(payload["tags"]) ? (payload["tags"] as string[]) : [],
      isPublic: Boolean(payload["isPublic"]),
      primitiveLinks,
      effectLinks,
    };
    return { kind: "capability", row };
  }

  if (
    targetType === "RACE_TEMPLATE" ||
    targetType === "BACKGROUND_TEMPLATE" ||
    targetType === "ARCHETYPE_TEMPLATE"
  ) {
    const kind = targetType.replace("_TEMPLATE", "") as "RACE" | "BACKGROUND" | "ARCHETYPE";
    const primitiveLinks = Array.isArray(payload["primitiveIds"])
      ? (payload["primitiveIds"] as number[]).map((pid) => ({
          primitiveId: pid,
          primitive: {
            id: pid,
            name: `Primitive ${pid}`,
            category: "",
            buCost: 0,
          },
          versionNumber: undefined,
        }))
      : [];
    const capabilityLinks = Array.isArray(payload["capabilityIds"])
      ? (payload["capabilityIds"] as string[]).map((cid) => ({
          capabilityId: cid,
          capability: {
            id: cid,
            name: nameMap?.[`capability:${cid}`] ?? `Capability ${cid.slice(0, 8)}`,
            type: "",
          },
          versionNumber: undefined,
        }))
      : [];
    const row: SandboxTemplateRow = {
      id: targetId,
      kind,
      name: String(payload["name"] ?? ""),
      description: (payload["description"] as string) ?? null,
      suggestedTraits: (payload["suggestedTraits"] as string) ?? null,
      isPublic: Boolean(payload["isPublic"]),
      primitiveLinks,
      capabilityLinks,
    };
    return { kind: "template", row };
  }

  if (targetType === "ITEM") {
    const primitiveLinks = Array.isArray(payload["primitiveIds"])
      ? (payload["primitiveIds"] as number[]).map((pid) => ({
          primitiveId: pid,
          primitive: {
            id: pid,
            name: `Primitive ${pid}`,
            category: "",
            buCost: 0,
          },
          versionNumber: undefined,
        }))
      : [];
    const effectLinks = Array.isArray(payload["effectIds"])
      ? (payload["effectIds"] as string[]).map((eid) => ({
          effectId: eid,
          sortOrder: 0,
          slotLabel: null,
          notes: null,
          effect: {
            id: eid,
            name: nameMap?.[`effect:${eid}`] ?? `Effect ${eid.slice(0, 8)}`,
            narrativeDescription: null,
          },
          versionNumber: undefined,
        }))
      : [];
    const capabilityLinks = Array.isArray(payload["capabilityIds"])
      ? (payload["capabilityIds"] as string[]).map((cid) => ({
          capabilityId: cid,
          sortOrder: 0,
          slotLabel: null,
          notes: null,
          capability: {
            id: cid,
            name: nameMap?.[`capability:${cid}`] ?? `Capability ${cid.slice(0, 8)}`,
            type: "",
          },
          versionNumber: undefined,
        }))
      : [];
    const row: SandboxItemRow = {
      id: targetId,
      name: String(payload["name"] ?? ""),
      itemType: String(payload["itemType"] ?? "TRINKET"),
      rarity: String(payload["rarity"] ?? "COMMON"),
      buCost: Number(payload["buCost"]) || 0,
      description: String(payload["description"] ?? ""),
      slotCost: Number(payload["slotCost"]) || 1,
      isTwoHanded: Boolean(payload["isTwoHanded"]),
      isConsumable: Boolean(payload["isConsumable"]),
      actsAsFocus: Boolean(payload["actsAsFocus"]),
      isPublic: Boolean(payload["isPublic"]),
      sourceOrigin: (payload["sourceOrigin"] as string) ?? null,
      tags: Array.isArray(payload["tags"]) ? (payload["tags"] as string[]) : [],
      primitiveLinks,
      effectLinks,
      capabilityLinks,
    };
    return { kind: "item", row };
  }

  return null;
}

function SimplifiedPreview({
  targetType,
  payload,
}: {
  targetType: string;
  payload: Record<string, unknown>;
}) {
  const entries = Object.entries(payload).filter(
    ([k]) => k !== "kind" && k !== "contentHash",
  );
  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase text-muted-foreground">
        {targetType.replace(/_/g, " ")} — Version payload
      </p>
      <dl className="space-y-2">
        {entries.map(([key, value]) => (
          <div key={key} className="flex gap-2">
            <dt className="shrink-0 text-xs font-medium text-muted-foreground">
              {key}
            </dt>
            <dd className="min-w-0 flex-1 break-words text-sm text-foreground">
              {typeof value === "object"
                ? JSON.stringify(value, null, 2)
                : String(value ?? "—")}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function VersionPreviewButton({
  targetType,
  targetId,
  versionNumber,
  payload,
  nameMap,
}: VersionPreviewButtonProps) {
  const [open, setOpen] = useState(false);
  const previewItem = mapPayloadToPreviewItem(targetType, targetId, payload, nameMap);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
        title={`Preview v${versionNumber} as it appeared at publication`}
      >
        <Eye className="size-3" />
        Preview
      </button>
      {open ? (
        previewItem ? (
          <SandboxPreviewModal
            item={previewItem}
            onClose={() => setOpen(false)}
            primaryActionLabel={null}
          />
        ) : (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="relative w-full max-w-2xl overflow-hidden rounded-t-2xl bg-card shadow-2xl sm:rounded-2xl max-h-[95vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-card px-6 py-4">
                <p className="text-sm font-semibold">
                  v{versionNumber} — {targetType.replace(/_/g, " ")}
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="shrink-0 rounded-md p-2 hover:bg-accent"
                >
                  ✕
                </button>
              </header>
              <div className="flex-1 overflow-y-auto px-6 py-5">
                <SimplifiedPreview
                  targetType={targetType}
                  payload={payload}
                />
              </div>
              <footer className="sticky bottom-0 flex items-center justify-end border-t border-border bg-card px-6 py-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-9 rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-accent"
                >
                  Close
                </button>
              </footer>
            </div>
          </div>
        )
      ) : null}
    </>
  );
}
