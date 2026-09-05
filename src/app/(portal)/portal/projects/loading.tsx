import { PageSkeleton, CardGridSkeleton } from "@/components/skeletons";

export default function Loading() {
  return <PageSkeleton withAction={false}><CardGridSkeleton /></PageSkeleton>;
}
