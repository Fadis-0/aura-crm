import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/portal-shell";
import { AccountGate } from "@/components/portal/account-gate";
import { PasswordGate } from "@/components/portal/password-gate";
import { SetupNotice } from "@/components/setup-notice";
import { getSession } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/config";
import type { Notification } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isConfigured()) return <SetupNotice />;

  const session = await getSession();
  if (!session) redirect("/login");

  // Admins may look around the portal; marketers must be approved first.
  if (!session.isAdmin && session.profile.status !== "active") {
    return <AccountGate profile={session.profile} />;
  }

  // An admin picked their password, so nothing else loads until it is theirs.
  if (!session.isAdmin && session.profile.must_change_password) {
    return <PasswordGate profile={session.profile} />;
  }

  const sb = await supabaseServer();
  const { data: notifications } = await sb
    .from("notifications")
    .select("*")
    .eq("recipient_id", session.userId)
    .order("created_at", { ascending: false })
    .limit(40);

  return (
    <PortalShell
      profile={session.profile}
      notifications={(notifications ?? []) as Notification[]}
    >
      {children}
    </PortalShell>
  );
}
