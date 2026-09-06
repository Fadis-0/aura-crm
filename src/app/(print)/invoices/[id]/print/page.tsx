import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { InvoiceDocument } from "./document";
import type {
  Client,
  Invoice,
  InvoiceItem,
  Project,
  WorkspaceSettings,
} from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Print" };

export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const sb = await supabaseServer();

  const { data: invoice } = await sb
    .from("invoices")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!invoice) notFound();
  const doc = invoice as Invoice;

  const [itemsRes, settingsRes, clientRes, projectRes] = await Promise.all([
    sb.from("invoice_items").select("*").eq("invoice_id", id).order("position"),
    sb.from("workspace_settings").select("*").eq("id", true).maybeSingle(),
    doc.client_id
      ? sb.from("clients").select("*").eq("id", doc.client_id).maybeSingle()
      : Promise.resolve({ data: null }),
    doc.project_id
      ? sb.from("projects").select("*").eq("id", doc.project_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <InvoiceDocument
      invoice={doc}
      items={(itemsRes.data ?? []) as InvoiceItem[]}
      settings={(settingsRes.data ?? null) as WorkspaceSettings | null}
      client={(clientRes.data ?? null) as Client | null}
      project={(projectRes.data ?? null) as Project | null}
    />
  );
}
