"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, FolderKanban, Plus, Search, Wallet } from "lucide-react";
import {
  Badge,
  Button,
  EmptyState,
  Input,
  PageHeader,
  Progress,
  Segmented,
} from "@/components/ui";
import { CreateDialog } from "@/components/create-dialog";
import { useServerState } from "@/lib/use-server-state";
import { compactMoney, money, LOCALE } from "@/lib/utils";
import {
  PROJECT_STATUS_ACCENT,
  PROJECT_STATUS_LABEL,
  PRIORITY_ACCENT,
  PRIORITY_LABEL,
  type Client,
  type Project,
  type ProjectStatus,
  type Task,
} from "@/lib/types";

type Filter = "live" | "all" | ProjectStatus;

function dueMeta(due: string | null) {
  if (!due) return { label: "No date", tone: "text-ink-4" };
  const days = Math.ceil(
    (new Date(due).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  if (days < 0)
    return { label: `${Math.abs(days)}d overdue`, tone: "text-[var(--rose)]" };
  if (days === 0) return { label: "Due today", tone: "text-[var(--clay)]" };
  if (days <= 7) return { label: `${days}d left`, tone: "text-[var(--amber)]" };
  return {
    label: new Date(due).toLocaleDateString(LOCALE, {
      month: "short",
      day: "numeric",
    }),
    tone: "text-ink-4",
  };
}

export function ProjectsView({
  initialProjects,
  clients,
  tasks,
}: {
  initialProjects: Project[];
  clients: Client[];
  tasks: Pick<Task, "id" | "project_id" | "status">[];
}) {
  const [filter, setFilter] = useState<Filter>("live");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [projects, setProjects] = useServerState(initialProjects);

  const counts = useMemo(
    () => ({
      all: projects.length,
      live: projects.filter(
        (p) => !p.archived && p.status !== "done" && p.status !== "cancelled",
      ).length,
      done: projects.filter((p) => p.status === "done").length,
      on_hold: projects.filter((p) => p.status === "on_hold").length,
    }),
    [projects],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects
      .filter((p) => {
        if (filter === "live")
          return !p.archived && p.status !== "done" && p.status !== "cancelled";
        if (filter === "all") return true;
        return p.status === filter;
      })
      .filter((p) =>
        q
          ? [p.name, p.code, p.description].some((v) =>
              String(v ?? "").toLowerCase().includes(q),
            )
          : true,
      );
  }, [projects, filter, query]);

  const budget = visible.reduce((s, p) => s + (p.budget ?? 0), 0);
  const spent = visible.reduce((s, p) => s + (p.spent ?? 0), 0);

  return (
    <>
      <PageHeader
        eyebrow="Delivery"
        title="Projects"
        description={`${counts.live} in flight · ${money(budget)} booked · ${money(spent)} spent so far.`}
        actions={
          <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
            <Plus size={14} />
            New
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "live", label: "In flight", count: counts.live },
            { value: "on_hold", label: "On hold", count: counts.on_hold },
            { value: "done", label: "Delivered", count: counts.done },
            { value: "all", label: "All", count: counts.all },
          ]}
        />
        <div className="relative ml-auto w-full max-w-xs">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-4"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects…"
            className="pl-8"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<FolderKanban size={19} />}
          title={projects.length === 0 ? "No projects yet" : "Nothing here"}
          description={
            projects.length === 0
              ? "Attach a project to a client to track budget and delivery."
              : "Try another filter."
          }
          action={
            projects.length === 0 ? (
              <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
                <Plus size={14} />
                New project
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((p) => {
            const client = clients.find((c) => c.id === p.client_id);
            const own = tasks.filter((t) => t.project_id === p.id);
            const done = own.filter((t) => t.status === "done").length;
            const due = dueMeta(p.due_date);
            const overBudget = (p.spent ?? 0) > (p.budget ?? 0) && (p.budget ?? 0) > 0;

            return (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="group flex flex-col rounded-lg border border-line bg-surface p-4 shadow-soft transition-all hover:border-line-2 hover:shadow-raised"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ background: `var(--${p.accent})` }}
                      />
                      <p className="truncate text-[14px] font-medium text-ink">
                        {p.name}
                      </p>
                    </div>
                    <p className="mt-0.5 truncate pl-4.5 text-[12px] text-ink-4">
                      {client?.name ?? "Internal"}
                      {p.code ? ` · ${p.code}` : ""}
                    </p>
                  </div>
                  <Badge accent={PROJECT_STATUS_ACCENT[p.status]} dot>
                    {PROJECT_STATUS_LABEL[p.status]}
                  </Badge>
                </div>

                {p.description ? (
                  <p className="mt-3 line-clamp-2 text-[12.5px] leading-relaxed text-ink-3">
                    {p.description}
                  </p>
                ) : null}

                <div className="mt-4">
                  <div className="mb-1.5 flex items-baseline justify-between text-[11.5px]">
                    <span className="tabular-nums text-ink-3">
                      {p.progress}% complete
                    </span>
                    <span className="text-ink-4">
                      {own.length ? `${done}/${own.length} tasks` : "no tasks"}
                    </span>
                  </div>
                  <Progress value={p.progress} accent={p.accent} />
                </div>

                <div className="mt-auto flex items-center gap-3 border-t border-line pt-3 text-[11.5px]">
                  <span className={`flex items-center gap-1 ${due.tone}`}>
                    <CalendarClock size={12} />
                    {due.label}
                  </span>
                  <span
                    className={`flex items-center gap-1 tabular-nums ${
                      overBudget ? "text-[var(--rose)]" : "text-ink-4"
                    }`}
                  >
                    <Wallet size={12} />
                    {compactMoney(p.spent ?? 0)} / {compactMoney(p.budget ?? 0)}
                  </span>
                  <Badge accent={PRIORITY_ACCENT[p.priority]} className="ml-auto">
                    {PRIORITY_LABEL[p.priority]}
                  </Badge>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <CreateDialog
        open={creating}
        onClose={() => setCreating(false)}
        only="project"
        onCreated={(row) => setProjects((rows) => [row as unknown as Project, ...rows])}
      />
    </>
  );
}
