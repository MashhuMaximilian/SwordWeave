"use client";

// =============================================================================
// ProfileFilterChips — Phase 9 follow-up.
//
// Client-side filter chips for the public profile page. Two orthogonal
// dimensions, matching the My Creations page so users have a consistent
// mental model across surfaces:
//
//   - Kind:      All / Forks only / Creations only
//   - Visibility: All / Public / Followers only
//
// The chips drive a Next.js router.push() with `?kind=<value>&visibility=<value>`
// search params, so the URL is shareable / back-button-able. The page
// server component reads these params and passes them to queryLibrary()
// as the `kind` and `visibility` filters.
// =============================================================================

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export type KindFilter = "all" | "fork" | "creation";
export type VisibilityFilter = "all" | "public" | "followers";

interface ProfileFilterChipsProps {
  basePath: string;
  kind: KindFilter;
  visibility: VisibilityFilter;
}

const KIND_CHIPS: Array<{ key: KindFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "fork", label: "Forks only" },
  { key: "creation", label: "Creations only" },
];

const VISIBILITY_CHIPS: Array<{ key: VisibilityFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "public", label: "Public" },
  { key: "followers", label: "Followers only" },
];

export function ProfileFilterChips({
  basePath,
  kind,
  visibility,
}: ProfileFilterChipsProps) {
  const router = useRouter();

  const update = (next: { kind?: KindFilter; visibility?: VisibilityFilter }) => {
    const params = new URLSearchParams();
    const k = next.kind ?? kind;
    const v = next.visibility ?? visibility;
    if (k !== "all") params.set("kind", k);
    if (v !== "all") params.set("visibility", v);
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  };

  return (
    <div className="mt-6 space-y-3">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
          Kind
        </p>
        <div className="flex flex-wrap gap-1.5">
          {KIND_CHIPS.map((c) => {
            const active = kind === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => update({ kind: c.key })}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-primary",
                )}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
          Visibility
        </p>
        <div className="flex flex-wrap gap-1.5">
          {VISIBILITY_CHIPS.map((c) => {
            const active = visibility === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => update({ visibility: c.key })}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-primary",
                )}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
