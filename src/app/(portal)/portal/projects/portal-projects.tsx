"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowRight,
  Check,
  FolderOpen,
  Paperclip,
  Plus,
  Search,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Segmented,
} from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useServerState } from "@/lib/use-server-state";
import { LOCALE } from "@/lib/utils";
import { commissionLabel } from "@/components/commission-field";
import type { Project, ProjectMarketer } from "@/lib/types";

type Filter = "all" | "mine" | "available";

export function PortalProjects({
  projects,
  initialJoined,
  affiliateId,
  assetCounts,
}: {
  projects: Project[];
  initialJoined: ProjectMarketer[];
  affiliateId: string | null;
  assetCounts: Record<string, number>;
}) {
  const sb = supabaseBrowser();

  const [joined, setJoined] = useServerState(initialJoined);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const isMine = (id: string) =>
    joined.some((j) => j.project_id === id && j.status === "active");

  const counts = useMemo(
    () => ({
      all: projects.length,
      mine: projects.filter((p) => isMine(p.id)).length,
      available: projects.filter((p) => !isMine(p.id)).length,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects, joined],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects
      .filter((p) =>
        filter === "mine" ? isMine(p.id) : filter === "available" ? !isMine(p.id) : true,
      )
      .filter((p) =>
        q
          ? [p.name, p.affiliate_brief, p.description].some((v) =>
              String(v ?? "").toLowerCase().includes(q),
            )
          : true,
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, joined, filter, query]);

  const join = async (project: Project) => {
    if (!affiliateId) {
      toast.error("Something is off with your account. Please get in touch.");
      return;
    }
    setBusy(project.id);

    const { data, error } = await sb
      .from("project_marketers")
      .upsert(
        { project_id: project.id, affiliate_id: affiliateId, status: "active" },
        { onConflict: "project_id,affiliate_id" },
      )
      .select("*")
      .single();

    setBusy(null);
    if (error) return toast.error(error.message);

    setJoined((rows) => [
      ...rows.filter((r) => r.project_id !== project.id),
      data as ProjectMarketer,
    ]);
    toast.success(`Added ${project.name} to your projects`);
  };

  const leave = async (project: Project) => {
    if (!affiliateId) return;
    setBusy(project.id);

    const { error } = await sb
      .from("project_marketers")
      .update({ status: "left" })
      .eq("project_id", project.id)
      .eq("affiliate_id", affiliateId);

    setBusy(null);
    if (error) return toast.error(error.message);

    setJoined((rows) =>
      rows.map((r) =>
        r.project_id === project.id ? { ...r, status: "left" as const } : r,
      ),
    );
    toast.success(`Removed ${project.name}`);
  };

  return (
    <>
      <PageHeader
        eyebrow="Campaigns"
        title="Projects"
        description="Everything opened up to affiliates. Add the ones you want to work on."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: counts.all },
            { value: "mine", label: "Mine", count: counts.mine },
            { value: "available", label: "Available", count: counts.available },
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
          icon={<FolderOpen size={19} />}
          title={
            projects.length === 0
              ? "No projects open yet"
              : "Nothing matches that"
          }
          description={
            projects.length === 0
              ? "New campaigns show up here with their brief and files."
              : "Try another filter or search."
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((p) => {
            const mine = isMine(p.id);
            const files = assetCounts[p.id] ?? 0;

            return (
              <Card key={p.id} className="flex flex-col p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ background: `var(--${p.accent})` }}
                    />
                    <p className="truncate text-[14px] font-medium text-ink">
                      {p.name}
                    </p>
                  </div>
                  {mine ? (
                    <Badge accent="sage" dot>
                      Working
                    </Badge>
                  ) : null}
                </div>

                <p className="mt-2.5 line-clamp-3 min-h-[3.4em] text-[12.5px] leading-relaxed text-ink-3">
                  {p.affiliate_brief ?? p.description ?? "No brief yet."}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {p.affiliate_commission_amount || p.affiliate_commission_rate ? (
                    <Badge accent="clay">
                      {commissionLabel(
                        p.affiliate_commission_type,
                        p.affiliate_commission_amount,
                        p.affiliate_commission_rate,
                      )}{" "}
                      per deal
                    </Badge>
                  ) : null}
                  {files > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[11.5px] text-ink-4">
                      <Paperclip size={11} />
                      {files} {files === 1 ? "file" : "files"}
                    </span>
                  ) : null}
                  {p.due_date ? (
                    <span className="text-[11.5px] text-ink-4">
                      until{" "}
                      {new Date(p.due_date).toLocaleDateString(LOCALE, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 flex items-center gap-2 border-t border-line pt-3">
                  <Link
                    href={`/portal/projects/${p.id}`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-[12.5px] font-medium transition-colors hover:bg-surface-2"
                  >
                    Details <ArrowRight size={12} />
                  </Link>

                  <div className="flex-1" />

                  {mine ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={busy === p.id}
                      onClick={() => leave(p)}
                    >
                      Remove
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="primary"
                      loading={busy === p.id}
                      onClick={() => join(p)}
                    >
                      {busy === p.id ? null : <Plus size={13} />}
                      Work on this
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {counts.mine > 0 ? (
        <p className="mt-5 flex items-center gap-1.5 text-[12.5px] text-ink-4">
          <Check size={13} className="text-[var(--sage)]" />
          {counts.mine} {counts.mine === 1 ? "project" : "projects"} on your list.
        </p>
      ) : null}
    </>
  );
}
