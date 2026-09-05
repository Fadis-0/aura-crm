import { supabaseServer } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { AffiliatesView } from "./affiliates-view";
import type { Affiliate, Client, Commission, Lead, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Affiliates" };

export default async function AffiliatesPage() {
  const sb = await supabaseServer();
  const session = await getSession();

  const [affiliatesRes, leadsRes, clientsRes, commissionsRes, marketersRes] =
    await Promise.all([
      sb.from("affiliates").select("*").order("created_at", { ascending: false }),
      sb.from("leads").select("*").not("affiliate_id", "is", null),
      sb.from("clients").select("*").not("affiliate_id", "is", null),
      sb.from("commissions").select("*").order("earned_on", { ascending: false }),
      sb
        .from("profiles")
        .select("*")
        .eq("role", "marketer")
        .order("created_at", { ascending: false }),
    ]);

  return (
    <AffiliatesView
      initialAffiliates={(affiliatesRes.data ?? []) as Affiliate[]}
      leads={(leadsRes.data ?? []) as Lead[]}
      clients={(clientsRes.data ?? []) as Client[]}
      initialCommissions={(commissionsRes.data ?? []) as Commission[]}
      initialMarketers={(marketersRes.data ?? []) as Profile[]}
      currentUserId={session?.userId ?? ""}
    />
  );
}
