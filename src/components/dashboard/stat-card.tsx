import Link from "next/link";
import { ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";
import { cn, type Accent } from "@/lib/utils";

const TINT: Record<Accent, string> = {
  clay: "bg-[var(--clay-soft)] text-[var(--clay)]",
  amber: "bg-[var(--amber-soft)] text-[var(--amber)]",
  sage: "bg-[var(--sage-soft)] text-[var(--sage)]",
  indigo: "bg-[var(--indigo-soft)] text-[var(--indigo)]",
  plum: "bg-[var(--plum-soft)] text-[var(--plum)]",
  rose: "bg-[var(--rose-soft)] text-[var(--rose)]",
};

export function StatCard({
  label,
  value,
  sub,
  delta,
  accent = "clay",
  icon,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: number | null;
  accent?: Accent;
  /** A rendered element: components cannot be passed from a Server Component. */
  icon: React.ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className={cn("grid h-9 w-9 place-items-center rounded-lg", TINT[accent])}>
          {icon}
        </span>
        {href ? (
          <ArrowUpRight
            size={15}
            className="text-ink-4 opacity-0 transition-opacity group-hover:opacity-100"
          />
        ) : null}
      </div>

      <p className="mt-4 font-display text-[27px] leading-none tracking-tight tabular-nums">
        {value}
      </p>

      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-[12.5px] font-medium text-ink-3">{label}</p>
        {typeof delta === "number" ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[11.5px] font-semibold tabular-nums",
              delta >= 0 ? "text-[var(--sage)]" : "text-[var(--rose)]",
            )}
          >
            {delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(delta)}%
          </span>
        ) : null}
      </div>

      {sub ? <p className="mt-1 text-[11.5px] text-ink-4">{sub}</p> : null}
    </>
  );

  const className =
    "group block rounded-lg border border-line bg-surface p-4 shadow-soft transition-all hover:border-line-2 hover:shadow-raised";

  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
