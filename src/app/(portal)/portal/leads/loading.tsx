import { PageSkeleton, BoardSkeleton } from "@/components/skeletons";

export default function Loading() {
  return <PageSkeleton stats={4}><BoardSkeleton /></PageSkeleton>;
}
