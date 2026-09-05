"use client";

import { useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Coins,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Target,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui";
import { Menu as DropMenu } from "@/components/overlays";
import { ThemeToggle } from "@/components/theme";
import { Notifications } from "@/components/shell/notifications";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Notification, Profile } from "@/lib/types";

const NAV = [
  { href: "/portal", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/portal/projects", label: "Projects", icon: FolderOpen },
  { href: "/portal/leads", label: "My leads", icon: Target },
  { href: "/portal/earnings", label: "Earnings", icon: Coins },
  { href: "/portal/settings", label: "Settings", icon: Settings },
];

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

function PortalSidebar({
  profile,
  mobileOpen,
  onCloseMobile,
}: {
  profile: Profile;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();
  const links = NAV.map((item) => ({
    ...item,
    active: item.exact ? pathname === item.href : pathname.startsWith(item.href),
  }));

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
          "fixed inset-y-0 left-0 z-40 flex w-[var(--sidebar-w)] flex-col border-r border-line bg-paper-2 transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex h-[var(--topbar-h)] items-center gap-2.5 border-b border-line px-4">
          <Link href="/portal" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--clay)] font-display text-[15px] font-semibold text-white shadow-soft">
              A
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-[15px] leading-none text-ink">
                Aura
              </p>
              <p className="mt-1 truncate text-[10.5px] uppercase tracking-[0.14em] text-ink-4">
                Partner
              </p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-0.5">
            {links.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onCloseMobile}
                  className={cn(
                    "group relative flex items-center gap-2.5 overflow-hidden rounded-md px-2 py-[7px] text-[13px] font-medium transition-colors",
                    "active:scale-[0.99]",
                    item.active
                      ? "bg-surface text-ink shadow-soft"
                      : "text-ink-3 hover:bg-surface/70 hover:text-ink",
                  )}
                >
                  {item.active ? (
                    <span className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--clay)]" />
                  ) : null}
                  <NavPending />
                  <item.icon
                    size={16}
                    strokeWidth={item.active ? 2.2 : 1.9}
                    className={item.active ? "text-[var(--clay)]" : ""}
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <Link
          href="/portal/settings"
          onClick={onCloseMobile}
          className="m-3 flex items-center gap-2.5 rounded-lg border border-line bg-surface p-2 transition-colors hover:border-line-2"
        >
          <Avatar
            name={profile.full_name}
            src={profile.avatar_url}
            accent={profile.accent}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-medium text-ink">
              {profile.full_name}
            </p>
            <p className="truncate text-[11px] text-ink-4">{profile.email}</p>
          </div>
        </Link>
      </aside>

      <div className="hidden w-[var(--sidebar-w)] shrink-0 lg:block" />
    </>
  );
}

export function PortalShell({
  profile,
  notifications,
  children,
}: {
  profile: Profile;
  notifications: Notification[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [mobileNav, setMobileNav] = useState(false);

  const signOut = async () => {
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen">
      <PortalSidebar
        profile={profile}
        mobileOpen={mobileNav}
        onCloseMobile={() => setMobileNav(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-[var(--topbar-h)] shrink-0 items-center gap-3 border-b border-line bg-paper/85 px-4 backdrop-blur-md sm:px-6">
          <button
            onClick={() => setMobileNav((v) => !v)}
            aria-label="Menu"
            className="grid h-9 w-9 place-items-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink lg:hidden"
          >
            {mobileNav ? <X size={18} /> : <Menu size={18} />}
          </button>

          <div className="flex-1" />

          <Notifications
            initial={notifications}
            emptyLabel="Nothing yet. Approvals, new campaigns and commissions land here."
          />

          <ThemeToggle className="hidden sm:inline-flex" />

          <DropMenu
            trigger={
              <button className="rounded-full transition-opacity hover:opacity-85">
                <Avatar
                  name={profile.full_name}
                  src={profile.avatar_url}
                  accent={profile.accent}
                  size="sm"
                />
              </button>
            }
            items={[
              {
                label: "Settings",
                icon: Settings,
                onSelect: () => router.push("/portal/settings"),
              },
              { type: "separator" },
              { label: "Sign out", icon: LogOut, onSelect: signOut, danger: true },
            ]}
          />
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1200px] animate-fade-up">{children}</div>
        </main>
      </div>
    </div>
  );
}
