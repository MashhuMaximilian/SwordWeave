"use client";

/**
 * Phase 9.2 (Mashu 2026-09-06): native HTML5 drag-and-drop primitives
 * for the BUILD-mode workspace.
 *
 * We deliberately avoid @dnd-kit / react-dnd here — they add ~30kB
 * and overkill for the chip-level interactions in the workspace.
 * Native HTML5 DnD + long-press fallback is enough.
 *
 * Data flow:
 *   <DraggablePrimitiveChip> writes the chip's identity into the
 *     browser's dataTransfer on dragstart. Source: any chip on the
 *     character sheet (lineage / upbringing / manifest / personal /
 *     capability-card body).
 *   <DroppableAccordion> / <DroppableCapabilityCard> read it on
 *     drop and call onDrop(...) which routes to the right API.
 *   <TrashZone> reads it on drop and calls onDelete(...).
 *
 * Touch fallback:
 *   Draggable chips emit long-press via the existing
 *   <LongPressMenu> from Phase 9.1 (which wraps the chip's onClick).
 *   No touch-friendly native DnD on iOS Safari; long-press is the
 *   affordance there.
 */

import {
  useCallback,
  useState,
} from "react";
import { Trash2 } from "lucide-react";

// =============================================================================
// Constants
// =============================================================================

/** Identifier for our chip drag payload, namespaced to avoid colliding
 * with other DnD consumers (the character sheet has rich-text editors
 * that also use dataTransfer). */
export const CHIP_MIME = "application/x-swordweave-chip";

export type ChipDragPayload =
  | {
      kind: "primitive-instance";
      characterId: string;
      instanceId: string;
      primitiveId: number;
      source: "LINEAGE" | "UPBRINGING" | "MANIFEST" | "PERSONAL";
    }
  | {
      kind: "primitive-template";
      characterId: string;
      primitiveId: number;
      source: "LINEAGE" | "UPBRINGING" | "MANIFEST" | "PERSONAL";
    };

export function encodeChipPayload(p: ChipDragPayload): string {
  return JSON.stringify(p);
}

export function decodeChipPayload(text: string): ChipDragPayload | null {
  try {
    const obj = JSON.parse(text);
    if (
      obj &&
      (obj.kind === "primitive-instance" || obj.kind === "primitive-template") &&
      typeof obj.characterId === "string" &&
      typeof obj.primitiveId === "number"
    ) {
      return obj as ChipDragPayload;
    }
    return null;
  } catch {
    return null;
  }
}

// =============================================================================
// DraggablePrimitiveChip
// =============================================================================

export type DraggablePrimitiveChipProps = {
  payload: ChipDragPayload;
  className?: string;
  children: React.ReactNode;
};

/**
 * Wrap any chip on the character sheet to make it draggable. On
 * dragstart the chip's identity is written to dataTransfer; on
 * dragend we clear a small visual flag.
 */
export function DraggablePrimitiveChip({
  payload,
  className,
  children,
}: DraggablePrimitiveChipProps) {
  const [dragging, setDragging] = useState(false);

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.dataTransfer.setData(CHIP_MIME, encodeChipPayload(payload));
      // Plain text fallback so external drop targets (rare) can read it.
      e.dataTransfer.setData("text/plain", payload.kind);
      e.dataTransfer.effectAllowed = "move";
      setDragging(true);
    },
    [payload],
  );

  const handleDragEnd = useCallback(() => {
    setDragging(false);
  }, []);

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={
        "cursor-grab active:cursor-grabbing touch-none select-none" +
        (dragging ? " opacity-50 ring-2 ring-amber-400/60 " : " ") +
        (className ?? "")
      }
      data-dragging={dragging || undefined}
      data-chip-kind={payload.kind}
    >
      {children}
    </div>
  );
}

// =============================================================================
// DroppableAccordion
// =============================================================================

export type DroppableAccordionProps = {
  /** Which accordion this is (so the drop handler knows what to set as source). */
  accordion: "LINEAGE" | "UPBRINGING" | "MANIFEST" | "PERSONAL";
  /** Optional heritage id — when set, the chip is dropped INTO that heritage
   * (originHeritageId = id), not directly slotted into the accordion. */
  heritageId?: string | null;
  /** Drop handler — receives the chip payload. Returns true on success. */
  onDrop: (payload: ChipDragPayload) => Promise<boolean> | boolean;
  /** Whether drops are allowed right now (e.g. only in BUILD mode). */
  enabled?: boolean;
  /** Render-prop so the parent can wire the drop attrs onto its container. */
  children: (dropProps: {
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    isOver: boolean;
    isInvalid: boolean;
  }) => React.ReactNode;
};

