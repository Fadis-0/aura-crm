import { supabaseServer } from "@/lib/supabase/server";
import { SettingsView } from "./settings-view";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();

  const { data: profiles } = await sb.from("profiles").select("*").order("created_at");

  return (
    <SettingsView
      profiles={(profiles ?? []) as Profile[]}
      currentUserId={user!.id}
      email={user!.email ?? ""}
    />
  );
}
