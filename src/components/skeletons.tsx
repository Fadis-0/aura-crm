import { cn } from "@/lib/utils";

/**
 * Page-shaped placeholders shown by each route's loading.tsx while the server
 * renders. They mirror the real layout so nothing jumps when the data lands.
 */

export function Bar({ className }: { className?: string }) {
  return <div className={cn("skeleton h-3", className)} />;
}

function HeaderBlock({ withAction = true }: { withAction?: boolean }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="w-full max-w-md">
        <Bar className="h-2.5 w-20" />
        <Bar className="mt-3 h-7 w-52" />
        <Bar className="mt-3 h-3 w-full max-w-sm" />
      </div>
      {withAction ? <Bar className="h-9 w-24 rounded-md" /> : null}
    </div>
  );
}

export function StatRow({ count = 4 }: { count?: number }) {
  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-line bg-surface p-4">
          <Bar className="h-9 w-9 rounded-lg" />
          <Bar className="mt-4 h-6 w-24" />
          <Bar className="mt-3 h-2.5 w-28" />
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({
  count = 6,
  columns = "md:grid-cols-2 xl:grid-cols-3",
}: {
  count?: number;
  columns?: string;
}) {
  return (
    <div className={cn("grid gap-3", columns)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-line bg-surface p-4">
          <div className="flex items-start gap-3">
            <Bar className="h-10 w-10 rounded-full" />
            <div className="flex-1">
              <Bar className="h-3.5 w-32" />
              <Bar className="mt-2 h-2.5 w-24" />
            </div>
          </div>
          <Bar className="mt-4 h-2.5 w-full" />
          <Bar className="mt-2 h-2.5 w-4/5" />
          <div className="mt-4 flex gap-2 border-t border-line pt-3">
            <Bar className="h-3 w-16" />
            <Bar className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="border-b border-line bg-surface-2/60 px-4 py-3">
        <Bar className="h-3 w-40" />
      </div>
      <ul className="divide-y divide-line">
        {Array.from({ length: rows }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-3">
            <Bar className="h-9 w-9 rounded-full" />
            <div className="min-w-0 flex-1">
              <Bar className="h-3 w-40" />
              <Bar className="mt-2 h-2.5 w-56" />
            </div>
            <Bar className="h-6 w-16 rounded-full" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BoardSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <div className="-mx-1 flex gap-3 overflow-hidden px-1">
      {Array.from({ length: columns }).map((_, i) => (
        <div key={i} className="w-[268px] shrink-0">
          <div className="mb-2 flex items-center gap-2 px-1">
            <Bar className="h-2 w-2 rounded-full" />
            <Bar className="h-3 w-20" />
          </div>
          <div className="space-y-2 rounded-lg border border-dashed border-line bg-surface-2/40 p-2">
            {Array.from({ length: 3 - (i % 2) }).map((_, j) => (
              <div key={j} className="rounded-lg border border-line bg-surface p-3">
                <Bar className="h-3 w-28" />
                <Bar className="mt-2 h-2.5 w-20" />
                <Bar className="mt-3 h-3.5 w-16" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- pages --- */

export function PageSkeleton({
  stats,
  children,
  withAction = true,
}: {
  stats?: number;
  children: React.ReactNode;
  withAction?: boolean;
}) {
  return (
    <div className="animate-fade-in">
      <HeaderBlock withAction={withAction} />
      {stats ? <StatRow count={stats} /> : null}
      {children}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <Bar className="h-2.5 w-40" />
        <Bar className="mt-3 h-7 w-64" />
        <Bar className="mt-3 h-3 w-80" />
      </div>
      <StatRow />
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="rounded-lg border border-line bg-surface p-5">
          <Bar className="h-3.5 w-24" />
          <Bar className="mt-5 h-[200px] w-full rounded-lg" />
        </div>
        <div className="rounded-lg border border-line bg-surface p-5">
          <Bar className="h-3.5 w-20" />
          <div className="mt-5 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i}>
                <Bar className="h-2.5 w-24" />
                <Bar className="mt-2 h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-line bg-surface p-5">
            <Bar className="h-3.5 w-28" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <Bar key={j} className="h-9 w-full rounded-md" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="animate-fade-in">
      <Bar className="mb-4 h-3 w-24" />
      <HeaderBlock />
      <StatRow />
      <div className="grid gap-4 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-4">
            {Array.from({ length: 2 }).map((_, j) => (
              <div key={j} className="rounded-lg border border-line bg-surface p-5">
                <Bar className="h-3.5 w-32" />
                <div className="mt-4 space-y-2.5">
                  {Array.from({ length: 4 }).map((_, k) => (
                    <Bar key={k} className="h-8 w-full rounded-md" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
