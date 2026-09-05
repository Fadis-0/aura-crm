"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  ListChecks,
  Megaphone,
  Plus,
  Receipt,
  Trash2,
  Users,
} from "lucide-react";
import { ConfirmDialog } from "@/components/overlays";
import { AssetManager } from "@/components/assets/asset-manager";
import { CommissionField } from "@/components/commission-field";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Progress,
  Select,
  Textarea,
} from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Combobox } from "@/components/combobox";
import { useServerState } from "@/lib/use-server-state";
import { cn, money, LOCALE } from "@/lib/utils";
import {
  PLAN_KINDS,
  PRIORITY_ACCENT,
  PRIORITY_LABEL,
  PROJECT_STATUSES,
  PROJECT_STATUS_ACCENT,
  PROJECT_STATUS_LABEL,
  type Affiliate,
  type Client,
  type CommissionType,
  type Invoice,
  type PlanKind,
  type Priority,
  type Profile,
  type Project,
  type ProjectAsset,
  type ProjectMarketer,
  type ProjectPlan,
  type ProjectStatus,
  type Task,
} from "@/lib/types";

const PLAN_KIND_LABEL: Record<PlanKind, string> = {
  one_time: "One-time",
  subscription: "Subscription",
};

const ACCENTS = ["clay", "amber", "sage", "indigo", "plum", "rose"] as const;

