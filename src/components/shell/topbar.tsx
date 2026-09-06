"use client";

import { useRouter } from "next/navigation";
import { LogOut, Megaphone, Menu, Plus, Search, UserRound } from "lucide-react";
import { Menu as DropMenu } from "@/components/overlays";
import { Notifications } from "./notifications";
import { Avatar, Button } from "@/components/ui";
import { ThemeToggle } from "@/components/theme";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Notification, Profile } from "@/lib/types";

export function Topbar({
  profile,
  notifications,
  onOpenSearch,
  onOpenMobileNav,
  onQuickAdd,
  onAnnounce,
}: {
  profile: Profile | null;
  notifications: Notification[];
  onOpenSearch: () => void;
  onOpenMobileNav: () => void;
  onQuickAdd: () => void;
  onAnnounce: () => void;
}) {
  const router = useRouter();

  const signOut = async () => {
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-20 flex h-[var(--topbar-h)] items-center gap-2 border-b border-line bg-paper/85 px-4 backdrop-blur-md">
      <button
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
        className="grid h-9 w-9 place-items-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink lg:hidden"
      >
        <Menu size={18} />
      </button>

      <button
        onClick={onOpenSearch}
        className="group flex h-9 min-w-0 flex-1 max-w-md items-center gap-2.5 rounded-md border border-line bg-surface px-3 text-left transition-colors hover:border-line-2"
      >
        <Search size={15} className="shrink-0 text-ink-4" />
        <span className="flex-1 truncate text-[13px] text-ink-4">Search…</span>
        <kbd className="hidden shrink-0 rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-ink-4 sm:block">
          Ctrl K
        </kbd>
      </button>

      <div className="flex-1" />

      <Button
        size="sm"
        variant="primary"
        onClick={onQuickAdd}
        className="hidden md:inline-flex"
      >
        <Plus size={14} strokeWidth={2.5} />
        Create something
      </Button>
      <Button
        size="icon"
        variant="primary"
        onClick={onQuickAdd}
        aria-label="Create something"
        className="md:hidden"
      >
        <Plus size={16} strokeWidth={2.5} />
      </Button>

      <Button
        size="icon"
        onClick={onAnnounce}
        aria-label="Announce something"
        title="Announce something"
      >
        <Megaphone size={16} />
      </Button>

      <Notifications initial={notifications} />

      <ThemeToggle className="hidden sm:inline-flex" />

      <DropMenu
        trigger={
          <button className="ml-0.5 rounded-full transition-opacity hover:opacity-85">
            <Avatar
              name={profile?.full_name}
              src={profile?.avatar_url}
              accent={profile?.accent ?? "clay"}
              size="sm"
            />
          </button>
        }
        items={[
          {
            label: "Profile & settings",
            icon: UserRound,
            onSelect: () => router.push("/settings"),
          },
          { type: "separator" },
          { label: "Sign out", icon: LogOut, onSelect: signOut, danger: true },
        ]}
      />
    </header>
  );
}
