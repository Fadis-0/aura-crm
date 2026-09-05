import { supabaseServer } from "@/lib/supabase/server";
import { CalendarView } from "./calendar-view";
import type { CalendarEvent, Client, Project } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendar" };

export default async function CalendarPage() {
  const sb = await supabaseServer();

  const [eventsRes, clientsRes, projectsRes] = await Promise.all([
    sb.from("events").select("*").order("starts_at"),
    sb.from("clients").select("id,name").order("name"),
    sb.from("projects").select("id,name").eq("archived", false).order("name"),
  ]);

  return (
    <CalendarView
      initialEvents={(eventsRes.data ?? []) as CalendarEvent[]}
      clients={(clientsRes.data ?? []) as Pick<Client, "id" | "name">[]}
      projects={(projectsRes.data ?? []) as Pick<Project, "id" | "name">[]}
    />
  );
}
