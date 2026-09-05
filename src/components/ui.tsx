"use client";

import * as React from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { cn, initials, type Accent } from "@/lib/utils";

/* ------------------------------------------------------------------ Button */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--clay)] text-white hover:bg-[var(--clay-hi)] shadow-soft border border-transparent",
  secondary:
    "bg-surface text-ink border border-line hover:bg-surface-2 hover:border-line-2 shadow-soft",
  outline:
    "bg-transparent text-ink-2 border border-line-2 hover:bg-surface-2 hover:text-ink",
  ghost: "bg-transparent text-ink-3 hover:bg-surface-2 hover:text-ink border border-transparent",
  danger:
    "bg-[var(--rose)] text-white hover:brightness-110 border border-transparent shadow-soft",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-[13px] gap-1.5 rounded-md",
  md: "h-9 px-3.5 text-[13px] gap-2 rounded-md",
  lg: "h-11 px-5 text-sm gap-2 rounded-lg",
  icon: "h-9 w-9 rounded-md",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant = "secondary", size = "md", loading, children, disabled, ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex select-none items-center justify-center font-medium transition-all duration-150",
          "active:scale-[0.985] disabled:pointer-events-none disabled:opacity-50",
          BUTTON_VARIANTS[variant],
          BUTTON_SIZES[size],
          className,
        )}
        {...props}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : null}
        {children}
      </button>
    );
  },
);

/* -------------------------------------------------------------------- Card */

export function Card({
  className,
  inset,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-line bg-surface shadow-soft",
        inset && "p-5",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b border-line px-5 py-3.5",
        className,
      )}
    >
      <div className="min-w-0">
        <h3 className="truncate text-[15px] leading-tight">{title}</h3>
        {subtitle ? (
          <p className="mt-0.5 truncate text-[12.5px] text-ink-3">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------- Badge */

const ACCENT_SOFT: Record<Accent | "neutral", string> = {
  clay: "bg-[var(--clay-soft)] text-[var(--clay)]",
  amber: "bg-[var(--amber-soft)] text-[var(--amber)]",
  sage: "bg-[var(--sage-soft)] text-[var(--sage)]",
  indigo: "bg-[var(--indigo-soft)] text-[var(--indigo)]",
  plum: "bg-[var(--plum-soft)] text-[var(--plum)]",
  rose: "bg-[var(--rose-soft)] text-[var(--rose)]",
  neutral: "bg-surface-2 text-ink-3",
};

export function Badge({
  accent = "neutral",
  dot,
  className,
  children,
}: {
  accent?: Accent | "neutral";
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-medium leading-5 whitespace-nowrap",
        ACCENT_SOFT[accent],
        className,
      )}
    >
      {dot ? (
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      ) : null}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ Avatar */

const AVATAR_SOLID: Record<Accent, string> = {
  clay: "bg-[var(--clay)]",
  amber: "bg-[var(--amber)]",
  sage: "bg-[var(--sage)]",
  indigo: "bg-[var(--indigo)]",
  plum: "bg-[var(--plum)]",
  rose: "bg-[var(--rose)]",
};

const AVATAR_SIZES = { xs: "h-6 w-6 text-[10px]", sm: "h-8 w-8 text-[11px]", md: "h-10 w-10 text-[13px]", lg: "h-14 w-14 text-lg" };

export function Avatar({
  name,
  src,
  accent = "clay",
  size = "sm",
  className,
}: {
  name?: string | null;
  src?: string | null;
  accent?: Accent;
  size?: keyof typeof AVATAR_SIZES;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold text-white ring-1 ring-black/5",
        AVATAR_SIZES[size],
        !src && AVATAR_SOLID[accent],
        className,
      )}
      title={name ?? undefined}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name ?? ""} className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

/* ------------------------------------------------------------ Form fields */

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-9 w-full rounded-md border border-line bg-surface px-3 text-[13px] text-ink",
        "placeholder:text-ink-4 transition-colors hover:border-line-2",
        "focus:border-[var(--clay)] focus:outline-none focus:ring-2 focus:ring-[var(--clay)]/18",
        "disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-md border border-line bg-surface px-3 py-2 text-[13px] leading-relaxed text-ink",
        "placeholder:text-ink-4 transition-colors hover:border-line-2 resize-y",
        "focus:border-[var(--clay)] focus:outline-none focus:ring-2 focus:ring-[var(--clay)]/18",
        className,
      )}
      {...props}
    />
  );
});

/**
 * The native select, kept for short fixed lists.
 *
 * The chevron is a real icon rather than a background image so it follows the
 * theme, and the option popup is drawn by the browser: `color-scheme` on the
 * element is what makes that popup dark rather than grey-on-white.
 */
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <span className="relative block w-full">
      <select
        ref={ref}
        className={cn(
          "h-9 w-full appearance-none rounded-md border border-line bg-surface px-3 pr-9 text-[13px] text-ink",
          "transition-colors hover:border-line-2",
          "focus:border-[var(--clay)] focus:outline-none focus:ring-2 focus:ring-[var(--clay)]/18",
          "disabled:opacity-60",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={14}
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-4"
      />
    </span>
  );
});


export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 flex items-baseline gap-1.5 text-[12px] font-medium text-ink-2">
        {label}
        {required ? <span className="text-[var(--clay)]">*</span> : null}
        {hint ? <span className="font-normal text-ink-4">{hint}</span> : null}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-[12px] text-[var(--rose)]">{error}</span>
      ) : null}
    </label>
  );
}

/* -------------------------------------------------------------- Segmented */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-line bg-surface-2 p-0.5",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium transition-all",
              active
                ? "bg-surface text-ink shadow-soft"
                : "text-ink-3 hover:text-ink",
            )}
          >
            {o.label}
            {typeof o.count === "number" ? (
              <span
                className={cn(
                  "rounded px-1 text-[10.5px] tabular-nums",
                  active ? "bg-surface-2 text-ink-3" : "text-ink-4",
                )}
              >
                {o.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------- Page furniture */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-4">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-[26px] leading-tight">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-[13.5px] text-ink-3">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/**
 * `icon` takes a rendered element, not a component. A component is a function,
 * and functions cannot cross the server/client boundary as props — passing one
 * from a Server Component throws at render time.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-line-2 bg-surface-2/50 px-6 py-14 text-center",
        className,
      )}
    >
      <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-surface text-ink-4 shadow-soft">
        {icon}
      </span>
      <p className="font-display text-[15px] text-ink">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-[13px] text-ink-3">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-surface-sunk", className)}
      aria-hidden
    />
  );
}

/* -------------------------------------------------------------- Progress */

export function Progress({
  value,
  accent = "clay",
  className,
}: {
  value: number;
  accent?: Accent;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-sunk", className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", AVATAR_SOLID[accent])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
