import { supabaseServer } from "@/lib/supabase/server";
import { ProjectsView } from "./projects-view";
import type { Client, Project, Task } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const sb = await supabaseServer();

  const [projectsRes, clientsRes, tasksRes] = await Promise.all([
    sb.from("projects").select("*").order("created_at", { ascending: false }),
    sb.from("clients").select("*").order("name"),
    sb.from("tasks").select("id,project_id,status"),
  ]);

  return (
    <ProjectsView
      initialProjects={(projectsRes.data ?? []) as Project[]}
      clients={(clientsRes.data ?? []) as Client[]}
      tasks={(tasksRes.data ?? []) as Pick<Task, "id" | "project_id" | "status">[]}
    />
  );
}