/**
 * Headless drop target for heritage accordions. Uses a render-prop
 * pattern so the parent controls the visual styling (dashed ring on
 * hover, blue ring when valid drop, red when invalid).
 */
export function DroppableAccordion({
  accordion: _accordion,
  heritageId: _heritageId,
  onDrop,
  enabled = true,
  children,
}: DroppableAccordionProps) {
  const [isOver, setIsOver] = useState(false);
  const [isInvalid, setIsInvalid] = useState(false);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!enabled) return;
      // Accept our chip mime.
      if (
        e.dataTransfer.types.includes(CHIP_MIME) ||
        e.dataTransfer.types.includes("text/plain")
      ) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setIsOver(true);
        setIsInvalid(false);
      }
    },
    [enabled],
  );

  const handleDragLeave = useCallback(() => {
    setIsOver(false);
    setIsInvalid(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      if (!enabled) return;
      e.preventDefault();
      const raw = e.dataTransfer.getData(CHIP_MIME);
      const payload = raw ? decodeChipPayload(raw) : null;
      setIsOver(false);
      if (!payload) {
        setIsInvalid(true);
        return;
      }
      await onDrop(payload);
    },
    [enabled, onDrop],
  );

  return (
    <>
      {children({
        onDragOver: handleDragOver,
        onDragLeave: handleDragLeave,
        onDrop: handleDrop,
        isOver,
        isInvalid,
      })}
    </>
  );
}

// =============================================================================
// DroppableCapabilityCard
// =============================================================================

export type DroppableCapabilityCardProps = {
  characterId: string;
  capabilityId: string;
  onDrop: (payload: ChipDragPayload) => Promise<boolean> | boolean;
  enabled?: boolean;
  children: (dropProps: {
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    isOver: boolean;
  }) => React.ReactNode;
};

/**
 * Drop target for a single capability card. Dropping a primitive
 * onto this calls onDrop which sets originCapabilityId on the
 * character_primitives row (the resolver walks this column).
 */
export function DroppableCapabilityCard({
  characterId: _characterId,
  capabilityId: _capabilityId,
  onDrop,
  enabled = true,
  children,
}: DroppableCapabilityCardProps) {
  const [isOver, setIsOver] = useState(false);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!enabled) return;
      if (
        e.dataTransfer.types.includes(CHIP_MIME) ||
        e.dataTransfer.types.includes("text/plain")
      ) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setIsOver(true);
      }
    },
    [enabled],
  );

  const handleDragLeave = useCallback(() => {
    setIsOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      if (!enabled) return;
      e.preventDefault();
      const raw = e.dataTransfer.getData(CHIP_MIME);
      const payload = raw ? decodeChipPayload(raw) : null;
      setIsOver(false);
      if (!payload) return;
      await onDrop(payload);
    },
    [enabled, onDrop],
  );

  return (
    <>
      {children({
        onDragOver: handleDragOver,
        onDragLeave: handleDragLeave,
        onDrop: handleDrop,
        isOver,
      })}
    </>
  );
}

// =============================================================================
// TrashZone
// =============================================================================

export type TrashZoneProps = {
  enabled?: boolean;
  onDrop: (payload: ChipDragPayload) => Promise<boolean> | boolean;
  /** Render-prop so the parent (sidebar) styles the trash as it likes. */
  children: (dropProps: {
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    isOver: boolean;
  }) => React.ReactNode;
};

/**
 * Drop target for "delete this chip". Dropping a primitive-instance
 * payload here triggers the existing DELETE
 * /api/characters/[id]/primitives/[instanceId] route.
 */
export function TrashZone({ enabled = true, onDrop, children }: TrashZoneProps) {
  const [isOver, setIsOver] = useState(false);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!enabled) return;
      if (
        e.dataTransfer.types.includes(CHIP_MIME) ||
        e.dataTransfer.types.includes("text/plain")
      ) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setIsOver(true);
      }
    },
    [enabled],
  );

  const handleDragLeave = useCallback(() => {
    setIsOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      if (!enabled) return;
      e.preventDefault();
      const raw = e.dataTransfer.getData(CHIP_MIME);
      const payload = raw ? decodeChipPayload(raw) : null;
      setIsOver(false);
      if (!payload) return;
      // Only primitive-instance chips can be detached (you can't
      // "delete" a library primitive from inside the character sheet).
      if (payload.kind !== "primitive-instance") return;
      await onDrop(payload);
    },
    [enabled, onDrop],
  );

  return (
    <>
      {children({
        onDragOver: handleDragOver,
        onDragLeave: handleDragLeave,
        onDrop: handleDrop,
        isOver,
      })}
    </>
  );
}

// =============================================================================
// Helper: small trash icon button (used inside the sidebar footer)
// =============================================================================

export function TrashIcon() {
  return <Trash2 className="size-4" />;
}
