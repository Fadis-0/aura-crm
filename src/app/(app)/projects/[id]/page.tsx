import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { ProjectDetail } from "./project-detail";
import type {
  Affiliate,
  Client,
  Invoice,
  Profile,
  Project,
  ProjectAsset,
  ProjectMarketer,
  Task,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = await supabaseServer();

  const { data: project } = await sb
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!project) notFound();

  const [clientsRes, tasksRes, invoicesRes, profilesRes, assetsRes, marketersRes, affiliatesRes] =
    await Promise.all([
      sb.from("clients").select("*").order("name"),
      sb.from("tasks").select("*").eq("project_id", id).order("position"),
      sb.from("invoices").select("*").eq("project_id", id).order("issued_on", { ascending: false }),
      sb.from("profiles").select("*"),
      sb.from("project_assets").select("*").eq("project_id", id).order("position"),
      sb.from("project_marketers").select("*").eq("project_id", id),
      sb.from("affiliates").select("*"),
    ]);

  return (
    <ProjectDetail
      project={project as Project}
      clients={(clientsRes.data ?? []) as Client[]}
      initialTasks={(tasksRes.data ?? []) as Task[]}
      invoices={(invoicesRes.data ?? []) as Invoice[]}
      profiles={(profilesRes.data ?? []) as Profile[]}
      assets={(assetsRes.data ?? []) as ProjectAsset[]}
      marketers={(marketersRes.data ?? []) as ProjectMarketer[]}
      affiliates={(affiliatesRes.data ?? []) as Affiliate[]}
    />
  );
}
