import { PageSkeleton, ListSkeleton } from "@/components/skeletons";

export default function Loading() {
  return <PageSkeleton stats={4}><ListSkeleton rows={6} /></PageSkeleton>;
}
