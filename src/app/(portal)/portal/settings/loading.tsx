import { PageSkeleton, ListSkeleton } from "@/components/skeletons";

export default function Loading() {
  return <div className="mx-auto max-w-2xl"><PageSkeleton withAction={false}><ListSkeleton rows={4} /></PageSkeleton></div>;
}
