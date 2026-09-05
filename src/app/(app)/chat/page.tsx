import { supabaseServer } from "@/lib/supabase/server";
import { ChatRoom } from "./chat-room";
import type { Conversation, Message, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Messages" };

export default async function ChatPage() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();

  const { data: profiles } = await sb.from("profiles").select("*").order("created_at");

  // One shared room for the workspace. Created on first visit.
  let { data: conversation } = await sb
    .from("conversations")
    .select("*")
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (!conversation) {
    const { data: created } = await sb
      .from("conversations")
      .insert({ title: "Workspace", is_direct: true, created_by: user!.id })
      .select("*")
      .single();
    conversation = created;

    if (created && profiles?.length) {
      await sb.from("conversation_members").insert(
        profiles.map((p) => ({ conversation_id: created.id, profile_id: p.id })),
      );
    }
  }

  const { data: messages } = conversation
    ? await sb
        .from("messages")
        .select("*")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: false })
        .limit(200)
    : { data: [] };

  return (
    <ChatRoom
      conversation={conversation as Conversation}
      initialMessages={((messages ?? []) as Message[]).slice().reverse()}
      profiles={(profiles ?? []) as Profile[]}
      currentUserId={user!.id}
    />
  );
}
