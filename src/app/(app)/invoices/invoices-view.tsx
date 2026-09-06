"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  BadgeCheck,
  Pencil,
  Plus,
  Printer,
  Receipt,
  Trash2,
  X,
} from "lucide-react";
import { ConfirmDialog, Modal } from "@/components/overlays";
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
import { invoiceTotals, lineTotal } from "@/lib/invoice";
import { cn, money, CURRENCY, LOCALE } from "@/lib/utils";
import type {
  Client,
  Invoice,
  InvoiceItem,
  InvoiceKind,
  Project,
} from "@/lib/types";

type Filter = "all" | Invoice["status"];

/** A line while it is being edited; it has no id until it is saved. */
type LineDraft = {
  key: string;
  description: string;
  quantity: string;
  unit_price: string;
};

const STATUS_ACCENT: Record<Invoice["status"], "sage" | "amber" | "rose" | "indigo"> = {
  draft: "indigo",
  sent: "amber",
  paid: "sage",
  overdue: "rose",
  void: "indigo",
};

const today = () => new Date().toISOString().slice(0, 10);

const newLine = (): LineDraft => ({
  key: Math.random().toString(36).slice(2),
  description: "",
  quantity: "1",
  unit_price: "0",
});

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
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingLines, setLoadingLines] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Invoice | null>(null);

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

  /** What the document currently adds up to, as the lines are typed. */
  const draftTotals = invoiceTotals(
    lines.map((l) => ({
      quantity: Number(l.quantity) || 0,
      unit_price: Number(l.unit_price) || 0,
    })),
    Number(draft.tax_rate) || 0,
  );

  const openNew = () => {
    setDraft({
      number: nextNumber(invoices),
      amount: 0,
      status: "draft",
      kind: "invoice",
      tax_rate: 19,
      issued_on: today(),
      currency: CURRENCY,
    });
    setLines([newLine()]);
    setEditing({ id: "" } as Invoice);
  };

  const openExisting = async (invoice: Invoice) => {
    setDraft(invoice);
    setEditing(invoice);
    setLines([]);
    setLoadingLines(true);

    const { data, error } = await sb
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", invoice.id)
      .order("position");
    setLoadingLines(false);

    if (error) return toast.error(error.message);

    const rows = (data ?? []) as InvoiceItem[];
    setLines(
      rows.length === 0
        ? // An invoice from before there were lines still has a total. Seed it
          // as one line so saving cannot silently reset the amount to zero.
          [{ ...newLine(), unit_price: String(invoice.amount) }]
        : rows.map((r) => ({
            key: r.id,
            description: r.description,
            quantity: String(r.quantity),
            unit_price: String(r.unit_price),
          })),
    );
  };

  const setLine = (key: string, patch: Partial<LineDraft>) =>
    setLines((rows) => rows.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  /**
   * Lines are replaced rather than diffed. A document is small, and rewriting
   * it wholesale means a deleted row can never survive as an orphan.
   */
  const writeLines = async (invoiceId: string) => {
    const kept = lines.filter(
      (l) => l.description.trim() || Number(l.unit_price) || Number(l.quantity) !== 1,
    );

    const { error: clearError } = await sb
      .from("invoice_items")
      .delete()
      .eq("invoice_id", invoiceId);
    if (clearError) return clearError;

    if (kept.length === 0) return null;

    const { error } = await sb.from("invoice_items").insert(
      kept.map((l, index) => ({
        invoice_id: invoiceId,
        description: l.description.trim(),
        quantity: Number(l.quantity) || 0,
        unit_price: Number(l.unit_price) || 0,
        position: index,
      })),
    );
    return error;
  };

  const save = async () => {
    if (!draft.number?.trim()) return toast.error("Give the document a number.");
    setSaving(true);

    const payload = {
      number: draft.number.trim(),
      client_id: draft.client_id || null,
      project_id: draft.project_id || null,
      // The total comes from the lines, so the two can never disagree.
      amount: draftTotals.total,
      currency: draft.currency ?? CURRENCY,
      status: draft.status ?? "draft",
      kind: (draft.kind ?? "invoice") as InvoiceKind,
      tax_rate: Number(draft.tax_rate) || 0,
      issued_on: draft.issued_on || today(),
      due_on: draft.due_on || null,
      paid_on: draft.status === "paid" ? (draft.paid_on ?? today()) : null,
      notes: draft.notes || null,
    };

    if (editing?.id) {
      const { error } = await sb.from("invoices").update(payload).eq("id", editing.id);
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
      const lineError = await writeLines(editing.id);
      setSaving(false);
      if (lineError) return toast.error(lineError.message);

      setInvoices((rows) =>
        rows.map((i) => (i.id === editing.id ? ({ ...i, ...payload } as Invoice) : i)),
      );
    } else {
      const { data, error } = await sb.from("invoices").insert(payload).select("*").single();
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
      const created = data as Invoice;
      const lineError = await writeLines(created.id);
      setSaving(false);
      if (lineError) return toast.error(lineError.message);

      setInvoices((rows) => [created, ...rows]);
    }

    setEditing(null);
    toast.success("Saved");
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
    const target = confirmDelete;
    if (!target) return;

    // The lines go with it: invoice_items cascades on delete.
    const { error } = await sb.from("invoices").delete().eq("id", target.id);
    if (error) return toast.error(error.message);

    setInvoices((rows) => rows.filter((i) => i.id !== target.id));
    setConfirmDelete(null);
    if (editing?.id === target.id) setEditing(null);
    toast.success(`${target.number} deleted`);
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

      <div className="mb-5 grid gap-3 grid-cols-2 sm:grid-cols-4">
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
            <table className="w-full min-w-[860px] text-left">
              <thead>
                <tr className="border-b border-line bg-surface-2/60 text-[11px] uppercase tracking-[0.12em] text-ink-4">
                  <th className="px-4 py-2.5 font-semibold">Number</th>
                  <th className="px-4 py-2.5 font-semibold">Client</th>
                  <th className="px-4 py-2.5 font-semibold">Issued</th>
                  <th className="px-4 py-2.5 font-semibold">Due</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Total</th>
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
                          onClick={() => openExisting(i)}
                          className="text-[13px] font-medium text-ink hover:underline"
                        >
                          {i.number}
                        </button>
                        {i.kind === "receipt" ? (
                          <span className="ml-1.5 text-[10.5px] uppercase tracking-wide text-ink-4">
                            receipt
                          </span>
                        ) : null}
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
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-0.5">
                          {i.status !== "paid" && i.status !== "void" ? (
                            <Button size="sm" variant="ghost" onClick={() => markPaid(i)}>
                              <BadgeCheck size={14} />
                              Paid
                            </Button>
                          ) : null}
                          <Link
                            href={`/invoices/${i.id}/print`}
                            aria-label={`Print ${i.number}`}
                            title="Print"
                            className="grid h-8 w-8 place-items-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                          >
                            <Printer size={14} />
                          </Link>
                          <button
                            onClick={() => openExisting(i)}
                            aria-label={`Edit ${i.number}`}
                            title="Edit"
                            className="grid h-8 w-8 place-items-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(i)}
                            aria-label={`Delete ${i.number}`}
                            title="Delete"
                            className="grid h-8 w-8 place-items-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-[var(--rose)]"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
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
        width="lg"
        title={editing?.id ? `Invoice ${editing.number}` : "New invoice"}
        description="The lines below are what gets printed, and what the total is built from."
        footer={
          <>
            {editing?.id ? (
              <>
                <Button
                  variant="ghost"
                  onClick={() => setConfirmDelete(editing)}
                  className="mr-auto text-[var(--rose)]"
                >
                  <Trash2 size={14} />
                  Delete
                </Button>
                <Link href={`/invoices/${editing.id}/print`}>
                  <Button>
                    <Printer size={14} />
                    Print
                  </Button>
                </Link>
              </>
            ) : null}
            <Button onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="primary" onClick={save} loading={saving}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Number" required>
              <Input
                value={draft.number ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, number: e.target.value }))}
              />
            </Field>
            <Field label="Document">
              <Select
                value={draft.kind ?? "invoice"}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, kind: e.target.value as InvoiceKind }))
                }
              >
                <option value="invoice">Facture</option>
                <option value="receipt">Reçu</option>
              </Select>
            </Field>
            <Field label="VAT" hint="%">
              <Input
                type="number"
                value={draft.tax_rate ?? 0}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, tax_rate: Number(e.target.value) }))
                }
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

          {/* ------------------------------------------------------ lines */}
          <div className="border-t border-line pt-4">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-4">
                Lines
              </p>
              <Button size="sm" onClick={() => setLines((rows) => [...rows, newLine()])}>
                <Plus size={13} />
                Add line
              </Button>
            </div>

            {loadingLines ? (
              <p className="py-4 text-[12.5px] text-ink-4">Loading the lines…</p>
            ) : (
              <div className="space-y-2">
                {lines.map((l, index) => (
                  <div
                    key={l.key}
                    className="grid gap-2 sm:grid-cols-[1fr_74px_120px_auto] sm:items-end"
                  >
                    <Field label={index === 0 ? "Description" : ""}>
                      <Input
                        value={l.description}
                        onChange={(e) => setLine(l.key, { description: e.target.value })}
                        placeholder="Design and build of the landing page"
                      />
                    </Field>
                    <Field label={index === 0 ? "Qty" : ""}>
                      <Input
                        type="number"
                        value={l.quantity}
                        onChange={(e) => setLine(l.key, { quantity: e.target.value })}
                      />
                    </Field>
                    <Field label={index === 0 ? "Unit price" : ""}>
                      <Input
                        type="number"
                        value={l.unit_price}
                        onChange={(e) => setLine(l.key, { unit_price: e.target.value })}
                      />
                    </Field>
                    <div className="flex items-center gap-1 pb-0.5">
                      <span className="min-w-[86px] text-right text-[12.5px] tabular-nums text-ink-2">
                        {money(
                          lineTotal({
                            quantity: Number(l.quantity) || 0,
                            unit_price: Number(l.unit_price) || 0,
                          }),
                        )}
                      </span>
                      <button
                        onClick={() =>
                          setLines((rows) => rows.filter((r) => r.key !== l.key))
                        }
                        aria-label="Remove this line"
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-4 transition-colors hover:bg-surface-2 hover:text-[var(--rose)]"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <dl className="mt-3 ml-auto w-full max-w-[260px] space-y-1 text-[12.5px]">
              <div className="flex justify-between">
                <dt className="text-ink-4">Subtotal</dt>
                <dd className="tabular-nums text-ink-2">{money(draftTotals.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-4">VAT {Number(draft.tax_rate) || 0}%</dt>
                <dd className="tabular-nums text-ink-2">{money(draftTotals.tax)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-1">
                <dt className="font-medium text-ink">Total</dt>
                <dd className="font-display text-[15px] tabular-nums text-ink">
                  {money(draftTotals.total)}
                </dd>
              </div>
            </dl>
          </div>

          <Field label="Notes" hint="printed on the document">
            <Textarea
              rows={3}
              value={draft.notes ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              placeholder="What this covers, payment terms…"
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={remove}
        title="Delete this invoice?"
        message={`${confirmDelete?.number ?? "It"} and its lines will be removed for good.`}
      />
    </>
  );
}
