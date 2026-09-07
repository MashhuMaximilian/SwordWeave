"use client";

/**
 * Phase 9.4 (Mashu 2026-09-07): useCharacterDnd — a single hook
 * that turns DnD drops into PATCH /api/characters/[id]/primitives
 * calls. Used by the heritage accordions + capability cards in
 * the character-sheet workspace.
 *
 * Why a hook (not a route wrapper):
 *   - The DnD primitive components are headless (render-prop).
 *   - Each drop target needs its own onDrop that knows which
 *     target (accordion kind, capability id, item id, effect id)
 *     it represents. Centralizing the PATCH logic + audit logging
 *     + cache busting keeps the drop handlers tiny at the call
 *     site.
 *
 * Returns:
 *   - movePrimitiveTo(target, payload): Promise<boolean>
 *   - deletePrimitive(payload): Promise<boolean>
 *   - boolean isPending
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useToasts } from "@/components/ui/toast";
import { bustResolverCache } from "@/lib/cache/character-resolver-cache";
import type { ChipDragPayload } from "./dnd-primitives";

export type AccordionLike =
  | "LINEAGE"
  | "UPBRINGING"
  | "MANIFEST"
  | "PERSONAL";

export type DnDTarget =
  | { kind: "accordion"; accordion: AccordionLike }
  | { kind: "capability"; capabilityId: string }
  | { kind: "item"; itemId: string }
  | { kind: "effect"; effectId: string }
  | { kind: "delete" }
  | { kind: "mirror"; isMirrored: boolean };

export function useCharacterDnd(characterId: string) {
  const router = useRouter();
  const { showToast } = useToasts();
  const [isPending, setIsPending] = useState(false);

  const movePrimitiveTo = useCallback(
    async (
      target: DnDTarget,
      payload: ChipDragPayload,
    ): Promise<boolean> => {
      if (isPending) return false;
      setIsPending(true);
      try {
        if (target.kind === "delete") {
          if (payload.kind !== "primitive-instance") {
            showToast(
              "Library primitives can't be deleted from a character.",
              "error",
            );
            return false;
          }
          const res = await fetch(
            `/api/characters/${characterId}/primitives/${payload.instanceId}`,
            { method: "DELETE" },
          );
          if (!res.ok) {
            const err = (await res.json().catch(() => ({}))) as {
              error?: string;
            };
            showToast(err.error ?? "Failed to remove primitive.", "error");
            return false;
          }
          bustResolverCache(characterId);
          showToast("Primitive removed.", "success");
          router.refresh();
          return true;
        }

        // Mirror toggle (Phase 9.5 — Mashu 2026-09-07): flips the
        // character_primitives.is_mirrored column via PATCH.
        if (target.kind === "mirror") {
          if (payload.kind !== "primitive-instance") {
            showToast("Library primitives can't be mirrored.", "error");
            return false;
          }
          const res = await fetch(
            `/api/characters/${characterId}/primitives/${payload.instanceId}/mirror`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                isMirrored: target.isMirrored,
              }),
            },
          );
          if (!res.ok) {
            const err = (await res.json().catch(() => ({}))) as {
              error?: string;
            };
            showToast(err.error ?? "Failed to toggle mirror.", "error");
            return false;
          }
          bustResolverCache(characterId);
          showToast(
            target.isMirrored
              ? "Mirrored (no BU cost)."
              : "Unmirrored (counts toward BU again).",
            "success",
          );
          router.refresh();
          return true;
        }

        // Slot vs. move semantics:
        //   - primitive-template: the chip is a library row being
        //     slotted for the first time. Use POST.
        //   - primitive-instance: the chip is on this character.
        //     Use PATCH with the new origin.
        if (payload.kind === "primitive-template") {
          // Phase 9.5: the POST route reads `source` (the accordion
          // destination) + `originCapabilityId` / `originItemId` /
          // `originEffectId` for the nesting origin. The hook
          // translates DnDTarget into that shape.
          const body: Record<string, unknown> = {
            primitiveId: payload.primitiveId,
          };
          if (target.kind === "accordion") {
            body["source"] = target.accordion;
          } else if (target.kind === "capability") {
            body["source"] = "PERSONAL";
            body["originCapabilityId"] = target.capabilityId;
          } else if (target.kind === "item") {
            body["source"] = "PERSONAL";
            body["originItemId"] = target.itemId;
          } else if (target.kind === "effect") {
            body["source"] = "PERSONAL";
            body["originEffectId"] = target.effectId;
          }
          const res = await fetch(
            `/api/characters/${characterId}/primitives`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            },
          );
          if (!res.ok) {
            const err = (await res.json().catch(() => ({}))) as {
              error?: string;
            };
            showToast(err.error ?? "Failed to slot primitive.", "error");
            return false;
          }
          bustResolverCache(characterId);
          showToast("Primitive slotted.", "success");
          router.refresh();
          return true;
        }

        // primitive-instance path — PATCH. The route reads `to`
        // (the accordion target) plus optional `toCapabilityId` /
        // `toItemId` / `toEffectId` to stamp the new origin.
        const body: Record<string, unknown> = {
          to:
            target.kind === "accordion" ? target.accordion : "PERSONAL",
        };
        if (target.kind === "capability") {
          body["toCapabilityId"] = target.capabilityId;
        } else if (target.kind === "item") {
          body["toItemId"] = target.itemId;
        } else if (target.kind === "effect") {
          body["toEffectId"] = target.effectId;
        }
        const res = await fetch(
          `/api/characters/${characterId}/primitives/${payload.instanceId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          showToast(err.error ?? "Failed to move primitive.", "error");
          return false;
          }
          bustResolverCache(characterId);
          showToast("Primitive moved.", "success");
        router.refresh();
        return true;
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Failed to update primitive.",
          "error",
        );
        return false;
      } finally {
        setIsPending(false);
      }
    },
    [characterId, isPending, router],
  );

  const deletePrimitive = useCallback(
    async (payload: ChipDragPayload): Promise<boolean> => {
      return movePrimitiveTo({ kind: "delete" }, payload);
    },
    [movePrimitiveTo],
  );

  const toggleMirror = useCallback(
    async (payload: ChipDragPayload, isMirrored: boolean): Promise<boolean> => {
      return movePrimitiveTo({ kind: "mirror", isMirrored }, payload);
    },
    [movePrimitiveTo],
  );

  return { movePrimitiveTo, deletePrimitive, toggleMirror, isPending };
}
