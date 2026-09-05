import { supabaseServer } from "@/lib/supabase/server";
import { PlanningWorkspace } from "./planning-workspace";
import type {
  Board,
  BoardColumn,
  Goal,
  Profile,
  Project,
  Task,
} from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Planning" };

export default async function PlanningPage() {
  const sb = await supabaseServer();

  const [boardsRes, columnsRes, tasksRes, goalsRes, profilesRes, projectsRes] =
    await Promise.all([
      sb.from("boards").select("*").order("position"),
      sb.from("board_columns").select("*").order("position"),
      sb.from("tasks").select("*").order("position"),
      sb.from("goals").select("*").order("created_at", { ascending: false }),
      sb.from("profiles").select("*"),
      sb.from("projects").select("*").eq("archived", false).order("name"),
    ]);

  return (
    <PlanningWorkspace
      initialBoards={(boardsRes.data ?? []) as Board[]}
      initialColumns={(columnsRes.data ?? []) as BoardColumn[]}
      initialTasks={(tasksRes.data ?? []) as Task[]}
      initialGoals={(goalsRes.data ?? []) as Goal[]}
      profiles={(profilesRes.data ?? []) as Profile[]}
      projects={(projectsRes.data ?? []) as Project[]}
    />
  );
}
