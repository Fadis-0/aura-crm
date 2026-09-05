"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  CornerDownLeft,
  FolderKanban,
  Moon,
  Search,
  Sun,
  Target,
  Users,
} from "lucide-react";
import { ALL_NAV_ITEMS } from "@/lib/nav";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useTheme } from "@/components/theme";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  run: () => void;
};

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<Row[]>([]);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Search clients, leads and projects as you type.
  useEffect(() => {
    const q = query.trim();
    let cancelled = false;

    const timer = setTimeout(async () => {
      if (q.length < 2) {
        setRemote([]);
        return;
      }
      const sb = supabaseBrowser();
      const like = `%${q}%`;
      const [clients, leads, projects] = await Promise.all([
        sb.from("clients").select("id,name,company").ilike("name", like).limit(5),
        sb.from("leads").select("id,name,company").ilike("name", like).limit(5),
        sb.from("projects").select("id,name,code").ilike("name", like).limit(5),
      ]);

      type NamedRow = { id: string; name: string; company?: string | null; code?: string | null };
      const asRows = (d: unknown) => (d ?? []) as NamedRow[];
      if (cancelled) return;

      const rows: Row[] = [
        ...asRows(clients.data).map((c) => ({
          id: `client-${c.id}`,
          label: c.name,
          hint: c.company ?? "Client",
          group: "Clients",
          icon: Users,
          run: () => router.push(`/clients?focus=${c.id}`),
        })),
        ...asRows(leads.data).map((l) => ({
          id: `lead-${l.id}`,
          label: l.name,
          hint: l.company ?? "Lead",
          group: "Pipeline",
          icon: Target,
          run: () => router.push(`/pipeline?focus=${l.id}`),
        })),
        ...asRows(projects.data).map((p) => ({
          id: `project-${p.id}`,
          label: p.name,
          hint: p.code ?? "Project",
          group: "Projects",
          icon: FolderKanban,
          run: () => router.push(`/projects/${p.id}`),
        })),
      ];
      setRemote(rows);
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, router]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();

    const navRows: Row[] = ALL_NAV_ITEMS.map((item) => ({
      id: `nav-${item.href}`,
      label: item.label,
      hint: "Go to",
      group: "Navigate",
      icon: item.icon,
      run: () => router.push(item.href),
    }));

    const themeRows: Row[] = [
      {
        id: "theme-toggle",
        label: theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        group: "Appearance",
        icon: theme === "dark" ? Sun : Moon,
        run: () => setTheme(theme === "dark" ? "light" : "dark"),
      },
    ];

    const local = [...navRows, ...themeRows].filter((r) =>
      q ? r.label.toLowerCase().includes(q) : true,
    );

    return [...remote, ...local];
  }, [query, remote, router, theme, setTheme]);

  // Keep the highlight inside the list as results change.
  const active = rows.length === 0 ? 0 : Math.min(cursor, rows.length - 1);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, rows.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const row = rows[active];
        if (row) {
          onOpenChange(false);
          row.run();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, rows, active, onOpenChange]);

  if (!open) return null;

  let lastGroup = "";

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]">
      <div
        className="fixed inset-0 bg-[#1a140c]/45 backdrop-blur-[3px] animate-fade-in"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full max-w-xl overflow-hidden rounded-xl border border-line bg-surface shadow-float animate-pop-in"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search size={16} className="shrink-0 text-ink-4" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients, leads, projects, or jump to a page…"
            className="h-12 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-4"
          />
          <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-medium text-ink-4">
            ESC
          </kbd>
        </div>

        <div className="max-h-[52vh] overflow-y-auto p-1.5">
          {rows.length === 0 ? (
            <p className="px-3 py-8 text-center text-[13px] text-ink-4">
              Nothing matches “{query}”.
            </p>
          ) : (
            rows.map((row, i) => {
              const showGroup = row.group !== lastGroup;
              lastGroup = row.group;
              return (
                <div key={row.id}>
                  {showGroup ? (
                    <p className="px-2.5 pb-1 pt-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-4">
                      {row.group}
                    </p>
                  ) : null}
                  <button
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => {
                      onOpenChange(false);
                      row.run();
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
                      i === active ? "bg-surface-2" : "",
                    )}
                  >
                    <row.icon size={15} className="shrink-0 text-ink-4" />
                    <span className="flex-1 truncate text-[13px] text-ink">
                      {row.label}
                    </span>
                    {row.hint ? (
                      <span className="truncate text-[11.5px] text-ink-4">
                        {row.hint}
                      </span>
                    ) : null}
                    {i === active ? (
                      <CornerDownLeft size={13} className="text-ink-4" />
                    ) : null}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
