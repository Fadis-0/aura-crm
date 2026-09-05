"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  BadgeDollarSign,
  FileText,
  Mail,
  MessageSquare,
  Phone,
  Send,
  Users,
} from "lucide-react";
import { Input, Select } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import { relativeTime } from "@/lib/utils";
import type { Interaction } from "@/lib/types";

const KIND_META = {
  note: { icon: MessageSquare, color: "var(--ink-3)", label: "Note" },
  call: { icon: Phone, color: "var(--indigo)", label: "Call" },
  email: { icon: Mail, color: "var(--plum)", label: "Email" },
  meeting: { icon: Users, color: "var(--clay)", label: "Meeting" },
  proposal: { icon: FileText, color: "var(--amber)", label: "Proposal" },
  payment: { icon: BadgeDollarSign, color: "var(--sage)", label: "Payment" },
} as const;

type Kind = keyof typeof KIND_META;

export function InteractionTimeline({
  clientId,
  leadId,
  affiliateId,
}: {
  clientId?: string;
  leadId?: string;
  affiliateId?: string;
}) {
  const sb = supabaseBrowser();
  const [rows, setRows] = useState<Interaction[]>([]);
  const [kind, setKind] = useState<Kind>("note");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(true);

  const column = clientId ? "client_id" : leadId ? "lead_id" : "affiliate_id";
  const value = clientId ?? leadId ?? affiliateId;

  useEffect(() => {
    if (!value) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await sb
        .from("interactions")
        .select("*")
        .eq(column, value)
        .order("occurred_at", { ascending: false })
        .limit(50);
      if (!cancelled) {
        setRows((data ?? []) as Interaction[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, column]);

  const add = async () => {
    const text = summary.trim();
    if (!text || !value) return;

    const { data, error } = await sb
      .from("interactions")
      .insert({ kind, summary: text, [column]: value })
      .select("*")
      .single();

    if (error) return toast.error(error.message);
    setRows((r) => [data as Interaction, ...r]);
    setSummary("");
  };

  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-4">
        Timeline
      </h3>

      <div className="mb-3 flex gap-2">
        <Select
          value={kind}
          onChange={(e) => setKind(e.target.value as Kind)}
          className="w-[116px] shrink-0"
        >
          {(Object.keys(KIND_META) as Kind[]).map((k) => (
            <option key={k} value={k}>
              {KIND_META[k].label}
            </option>
          ))}
        </Select>
        <Input
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="What happened?"
        />
        <button
          onClick={add}
          disabled={!summary.trim()}
          aria-label="Log interaction"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--clay)] text-white transition-all hover:bg-[var(--clay-hi)] disabled:opacity-40"
        >
          <Send size={14} />
        </button>
      </div>

      {loading ? (
        <p className="py-3 text-[12.5px] text-ink-4">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-line-2 px-3 py-5 text-center text-[12.5px] text-ink-4">
          Nothing logged yet. Every call, email and meeting you record shows up here.
        </p>
      ) : (
        <ol className="relative space-y-3 border-l border-line pl-5">
          {rows.map((r) => {
            const meta = KIND_META[r.kind];
            const Icon = meta.icon;
            return (
              <li key={r.id} className="relative">
                <span
                  className="absolute -left-[26px] top-0.5 grid h-[18px] w-[18px] place-items-center rounded-full border border-line bg-surface"
                  style={{ color: meta.color }}
                >
                  <Icon size={10} />
                </span>
                <p className="text-[13px] leading-snug text-ink">{r.summary}</p>
                <p className="mt-0.5 text-[11px] text-ink-4">
                  {meta.label} · {relativeTime(r.occurred_at)}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