export function ProjectDetail({
  project,
  clients,
  initialTasks,
  invoices,
  profiles,
  assets,
  marketers,
  affiliates,
  initialPlans,
}: {
  project: Project;
  clients: Client[];
  initialTasks: Task[];
  invoices: Invoice[];
  profiles: Profile[];
  assets: ProjectAsset[];
  marketers: ProjectMarketer[];
  affiliates: Affiliate[];
  initialPlans: ProjectPlan[];
}) {
  const sb = supabaseBrowser();
  const router = useRouter();

  const [draft, setDraft] = useState<Project>(project);
  const [tasks, setTasks] = useServerState(initialTasks);
  const [plans, setPlans] = useServerState(initialPlans);
  const [newTask, setNewTask] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const client = clients.find((c) => c.id === draft.client_id);
  const done = tasks.filter((t) => t.status === "done").length;
  const invoiced = invoices.reduce((s, i) => s + i.amount, 0);
  const collected = invoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + i.amount, 0);

  const activeMarketers = marketers.filter((m) => m.status === "active");

  const burn = useMemo(() => {
    const b = draft.budget ?? 0;
    return b > 0 ? Math.round(((draft.spent ?? 0) / b) * 100) : 0;
  }, [draft.budget, draft.spent]);

  const set = <K extends keyof Project>(k: K, v: Project[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const save = async () => {
    setSaving(true);
    const patch = {
      name: draft.name,
      code: draft.code || null,
      description: draft.description || null,
      client_id: draft.client_id || null,
      status: draft.status,
      priority: draft.priority,
      budget: Number(draft.budget ?? 0),
      spent: Number(draft.spent ?? 0),
      progress: Number(draft.progress ?? 0),
      accent: draft.accent,
      start_date: draft.start_date || null,
      due_date: draft.due_date || null,
      open_for_affiliates: draft.open_for_affiliates,
      affiliate_brief: draft.affiliate_brief || null,
      affiliate_commission_type: draft.affiliate_commission_type ?? "fixed",
      affiliate_commission_amount: Number(draft.affiliate_commission_amount ?? 0),
      affiliate_commission_rate: Number(draft.affiliate_commission_rate ?? 0),
      affiliate_payout_note: draft.affiliate_payout_note || null,
    };
    const { error } = await sb.from("projects").update(patch).eq("id", project.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Project saved");
    router.refresh();
  };

  const addTask = async () => {
    const title = newTask.trim();
    if (!title) return;

    const { data, error } = await sb
      .from("tasks")
      .insert({ title, project_id: project.id, position: tasks.length })
      .select("*")
      .single();

    if (error) return toast.error(error.message);
    setTasks((t) => [...t, data as Task]);
    setNewTask("");
  };

  const toggleTask = async (task: Task) => {
    const next = task.status === "done" ? "todo" : "done";
    setTasks((rows) =>
      rows.map((t) =>
        t.id === task.id
          ? { ...t, status: next, completed_at: next === "done" ? new Date().toISOString() : null }
          : t,
      ),
    );
    await sb
      .from("tasks")
      .update({
        status: next,
        completed_at: next === "done" ? new Date().toISOString() : null,
      })
      .eq("id", task.id);
  };

  const removeTask = async (id: string) => {
    setTasks((rows) => rows.filter((t) => t.id !== id));
    await sb.from("tasks").delete().eq("id", id);
  };

  const addPlan = async () => {
    const { data, error } = await sb
      .from("project_plans")
      .insert({
        project_id: project.id,
        name: `Plan ${plans.length + 1}`,
        kind: "one_time",
        position: plans.length,
      })
      .select("*")
      .single();
    if (error) return toast.error(error.message);
    setPlans((p) => [...p, data as ProjectPlan]);
  };

  const updatePlan = async (id: string, patch: Partial<ProjectPlan>) => {
    setPlans((rows) => rows.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    await sb.from("project_plans").update(patch).eq("id", id);
  };

  const removePlan = async (id: string) => {
    setPlans((rows) => rows.filter((p) => p.id !== id));
    await sb.from("project_plans").delete().eq("id", id);
  };

  const remove = async () => {
    const { error } = await sb.from("projects").delete().eq("id", project.id);
    if (error) return toast.error(error.message);
    toast.success("Project deleted");
    router.push("/projects");
  };

  return (
    <>
      <Link
        href="/projects"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-3 transition-colors hover:text-ink"
      >
        <ArrowLeft size={14} />
        All projects
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span
              className="h-3 w-3 rounded-sm"
              style={{ background: `var(--${draft.accent})` }}
            />
            <h1 className="text-[26px] leading-tight">{draft.name}</h1>
            <Badge accent={PROJECT_STATUS_ACCENT[draft.status]} dot>
              {PROJECT_STATUS_LABEL[draft.status]}
            </Badge>
            <Badge accent={PRIORITY_ACCENT[draft.priority]}>
              {PRIORITY_LABEL[draft.priority]}
            </Badge>
          </div>
          <p className="mt-1.5 text-[13.5px] text-ink-3">
            {client ? (
              <>
                for <span className="text-ink-2">{client.name}</span>
              </>
            ) : (
              "Internal project"
            )}
            {draft.due_date
              ? ` · due ${new Date(draft.due_date).toLocaleDateString(LOCALE, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}`
              : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(true)} className="text-[var(--rose)]">
            <Trash2 size={14} />
            Delete
          </Button>
          <Button variant="primary" onClick={save} loading={saving}>
            Save changes
          </Button>
        </div>
      </header>

      {/* metrics */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Progress", value: `${draft.progress}%`, bar: draft.progress, accent: draft.accent },
          { label: "Budget used", value: `${burn}%`, bar: burn, accent: burn > 100 ? "rose" : "amber" },
          { label: "Invoiced", value: money(invoiced), sub: `${money(collected)} collected` },
          { label: "Tasks", value: `${done}/${tasks.length}`, bar: tasks.length ? (done / tasks.length) * 100 : 0, accent: "sage" },
        ].map((m) => (
          <Card key={m.label} className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-4">
              {m.label}
            </p>
            <p className="mt-1.5 font-display text-[22px] leading-none tabular-nums text-ink">
              {m.value}
            </p>
            {typeof m.bar === "number" ? (
              <Progress
                value={Math.min(100, m.bar)}
                accent={(m.accent ?? "clay") as (typeof ACCENTS)[number]}
                className="mt-3"
              />
            ) : null}
            {m.sub ? <p className="mt-2 text-[11.5px] text-ink-4">{m.sub}</p> : null}
          </Card>
        ))}
      </div>

      {/*
        Three columns from xl up. The affiliate programme and the document
        library sit in the middle so they are visible without scrolling,
        rather than buried under the settings form.
      */}
      <div className="grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {/* -------------------------------------------------- delivery */}
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Tasks"
              subtitle={`${done} of ${tasks.length} complete`}
            />
            <div className="flex gap-2 border-b border-line px-4 py-3">
              <Input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTask()}
                placeholder="Add a task and press Enter"
              />
              <Button size="icon" variant="primary" onClick={addTask} aria-label="Add task">
                <Plus size={16} />
              </Button>
            </div>

            {tasks.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={<ListChecks size={19} />}
                  title="No tasks yet"
                  description="Break the project into steps you can tick off."
                />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {tasks.map((t) => (
                  <li
                    key={t.id}
                    className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2"
                  >
                    <button
                      onClick={() => toggleTask(t)}
                      aria-label={t.status === "done" ? "Mark not done" : "Mark done"}
                      className={cn(
                        "grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border transition-all",
                        t.status === "done"
                          ? "border-[var(--sage)] bg-[var(--sage)] text-white"
                          : "border-line-strong hover:border-[var(--clay)]",
                      )}
                    >
                      {t.status === "done" ? <Check size={12} strokeWidth={3} /> : null}
                    </button>

                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-[13px]",
                        t.status === "done" ? "text-ink-4 line-through" : "text-ink",
                      )}
                    >
                      {t.title}
                    </span>

                    {t.due_date ? (
                      <span className="shrink-0 text-[11.5px] text-ink-4">
                        {new Date(t.due_date).toLocaleDateString(LOCALE, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    ) : null}

                    {t.assignee_id ? (
                      <Avatar
                        name={profiles.find((p) => p.id === t.assignee_id)?.full_name}
                        accent={profiles.find((p) => p.id === t.assignee_id)?.accent ?? "clay"}
                        size="xs"
                      />
                    ) : null}

                    <button
                      onClick={() => removeTask(t.id)}
                      aria-label="Delete task"
                      className="shrink-0 text-ink-4 opacity-0 transition-opacity hover:text-[var(--rose)] group-hover:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* ------------------------------------ marketers and material */}
        <div className="space-y-4">
          {/* ------------------------------------------------ affiliation */}
          <Card>
            <CardHeader
              title="Affiliate programme"
              subtitle={
                draft.open_for_affiliates
                  ? "Marketers can see this project and its assets"
                  : "Hidden from marketers"
              }
              action={
                <button
                  role="switch"
                  aria-checked={draft.open_for_affiliates}
                  aria-label="Open to affiliates"
                  onClick={() => set("open_for_affiliates", !draft.open_for_affiliates)}
                  className={cn(
                    "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                    draft.open_for_affiliates
                      ? "bg-[var(--sage)]"
                      : "bg-surface-sunk",
                  )}
                >
                  <span
                    className={cn(
                      "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-soft transition-transform",
                      draft.open_for_affiliates ? "translate-x-[22px]" : "translate-x-0",
                    )}
                  />
                </button>
              }
            />

            {draft.open_for_affiliates ? (
              <div className="space-y-3 p-4">
                <Field label="Brief" hint="what marketers should know">
                  <Textarea
                    rows={4}
                    value={draft.affiliate_brief ?? ""}
                    onChange={(e) => set("affiliate_brief", e.target.value)}
                    placeholder="Who the buyer is, what to lead with, what not to promise."
                  />
                </Field>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[12px] font-medium text-ink-2">
                      Payment plans
                    </span>
                    <button
                      onClick={addPlan}
                      className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--clay)] hover:underline"
                    >
                      <Plus size={12} /> Add plan
                    </button>
                  </div>

                  {plans.length === 0 ? (
                    <p className="rounded-md border border-dashed border-line-2 px-3 py-3 text-[12px] text-ink-4">
                      No plans yet. Add a one-time sell or a subscription tier —
                      each pays partners its own commission.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {plans.map((plan, i) => (
                        <div
                          key={plan.id}
                          className="space-y-2.5 rounded-md border border-line bg-surface p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-4">
                              Plan {i + 1}
                            </span>
                            <button
                              onClick={() => removePlan(plan.id)}
                              aria-label={`Delete ${plan.name || `plan ${i + 1}`}`}
                              className="shrink-0 text-ink-4 transition-colors hover:text-[var(--rose)]"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          <div className="grid gap-2.5 sm:grid-cols-2">
                            <Field label="Plan name">
                              <Input
                                value={plan.name}
                                onChange={(e) => updatePlan(plan.id, { name: e.target.value })}
                                className="h-8"
                                placeholder="Starter"
                              />
                            </Field>
                            <Field label="Billing">
                              <Select
                                value={plan.kind}
                                onChange={(e) =>
                                  updatePlan(plan.id, { kind: e.target.value as PlanKind })
                                }
                                className="h-8"
                              >
                                {PLAN_KINDS.map((k) => (
                                  <option key={k} value={k}>
                                    {PLAN_KIND_LABEL[k]}
                                  </option>
                                ))}
                              </Select>
                            </Field>
                          </div>

                          <Field
                            label="Price"
                            hint={plan.kind === "subscription" ? "DA / month" : "DA"}
                          >
                            <Input
                              type="number"
                              min={0}
                              value={plan.price}
                              onChange={(e) =>
                                updatePlan(plan.id, { price: Number(e.target.value) })
                              }
                              className="h-8"
                            />
                          </Field>

                          <CommissionField
                            type={plan.commission_type}
                            amount={plan.commission_amount}
                            rate={plan.commission_rate}
                            onTypeChange={(t) =>
                              updatePlan(plan.id, { commission_type: t as CommissionType })
                            }
                            onAmountChange={(v) => updatePlan(plan.id, { commission_amount: v })}
                            onRateChange={(v) => updatePlan(plan.id, { commission_rate: v })}
                            label="Partner earns"
                            sampleValue={plan.price}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <p className="flex items-center gap-1.5 text-[12px] text-ink-3">
                  <Users size={13} className="text-ink-4" />
                  {activeMarketers.length}{" "}
                  {activeMarketers.length === 1 ? "partner is" : "partners are"} working
                  this
                </p>

                <Field label="Payout terms" hint="shown on their project page">
                  <Textarea
                    rows={2}
                    value={draft.affiliate_payout_note ?? ""}
                    onChange={(e) => set("affiliate_payout_note", e.target.value)}
                    placeholder="Paid within 30 days of the client's first invoice clearing."
                  />
                </Field>

                {activeMarketers.length > 0 ? (
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-4">
                      On this project
                    </p>
                    <ul className="space-y-1">
                      {activeMarketers.map((m) => {
                        const a = affiliates.find((x) => x.id === m.affiliate_id);
                        return (
                          <li
                            key={m.affiliate_id}
                            className="flex items-center gap-2.5 rounded-md border border-line bg-surface px-2.5 py-1.5"
                          >
                            <Avatar
                              name={a?.name}
                              accent={a?.accent ?? "indigo"}
                              size="xs"
                            />
                            <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">
                              {a?.name ?? "Marketer"}
                            </span>
                            <span className="text-[11px] text-ink-4">
                              since{" "}
                              {new Date(m.joined_at).toLocaleDateString(LOCALE, {
                                day: "numeric",
                                month: "short",
                              })}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}

                <p className="flex items-start gap-2 rounded-md bg-surface-2 px-3 py-2 text-[11.5px] leading-relaxed text-ink-3">
                  <Megaphone size={13} className="mt-0.5 shrink-0 text-ink-4" />
                  Remember to press Save changes. Marketers see the brief, the
                  rate, the payout terms and every asset below.
                </p>
              </div>
            ) : (
              <p className="px-4 py-4 text-[12.5px] leading-relaxed text-ink-3">
                Turn this on to let marketers pick the project up, download its
                files and submit leads against it.
              </p>
            )}
          </Card>

          {draft.open_for_affiliates ? (
            <AssetManager projectId={project.id} initialAssets={assets} />
          ) : null}
        </div>

        {/* --------------------------------------- settings and billing */}
        <div className="space-y-4 lg:col-span-2 xl:col-span-1">
          <Card>
            <CardHeader title="Details" />
            <div className="space-y-3 p-4">
              <Field label="Name" required>
                <Input value={draft.name} onChange={(e) => set("name", e.target.value)} />
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Code">
                  <Input
                    value={draft.code ?? ""}
                    onChange={(e) => set("code", e.target.value)}
                    placeholder="ACME-01"
                  />
                </Field>
                <Field label="Client">
                  <Combobox
                    value={draft.client_id ?? null}
                    onChange={(v) => set("client_id", v)}
                    options={clients.map((c) => ({
                      value: c.id,
                      label: c.name,
                      hint: c.company ?? undefined,
                      accent: c.accent,
                    }))}
                    placeholder="Internal"
                    clearLabel="Internal"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Status">
                  <Select
                    value={draft.status}
                    onChange={(e) => set("status", e.target.value as ProjectStatus)}
                  >
                    {PROJECT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {PROJECT_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Priority">
                  <Select
                    value={draft.priority}
                    onChange={(e) => set("priority", e.target.value as Priority)}
                  >
                    {(["low", "medium", "high", "urgent"] as Priority[]).map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_LABEL[p]}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Start">
                  <Input
                    type="date"
                    value={draft.start_date ?? ""}
                    onChange={(e) => set("start_date", e.target.value)}
                  />
                </Field>
                <Field label="Due">
                  <Input
                    type="date"
                    value={draft.due_date ?? ""}
                    onChange={(e) => set("due_date", e.target.value)}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Budget" hint="DA">
                  <Input
                    type="number"
                    value={draft.budget ?? 0}
                    onChange={(e) => set("budget", Number(e.target.value))}
                  />
                </Field>
                <Field label="Spent" hint="DA">
                  <Input
                    type="number"
                    value={draft.spent ?? 0}
                    onChange={(e) => set("spent", Number(e.target.value))}
                  />
                </Field>
              </div>

              <Field label="Progress" hint={`${draft.progress}%`}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={draft.progress}
                  onChange={(e) => set("progress", Number(e.target.value))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-sunk accent-[var(--clay)]"
                />
              </Field>

              <Field label="Colour">
                <div className="flex gap-1.5">
                  {ACCENTS.map((a) => (
                    <button
                      key={a}
                      onClick={() => set("accent", a)}
                      aria-label={a}
                      className={cn(
                        "h-7 w-7 rounded-md border-2 transition-transform",
                        draft.accent === a
                          ? "scale-110 border-ink"
                          : "border-transparent hover:scale-105",
                      )}
                      style={{ background: `var(--${a})` }}
                    />
                  ))}
                </div>
              </Field>

              <Field label="Brief">
                <Textarea
                  rows={4}
                  value={draft.description ?? ""}
                  onChange={(e) => set("description", e.target.value)}
                />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Invoices" subtitle={`${money(collected)} of ${money(invoiced)} collected`} />
            {invoices.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={<Receipt size={19} />}
                  title="No invoices"
                  description="Bill this project from the Invoices page."
                  className="py-8"
                />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {invoices.map((i) => (
                  <li key={i.id} className="flex items-center gap-2.5 px-4 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                      {i.number}
                    </span>
                    <span className="text-[13px] tabular-nums text-ink-2">
                      {money(i.amount)}
                    </span>
                    <Badge
                      accent={
                        i.status === "paid" ? "sage" : i.status === "overdue" ? "rose" : "amber"
                      }
                    >
                      {i.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        title="Delete this project?"
        message={`${project.name} and all of its tasks will be removed permanently.`}
      />
    </>
  );
}
