"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Bell,
  CheckCheck,
  Coins,
  FolderPlus,
  Megaphone,
  ShieldAlert,
  Target,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn, relativeTime } from "@/lib/utils";
import type { Notification } from "@/lib/types";

const KIND_META: Record<
  string,
  { icon: typeof Bell; accent: string }
> = {
  "marketer.signup": { icon: UserPlus, accent: "clay" },
  "lead.created": { icon: Target, accent: "indigo" },
  "lead.stage": { icon: TrendingUp, accent: "amber" },
  "project.joined": { icon: FolderPlus, accent: "sage" },
  "project.opened": { icon: Megaphone, accent: "clay" },
  "account.approved": { icon: BadgeCheck, accent: "sage" },
  "account.suspended": { icon: ShieldAlert, accent: "rose" },
  "commission.earned": { icon: Coins, accent: "amber" },
  "commission.paid": { icon: Coins, accent: "sage" },
};

export function Notifications({
  initial,
  emptyLabel = "Nothing yet. Signups, new leads and project pickups land here.",
}: {
  initial: Notification[];
  emptyLabel?: string;
}) {
  const sb = supabaseBrowser();

  const [items, setItems] = useState(initial);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unread = items.filter((n) => !n.read_at).length;

  useEffect(() => {
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

  // New notifications arrive without a reload.
  useEffect(() => {
    const channel = sb
      .channel("notifications-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload: { new: Notification }) => {
          setItems((rows) =>
            rows.some((r) => r.id === payload.new.id)
              ? rows
              : [payload.new, ...rows].slice(0, 40),
          );
        },
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markAllRead = useCallback(async () => {
    const ids = items.filter((n) => !n.read_at).map((n) => n.id);
    if (ids.length === 0) return;

    const now = new Date().toISOString();
    setItems((rows) => rows.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    await sb.from("notifications").update({ read_at: now }).in("id", ids);
  }, [items, sb]);

  const markRead = async (n: Notification) => {
    if (n.read_at) return;
    const now = new Date().toISOString();
    setItems((rows) => rows.map((r) => (r.id === n.id ? { ...r, read_at: now } : r)));
    await sb.from("notifications").update({ read_at: now }).eq("id", n.id);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={unread ? `${unread} unread notifications` : "Notifications"}
        className={cn(
          "relative grid h-9 w-9 place-items-center rounded-md transition-colors",
          open ? "bg-surface-2 text-ink" : "text-ink-3 hover:bg-surface-2 hover:text-ink",
        )}
      >
        <Bell size={17} />
        {unread > 0 ? (
          <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--clay)] px-1 text-[9.5px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-1.5 w-[340px] overflow-hidden rounded-lg border border-line bg-surface shadow-float animate-pop-in">
          <div className="flex items-center gap-2 border-b border-line px-3.5 py-2.5">
            <h3 className="text-[13px]">Notifications</h3>
            {unread > 0 ? (
              <span className="rounded-full bg-[var(--clay-soft)] px-1.5 text-[10.5px] font-semibold text-[var(--clay)]">
                {unread} new
              </span>
            ) : null}
            <button
              onClick={markAllRead}
              disabled={unread === 0}
              className="ml-auto inline-flex items-center gap-1 text-[11.5px] font-medium text-ink-3 transition-colors hover:text-ink disabled:opacity-40"
            >
              <CheckCheck size={12} />
              Mark all read
            </button>
          </div>

          <div className="max-h-[380px] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-10 text-center text-[12.5px] text-ink-4">
                {emptyLabel}
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {items.map((n) => {
                  const meta = KIND_META[n.kind] ?? { icon: Bell, accent: "indigo" };
                  const Icon = meta.icon;

                  const body = (
                    <div className="flex gap-2.5">
                      <span
                        className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg"
                        style={{
                          background: `var(--${meta.accent}-soft)`,
                          color: `var(--${meta.accent})`,
                        }}
                      >
                        <Icon size={14} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] leading-snug text-ink">{n.title}</p>
                        {n.body ? (
                          <p className="mt-0.5 truncate text-[11.5px] text-ink-4">
                            {n.body}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[10.5px] text-ink-4">
                          {relativeTime(n.created_at)}
                        </p>
                      </div>
                      {!n.read_at ? (
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--clay)]" />
                      ) : null}
                    </div>
                  );

                  return (
                    <li key={n.id}>
                      {n.href ? (
                        <Link
                          href={n.href}
                          onClick={() => {
                            markRead(n);
                            setOpen(false);
                          }}
                          className={cn(
                            "block px-3.5 py-2.5 transition-colors hover:bg-surface-2",
                            !n.read_at && "bg-[var(--clay-soft)]/35",
                          )}
                        >
                          {body}
                        </Link>
                      ) : (
                        <button
                          onClick={() => markRead(n)}
                          className={cn(
                            "block w-full px-3.5 py-2.5 text-left transition-colors hover:bg-surface-2",
                            !n.read_at && "bg-[var(--clay-soft)]/35",
                          )}
                        >
                          {body}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
