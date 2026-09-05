import { supabaseServer } from "@/lib/supabase/server";
import { ClientsView } from "./clients-view";
import type { Affiliate, Client, Invoice, Project } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clients" };

export default async function ClientsPage() {
  const sb = await supabaseServer();

  const [clientsRes, projectsRes, invoicesRes, affiliatesRes] = await Promise.all([
    sb.from("clients").select("*").order("created_at", { ascending: false }),
    sb.from("projects").select("*").eq("archived", false),
    sb.from("invoices").select("*"),
    sb.from("affiliates").select("*").order("name"),
  ]);

  return (
    <ClientsView
      initialClients={(clientsRes.data ?? []) as Client[]}
      projects={(projectsRes.data ?? []) as Project[]}
      invoices={(invoicesRes.data ?? []) as Invoice[]}
      affiliates={(affiliatesRes.data ?? []) as Affiliate[]}
    />
  );
}
