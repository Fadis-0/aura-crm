import Link from "next/link";
import {
  ArrowRight,
  Coins,
  FolderOpen,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { getPortalContext } from "@/lib/portal";
import { supabaseServer } from "@/lib/supabase/server";
import { Badge, Card, CardHeader, EmptyState, Progress } from "@/components/ui";
import { compactMoney, money } from "@/lib/utils";
import {
  LEAD_STAGES,
  STAGE_ACCENT,
  STAGE_LABEL,
  type Commission,
  type Lead,
  type Project,
  type ProjectMarketer,
} from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Overview" };

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default async function PortalHome() {
  const { profile, affiliate } = await getPortalContext();
  const sb = await supabaseServer();

  const [projectsRes, joinedRes, leadsRes, commissionsRes] = await Promise.all([
    sb.from("projects").select("*").eq("open_for_affiliates", true),
    affiliate
      ? sb.from("project_marketers").select("*").eq("affiliate_id", affiliate.id)
      : Promise.resolve({ data: [] }),
    affiliate
      ? sb.from("leads").select("*").eq("affiliate_id", affiliate.id)
      : Promise.resolve({ data: [] }),
    affiliate
      ? sb.from("commissions").select("*").eq("affiliate_id", affiliate.id)
      : Promise.resolve({ data: [] }),
  ]);

  const projects = (projectsRes.data ?? []) as Project[];
  const joined = (joinedRes.data ?? []) as ProjectMarketer[];
  const leads = (leadsRes.data ?? []) as Lead[];
  const commissions = (commissionsRes.data ?? []) as Commission[];

  const myProjects = projects.filter((p) =>
    joined.some((j) => j.project_id === p.id && j.status === "active"),
  );
  const available = projects.filter((p) => !joined.some((j) => j.project_id === p.id));

  const open = leads.filter((l) => l.stage !== "won" && l.stage !== "lost");
  const won = leads.filter((l) => l.stage === "won");

  const paid = commissions
    .filter((c) => c.status === "paid")
    .reduce((s, c) => s + c.amount, 0);
  const owed = commissions
    .filter((c) => c.status !== "paid" && c.status !== "cancelled")
    .reduce((s, c) => s + c.amount, 0);

  const funnel = LEAD_STAGES.filter((s) => s !== "lost").map((stage) => ({
    stage,
    count: leads.filter((l) => l.stage === stage).length,
  }));
  const funnelMax = Math.max(1, ...funnel.map((f) => f.count));

  const stats = [
    {
      label: "Projects you work",
      value: String(myProjects.length),
      sub: `${available.length} more available`,
      icon: FolderOpen,
      accent: "indigo",
      href: "/portal/projects",
    },
    {
      label: "Leads in play",
      value: String(open.length),
      sub: `${won.length} closed so far`,
      icon: Target,
      accent: "clay",
      href: "/portal/leads",
    },
    {
      label: "Earned",
      value: compactMoney(paid),
      sub: "paid out to you",
      icon: Coins,
      accent: "sage",
      href: "/portal/earnings",
    },
    {
      label: "Owed to you",
      value: compactMoney(owed),
      sub: "approved and pending",
      icon: TrendingUp,
      accent: "amber",
      href: "/portal/earnings",
    },
  ];

  return (
    <div className="space-y-6">
      <header>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-4">
          Your workspace
        </p>
        <h1 className="text-[27px] leading-tight">
          {greeting()}, {profile.full_name.split(" ")[0]}.
        </h1>
        <p className="mt-1 text-[13.5px] text-ink-3">
          {myProjects.length === 0
            ? "Pick up a project to get started."
            : `${open.length} open ${open.length === 1 ? "lead" : "leads"} across ${myProjects.length} ${myProjects.length === 1 ? "project" : "projects"}.`}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="group rounded-lg border border-line bg-surface p-4 shadow-soft transition-all hover:border-line-2 hover:shadow-raised"
          >
            <span
              className="grid h-9 w-9 place-items-center rounded-lg"
              style={{
                background: `var(--${s.accent}-soft)`,
                color: `var(--${s.accent})`,
              }}
            >
              <s.icon size={17} />
            </span>
            <p className="mt-4 font-display text-[26px] leading-none tabular-nums">
              {s.value}
            </p>
            <p className="mt-2 text-[12.5px] font-medium text-ink-3">{s.label}</p>
            <p className="mt-0.5 text-[11.5px] text-ink-4">{s.sub}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader
            title="Projects you are working"
            subtitle="Everything you have picked up"
            action={
              <Link
                href="/portal/projects"
                className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--clay)] hover:underline"
              >
                Browse all <ArrowRight size={12} />
              </Link>
            }
          />
          {myProjects.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<Sparkles size={19} />}
                title="Nothing picked up yet"
                description="Browse the open projects and add the ones you want to sell."
              />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {myProjects.slice(0, 6).map((p) => {
                const mine = leads.filter((l) => l.stage === "won").length;
                return (
                  <li key={p.id}>
                    <Link
                      href={`/portal/projects/${p.id}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
                    >
                      <span
                        className="h-8 w-1 shrink-0 rounded-full"
                        style={{ background: `var(--${p.accent})` }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-medium text-ink">
                          {p.name}
                        </p>
                        <p className="mt-0.5 truncate text-[11.5px] text-ink-4">
                          {p.affiliate_brief ?? "No brief yet"}
                        </p>
                      </div>
                      {p.affiliate_commission_rate ? (
                        <Badge accent="sage">{p.affiliate_commission_rate}%</Badge>
                      ) : null}
                      <span className="hidden shrink-0 text-[11.5px] text-ink-4 sm:block">
                        {mine} won
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Your pipeline"
            subtitle="Leads by stage"
            action={
              <Link
                href="/portal/leads"
                className="text-[12px] font-medium text-[var(--clay)] hover:underline"
              >
                Open
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
                    {f.count}
                  </span>
                </div>
                <Progress
                  value={(f.count / funnelMax) * 100}
                  accent={STAGE_ACCENT[f.stage]}
                />
              </div>
            ))}
            {leads.length === 0 ? (
              <p className="pt-2 text-[12.5px] text-ink-4">
                No leads yet. Add your first from the My leads page.
              </p>
            ) : null}
          </div>
        </Card>
      </div>

      {available.length > 0 ? (
        <Card>
          <CardHeader
            title="Open for affiliates"
            subtitle="Projects you have not taken on yet"
            action={
              <Link
                href="/portal/projects"
                className="text-[12px] font-medium text-[var(--clay)] hover:underline"
              >
                See all
              </Link>
            }
          />
          <div className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-3">
            {available.slice(0, 6).map((p) => (
              <Link
                key={p.id}
                href={`/portal/projects/${p.id}`}
                className="bg-surface p-4 transition-colors hover:bg-surface-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">
                    {p.name}
                  </p>
                  {p.affiliate_commission_rate ? (
                    <Badge accent="sage">{p.affiliate_commission_rate}%</Badge>
                  ) : null}
                </div>
                {p.affiliate_brief ? (
                  <p className="mt-2 line-clamp-2 text-[12.5px] leading-relaxed text-ink-3">
                    {p.affiliate_brief}
                  </p>
                ) : null}
                {p.affiliate_payout_note ? (
                  <p className="mt-2.5 text-[11.5px] text-ink-4">
                    {p.affiliate_payout_note}
                  </p>
                ) : null}
              </Link>
            ))}
          </div>
        </Card>
      ) : null}

      {owed > 0 ? (
        <p className="text-[12.5px] text-ink-3">
          {money(owed)} is approved and waiting to be paid out to you.
        </p>
      ) : null}
    </div>
  );
}
