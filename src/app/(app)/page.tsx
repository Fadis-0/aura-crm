import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CircleDollarSign,
  FolderKanban,
  Handshake,
  ListChecks,
  Target,
  Users,
} from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { StatCard } from "@/components/dashboard/stat-card";
import { RevenueChart, type RevenuePoint } from "@/components/dashboard/revenue-chart";
import { Badge, Card, CardHeader, EmptyState, Progress } from "@/components/ui";
import { accentFor, compactMoney, money, LOCALE } from "@/lib/utils";
import {
  LEAD_STAGES,
  PROJECT_STATUS_ACCENT,
  PROJECT_STATUS_LABEL,
  STAGE_ACCENT,
  STAGE_LABEL,
  type Client,
  type CalendarEvent,
  type Invoice,
  type Lead,
  type Profile,
  type Project,
  type Task,
} from "@/lib/types";

export const dynamic = "force-dynamic";

const MONTH_KEY = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

function lastSixMonths() {
  const out: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: MONTH_KEY(d),
      label: d.toLocaleDateString(LOCALE, { month: "short" }),
    });
  }
  return out;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();

  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const inTwoWeeks = new Date(startOfToday);
  inTwoWeeks.setDate(inTwoWeeks.getDate() + 14);

  const [
    profileRes,
    clientsRes,
    leadsRes,
    projectsRes,
    invoicesRes,
    eventsRes,
    tasksRes,
    affiliatesRes,
    commissionsRes,
  ] = await Promise.all([
    sb.from("profiles").select("*").eq("id", user!.id).maybeSingle(),
    sb.from("clients").select("*").order("lifetime_value", { ascending: false }),
    sb.from("leads").select("*"),
    sb
      .from("projects")
      .select("*")
      .eq("archived", false)
      .order("due_date", { ascending: true, nullsFirst: false }),
    sb.from("invoices").select("*").gte("issued_on", sixMonthsAgo.toISOString().slice(0, 10)),
    sb
      .from("events")
      .select("*")
      .gte("starts_at", startOfToday.toISOString())
      .order("starts_at")
      .limit(6),
    sb
      .from("tasks")
      .select("*")
      .neq("status", "done")
      .not("due_date", "is", null)
      .lte("due_date", inTwoWeeks.toISOString().slice(0, 10))
      .order("due_date")
      .limit(7),
    sb.from("affiliates").select("id,name,accent,status"),
    sb.from("commissions").select("affiliate_id,amount,status"),
  ]);

  const profile = profileRes.data as Profile | null;
  const clients = (clientsRes.data ?? []) as Client[];
  const leads = (leadsRes.data ?? []) as Lead[];
  const projects = (projectsRes.data ?? []) as Project[];
  const invoices = (invoicesRes.data ?? []) as Invoice[];
  const events = (eventsRes.data ?? []) as CalendarEvent[];
  const tasks = (tasksRes.data ?? []) as Task[];
  const affiliates = (affiliatesRes.data ?? []) as {
    id: string;
    name: string;
    accent: string;
    status: string;
  }[];
  const commissions = (commissionsRes.data ?? []) as {
    affiliate_id: string;
    amount: number;
    status: string;
  }[];

  /* ------------------------------------------------------------ derived */

  const openLeads = leads.filter((l) => l.stage !== "won" && l.stage !== "lost");
  const activeClients = clients.filter((c) => c.status === "active");
  const activeProjects = projects.filter(
    (p) => p.status === "active" || p.status === "review",
  );

  const pipelineValue = openLeads.reduce((s, l) => s + (l.estimated_value ?? 0), 0);
  const weightedPipeline = openLeads.reduce(
    (s, l) => s + (l.estimated_value ?? 0) * ((l.probability ?? 0) / 100),
    0,
  );

  const thisMonthKey = MONTH_KEY(now);
  const collectedThisMonth = invoices
    .filter((i) => i.status === "paid" && i.paid_on && MONTH_KEY(new Date(i.paid_on)) === thisMonthKey)
    .reduce((s, i) => s + i.amount, 0);

  const outstanding = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((s, i) => s + i.amount, 0);

  const months = lastSixMonths();
  const chartData: RevenuePoint[] = months.map(({ key, label }) => ({
    month: label,
    paid: invoices
      .filter((i) => i.status === "paid" && i.paid_on && MONTH_KEY(new Date(i.paid_on)) === key)
      .reduce((s, i) => s + i.amount, 0),
    pipeline: invoices
      .filter(
        (i) =>
          (i.status === "sent" || i.status === "overdue" || i.status === "draft") &&
          MONTH_KEY(new Date(i.issued_on)) === key,
      )
      .reduce((s, i) => s + i.amount, 0),
  }));

  const funnel = LEAD_STAGES.filter((s) => s !== "won" && s !== "lost").map((stage) => {
    const rows = leads.filter((l) => l.stage === stage);
    return {
      stage,
      count: rows.length,
      value: rows.reduce((s, l) => s + (l.estimated_value ?? 0), 0),
    };
  });
  const funnelMax = Math.max(1, ...funnel.map((f) => f.count));

  const affiliateBoard = affiliates
    .map((a) => {
      const rows = commissions.filter((c) => c.affiliate_id === a.id);
      const leadsFrom = leads.filter((l) => l.affiliate_id === a.id).length;
      return {
        ...a,
        leadsFrom,
        earned: rows.reduce((s, c) => s + c.amount, 0),
        pending: rows.filter((c) => c.status !== "paid").reduce((s, c) => s + c.amount, 0),
      };
    })
    .sort((a, b) => b.earned - a.earned)
    .slice(0, 4);

  const firstName = (profile?.full_name ?? "there").split(" ")[0];

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------- header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-4">
            {now.toLocaleDateString(LOCALE, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          <h1 className="text-[28px] leading-tight">
            {greeting()}, {firstName}.
          </h1>
          <p className="mt-1 text-[13.5px] text-ink-3">
            {openLeads.length} open {openLeads.length === 1 ? "lead" : "leads"} worth{" "}
            {money(pipelineValue)}, {activeProjects.length} projects in flight.
          </p>
        </div>
      </header>

      {/* --------------------------------------------------------- stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Weighted pipeline"
          value={compactMoney(weightedPipeline)}
          sub={`${money(pipelineValue)} unweighted`}
          accent="clay"
          icon={<Target size={17} />}
          href="/pipeline"
        />
        <StatCard
          label="Collected this month"
          value={compactMoney(collectedThisMonth)}
          sub={`${compactMoney(outstanding)} still outstanding`}
          accent="sage"
          icon={<CircleDollarSign size={17} />}
          href="/invoices"
        />
        <StatCard
          label="Active clients"
          value={String(activeClients.length)}
          sub={`${money(clients.reduce((s, c) => s + c.lifetime_value, 0))} lifetime`}
          accent="indigo"
          icon={<Users size={17} />}
          href="/clients"
        />
        <StatCard
          label="Projects in flight"
          value={String(activeProjects.length)}
          sub={`${projects.filter((p) => p.status === "planning").length} in planning`}
          accent="plum"
          icon={<FolderKanban size={17} />}
          href="/projects"
        />
      </div>

      {/* ------------------------------------------------- chart + funnel */}
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader
            title="Revenue"
            subtitle="Collected against invoiced, last six months"
            action={
              <div className="flex items-center gap-3 text-[11.5px] text-ink-3">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[var(--clay)]" />
                  Collected
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[var(--indigo)]" />
                  Invoiced
                </span>
              </div>
            }
          />
          {invoices.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<CircleDollarSign size={19} />}
                title="No invoices yet"
                description="Once you invoice a client, collected and outstanding revenue appear here."
              />
            </div>
          ) : (
            <RevenueChart data={chartData} />
          )}
        </Card>

        <Card>
          <CardHeader
            title="Pipeline"
            subtitle="Open leads by stage"
            action={
              <Link
                href="/pipeline"
                className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--clay)] hover:underline"
              >
                Open <ArrowRight size={12} />
              </Link>
            }
          />
          <div className="space-y-3 p-5">
            {funnel.map((f) => (
              <div key={f.stage}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className="text-[12.5px] font-medium text-ink-2">
                    {STAGE_LABEL[f.stage]}
                  </span>
                  <span className="text-[11.5px] tabular-nums text-ink-4">
                    {f.count} · {compactMoney(f.value)}
                  </span>
                </div>
                <Progress
                  value={(f.count / funnelMax) * 100}
                  accent={STAGE_ACCENT[f.stage]}
                />
              </div>
            ))}
            {openLeads.length === 0 ? (
              <p className="pt-2 text-[12.5px] text-ink-4">
                No open leads. Add one with the New button.
              </p>
            ) : null}
          </div>
        </Card>
      </div>

      {/* --------------------------------------------- schedule + tasks */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader
            title="Coming up"
            subtitle="Next six on the calendar"
            action={
              <Link
                href="/calendar"
                className="text-[12px] font-medium text-[var(--clay)] hover:underline"
              >
                Calendar
              </Link>
            }
          />
          <div className="p-2">
            {events.length === 0 ? (
              <EmptyState
                icon={<CalendarDays size={19} />}
                title="Nothing scheduled"
                description="Your next two weeks are clear."
                className="m-2 border-0 bg-transparent py-8"
              />
            ) : (
              <ul>
                {events.map((e) => {
                  const start = new Date(e.starts_at);
                  return (
                    <li key={e.id}>
                      <div className="flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-surface-2">
                        <div className="w-11 shrink-0 text-center">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-4">
                            {start.toLocaleDateString(LOCALE, { month: "short" })}
                          </p>
                          <p className="font-display text-[17px] leading-none text-ink">
                            {start.getDate()}
                          </p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-ink">
                            {e.title}
                          </p>
                          <p className="mt-0.5 text-[11.5px] text-ink-4">
                            {e.all_day
                              ? "All day"
                              : start.toLocaleTimeString(LOCALE, {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                            {e.location ? ` · ${e.location}` : ""}
                          </p>
                        </div>
                        <span
                          className="mt-1 h-2 w-2 shrink-0 rounded-full"
                          style={{ background: `var(--${e.accent})` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Due soon"
            subtitle="Tasks landing in the next two weeks"
            action={
              <Link
                href="/planning"
                className="text-[12px] font-medium text-[var(--clay)] hover:underline"
              >
                Planning
              </Link>
            }
          />
          <div className="p-2">
            {tasks.length === 0 ? (
              <EmptyState
                icon={<ListChecks size={19} />}
                title="Nothing due"
                description="No dated tasks in the next two weeks."
                className="m-2 border-0 bg-transparent py-8"
              />
            ) : (
              <ul className="space-y-0.5">
                {tasks.map((t) => {
                  const overdue =
                    t.due_date && new Date(t.due_date) < startOfToday;
                  return (
                    <li
                      key={t.id}
                      className="flex items-center gap-2.5 rounded-md px-3 py-2 transition-colors hover:bg-surface-2"
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{
                          background:
                            t.priority === "urgent"
                              ? "var(--rose)"
                              : t.priority === "high"
                                ? "var(--amber)"
                                : "var(--line-strong)",
                        }}
                      />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                        {t.title}
                      </span>
                      <span
                        className={
                          overdue
                            ? "shrink-0 text-[11.5px] font-medium text-[var(--rose)]"
                            : "shrink-0 text-[11.5px] text-ink-4"
                        }
                      >
                        {new Date(t.due_date!).toLocaleDateString(LOCALE, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Affiliates"
            subtitle="Who is sending you work"
            action={
              <Link
                href="/affiliates"
                className="text-[12px] font-medium text-[var(--clay)] hover:underline"
              >
                All
              </Link>
            }
          />
          <div className="p-2">
            {affiliateBoard.length === 0 ? (
              <EmptyState
                icon={<Handshake size={19} />}
                title="No affiliates yet"
                description="Add the people who refer work to you."
                className="m-2 border-0 bg-transparent py-8"
              />
            ) : (
              <ul className="space-y-0.5">
                {affiliateBoard.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-surface-2"
                  >
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-semibold text-white"
                      style={{ background: `var(--${accentFor(a.id)})` }}
                    >
                      {a.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink">
                        {a.name}
                      </p>
                      <p className="text-[11px] text-ink-4">
                        {a.leadsFrom} leads
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[12.5px] font-medium tabular-nums text-ink">
                        {compactMoney(a.earned)}
                      </p>
                      {a.pending > 0 ? (
                        <p className="text-[10.5px] text-[var(--amber)]">
                          {compactMoney(a.pending)} due
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      {/* -------------------------------------------------- project strip */}
      <Card>
        <CardHeader
          title="Projects in flight"
          subtitle="Progress against the delivery date"
          action={
            <Link
              href="/projects"
              className="text-[12px] font-medium text-[var(--clay)] hover:underline"
            >
              All projects
            </Link>
          }
        />
        {activeProjects.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<FolderKanban size={19} />}
              title="No active projects"
              description="Projects you mark active or in review show up here with live progress."
            />
          </div>
        ) : (
          <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {activeProjects.slice(0, 6).map((p) => {
              const client = clients.find((c) => c.id === p.client_id);
              return (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="rounded-lg border border-line bg-surface p-3.5 transition-colors hover:border-line-2 hover:bg-surface-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-medium text-ink">
                        {p.name}
                      </p>
                      <p className="mt-0.5 truncate text-[11.5px] text-ink-4">
                        {client?.name ?? "Internal"}
                      </p>
                    </div>
                    <Badge accent={PROJECT_STATUS_ACCENT[p.status]} dot>
                      {PROJECT_STATUS_LABEL[p.status]}
                    </Badge>
                  </div>

                  <div className="mt-3.5">
                    <div className="mb-1.5 flex items-baseline justify-between text-[11.5px]">
                      <span className="tabular-nums text-ink-3">{p.progress}%</span>
                      <span className="text-ink-4">
                        {p.due_date
                          ? `due ${new Date(p.due_date).toLocaleDateString(LOCALE, {
                              month: "short",
                              day: "numeric",
                            })}`
                          : "no date"}
                      </span>
                    </div>
                    <Progress value={p.progress} accent={p.accent} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
