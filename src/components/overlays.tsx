"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * How many overlays currently want the page frozen.
 *
 * Counted rather than saved and restored per overlay: a drawer and the confirm
 * dialog inside it are open at once, and when both close in the same update the
 * later cleanup used to write back "hidden" and leave the page unscrollable.
 */
let scrollLocks = 0;

function lockScroll() {
  scrollLocks += 1;
  if (scrollLocks === 1) document.body.style.overflow = "hidden";
}

function unlockScroll() {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks === 0) document.body.style.removeProperty("overflow");
}

/** Locks scroll and wires Escape while an overlay is open. */
function useOverlay(open: boolean, onClose: () => void) {
  // Kept in a ref so a fresh inline onClose does not re-run the lock effect.
  const closeRef = React.useRef(onClose);
  React.useEffect(() => {
    closeRef.current = onClose;
  });

  React.useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };

    lockScroll();
    document.addEventListener("keydown", onKey);

    return () => {
      unlockScroll();
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
}

/* ------------------------------------------------------------------ Modal */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: "sm" | "md" | "lg";
}) {
  useOverlay(open, onClose);
  if (!open) return null;

  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-3xl" };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <div
        className="fixed inset-0 bg-[#1a140c]/45 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative my-auto w-full rounded-xl border border-line bg-surface shadow-float animate-pop-in",
          widths[width],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[17px] leading-tight">{title}</h2>
            {description ? (
              <p className="mt-1 text-[13px] text-ink-3">{description}</p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-4 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-2/60 px-5 py-3.5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/* ----------------------------------------------------------------- Drawer */

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useOverlay(open, onClose);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-[#1a140c]/40 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-line bg-surface shadow-float"
        style={{ animation: "fade-up .24s cubic-bezier(.22,1,.36,1) both" }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-[17px] leading-tight">{title}</h2>
            {subtitle ? (
              <div className="mt-1 text-[12.5px] text-ink-3">{subtitle}</div>
            ) : null}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-4 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-2/60 px-5 py-3.5">
            {footer}
          </div>
        ) : null}
      </aside>
    </div>,
    document.body,
  );
}

/* --------------------------------------------------------------- Dropdown */

type MenuItem =
  | { type: "separator" }
  | {
      type?: "item";
      label: string;
      icon?: React.ComponentType<{ size?: number }>;
      onSelect: () => void;
      danger?: boolean;
    };

export function Menu({
  trigger,
  items,
  align = "end",
}: {
  trigger: React.ReactNode;
  items: MenuItem[];
  align?: "start" | "end";
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute z-40 mt-1.5 min-w-[180px] overflow-hidden rounded-lg border border-line bg-surface p-1 shadow-float animate-pop-in",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {items.map((item, i) =>
            item.type === "separator" ? (
              <div key={i} className="my-1 h-px bg-line" />
            ) : (
              <button
                key={i}
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors",
                  item.danger
                    ? "text-[var(--rose)] hover:bg-[var(--rose-soft)]"
                    : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                )}
              >
                {item.icon ? <item.icon size={14} /> : null}
                {item.label}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------- Confirm */

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Delete",
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} width="sm">
      <p className="text-[13.5px] leading-relaxed text-ink-2">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="h-9 rounded-md border border-line bg-surface px-3.5 text-[13px] font-medium text-ink transition-colors hover:bg-surface-2"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="h-9 rounded-md bg-[var(--rose)] px-3.5 text-[13px] font-medium text-white transition-all hover:brightness-110 disabled:opacity-60"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
