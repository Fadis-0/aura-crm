import { notFound } from "next/navigation";
import { getPortalContext } from "@/lib/portal";
import { supabaseServer } from "@/lib/supabase/server";
import { PortalProjectDetail } from "./portal-project-detail";
import type { Lead, Project, ProjectAsset, ProjectMarketer } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PortalProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { affiliate } = await getPortalContext();
  const sb = await supabaseServer();

  const { data: project } = await sb
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  // Row-level security already hides projects that are not open to affiliates.
  if (!project) notFound();

  const [assetsRes, membershipRes, leadsRes] = await Promise.all([
    sb.from("project_assets").select("*").eq("project_id", id).order("position"),
    affiliate
      ? sb
          .from("project_marketers")
          .select("*")
          .eq("project_id", id)
          .eq("affiliate_id", affiliate.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    affiliate
      ? sb.from("leads").select("*").eq("affiliate_id", affiliate.id)
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <PortalProjectDetail
      project={project as Project}
      assets={(assetsRes.data ?? []) as ProjectAsset[]}
      initialMembership={(membershipRes.data as ProjectMarketer | null) ?? null}
      affiliateId={affiliate?.id ?? null}
      leads={(leadsRes.data ?? []) as Lead[]}
    />
  );
}
