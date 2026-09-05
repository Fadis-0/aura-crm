"use client";

import * as React from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ComboOption = {
  value: string;
  label: string;
  /** Second line, and also searched. */
  hint?: string;
  /** A colour token name, drawn as a dot. */
  accent?: string;
};

/**
 * A select you can type into. Use it wherever the list is a set of records
 * that grows — clients, projects, affiliates — and keep the native Select for
 * fixed enums like status or priority.
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Type to search…",
  emptyLabel = "Nothing matches that",
  clearLabel = "None",
  allowClear = true,
  disabled,
  className,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  options: ComboOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  clearLabel?: string;
  allowClear?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [cursor, setCursor] = React.useState(0);

  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) =>
      `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(q),
    );
  }, [options, query]);

  // Keep the highlight inside the filtered list.
  const active = matches.length === 0 ? 0 : Math.min(cursor, matches.length - 1);

  React.useEffect(() => {
    if (!open) return;

    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  React.useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  React.useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const commit = (next: string | null) => {
    onChange(next);
    setOpen(false);
    setQuery("");
    setCursor(0);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor(Math.min(active + 1, matches.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor(Math.max(active - 1, 0));
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const row = matches[active];
      if (row) commit(row.value);
    }
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-md border border-line bg-surface px-3 text-left text-[13px] transition-colors",
          "hover:border-line-2 disabled:opacity-60",
          open && "border-[var(--clay)] ring-2 ring-[var(--clay)]/18",
        )}
      >
        {selected?.accent ? (
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: `var(--${selected.accent})` }}
          />
        ) : null}
        <span className={cn("flex-1 truncate", selected ? "text-ink" : "text-ink-4")}>
          {selected ? selected.label : placeholder}
        </span>

        {selected && allowClear ? (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Clear"
            onClick={(e) => {
              e.stopPropagation();
              commit(null);
            }}
            className="grid h-5 w-5 shrink-0 place-items-center rounded text-ink-4 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X size={12} />
          </span>
        ) : null}

        <ChevronDown
          size={14}
          className={cn(
            "shrink-0 text-ink-4 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-line bg-surface shadow-float animate-pop-in">
          <div className="flex items-center gap-2 border-b border-line px-2.5">
            <Search size={13} className="shrink-0 text-ink-4" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCursor(0);
              }}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              className="h-9 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-4"
            />
          </div>

          <div ref={listRef} className="max-h-56 overflow-y-auto p-1">
            {allowClear && !query ? (
              <button
                type="button"
                onClick={() => commit(null)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors",
                  value === null ? "text-ink" : "text-ink-3 hover:bg-surface-2",
                )}
              >
                <span className="flex-1">{clearLabel}</span>
                {value === null ? <Check size={13} className="text-[var(--clay)]" /> : null}
              </button>
            ) : null}

            {matches.length === 0 ? (
              <p className="px-2.5 py-6 text-center text-[12.5px] text-ink-4">
                {emptyLabel}
              </p>
            ) : (
              matches.map((o, i) => (
                <button
                  key={o.value}
                  type="button"
                  data-active={i === active}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => commit(o.value)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors",
                    i === active ? "bg-surface-2" : "",
                  )}
                >
                  {o.accent ? (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: `var(--${o.accent})` }}
                    />
                  ) : null}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-ink">{o.label}</span>
                    {o.hint ? (
                      <span className="block truncate text-[11.5px] text-ink-4">
                        {o.hint}
                      </span>
                    ) : null}
                  </span>
                  {o.value === value ? (
                    <Check size={13} className="shrink-0 text-[var(--clay)]" />
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
