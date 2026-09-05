import { PageSkeleton, BoardSkeleton } from "@/components/skeletons";

export default function Loading() {
  return <PageSkeleton><BoardSkeleton columns={4} /></PageSkeleton>;
}
