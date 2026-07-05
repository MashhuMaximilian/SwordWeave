import { SkeletonProfile, SkeletonList } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8">
      <SkeletonProfile />
      <div className="mt-8 space-y-6">
        <div className="space-y-2">
          <div className="h-5 w-32 animate-pulse rounded-md bg-muted" />
          <SkeletonList count={4} />
        </div>
      </div>
    </div>
  );
}