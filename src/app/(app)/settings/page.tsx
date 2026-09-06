import { supabaseServer } from "@/lib/supabase/server";
import { SettingsView } from "./settings-view";
import type { Profile, WorkspaceSettings } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();

  const [profilesRes, settingsRes] = await Promise.all([
    sb.from("profiles").select("*").order("created_at"),
    sb.from("workspace_settings").select("*").eq("id", true).maybeSingle(),
  ]);

  return (
    <SettingsView
      profiles={(profilesRes.data ?? []) as Profile[]}
      settings={(settingsRes.data ?? null) as WorkspaceSettings | null}
      currentUserId={user!.id}
      email={user!.email ?? ""}
    />
  );
}
