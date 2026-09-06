import { supabaseServer } from "@/lib/supabase/server";
import { ClientsView } from "./clients-view";
import type { Client, Invoice, Project, ProjectPlan } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clients" };

export default async function ClientsPage() {
  const sb = await supabaseServer();

  const [clientsRes, projectsRes, plansRes, invoicesRes] = await Promise.all([
    sb.from("clients").select("*").order("created_at", { ascending: false }),
    sb.from("projects").select("*").eq("archived", false),
    sb.from("project_plans").select("*").order("position"),
    sb.from("invoices").select("*"),
  ]);

  return (
    <ClientsView
      initialClients={(clientsRes.data ?? []) as Client[]}
      projects={(projectsRes.data ?? []) as Project[]}
      plans={(plansRes.data ?? []) as ProjectPlan[]}
      invoices={(invoicesRes.data ?? []) as Invoice[]}
    />
  );
}
