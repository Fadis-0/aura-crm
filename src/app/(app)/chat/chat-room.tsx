"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MessageCircle, Send, Smile } from "lucide-react";
import { Avatar, Card, EmptyState } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { RealtimePostgresInsertPayload } from "@supabase/supabase-js";
import { cn, LOCALE } from "@/lib/utils";
import type { Conversation, Message, Profile } from "@/lib/types";

const QUICK_EMOJI = ["👍", "🔥", "🎉", "😂", "❤️", "🤔", "✅", "🙏"];

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Today";
  if (same(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString(LOCALE, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function ChatRoom({
  conversation,
  initialMessages,
  profiles,
  currentUserId,
}: {
  conversation: Conversation | null;
  initialMessages: Message[];
  profiles: Profile[];
  currentUserId: string;
}) {
  const sb = supabaseBrowser();

  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [online, setOnline] = useState<string[]>([]);
  const [typing, setTyping] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const me = profiles.find((p) => p.id === currentUserId);
  /** The other person in the room. */
  const other = profiles.find((p) => p.id !== currentUserId);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    scrollToBottom(false);
  }, [scrollToBottom]);

  // Realtime: new messages, presence, typing.
  useEffect(() => {
    if (!conversation) return;

    const channel = sb
      .channel(`room:${conversation.id}`, {
        config: { presence: { key: currentUserId } },
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload: RealtimePostgresInsertPayload<Message>) => {
          const incoming = payload.new;
          setMessages((rows) =>
            rows.some((m) => m.id === incoming.id) ? rows : [...rows, incoming],
          );
          setTyping(null);
          setTimeout(() => scrollToBottom(), 30);
        },
      )
      .on("presence", { event: "sync" }, () => {
        setOnline(Object.keys(channel.presenceState()));
      })
      .on(
        "broadcast",
        { event: "typing" },
        ({ payload }: { payload: { userId: string; name: string } }) => {
          if (payload.userId === currentUserId) return;
          setTyping(payload.name);
          if (typingTimer.current) clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => setTyping(null), 2500);
        },
      )
      .subscribe(async (status: string) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ at: new Date().toISOString() });
        }
      });

    return () => {
      sb.removeChannel(channel);
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation?.id, currentUserId]);

  const announceTyping = () => {
    if (!conversation) return;
    sb.channel(`room:${conversation.id}`).send({
      type: "broadcast",
      event: "typing",
      payload: { userId: currentUserId, name: me?.full_name ?? "Someone" },
    });
  };

  const send = async () => {
    const text = body.trim();
    if (!text || !conversation) return;

    setBody("");
    inputRef.current?.focus();

    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: conversation.id,
      sender_id: currentUserId,
      body: text,
      attachment_url: null,
      attachment_name: null,
      reply_to: null,
      edited_at: null,
      created_at: new Date().toISOString(),
    };
    setMessages((rows) => [...rows, optimistic]);
    setTimeout(() => scrollToBottom(), 20);

    const { data, error } = await sb
      .from("messages")
      .insert({
        conversation_id: conversation.id,
        sender_id: currentUserId,
        body: text,
      })
      .select("*")
      .single();

    if (error) {
      setMessages((rows) => rows.filter((m) => m.id !== optimistic.id));
      setBody(text);
      return toast.error(error.message);
    }

    setMessages((rows) =>
      rows.map((m) => (m.id === optimistic.id ? (data as Message) : m)),
    );
  };

  if (!conversation) {
    return (
      <EmptyState
        icon={<MessageCircle size={19} />}
        title="Chat is not set up"
        description="Run the seed script to create the workspace conversation."
      />
    );
  }

  let lastDay = "";

  return (
    <div className="flex h-[calc(100vh-var(--topbar-h)-3rem)] flex-col">
      {/* header */}
      <div className="mb-3 flex items-center gap-3">
        <div className="relative">
          <Avatar
            name={other?.full_name ?? "Workspace"}
            src={other?.avatar_url}
            accent={other?.accent ?? "plum"}
            size="md"
          />
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-paper",
              other && online.includes(other.id)
                ? "bg-[var(--sage)]"
                : "bg-[var(--line-strong)]",
            )}
          />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-[18px] leading-tight">
            {other?.full_name ?? "Workspace"}
          </h1>
          <p className="text-[12px] text-ink-3">
            {typing
              ? `${typing} is typing…`
              : other && online.includes(other.id)
                ? "Online now"
                : "Offline"}
          </p>
        </div>
      </div>

      {/* messages */}
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <div className="grid h-full place-items-center">
              <div className="text-center">
                <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-ink-4">
                  <MessageCircle size={20} />
                </span>
                <p className="font-display text-[15px] text-ink">No messages yet</p>
                <p className="mt-1 text-[13px] text-ink-3">
                  Say something. It stays between the two of you.
                </p>
              </div>
            </div>
          ) : (
            messages.map((m) => {
              const mine = m.sender_id === currentUserId;
              const sender = profiles.find((p) => p.id === m.sender_id);
              const day = dayLabel(m.created_at);
              const showDay = day !== lastDay;
              lastDay = day;

              return (
                <div key={m.id}>
                  {showDay ? (
                    <div className="my-4 flex items-center gap-3">
                      <div className="h-px flex-1 bg-line" />
                      <span className="text-[11px] font-medium uppercase tracking-wider text-ink-4">
                        {day}
                      </span>
                      <div className="h-px flex-1 bg-line" />
                    </div>
                  ) : null}

                  <div
                    className={cn(
                      "mb-2 flex items-end gap-2",
                      mine ? "flex-row-reverse" : "flex-row",
                    )}
                  >
                    {!mine ? (
                      <Avatar
                        name={sender?.full_name}
                        src={sender?.avatar_url}
                        accent={sender?.accent ?? "indigo"}
                        size="xs"
                        className="mb-0.5"
                      />
                    ) : null}

                    <div
                      className={cn(
                        "max-w-[min(74%,520px)] rounded-2xl px-3.5 py-2 shadow-soft",
                        mine
                          ? "rounded-br-md bg-[var(--clay)] text-white"
                          : "rounded-bl-md border border-line bg-surface-2 text-ink",
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words text-[13.5px] leading-relaxed">
                        {m.body}
                      </p>
                      <p
                        className={cn(
                          "mt-0.5 text-right text-[10.5px]",
                          mine ? "text-white/65" : "text-ink-4",
                        )}
                      >
                        {new Date(m.created_at).toLocaleTimeString(LOCALE, {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {typing ? (
            <div className="mb-2 flex items-end gap-2">
              <Avatar
                name={other?.full_name}
                accent={other?.accent ?? "indigo"}
                size="xs"
              />
              <div className="flex gap-1 rounded-2xl rounded-bl-md border border-line bg-surface-2 px-3 py-2.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-4"
                    style={{ animationDelay: `${i * 120}ms` }}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div ref={bottomRef} />
        </div>

        {/* composer */}
        <div className="border-t border-line bg-surface-2/50 p-3">
          {showEmoji ? (
            <div className="mb-2 flex flex-wrap gap-1">
              {QUICK_EMOJI.map((e) => (
                <button
                  key={e}
                  onClick={() => {
                    setBody((b) => b + e);
                    inputRef.current?.focus();
                  }}
                  className="grid h-8 w-8 place-items-center rounded-md text-[17px] transition-colors hover:bg-surface"
                >
                  {e}
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex items-end gap-2">
            <button
              onClick={() => setShowEmoji((v) => !v)}
              aria-label="Emoji"
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-md transition-colors",
                showEmoji ? "bg-surface text-ink" : "text-ink-4 hover:bg-surface hover:text-ink",
              )}
            >
              <Smile size={17} />
            </button>

            <textarea
              ref={inputRef}
              rows={1}
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
                announceTyping();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Write a message…  (Enter to send, Shift+Enter for a new line)"
              className="max-h-[140px] min-h-9 flex-1 resize-none rounded-md border border-line bg-surface px-3 py-2 text-[13.5px] leading-relaxed text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-[var(--clay)]"
            />

            <button
              onClick={send}
              disabled={!body.trim()}
              aria-label="Send"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--clay)] text-white transition-all hover:bg-[var(--clay-hi)] active:scale-95 disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
