import { getPortalContext } from "@/lib/portal";
import { supabaseServer } from "@/lib/supabase/server";
import { PortalLeads } from "./portal-leads";
import type { Lead } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "My leads" };

export default async function PortalLeadsPage() {
  const { affiliate } = await getPortalContext();
  const sb = await supabaseServer();

  const { data } = affiliate
    ? await sb
        .from("leads")
        .select("*")
        .eq("affiliate_id", affiliate.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <PortalLeads
      initialLeads={(data ?? []) as Lead[]}
      affiliateId={affiliate?.id ?? null}
      commissionRate={affiliate?.commission_rate ?? null}
    />
  );
}
