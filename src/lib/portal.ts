import "server-only";

import { redirect } from "next/navigation";
import { getSession, type Session } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import type { Affiliate } from "@/lib/types";

export type PortalContext = Session & {
  /** The affiliate record the marketer's leads and commissions hang off. */
  affiliate: Affiliate | null;
};

/**
 * Everything a portal page needs about the viewer.
 *
 * Admins get through with a null affiliate so they can preview the portal
 * without owning one.
 */
export async function getPortalContext(): Promise<PortalContext> {
  const session = await getSession();
  if (!session) redirect("/login");

  const sb = await supabaseServer();
  const { data } = await sb
    .from("affiliates")
    .select("*")
    .eq("profile_id", session.userId)
    .maybeSingle();

  return { ...session, affiliate: (data as Affiliate | null) ?? null };
}
