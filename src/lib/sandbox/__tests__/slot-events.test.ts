// =============================================================================
// Tests for the sandbox slot + open-preview event bus.
//
// The bus bridges Library ↔ Form communication inside the sandbox layout.
// We mock `window` so the tests run under vitest's node environment.
// =============================================================================

import { describe, expect, it, vi } from "vitest";

import {
  SLOT_EVENT_NAME,
  OPEN_PREVIEW_EVENT_NAME,
  dispatchSlot,
  dispatchOpenPreview,
} from "@/lib/sandbox/slot-events";

type Listener = (event: Event) => void;

function installWindow() {
  const listeners = new Map<string, Set<Listener>>();
  const win = {
    dispatchEvent: (event: Event) => {
      const set = listeners.get(event.type);
      if (!set) return true;
      for (const fn of set) fn(event);
      return true;
    },
    addEventListener: (type: string, fn: Listener) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener: (type: string, fn: Listener) => {
      listeners.get(type)?.delete(fn);
    },
  };
  vi.stubGlobal("window", win);
  return { win, listeners };
}

describe("sandbox slot-events", () => {
  describe("dispatchSlot", () => {
    it("emits a CustomEvent on window with the slot payload", () => {
      const { listeners } = installWindow();
      const received: CustomEvent[] = [];
      listeners.set(
        SLOT_EVENT_NAME,
        new Set([(e) => received.push(e as CustomEvent)]),
      );

      dispatchSlot({ kind: "primitive", id: 42, label: "Lunge" });

      expect(received).toHaveLength(1);
      expect(received[0]?.type).toBe(SLOT_EVENT_NAME);
      expect(received[0]?.detail).toEqual({
        kind: "primitive",
        id: 42,
        label: "Lunge",
      });
    });

    it("works for effect and capability kinds", () => {
      const { listeners } = installWindow();
      const received: CustomEvent[] = [];
      listeners.set(
        SLOT_EVENT_NAME,
        new Set([(e) => received.push(e as CustomEvent)]),
      );

      dispatchSlot({ kind: "effect", id: "eff-1", label: "Bleed" });
      dispatchSlot({ kind: "capability", id: "cap-1", label: "Rally" });

      expect(received).toHaveLength(2);
      expect(received[0]?.detail).toEqual({
        kind: "effect",
        id: "eff-1",
        label: "Bleed",
      });
      expect(received[1]?.detail).toEqual({
        kind: "capability",
        id: "cap-1",
        label: "Rally",
      });
    });
  });

  describe("dispatchOpenPreview", () => {
    it("emits a CustomEvent on window with the open-preview payload", () => {
      const { listeners } = installWindow();
      const received: CustomEvent[] = [];
      listeners.set(
        OPEN_PREVIEW_EVENT_NAME,
        new Set([(e) => received.push(e as CustomEvent)]),
      );

      dispatchOpenPreview({
        targetType: "PRIMITIVE",
        targetId: "12",
        label: "Parry",
      });

      expect(received).toHaveLength(1);
      expect(received[0]?.type).toBe(OPEN_PREVIEW_EVENT_NAME);
      expect(received[0]?.detail).toEqual({
        targetType: "PRIMITIVE",
        targetId: "12",
        label: "Parry",
      });
    });

    it("supports all targetType values from the canonical enum", () => {
      const types = [
        "PRIMITIVE",
        "EFFECT",
        "CAPABILITY",
        "ITEM",
        "TEMPLATE_RACE",
        "TEMPLATE_CLASS",
        "TEMPLATE_MONSTER",
        "TEMPLATE_ITEM",
      ] as const;

      for (const targetType of types) {
        const { listeners } = installWindow();
        const received: CustomEvent[] = [];
        listeners.set(
          OPEN_PREVIEW_EVENT_NAME,
          new Set([(e) => received.push(e as CustomEvent)]),
        );
        dispatchOpenPreview({ targetType, targetId: "x", label: "Y" });
        expect(received[0]?.detail?.targetType).toBe(targetType);
      }
    });
  });

  describe("server-side safety", () => {
    it("dispatchSlot is a no-op when window is undefined", () => {
      vi.stubGlobal("window", undefined);

      expect(() =>
        dispatchSlot({ kind: "primitive", id: 1, label: "x" }),
      ).not.toThrow();
    });

    it("dispatchOpenPreview is a no-op when window is undefined", () => {
      vi.stubGlobal("window", undefined);

      expect(() =>
        dispatchOpenPreview({
          targetType: "PRIMITIVE",
          targetId: "1",
          label: "x",
        }),
      ).not.toThrow();
    });
  });
});