import { supabaseServer } from "@/lib/supabase/server";
import { InvoicesView } from "./invoices-view";
import type { Client, Invoice, Project } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoices" };

export default async function InvoicesPage() {
  const sb = await supabaseServer();

  const [invoicesRes, clientsRes, projectsRes] = await Promise.all([
    sb.from("invoices").select("*").order("issued_on", { ascending: false }),
    sb.from("clients").select("id,name").order("name"),
    sb.from("projects").select("id,name").eq("archived", false).order("name"),
  ]);

  return (
    <InvoicesView
      initialInvoices={(invoicesRes.data ?? []) as Invoice[]}
      clients={(clientsRes.data ?? []) as Pick<Client, "id" | "name">[]}
      projects={(projectsRes.data ?? []) as Pick<Project, "id" | "name">[]}
    />
  );
}
