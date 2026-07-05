// =============================================================================
// <Skeleton> — base shimmer primitive + composite shapes
//
// Used inside `loading.tsx` files for Suspense-based route loading states.
// Keep these static (no state, no effects) so they're cheap to render
// server-side and never block the route transition.
//
// The shimmer animation respects `prefers-reduced-motion` via Tailwind's
// `motion-reduce:` variant — set globally in globals.css if needed.
// =============================================================================

import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  /** Render as a different element (e.g. span inside a paragraph) */
  as?: "div" | "span";
}

export function Skeleton({ className, as: Tag = "div" }: SkeletonProps) {
  return (
    <Tag
      className={cn(
        "relative overflow-hidden rounded-md bg-muted",
        // Tailwind v4 animation utility — disabled when motion-reduce
        "after:absolute after:inset-0 after:-translate-x-full after:bg-gradient-to-r after:from-transparent after:via-white/10 after:to-transparent after:animate-[shimmer_1.6s_infinite] motion-reduce:after:hidden",
        className,
      )}
      aria-hidden="true"
    />
  );
}

// -----------------------------------------------------------------------------
// Composite shapes — semantic skeletons matching the route they belong to
// -----------------------------------------------------------------------------

/** Card used in library browse grids */
export function SkeletonCard() {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <div className="mt-2 flex gap-2">
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-7 w-16" />
      </div>
    </div>
  );
}

/** Row used in list view of library browse */
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-card p-3">
      <Skeleton className="size-12 shrink-0 rounded-md" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-7 w-20" />
    </div>
  );
}

/** Hero block for a detail page (library item, character) */
export function SkeletonDetail() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-6 w-24" /> {/* breadcrumb */}
      <div className="space-y-3">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      <Skeleton className="h-64 w-full" /> {/* hero image */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
  );
}

/** Compact profile header (avatar + name + stats) */
export function SkeletonProfile() {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 sm:flex-row sm:items-center">
      <Skeleton className="size-20 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-64 max-w-full" />
        <div className="mt-3 flex gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  );
}

/** Grid of cards */
export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/** Stack of rows */
export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}