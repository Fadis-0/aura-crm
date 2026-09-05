import { getPortalContext } from "@/lib/portal";
import { supabaseServer } from "@/lib/supabase/server";
import { PortalLeads } from "./portal-leads";
import type { Lead, PortalProject, ProjectPlan } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "My leads" };

export default async function PortalLeadsPage() {
  const { affiliate } = await getPortalContext();
  const sb = await supabaseServer();

  const [leadsRes, projectsRes, plansRes] = await Promise.all([
    affiliate
      ? sb
          .from("leads")
          .select("*")
          .eq("affiliate_id", affiliate.id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    sb.from("projects_public").select("*").order("name"),
    sb.from("project_plans").select("*").order("position"),
  ]);

  return (
    <PortalLeads
      initialLeads={(leadsRes.data ?? []) as Lead[]}
      affiliateId={affiliate?.id ?? null}
      affiliate={affiliate}
      projects={(projectsRes.data ?? []) as PortalProject[]}
      plans={(plansRes.data ?? []) as ProjectPlan[]}
    />
  );
}
