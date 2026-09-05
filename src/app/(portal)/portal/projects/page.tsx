import { getPortalContext } from "@/lib/portal";
import { supabaseServer } from "@/lib/supabase/server";
import { PortalProjects } from "./portal-projects";
import type { Project, ProjectMarketer } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Projects" };

export default async function PortalProjectsPage() {
  const { affiliate } = await getPortalContext();
  const sb = await supabaseServer();

  const [projectsRes, joinedRes, assetCountsRes] = await Promise.all([
    sb
      .from("projects")
      .select("*")
      .eq("open_for_affiliates", true)
      .order("created_at", { ascending: false }),
    affiliate
      ? sb.from("project_marketers").select("*").eq("affiliate_id", affiliate.id)
      : Promise.resolve({ data: [] }),
    sb.from("project_assets").select("id,project_id"),
  ]);

  const assets = (assetCountsRes.data ?? []) as { id: string; project_id: string }[];

  return (
    <PortalProjects
      projects={(projectsRes.data ?? []) as Project[]}
      initialJoined={(joinedRes.data ?? []) as ProjectMarketer[]}
      affiliateId={affiliate?.id ?? null}
      assetCounts={assets.reduce<Record<string, number>>((acc, a) => {
        acc[a.project_id] = (acc[a.project_id] ?? 0) + 1;
        return acc;
      }, {})}
    />
  );
}
