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
} from "@/components/sandbox/sandbox-preview-modal";

interface VersionPreviewButtonProps {
  targetType: string;
  targetId: string;
  versionNumber: number;
  payload: Record<string, unknown>;
}

function mapPayloadToPreviewItem(
  targetType: string,
  targetId: string,
  payload: Record<string, unknown>,
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
  // Effects, capabilities, templates, items — the payload has scalar
  // fields but not the full composed-entity tree needed for the unified
  // preview. Return null so the caller can fall back to a simpler view.
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
}: VersionPreviewButtonProps) {
  const [open, setOpen] = useState(false);
  const previewItem = mapPayloadToPreviewItem(targetType, targetId, payload);

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
