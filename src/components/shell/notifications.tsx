"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Bell,
  BellRing,
  CheckCheck,
  Coins,
  ExternalLink,
  FolderPlus,
  Megaphone,
  ShieldAlert,
  Target,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import { Modal } from "@/components/overlays";
import { Button } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn, relativeTime } from "@/lib/utils";
// `Notification` is also a browser global, and this file uses both.
import type { Notification as Note } from "@/lib/types";

const KIND_META: Record<
  string,
  { icon: typeof Bell; accent: string; label: string }
> = {
  "marketer.signup": { icon: UserPlus, accent: "clay", label: "Signup" },
  "lead.created": { icon: Target, accent: "indigo", label: "New lead" },
  "lead.stage": { icon: TrendingUp, accent: "amber", label: "Lead moved" },
  "project.joined": { icon: FolderPlus, accent: "sage", label: "Project" },
  "project.opened": { icon: Megaphone, accent: "clay", label: "Project open" },
  "account.approved": { icon: BadgeCheck, accent: "sage", label: "Account" },
  "account.suspended": { icon: ShieldAlert, accent: "rose", label: "Account" },
  "commission.earned": { icon: Coins, accent: "amber", label: "Commission" },
  "commission.paid": { icon: Coins, accent: "sage", label: "Paid" },
  announcement: { icon: Megaphone, accent: "indigo", label: "Announcement" },
};

const metaFor = (kind: string) =>
  KIND_META[kind] ?? { icon: Bell, accent: "indigo", label: "Update" };

/**
 * The browser owns the permission value, so React reads it rather than
 * mirroring it. "unsupported" covers old browsers, and iOS Safari outside an
 * installed app; it is also what the server renders, so hydration matches.
 */
let permissionListeners: (() => void)[] = [];

const permissionStore = {
  subscribe(cb: () => void) {
    permissionListeners = [...permissionListeners, cb];
    return () => {
      permissionListeners = permissionListeners.filter((l) => l !== cb);
    };
  },
  read(): NotificationPermission | "unsupported" {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "unsupported";
    }
    return window.Notification.permission;
  },
  server: () => "unsupported" as const,
};

const permissionChanged = () => permissionListeners.forEach((l) => l());

const fullDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

