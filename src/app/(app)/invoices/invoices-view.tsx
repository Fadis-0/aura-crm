"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, Plus, Receipt, Trash2 } from "lucide-react";
import { Modal } from "@/components/overlays";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Segmented,
  Select,
  Textarea,
} from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Combobox } from "@/components/combobox";
import { useServerState } from "@/lib/use-server-state";
import { cn, money, CURRENCY, LOCALE } from "@/lib/utils";
import type { Client, Invoice, Project } from "@/lib/types";

type Filter = "all" | Invoice["status"];

const STATUS_ACCENT: Record<Invoice["status"], "sage" | "amber" | "rose" | "indigo"> = {
  draft: "indigo",
  sent: "amber",
  paid: "sage",
  overdue: "rose",
  void: "indigo",
};

const today = () => new Date().toISOString().slice(0, 10);

function nextNumber(existing: Invoice[]) {
  const year = new Date().getFullYear();
  const count = existing.filter((i) => i.number.includes(String(year))).length + 1;
  return `INV-${year}-${String(count).padStart(3, "0")}`;
}

export function InvoicesView({
  initialInvoices,
  clients,
  projects,
}: {
  initialInvoices: Invoice[];
  clients: Pick<Client, "id" | "name">[];
  projects: Pick<Project, "id" | "name">[];
}) {
  const sb = supabaseBrowser();

  const [invoices, setInvoices] = useServerState(initialInvoices);
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [draft, setDraft] = useState<Partial<Invoice>>({});
  const [saving, setSaving] = useState(false);

  const counts = useMemo(
    () => ({
      all: invoices.length,
      draft: invoices.filter((i) => i.status === "draft").length,
      sent: invoices.filter((i) => i.status === "sent").length,
      overdue: invoices.filter((i) => i.status === "overdue").length,
      paid: invoices.filter((i) => i.status === "paid").length,
    }),
    [invoices],
  );

  const totals = useMemo(
    () => ({
      collected: invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0),
      outstanding: invoices
        .filter((i) => i.status === "sent" || i.status === "overdue")
        .reduce((s, i) => s + i.amount, 0),
      overdue: invoices.filter((i) => i.status === "overdue").reduce((s, i) => s + i.amount, 0),
      drafted: invoices.filter((i) => i.status === "draft").reduce((s, i) => s + i.amount, 0),
    }),
    [invoices],
  );

  const visible = invoices.filter((i) => (filter === "all" ? true : i.status === filter));

  const openNew = () => {
    setDraft({
      number: nextNumber(invoices),
      amount: 0,
      status: "draft",
      issued_on: today(),
      currency: CURRENCY,
    });
    setEditing({ id: "" } as Invoice);
  };

  const save = async () => {
    if (!draft.number?.trim()) return toast.error("Give the invoice a number.");
    setSaving(true);

    const payload = {
      number: draft.number.trim(),
      client_id: draft.client_id || null,
      project_id: draft.project_id || null,
      amount: Number(draft.amount ?? 0),
      currency: draft.currency ?? CURRENCY,
      status: draft.status ?? "draft",
      issued_on: draft.issued_on || today(),
      due_on: draft.due_on || null,
      paid_on: draft.status === "paid" ? (draft.paid_on ?? today()) : null,
      notes: draft.notes || null,
    };

    if (editing?.id) {
      const { error } = await sb.from("invoices").update(payload).eq("id", editing.id);
      setSaving(false);
      if (error) return toast.error(error.message);
      setInvoices((rows) =>
        rows.map((i) => (i.id === editing.id ? ({ ...i, ...payload } as Invoice) : i)),
      );
    } else {
      const { data, error } = await sb.from("invoices").insert(payload).select("*").single();
      setSaving(false);
      if (error) return toast.error(error.message);
      setInvoices((rows) => [data as Invoice, ...rows]);
    }

    setEditing(null);
    toast.success("Invoice saved");
  };

  const markPaid = async (invoice: Invoice) => {
    const paid_on = today();
    setInvoices((rows) =>
      rows.map((i) => (i.id === invoice.id ? { ...i, status: "paid", paid_on } : i)),
    );
    const { error } = await sb
      .from("invoices")
      .update({ status: "paid", paid_on })
      .eq("id", invoice.id);
    if (error) return toast.error(error.message);
    toast.success(`${invoice.number} marked paid`);
  };

  const remove = async () => {
    if (!editing?.id) return setEditing(null);
    setInvoices((rows) => rows.filter((i) => i.id !== editing.id));
    await sb.from("invoices").delete().eq("id", editing.id);
    setEditing(null);
    toast.success("Invoice deleted");
  };

  return (
    <>
      <PageHeader
        eyebrow="Revenue"
        title="Invoices"
        description="What you have billed, what has landed, and what is late."
        actions={
          <Button variant="primary" size="sm" onClick={openNew}>
            <Plus size={14} />
            New
          </Button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        {[
          { label: "Collected", value: money(totals.collected), color: "var(--sage)" },
          { label: "Outstanding", value: money(totals.outstanding), color: "var(--amber)" },
          { label: "Overdue", value: money(totals.overdue), color: "var(--rose)" },
          { label: "In draft", value: money(totals.drafted), color: "var(--indigo)" },
        ].map((s) => (
          <Card key={s.label} className="p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-4">
              {s.label}
            </p>
            <p
              className="mt-1.5 font-display text-[21px] leading-none tabular-nums"
              style={{ color: s.color }}
            >
              {s.value}
            </p>
          </Card>
        ))}
      </div>

      <div className="mb-4">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: counts.all },
            { value: "draft", label: "Draft", count: counts.draft },
            { value: "sent", label: "Sent", count: counts.sent },
            { value: "overdue", label: "Overdue", count: counts.overdue },
            { value: "paid", label: "Paid", count: counts.paid },
          ]}
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Receipt size={19} />}
          title={invoices.length === 0 ? "No invoices yet" : "Nothing in this bucket"}
          description={
            invoices.length === 0
              ? "Create an invoice against a client or project to start tracking cash."
              : "Try another filter."
          }
          action={
            invoices.length === 0 ? (
              <Button variant="primary" size="sm" onClick={openNew}>
                <Plus size={14} />
                New invoice
              </Button>
            ) : null
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-line bg-surface-2/60 text-[11px] uppercase tracking-[0.12em] text-ink-4">
                  <th className="px-4 py-2.5 font-semibold">Number</th>
                  <th className="px-4 py-2.5 font-semibold">Client</th>
                  <th className="px-4 py-2.5 font-semibold">Issued</th>
                  <th className="px-4 py-2.5 font-semibold">Due</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {visible.map((i) => {
                  const client = clients.find((c) => c.id === i.client_id);
                  const late =
                    i.status !== "paid" &&
                    i.due_on &&
                    new Date(i.due_on) < new Date(new Date().toDateString());
                  return (
                    <tr
                      key={i.id}
                      className="border-b border-line last:border-0 transition-colors hover:bg-surface-2"
                    >
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => {
                            setDraft(i);
                            setEditing(i);
                          }}
                          className="text-[13px] font-medium text-ink hover:underline"
                        >
                          {i.number}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-[13px] text-ink-2">
                        {client?.name ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-[12.5px] text-ink-3">
                        {new Date(i.issued_on).toLocaleDateString(LOCALE, {
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-2.5 text-[12.5px]",
                          late ? "font-medium text-[var(--rose)]" : "text-ink-3",
                        )}
                      >
                        {i.due_on
                          ? new Date(i.due_on).toLocaleDateString(LOCALE, {
                              month: "short",
                              day: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-[13px] font-medium tabular-nums text-ink">
                        {money(i.amount)}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge accent={STATUS_ACCENT[i.status]} dot>
                          {i.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {i.status !== "paid" && i.status !== "void" ? (
                          <Button size="sm" variant="ghost" onClick={() => markPaid(i)}>
                            <BadgeCheck size={14} />
                            Paid
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? `Invoice ${editing.number}` : "New invoice"}
        footer={
          <>
            {editing?.id ? (
              <Button variant="ghost" onClick={remove} className="mr-auto text-[var(--rose)]">
                <Trash2 size={14} />
                Delete
              </Button>
            ) : null}
            <Button onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="primary" onClick={save} loading={saving}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Number" required>
              <Input
                value={draft.number ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, number: e.target.value }))}
              />
            </Field>
            <Field label="Amount" hint="DA">
              <Input
                type="number"
                value={draft.amount ?? 0}
                onChange={(e) => setDraft((d) => ({ ...d, amount: Number(e.target.value) }))}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Client">
              <Combobox
                value={draft.client_id ?? null}
                onChange={(v) => setDraft((d) => ({ ...d, client_id: v }))}
                options={clients.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="None"
              />
            </Field>
            <Field label="Project">
              <Combobox
                value={draft.project_id ?? null}
                onChange={(v) => setDraft((d) => ({ ...d, project_id: v }))}
                options={projects.map((p) => ({ value: p.id, label: p.name }))}
                placeholder="None"
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Status">
              <Select
                value={draft.status ?? "draft"}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, status: e.target.value as Invoice["status"] }))
                }
              >
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="void">Void</option>
              </Select>
            </Field>
            <Field label="Issued">
              <Input
                type="date"
                value={draft.issued_on ?? today()}
                onChange={(e) => setDraft((d) => ({ ...d, issued_on: e.target.value }))}
              />
            </Field>
            <Field label="Due">
              <Input
                type="date"
                value={draft.due_on ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, due_on: e.target.value }))}
              />
            </Field>
          </div>

          <Field label="Notes">
            <Textarea
              rows={3}
              value={draft.notes ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              placeholder="What this covers, payment terms…"
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}
