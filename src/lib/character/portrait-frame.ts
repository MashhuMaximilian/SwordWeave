import type { CSSProperties } from "react";

export interface PortraitFrame {
  x: number;
  y: number;
  zoom: number;
}

export const DEFAULT_PORTRAIT_FRAME: PortraitFrame = { x: 50, y: 50, zoom: 1 };

export function normalizePortraitFrame(value: unknown): PortraitFrame {
  if (!value || typeof value !== "object" || Array.isArray(value)) return DEFAULT_PORTRAIT_FRAME;
  const source = value as Record<string, unknown>;
  const number = (key: string, fallback: number) => typeof source[key] === "number" && Number.isFinite(source[key]) ? source[key] : fallback;
  return {
    x: Math.max(0, Math.min(100, number("x", 50))),
    y: Math.max(0, Math.min(100, number("y", 50))),
    zoom: Math.max(1, Math.min(3, number("zoom", 1))),
  };
}

export function portraitFrameStyle(value: unknown): CSSProperties {
  const frame = normalizePortraitFrame(value);
  return { objectPosition: `${frame.x}% ${frame.y}%`, transform: `scale(${frame.zoom})` };
}
