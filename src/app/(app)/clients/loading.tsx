import { PageSkeleton, CardGridSkeleton } from "@/components/skeletons";

export default function Loading() {
  return <PageSkeleton><CardGridSkeleton columns="sm:grid-cols-2 xl:grid-cols-3" /></PageSkeleton>;
}
