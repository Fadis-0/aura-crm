import { PageSkeleton, ListSkeleton } from "@/components/skeletons";

export default function Loading() {
  return <PageSkeleton stats={3} withAction={false}><ListSkeleton rows={5} /></PageSkeleton>;
}
