import { SkeletonDetail } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8">
      <SkeletonDetail />
    </div>
  );
}