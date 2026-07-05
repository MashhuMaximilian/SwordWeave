import { SkeletonGrid } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8">
      <div className="mb-6 space-y-3">
        <div className="h-8 w-64 animate-pulse rounded-md bg-muted" />
        <div className="h-10 w-full max-w-md animate-pulse rounded-md bg-muted" />
      </div>
      <SkeletonGrid count={9} />
    </div>
  );
}