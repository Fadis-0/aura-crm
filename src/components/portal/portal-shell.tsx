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

export function PortalShell({
  profile,
  notifications,
  children,
}: {
  profile: Profile;
  notifications: Notification[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);

  const signOut = async () => {
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  const links = NAV.map((item) => ({
    ...item,
    active: item.exact ? pathname === item.href : pathname.startsWith(item.href),
  }));

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-[var(--topbar-h)] w-full max-w-[1200px] items-center gap-3 px-4 sm:px-6">
          <Link href="/portal" className="flex shrink-0 items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--clay)] font-display text-[15px] font-semibold text-white shadow-soft">
              A
            </span>
            <span className="font-display text-[15px] leading-none">Aura</span>
          </Link>

          <nav className="ml-4 hidden items-center gap-0.5 md:flex">
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative inline-flex h-8 items-center gap-1.5 overflow-hidden rounded-md px-2.5 text-[13px] font-medium transition-colors active:scale-[0.99]",
                  item.active
                    ? "bg-surface text-ink shadow-soft"
                    : "text-ink-3 hover:bg-surface/70 hover:text-ink",
                )}
              >
                <item.icon size={14} />
                {item.label}
                <NavPending />
              </Link>
            ))}
          </nav>

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

          <button
            onClick={() => setNavOpen((v) => !v)}
            aria-label="Menu"
            className="grid h-9 w-9 place-items-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink md:hidden"
          >
            {navOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {navOpen ? (
          <nav className="border-t border-line px-4 py-2 md:hidden">
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setNavOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2 py-2 text-[13px] font-medium transition-colors",
                  item.active ? "bg-surface text-ink" : "text-ink-3",
                )}
              >
                <item.icon size={15} />
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-[1200px] px-4 py-7 sm:px-6">
        <div className="animate-fade-up">{children}</div>
      </main>
    </div>
  );
}
