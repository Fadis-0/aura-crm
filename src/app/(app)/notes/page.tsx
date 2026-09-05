import { supabaseServer } from "@/lib/supabase/server";
import { NotesView } from "./notes-view";
import type { Client, Note, Project } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notes" };

export default async function NotesPage() {
  const sb = await supabaseServer();

  const [notesRes, clientsRes, projectsRes] = await Promise.all([
    sb
      .from("notes")
      .select("*")
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false }),
    sb.from("clients").select("id,name").order("name"),
    sb.from("projects").select("id,name").eq("archived", false).order("name"),
  ]);

  return (
    <NotesView
      initialNotes={(notesRes.data ?? []) as Note[]}
      clients={(clientsRes.data ?? []) as Pick<Client, "id" | "name">[]}
      projects={(projectsRes.data ?? []) as Pick<Project, "id" | "name">[]}
    />
  );
}
