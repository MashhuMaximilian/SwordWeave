"use client";

/**
 * DataQualityPanel — Phase 8.I i1 (Mashu 2026-08-04)
 *
 * Surfaces primitives with malformed modifiers (e.g. an `attribute`
 * modifier with no PHYSICAL/MENTAL/MAGICAL picked). Lives in the
 * data-atelier view, NOT in the drawer. The drawer follows sheet
 * logic — engine drops invalid modifiers silently.
 *
 * Uses the same validator the form uses (`validateModifierDraft`),
 * so the panel and the form stay in lockstep: if the form rejects
 * the modifier, this panel flags it.
 *
 * NOTE: We can't import server-only `MODIFIER_TARGET_SPEC` here
 * (the validator is client-safe, but the spec lives in
 * modifier-scope which is safe too). We just need to read the
 * modifier shape from the public Primitives API.
 */
import { useEffect, useMemo, useState } from "react";
import { validateModifierDraft } from "@/lib/primitives/modifier-validator";

interface ModifierShape {
  target?: string;
  metadata?: { targetScope?: { values?: unknown[] }; behaviorName?: string };
  // Free-text field on the form is `freeTextNarrowFocus`, but in
  // serialized form (hardModifiers) it lives in metadata.behaviorName.
}

interface PrimitiveRow {
  id: number;
  name: string;
  category: string;
  hardModifiers: ModifierShape[];
}

type PrimitiveApiRow = {
  id?: number | string;
  primitive?: PrimitiveRow;
};

interface PrimitiveApiResponse {
  primitives?: PrimitiveApiRow[];
}

interface MalformedEntry {
  primitiveId: number;
  primitiveName: string;
  category: string;
  modifierIndex: number;
  errorMessage: string;
}

function extractPrimitives(payload: unknown): PrimitiveRow[] {
  if (!payload || typeof payload !== "object") return [];
  const data = payload as PrimitiveApiResponse;
  const list = data.primitives ?? [];
  const out: PrimitiveRow[] = [];
  for (const entry of list) {
    const p = entry.primitive;
    if (p && typeof p.id === "number") {
      out.push(p);
    }
  }
  return out;
}

function auditModifiers(primitives: PrimitiveRow[]): MalformedEntry[] {
  const issues: MalformedEntry[] = [];
  for (const prim of primitives) {
    if (!Array.isArray(prim.hardModifiers)) continue;
    prim.hardModifiers.forEach((mod, idx) => {
      const target = String(mod.target ?? "");
      const scope = mod.metadata?.targetScope;
      const values = Array.isArray(scope?.values)
        ? scope.values.map((v) => String(v))
        : [];
      const behaviorName =
        typeof mod.metadata?.behaviorName === "string"
          ? mod.metadata.behaviorName
          : "";
      const error = validateModifierDraft({
        target,
        targetValues: values,
        freeTextNarrowFocus: behaviorName,
      });
      if (error) {
        issues.push({
          primitiveId: prim.id,
          primitiveName: prim.name,
          category: prim.category,
          modifierIndex: idx + 1,
          errorMessage: error,
        });
      }
    });
  }
  return issues;
}

export function DataQualityPanel() {
  const [primitives, setPrimitives] = useState<PrimitiveRow[] | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/primitives", { method: "GET" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload: unknown = await res.json();
        if (!cancelled) {
          setPrimitives(extractPrimitives(payload));
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Unable to load primitives.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const issues = useMemo(() => {
    if (!primitives) return [];
    return auditModifiers(primitives);
  }, [primitives]);

  if (error) {
    return (
      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
        Could not load modifier audit: {error}
      </div>
    );
  }

  if (!primitives) {
    return (
      <div className="rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
        Scanning primitives for malformed modifiers…
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
        ✓ All {primitives.length} primitives pass modifier validation.
      </div>
    );
  }

  // Group by primitive so the user sees each problematic primitive once
  // with all its bad modifiers listed.
  const byPrimitive = new Map<number, { name: string; category: string; issues: MalformedEntry[] }>();
  for (const issue of issues) {
    const existing = byPrimitive.get(issue.primitiveId);
    if (existing) {
      existing.issues.push(issue);
    } else {
      byPrimitive.set(issue.primitiveId, {
        name: issue.primitiveName,
        category: issue.category,
        issues: [issue],
      });
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="font-semibold text-amber-200">
          ⚠ {issues.length} modifier{issues.length === 1 ? "" : "s"} across{" "}
          {byPrimitive.size} primitive{byPrimitive.size === 1 ? "" : "s"} need review
        </span>
        <span className="text-amber-200/70">{open ? "▾" : "▸"}</span>
      </button>
      <p className="text-[10px] text-amber-200/70">
        The engine silently drops these from sheet calculations. Open the
        primitive, pick at least one sub-target, and re-save to fix.
      </p>
      {open ? (
        <ul className="mt-2 space-y-2">
          {Array.from(byPrimitive.entries()).map(([id, entry]) => (
            <li
              key={id}
              className="rounded border border-amber-500/30 bg-background px-3 py-2 text-foreground"
            >
              <p className="font-medium">
                {entry.name}{" "}
                <span className="text-[10px] text-muted-foreground">
                  ({entry.category})
                </span>
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[11px]">
                {entry.issues.map((i) => (
                  <li key={i.modifierIndex}>
                    Modifier {i.modifierIndex}: {i.errorMessage}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}