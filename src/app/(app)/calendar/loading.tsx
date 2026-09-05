import { PageSkeleton, Bar } from "@/components/skeletons";

export default function Loading() {
  return <PageSkeleton><Bar className="h-[520px] w-full rounded-lg" /></PageSkeleton>;
}
