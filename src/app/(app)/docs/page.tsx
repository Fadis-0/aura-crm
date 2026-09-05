import { supabaseServer } from "@/lib/supabase/server";
import { DocsHub } from "./docs-hub";
import type { Project, ProjectAsset } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Documents" };

export default async function DocsPage() {
  const sb = await supabaseServer();

  const [assetsRes, projectsRes] = await Promise.all([
    sb.from("project_assets").select("*").order("created_at", { ascending: false }),
    sb.from("projects").select("*").eq("archived", false).order("name"),
  ]);

  return (
    <DocsHub
      initialAssets={(assetsRes.data ?? []) as ProjectAsset[]}
      projects={(projectsRes.data ?? []) as Project[]}
    />
  );
}
