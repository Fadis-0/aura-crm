"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Check, Coins, FolderOpen, Plus, Target } from "lucide-react";
import { AssetRow } from "@/components/assets/asset-kit";
import { planPayout, plansPayoutRange } from "@/lib/commission";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { CreateLeadDialog } from "@/components/portal/create-lead-dialog";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useServerState } from "@/lib/use-server-state";
import { LOCALE, money } from "@/lib/utils";
import {
  STAGE_ACCENT,
  STAGE_LABEL,
  type Lead,
  type Project,
  type ProjectAsset,
  type ProjectMarketer,
  type ProjectPlan,
} from "@/lib/types";

export function PortalProjectDetail({
  project,
  assets,
  initialMembership,
  affiliateId,
  leads,
  plans,
}: {
  project: Project;
  assets: ProjectAsset[];
  initialMembership: ProjectMarketer | null;
  affiliateId: string | null;
  leads: Lead[];
  plans: ProjectPlan[];
}) {
  const sb = supabaseBrowser();

  const [membership, setMembership] = useServerState(initialMembership);
  const [myLeads, setMyLeads] = useServerState(leads);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);

  const working = membership?.status === "active";
  const payoutRange = plansPayoutRange(plans);
  const won = myLeads.filter((l) => l.stage === "won").length;

  const toggle = async () => {
    if (!affiliateId) {
      toast.error("Something is off with your account. Please get in touch.");
      return;
    }
    setBusy(true);

    if (working) {
      const { error } = await sb
        .from("project_marketers")
        .update({ status: "left" })
        .eq("project_id", project.id)
        .eq("affiliate_id", affiliateId);
      setBusy(false);
      if (error) return toast.error(error.message);
      setMembership((m) => (m ? { ...m, status: "left" } : m));
      toast.success("Removed from your projects");
      return;
    }

    const { data, error } = await sb
      .from("project_marketers")
      .upsert(
        { project_id: project.id, affiliate_id: affiliateId, status: "active" },
        { onConflict: "project_id,affiliate_id" },
      )
      .select("*")
      .single();

    setBusy(false);
    if (error) return toast.error(error.message);
    setMembership(data as ProjectMarketer);
    toast.success(`${project.name} added to your projects`);
  };

  const files = assets.filter((a) => a.storage_path);
  const links = assets.filter((a) => !a.storage_path);

  return (
    <>
      <Link
        href="/portal/projects"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-3 transition-colors hover:text-ink"
      >
        <ArrowLeft size={14} />
        All projects
      </Link>

      <PageHeader
        eyebrow="Campaign"
        title={project.name}
        description={project.affiliate_brief ?? project.description ?? undefined}
        actions={
          <>
            {working ? (
              <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
                <Plus size={14} />
                New lead
              </Button>
            ) : null}
            <Button
              variant={working ? "secondary" : "primary"}
              size="sm"
              loading={busy}
              onClick={toggle}
            >
              {busy ? null : working ? <Check size={14} /> : <Plus size={14} />}
              {working ? "Working on this" : "Work on this"}
            </Button>
          </>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {[
          {
            label: "You earn",
            value: payoutRange ?? "To be confirmed",
            color: "var(--clay)",
          },
          {
            label: "Your closed leads",
            value: String(won),
            color: "var(--sage)",
          },
          {
            label: "Runs until",
            value: project.due_date
              ? new Date(project.due_date).toLocaleDateString(LOCALE, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "Open ended",
            color: "var(--indigo)",
          },
        ].map((s) => (
          <Card key={s.label} className="p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-4">
              {s.label}
            </p>
            <p
              className="mt-1.5 font-display text-[20px] leading-none"
              style={{ color: s.color }}
            >
              {s.value}
            </p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="What you earn"
              subtitle="Your cut on each way a client can buy"
            />
            {plans.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={<Coins size={19} />}
                  title="No plans published yet"
                  description="The team has not set the pricing for this project."
                  className="py-8"
                />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {plans.map((pl) => (
                  <li
                    key={pl.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-medium text-ink">
                        {pl.name}
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-ink-4">
                        {money(pl.price)}
                        {pl.kind === "subscription" ? " / month" : " one-time"}
                      </p>
                    </div>
                    <Badge accent="clay">{money(planPayout(pl))} to you</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Files and documents"
              subtitle={
                files.length
                  ? `${files.length} to download`
                  : "Nothing uploaded yet"
              }
            />
            {files.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={<FolderOpen size={19} />}
                  title="No files yet"
                  description="Material for this project will appear here."
                  className="py-8"
                />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {files.map((a) => (
                  <AssetRow key={a.id} asset={a} />
                ))}
              </ul>
            )}
          </Card>

          {links.length > 0 ? (
            <Card>
              <CardHeader
                title="Demos and links"
                subtitle="Open these in a new tab"
              />
              <ul className="divide-y divide-line">
                {links.map((a) => (
                  <AssetRow key={a.id} asset={a} />
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          {project.affiliate_payout_note ? (
            <Card>
              <CardHeader title="How you get paid" />
              <p className="whitespace-pre-wrap px-5 py-4 text-[13px] leading-relaxed text-ink-2">
                {project.affiliate_payout_note}
              </p>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Your leads"
              subtitle={`${myLeads.length} submitted in total`}
              action={
                <Link
                  href="/portal/leads"
                  className="text-[12px] font-medium text-[var(--clay)] hover:underline"
                >
                  Open board
                </Link>
              }
            />
            {myLeads.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={<Target size={19} />}
                  title="No leads yet"
                  description={
                    working
                      ? "Add the first person you have brought in."
                      : "Take this project on first, then start adding leads."
                  }
                  className="py-8"
                  action={
                    working ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setCreating(true)}
                      >
                        <Plus size={14} />
                        New lead
                      </Button>
                    ) : null
                  }
                />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {myLeads.slice(0, 8).map((l) => (
                  <li key={l.id} className="flex items-center gap-2.5 px-4 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                      {l.name}
                    </span>
                    <span className="shrink-0 text-[12px] tabular-nums text-ink-3">
                      {money(l.estimated_value ?? 0)}
                    </span>
                    <Badge accent={STAGE_ACCENT[l.stage]}>
                      {STAGE_LABEL[l.stage]}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <CreateLeadDialog
        open={creating}
        onClose={() => setCreating(false)}
        affiliateId={affiliateId}
        plans={plans}
        lockedProjectId={project.id}
        onCreated={(lead) => setMyLeads((rows) => [lead, ...rows])}
      />
    </>
  );
}
