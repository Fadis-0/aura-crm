import { supabaseServer } from "@/lib/supabase/server";
import { PipelineBoard } from "./pipeline-board";
import type { Affiliate, Lead, Project, ProjectPlan } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const sb = await supabaseServer();

  const [leadsRes, affiliatesRes, projectsRes, plansRes] = await Promise.all([
    sb.from("leads").select("*").order("position").order("created_at", { ascending: false }),
    sb.from("affiliates").select("*").order("name"),
    sb.from("projects").select("*").eq("archived", false).order("name"),
    sb.from("project_plans").select("*").order("position"),
  ]);

  return (
    <PipelineBoard
      initialLeads={(leadsRes.data ?? []) as Lead[]}
      affiliates={(affiliatesRes.data ?? []) as Affiliate[]}
      projects={(projectsRes.data ?? []) as Project[]}
      plans={(plansRes.data ?? []) as ProjectPlan[]}
    />
  );
}
