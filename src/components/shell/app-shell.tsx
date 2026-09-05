"use client";

import { useEffect, useState } from "react";
import { Sidebar, type NavCounts } from "./sidebar";
import { Topbar } from "./topbar";
import { CommandPalette } from "./command-palette";
import { CreateDialog } from "@/components/create-dialog";
import type { Notification, Profile } from "@/lib/types";

export function AppShell({
  profile,
  counts,
  notifications,
  children,
}: {
  profile: Profile | null;
  counts: NavCounts;
  notifications: Notification[];
  children: React.ReactNode;
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setQuickAddOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        profile={profile}
        counts={counts}
        mobileOpen={mobileNav}
        onCloseMobile={() => setMobileNav(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          profile={profile}
          notifications={notifications}
          onOpenSearch={() => setPaletteOpen(true)}
          onOpenMobileNav={() => setMobileNav(true)}
          onQuickAdd={() => setQuickAddOpen(true)}
        />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1400px] animate-fade-up">{children}</div>
        </main>
      </div>

      {paletteOpen ? (
        <CommandPalette open onOpenChange={setPaletteOpen} />
      ) : null}
      <CreateDialog open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
    </div>
  );
}
