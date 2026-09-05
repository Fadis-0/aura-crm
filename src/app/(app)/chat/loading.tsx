import { Bar } from "@/components/skeletons";

export default function Loading() {
  return <div className="animate-fade-in space-y-3"><Bar className="h-10 w-48" /><Bar className="h-[70vh] w-full rounded-lg" /></div>;
}
