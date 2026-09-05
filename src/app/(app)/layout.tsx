import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { SetupNotice } from "@/components/setup-notice";
import { supabaseServer } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { isConfigured } from "@/lib/config";
import type { Notification } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isConfigured()) return <SetupNotice />;

  const session = await getSession();
  if (!session) redirect("/login");
  // Marketers get the portal, never the back office.
  if (!session.isAdmin) redirect("/portal");

  const sb = await supabaseServer();
  const user = { id: session.userId };

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  const [notificationsRes, leadsRes, tasksRes, eventsRes] = await Promise.all([
    sb
      .from("notifications")
      .select("*")
      .eq("audience", "admins")
      .order("created_at", { ascending: false })
      .limit(40),
    sb
      .from("leads")
      .select("id", { count: "exact", head: true })
      .not("stage", "in", "(won,lost)"),
    sb
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .neq("status", "done")
      .eq("assignee_id", user.id),
    sb
      .from("events")
      .select("id", { count: "exact", head: true })
      .gte("starts_at", startOfToday.toISOString())
      .lt("starts_at", endOfToday.toISOString()),
  ]);

  return (
    <AppShell
      profile={session.profile}
      notifications={(notificationsRes.data ?? []) as Notification[]}
      counts={{
        leads: leadsRes.count ?? 0,
        tasks: tasksRes.count ?? 0,
        today: eventsRes.count ?? 0,
      }}
    >
      {children}
    </AppShell>
  );
}
