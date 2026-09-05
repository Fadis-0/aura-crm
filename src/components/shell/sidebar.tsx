"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, PanelLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui";
import type { Profile } from "@/lib/types";

export type NavCounts = Partial<Record<"leads" | "tasks" | "unread" | "today", number>>;

/**
 * A thin bar that fills across a nav item the moment it is clicked, so the
 * click registers even before the new page has anything to show.
 */
function NavPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;

  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] overflow-hidden rounded-full"
    >
      <span className="route-progress block h-full w-full bg-[var(--clay)]" />
    </span>
  );
}

export function Sidebar({
  profile,
  counts,
  mobileOpen,
  onCloseMobile,
}: {
  profile: Profile | null;
  counts: NavCounts;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // Restoring a persisted preference is only possible after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(localStorage.getItem("crm-sidebar") === "1");
  }, []);

  const toggle = () => {
    setCollapsed((v) => {
      localStorage.setItem("crm-sidebar", v ? "0" : "1");
      return !v;
    });
  };

  return (
    <>
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-30 bg-[#1a140c]/40 backdrop-blur-[2px] lg:hidden"
          onClick={onCloseMobile}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-line bg-paper-2 transition-[width,transform] duration-200",
          collapsed ? "w-[68px]" : "w-[var(--sidebar-w)]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Wordmark */}
        <div className="flex h-[var(--topbar-h)] items-center gap-2.5 border-b border-line px-4">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--clay)] font-display text-[15px] font-semibold text-white shadow-soft">
            A
          </span>
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-[15px] leading-none text-ink">
                Aura
              </p>
              <p className="mt-1 truncate text-[10.5px] uppercase tracking-[0.14em] text-ink-4">
                CRM
              </p>
            </div>
          ) : null}
          {!collapsed ? (
            <button
              onClick={toggle}
              aria-label="Collapse sidebar"
              className="hidden h-7 w-7 place-items-center rounded-md text-ink-4 transition-colors hover:bg-surface-2 hover:text-ink lg:grid"
            >
              <ChevronsLeft size={15} />
            </button>
          ) : null}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {collapsed ? (
            <button
              onClick={toggle}
              aria-label="Expand sidebar"
              className="mb-3 grid h-9 w-full place-items-center rounded-md text-ink-4 transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <PanelLeft size={16} />
            </button>
          ) : null}

          {NAV.map((group) => (
            <div key={group.label} className="mb-5 last:mb-0">
              {!collapsed ? (
                <p className="mb-1.5 px-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-4">
                  {group.label}
                </p>
              ) : null}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href);
                  const count = item.badgeKey ? counts[item.badgeKey] : undefined;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onCloseMobile}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "group relative flex items-center gap-2.5 overflow-hidden rounded-md px-2 py-[7px] text-[13px] font-medium transition-colors",
                          "active:scale-[0.99]",
                          collapsed && "justify-center px-0",
                          active
                            ? "bg-surface text-ink shadow-soft"
                            : "text-ink-3 hover:bg-surface/70 hover:text-ink",
                        )}
                      >
                        {active ? (
                          <span className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--clay)]" />
                        ) : null}
                        <NavPending />
                        <item.icon
                          size={16}
                          strokeWidth={active ? 2.2 : 1.9}
                          className={active ? "text-[var(--clay)]" : ""}
                        />
                        {!collapsed ? (
                          <>
                            <span className="flex-1 truncate">{item.label}</span>
                            {count ? (
                              <span className="rounded-full bg-surface-sunk px-1.5 text-[10.5px] font-semibold tabular-nums text-ink-3">
                                {count}
                              </span>
                            ) : null}
                          </>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <Link
          href="/settings"
          onClick={onCloseMobile}
          className={cn(
            "m-3 flex items-center gap-2.5 rounded-lg border border-line bg-surface p-2 transition-colors hover:border-line-2",
            collapsed && "justify-center",
          )}
        >
          <Avatar
            name={profile?.full_name}
            src={profile?.avatar_url}
            accent={profile?.accent ?? "clay"}
            size="sm"
          />
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-medium text-ink">
                {profile?.full_name ?? "Signed in"}
              </p>
              <p className="truncate text-[11px] text-ink-4">
                {profile?.title ?? profile?.email ?? ""}
              </p>
            </div>
          ) : null}
        </Link>
      </aside>

      <div
        className={cn(
          "hidden shrink-0 transition-[width] duration-200 lg:block",
          collapsed ? "w-[68px]" : "w-[var(--sidebar-w)]",
        )}
      />
    </>
  );
}