export function Notifications({
  initial,
  emptyLabel = "Nothing yet. Signups, new leads and project pickups land here.",
}: {
  initial: Note[];
  emptyLabel?: string;
}) {
  const sb = supabaseBrowser();
  const router = useRouter();

  const [items, setItems] = useState(initial);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Note | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const permission = useSyncExternalStore(
    permissionStore.subscribe,
    permissionStore.read,
    permissionStore.server,
  );

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

  /**
   * Raises the desktop popup. It lives in a ref because the realtime
   * subscription below is set up once, and would otherwise close over the
   * permission state as it was on the first render.
   */
  const popRef = useRef<(n: Note) => void>(() => {});

  useEffect(() => {
    popRef.current = (n) => {
      if (typeof window === "undefined" || !("Notification" in window)) return;
      if (window.Notification.permission !== "granted") return;

      try {
        const popup = new window.Notification(n.title, {
          body: n.body ?? undefined,
          icon: "/favicon.ico",
          // Stops a re-delivered row from stacking up twice.
          tag: n.id,
        });
        popup.onclick = () => {
          window.focus();
          setActive(n);
          popup.close();
        };
      } catch {
        // A few browsers only allow this through a service worker. The bell
        // still updates, so there is nothing to recover from.
      }
    };
  });

  // New notifications arrive without a reload.
  useEffect(() => {
    const channel = sb
      .channel("notifications-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload: { new: Note }) => {
          let fresh = false;
          setItems((rows) => {
            if (rows.some((r) => r.id === payload.new.id)) return rows;
            fresh = true;
            return [payload.new, ...rows].slice(0, 40);
          });
          if (fresh) popRef.current(payload.new);
        },
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const askPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const result = await window.Notification.requestPermission();
    permissionChanged();
    if (result === "granted") {
      new window.Notification("Desktop alerts are on", {
        body: "New notifications will pop up here.",
        icon: "/favicon.ico",
      });
    }
  };

  const markAllRead = useCallback(async () => {
    const ids = items.filter((n) => !n.read_at).map((n) => n.id);
    if (ids.length === 0) return;

    const now = new Date().toISOString();
    setItems((rows) => rows.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    await sb.from("notifications").update({ read_at: now }).in("id", ids);
  }, [items, sb]);

  const markRead = async (n: Note) => {
    if (n.read_at) return;
    const now = new Date().toISOString();
    setItems((rows) => rows.map((r) => (r.id === n.id ? { ...r, read_at: now } : r)));
    await sb.from("notifications").update({ read_at: now }).eq("id", n.id);
  };

  /** Every notification opens its details; following the link is a step inside. */
  const openDetails = (n: Note) => {
    markRead(n);
    setActive(n);
    setOpen(false);
  };

  const follow = (n: Note) => {
    setActive(null);
    if (n.href) router.push(n.href);
  };

  const activeMeta = active ? metaFor(active.kind) : null;
  const ActiveIcon = activeMeta?.icon ?? Bell;

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
        <div className="absolute right-0 z-50 mt-1.5 w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-line bg-surface shadow-float animate-pop-in">
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

          {permission === "default" ? (
            <button
              onClick={askPermission}
              className="flex w-full items-center gap-2 border-b border-line bg-[var(--clay-soft)]/40 px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--clay-soft)]/70"
            >
              <BellRing size={14} className="shrink-0 text-[var(--clay)]" />
              <span className="text-[11.5px] leading-snug text-ink-2">
                Turn on desktop alerts so these pop up while Aura is open.
              </span>
            </button>
          ) : null}

          {permission === "denied" ? (
            <p className="border-b border-line px-3.5 py-2 text-[11px] leading-snug text-ink-4">
              Desktop alerts are blocked for this site. Allow them in your
              browser&rsquo;s site settings to get popups.
            </p>
          ) : null}

          <div className="max-h-[380px] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-10 text-center text-[12.5px] text-ink-4">
                {emptyLabel}
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {items.map((n) => {
                  const meta = metaFor(n.kind);
                  const Icon = meta.icon;

                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => openDetails(n)}
                        className={cn(
                          "block w-full px-3.5 py-2.5 text-left transition-colors hover:bg-surface-2",
                          !n.read_at && "bg-[var(--clay-soft)]/35",
                        )}
                      >
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
                            <p className="text-[12.5px] leading-snug text-ink">
                              {n.title}
                            </p>
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
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      <Modal
        open={active !== null}
        onClose={() => setActive(null)}
        title={active?.title ?? ""}
        width="sm"
        footer={
          <>
            <Button onClick={() => setActive(null)}>Close</Button>
            {active?.href ? (
              <Button variant="primary" onClick={() => follow(active)}>
                <ExternalLink size={14} />
                Open
              </Button>
            ) : null}
          </>
        }
      >
        {active ? (
          <div>
            <div className="flex items-center gap-2.5">
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
                style={{
                  background: `var(--${activeMeta!.accent}-soft)`,
                  color: `var(--${activeMeta!.accent})`,
                }}
              >
                <ActiveIcon size={17} />
              </span>
              <div className="min-w-0">
                <p className="text-[12.5px] font-medium text-ink-2">
                  {activeMeta!.label}
                </p>
                <p className="text-[11.5px] text-ink-4">
                  {fullDate(active.created_at)}
                </p>
              </div>
            </div>

            {active.body ? (
              <p className="mt-4 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">
                {active.body}
              </p>
            ) : (
              <p className="mt-4 text-[13px] text-ink-4">No further detail.</p>
            )}

            {active.href ? (
              <p className="mt-4 truncate rounded-md border border-line bg-surface-2 px-2.5 py-2 font-mono text-[11.5px] text-ink-3">
                {active.href}
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
