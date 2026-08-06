import { SkeletonHero, SkeletonRow } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-8">
      <SkeletonHero />
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </div>
  );
}
