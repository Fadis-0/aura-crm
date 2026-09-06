"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarDays,
  FolderKanban,
  Handshake,
  ListChecks,
  Check,
  Megaphone,
  Target,
  Users,
} from "lucide-react";
import { Modal } from "@/components/overlays";
import { Combobox, type ComboOption } from "@/components/combobox";
import { planPayout } from "@/lib/commission";
import { Button, Field, Input, Segmented, Select, Textarea } from "@/components/ui";
import { createPartnerAccount } from "@/app/(app)/affiliates/actions";
import { supabaseBrowser } from "@/lib/supabase/client";
import { WILAYAS } from "@/lib/algeria";
import { cn, isoFromLocalInput, money } from "@/lib/utils";
import type { ProjectPlan } from "@/lib/types";

export type CreateKind =
  | "lead"
  | "client"
  | "project"
  | "task"
  | "event"
  | "affiliate"
  | "announcement";

const KINDS: {
  value: CreateKind;
  label: string;
  icon: typeof Target;
  blurb: string;
  table: string;
}[] = [
  { value: "lead", label: "Lead", icon: Target, blurb: "Someone who might buy", table: "leads" },
  { value: "client", label: "Client", icon: Users, blurb: "Signed and active", table: "clients" },
  { value: "project", label: "Project", icon: FolderKanban, blurb: "Work to deliver", table: "projects" },
  { value: "task", label: "Task", icon: ListChecks, blurb: "A single to-do", table: "tasks" },
  { value: "event", label: "Event", icon: CalendarDays, blurb: "Meeting or deadline", table: "events" },
  { value: "affiliate", label: "Partner", icon: Handshake, blurb: "Sends you leads, gets a login", table: "affiliates" },
];

/** Only offered from the Announce button, so it stays out of KINDS. */
const ANNOUNCE_KIND = {
  value: "announcement" as const,
  label: "Announcement",
  icon: Megaphone,
  blurb: "Lands in their notifications",
  table: "notifications",
};

type Person = { id: string; full_name: string; email: string; role: string };

/** What the announcement points at, if anything. */
type Attach = "none" | "link" | "invoice";

const todayLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

type Row = Record<string, unknown> & { id: string };

/**
 * One create form for every record type.
 *
 * With `only` it locks to a single kind and hides the type picker, which is how
 * each page's own New button uses it. Without it, the picker shows and it is
 * the global "Create something" dialog.
 */
export function CreateDialog({
  open,
  onClose,
  only,
  announce,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  only?: CreateKind;
  /** Adds the announcement card and starts on it. */
  announce?: boolean;
  onCreated?: (row: Row) => void;
}) {
  const router = useRouter();
  const sb = supabaseBrowser();

  const initialKind: CreateKind = only ?? (announce ? "announcement" : "lead");
  const [kind, setKind] = useState<CreateKind>(initialKind);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const [affiliates, setAffiliates] = useState<ComboOption[]>([]);
  const [clients, setClients] = useState<ComboOption[]>([]);
  const [projects, setProjects] = useState<ComboOption[]>([]);
  const [plans, setPlans] = useState<ProjectPlan[]>([]);

  const [people, setPeople] = useState<Person[]>([]);
  const [invoices, setInvoices] = useState<ComboOption[]>([]);
  const [everyone, setEveryone] = useState(true);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [attach, setAttach] = useState<Attach>("none");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Load the pickers' options once the dialog is actually opened.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      const [aff, cli, prj, pln] = await Promise.all([
        sb
          .from("affiliates")
          .select("id,name,company,accent")
          .order("name"),
        sb.from("clients").select("id,name,company,accent").order("name"),
        sb.from("projects").select("id,name,code,accent").eq("archived", false).order("name"),
        sb.from("project_plans").select("*").order("position"),
      ]);
      if (cancelled) return;
      setPlans((pln.data ?? []) as ProjectPlan[]);

      type A = { id: string; name: string; company: string | null; accent: string };
      type C = { id: string; name: string; company: string | null; accent: string };
      type P = { id: string; name: string; code: string | null; accent: string };

      setAffiliates(
        ((aff.data ?? []) as A[]).map((a) => ({
          value: a.id,
          label: a.name,
          hint: a.company ?? undefined,
          accent: a.accent,
        })),
      );
      setClients(
        ((cli.data ?? []) as C[]).map((c) => ({
          value: c.id,
          label: c.name,
          hint: c.company ?? undefined,
          accent: c.accent,
        })),
      );
      setProjects(
        ((prj.data ?? []) as P[]).map((p) => ({
          value: p.id,
          label: p.name,
          hint: p.code ?? undefined,
          accent: p.accent,
        })),
      );
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Only the announce dialog needs people and invoices, so they load apart.
  useEffect(() => {
    if (!open || !announce) return;
    let cancelled = false;

    (async () => {
      const [prof, inv] = await Promise.all([
        sb
          .from("profiles")
          .select("id,full_name,email,role")
          .eq("status", "active")
          .order("full_name"),
        sb
          .from("invoices")
          .select("id,number,amount,status")
          .order("issued_on", { ascending: false })
          .limit(100),
      ]);
      if (cancelled) return;

      setPeople((prof.data ?? []) as Person[]);

      type I = { id: string; number: string; amount: number; status: string };
      setInvoices(
        ((inv.data ?? []) as I[]).map((i) => ({
          value: i.id,
          label: i.number,
          hint: `${money(i.amount)} · ${i.status}`,
        })),
      );
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, announce]);

  const close = () => {
    setForm({});
    setKind(initialKind);
    setEveryone(true);
    setRecipients([]);
    setAttach("none");
    onClose();
  };

  /**
   * A partner is an account, not just a row, so this goes through a server
   * action: creating the login needs credentials the browser must never hold.
   */
  const savePartner = async () => {
    const name = (form.name ?? "").trim();
    if (!name) return toast.error("Give the partner a name.");
    if (!(form.email ?? "").trim()) return toast.error("An email is required to sign in.");
    if ((form.password ?? "").length < 8) {
      return toast.error("The password needs at least 8 characters.");
    }

    setSaving(true);
    const result = await createPartnerAccount({
      fullName: name,
      email: form.email,
      password: form.password,
      phone: form.phone,
      social: form.social,
      wilaya: form.wilaya,
      commune: form.commune,
      addressLine: form.addressLine,
      postalCode: form.postalCode,
      company: form.company,
      notes: form.notes,
      ccpRip: form.ccpRip,
      ccpHolder: form.ccpHolder,
    });
    setSaving(false);

    if (!result.ok) return toast.error(result.error);

    toast.success(`${name} can sign in now`);
    close();
    router.refresh();
  };

  /**
   * Writes one notification per recipient through an admin-only function.
   * Doing it in the browser would need write access to other people's feeds,
   * which is exactly what nobody should have.
   */
  const saveAnnouncement = async () => {
    const title = (form.name ?? "").trim();
    if (!title) return toast.error("Give the announcement a title.");
    if (!everyone && recipients.length === 0) {
      return toast.error("Pick who should get this, or send it to everyone.");
    }

    let href: string | null = null;
    if (attach === "link") {
      const link = (form.link ?? "").trim();
      if (!link) return toast.error("Paste the link, or attach nothing.");
      if (!link.startsWith("https://") && !(link.startsWith("/") && !link.startsWith("//"))) {
        return toast.error("Links must start with https:// or /.");
      }
      href = link;
    }
    if (attach === "invoice") {
      if (!form.invoice) return toast.error("Pick the invoice to point at.");
      href = `/invoices/${form.invoice}`;
    }

    setSaving(true);
    const { data, error } = await sb.rpc("broadcast_announcement", {
      title,
      body: (form.message ?? "").trim() || null,
      href,
      targets: everyone ? null : recipients,
    });
    setSaving(false);

    if (error) return toast.error(error.message);

    const sent = typeof data === "number" ? data : recipients.length;
    toast.success(
      sent === 0
        ? "Nobody active to send that to"
        : `Sent to ${sent} ${sent === 1 ? "person" : "people"}`,
    );
    close();
    router.refresh();
  };

  const save = async () => {
    if (kind === "affiliate") return savePartner();
    if (kind === "announcement") return saveAnnouncement();

    const name = (form.name ?? "").trim();
    if (!name) {
      toast.error("Give it a name first.");
      return;
    }

    const meta = KINDS.find((k) => k.value === kind)!;
    setSaving(true);

    const payload: Record<string, unknown> =
      kind === "task"
        ? {
            title: name,
            notes: form.notes || null,
            priority: form.priority || "medium",
            due_date: form.due || null,
            project_id: form.project || null,
          }
        : kind === "event"
          ? {
              title: name,
              kind: form.eventKind || "meeting",
              starts_at:
                isoFromLocalInput(form.starts ?? "") ?? new Date().toISOString(),
              location: form.location || null,
              client_id: form.client || null,
            }
          : kind === "project"
            ? {
                name,
                description: form.notes || null,
                status: form.status || "planning",
                budget: form.budget ? Number(form.budget) : 0,
                due_date: form.due || null,
                client_id: form.client || null,
              }
            : kind === "lead"
              ? {
                  name,
                  company: form.company || null,
                  email: form.email || null,
                  phone: form.phone || null,
                  stage: form.stage || "new",
                  source: form.source || "direct",
                  temperature: form.temperature || "warm",
                  estimated_value: form.value ? Number(form.value) : 0,
                  // Only attribute when the source actually is an affiliate.
                  affiliate_id:
                    (form.source || "direct") === "affiliate" ? form.affiliate || null : null,
                  project_id: form.project || null,
                  plan_id: form.plan || null,
                }
              : kind === "client"
                ? {
                    name,
                    company: form.company || null,
                    email: form.email || null,
                    phone: form.phone || null,
                    status: "active",
                    retainer_amount: form.retainer ? Number(form.retainer) : null,
                  }
                : {};

    const { data, error } = await sb
      .from(meta.table)
      .insert(payload)
      .select("*")
      .single();

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`${meta.label} created`);
    onCreated?.(data as Row);
    close();
    router.refresh();
  };

  const nameLabel =
    kind === "task" || kind === "event" || kind === "announcement" ? "Title" : "Name";
  const source = form.source || "direct";
  const meta =
    kind === "announcement" ? ANNOUNCE_KIND : KINDS.find((k) => k.value === kind)!;

  const cards = announce ? [...KINDS, ANNOUNCE_KIND] : KINDS;
  // Back-office links only work for owners, so warn before sending one out.
  const reachesMarketers = everyone
    ? people.some((p) => p.role === "marketer")
    : people.some((p) => p.role === "marketer" && recipients.includes(p.id));

  return (
    <Modal
      open={open}
      onClose={close}
      title={
        only
          ? `New ${meta.label.toLowerCase()}`
          : announce
            ? "Announce something"
            : "Create something"
      }
      description={
        only
          ? meta.blurb
          : announce
            ? "Push a note, a link or an invoice into people's notifications."
            : "Pick what you're adding, fill the essentials, refine it later."
      }
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={save}>
            {kind === "affiliate"
            ? "Create account"
            : kind === "announcement"
              ? "Publish"
              : "Create"}
          </Button>
        </>
      }
    >
      {!only ? (
        <div className="mb-5 grid grid-cols-3 gap-1.5">
          {cards.map((k) => {
            const active = k.value === kind;
            return (
              <button
                key={k.value}
                onClick={() => setKind(k.value)}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-lg border p-2.5 text-left transition-all",
                  active
                    ? "border-[var(--clay)] bg-[var(--clay-soft)] shadow-soft"
                    : "border-line bg-surface hover:border-line-2 hover:bg-surface-2",
                )}
              >
                <k.icon size={16} className={active ? "text-[var(--clay)]" : "text-ink-4"} />
                <span className="text-[12.5px] font-medium text-ink">{k.label}</span>
                <span className="text-[11px] leading-tight text-ink-4">{k.blurb}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="space-y-3">
        <Field label={nameLabel} required>
          <Input
            autoFocus
            value={form.name ?? ""}
            onChange={(e) => set("name", e.target.value)}
            placeholder={
              kind === "task"
                ? "Draft the onboarding email"
                : kind === "event"
                  ? "Kick-off call"
                  : kind === "announcement"
                    ? "New payment plans are live"
                    : "Acme Studio"
            }
          />
        </Field>

        {kind === "announcement" && (
          <>
            <Field label="Message" hint="optional">
              <Textarea
                rows={3}
                value={form.message ?? ""}
                onChange={(e) => set("message", e.target.value)}
                placeholder="A line or two of detail."
              />
            </Field>

            <div>
              <span className="mb-1.5 block text-[12px] font-medium text-ink-2">
                Attach
              </span>
              <Segmented
                value={attach}
                onChange={(v) => setAttach(v)}
                options={[
                  { value: "none", label: "Nothing" },
                  { value: "link", label: "Link" },
                  { value: "invoice", label: "Invoice" },
                ]}
              />
            </div>

            {attach === "link" ? (
              <Field label="Link" hint="https:// or a path like /projects" required>
                <Input
                  type="url"
                  value={form.link ?? ""}
                  onChange={(e) => set("link", e.target.value)}
                  placeholder="https://example.com/brief"
                />
              </Field>
            ) : null}

            {attach === "invoice" ? (
              <Field label="Invoice" required>
                <Combobox
                  value={form.invoice ?? null}
                  onChange={(v) => set("invoice", v ?? "")}
                  options={invoices}
                  placeholder="Search invoices…"
                  clearLabel="No invoice"
                  emptyLabel="No invoice matches that"
                />
              </Field>
            ) : null}

            {attach !== "none" && reachesMarketers ? (
              <p className="text-[11.5px] leading-relaxed text-[var(--amber)]">
                Partners cannot open back-office pages, so keep the message
                readable on its own for them.
              </p>
            ) : null}

            <div className="border-t border-line pt-4">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-4">
                  Who gets it
                </p>
                <Segmented
                  value={everyone ? "all" : "some"}
                  onChange={(v) => setEveryone(v === "all")}
                  options={[
                    { value: "all", label: "@everyone", count: people.length },
                    { value: "some", label: "Pick people", count: recipients.length },
                  ]}
                />
              </div>

              {everyone ? (
                <p className="text-[12px] leading-relaxed text-ink-4">
                  Everyone with an active account, you excluded.
                </p>
              ) : people.length === 0 ? (
                <p className="text-[12px] text-ink-4">Nobody active to pick from yet.</p>
              ) : (
                <div className="max-h-52 overflow-y-auto rounded-lg border border-line">
                  <ul className="divide-y divide-line">
                    {people.map((person) => {
                      const picked = recipients.includes(person.id);
                      return (
                        <li key={person.id}>
                          <button
                            type="button"
                            onClick={() =>
                              setRecipients((r) =>
                                picked
                                  ? r.filter((id) => id !== person.id)
                                  : [...r, person.id],
                              )
                            }
                            className={cn(
                              "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors",
                              picked ? "bg-[var(--clay-soft)]/40" : "hover:bg-surface-2",
                            )}
                          >
                            <span
                              className={cn(
                                "grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors",
                                picked
                                  ? "border-[var(--clay)] bg-[var(--clay)] text-white"
                                  : "border-line-2",
                              )}
                            >
                              {picked ? <Check size={11} strokeWidth={3} /> : null}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[12.5px] text-ink">
                                {person.full_name}
                              </span>
                              <span className="block truncate text-[11px] text-ink-4">
                                {person.email}
                              </span>
                            </span>
                            <span className="shrink-0 text-[10.5px] uppercase tracking-wide text-ink-4">
                              {person.role === "marketer" ? "Partner" : "Owner"}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </>
        )}

        {(kind === "lead" || kind === "client") && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Company">
                <Input
                  value={form.company ?? ""}
                  onChange={(e) => set("company", e.target.value)}
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => set("email", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Phone">
              <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
            </Field>
          </>
        )}

        {kind === "lead" && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Stage">
                <Select value={form.stage ?? "new"} onChange={(e) => set("stage", e.target.value)}>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="qualified">Qualified</option>
                  <option value="proposal">Proposal</option>
                  <option value="negotiation">Negotiation</option>
                </Select>
              </Field>
              <Field label="Heat">
                <Select
                  value={form.temperature ?? "warm"}
                  onChange={(e) => set("temperature", e.target.value)}
                >
                  <option value="cold">Cold</option>
                  <option value="warm">Warm</option>
                  <option value="hot">Hot</option>
                </Select>
              </Field>
              <Field label="Value" hint="DA">
                <Input
                  type="number"
                  value={form.value ?? ""}
                  onChange={(e) => set("value", e.target.value)}
                  placeholder="650000"
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Project" hint="what they'd be buying">
                <Combobox
                  value={form.project ?? null}
                  onChange={(v) => {
                    set("project", v ?? "");
                    set("plan", "");
                  }}
                  options={projects}
                  placeholder="No project yet"
                  clearLabel="No project yet"
                  emptyLabel="No project matches that"
                />
              </Field>
              <Field label="Plan" hint="sets the partner's commission">
                <Combobox
                  value={form.plan ?? null}
                  onChange={(v) => set("plan", v ?? "")}
                  options={plans
                    .filter((pl) => pl.project_id === form.project)
                    .map((pl) => ({
                      value: pl.id,
                      label: pl.name,
                      hint: `${money(pl.price)}${pl.kind === "subscription" ? "/yr" : ""} · ${money(planPayout(pl))} to partner`,
                    }))}
                  placeholder={form.project ? "No plan yet" : "Pick a project first"}
                  clearLabel="No plan yet"
                  emptyLabel="This project has no plans yet"
                />
              </Field>
            </div>

            <Field label="Source">
              <Select value={source} onChange={(e) => set("source", e.target.value)}>
                <option value="direct">Direct</option>
                <option value="affiliate">Affiliate</option>
                <option value="referral">Referral</option>
                <option value="inbound">Inbound</option>
                <option value="outbound">Outbound</option>
                <option value="social">Social</option>
                <option value="other">Other</option>
              </Select>
            </Field>

            {/* The affiliate picker appears the moment the source is an affiliate. */}
            {source === "affiliate" ? (
              <Field
                label="Who brought them in"
                required
                hint={affiliates.length === 0 ? "add an affiliate first" : undefined}
              >
                <Combobox
                  value={form.affiliate ?? null}
                  onChange={(v) => set("affiliate", v ?? "")}
                  options={affiliates}
                  placeholder="Search affiliates…"
                  clearLabel="Not attributed yet"
                  emptyLabel="No affiliate matches that"
                />
              </Field>
            ) : null}
          </>
        )}

        {kind === "client" && (
          <Field label="Monthly retainer" hint="DA">
            <Input
              type="number"
              value={form.retainer ?? ""}
              onChange={(e) => set("retainer", e.target.value)}
              placeholder="300000"
            />
          </Field>
        )}

        {kind === "affiliate" && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Company" hint="optional">
                <Input
                  value={form.company ?? ""}
                  onChange={(e) => set("company", e.target.value)}
                />
              </Field>
              <Field label="Phone" required>
                <Input
                  type="tel"
                  value={form.phone ?? ""}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="+213 ..."
                />
              </Field>
            </div>

            <Field label="Social link" hint="optional">
              <Input
                type="url"
                value={form.social ?? ""}
                onChange={(e) => set("social", e.target.value)}
                placeholder="https://instagram.com/them"
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Wilaya">
                <Select
                  value={form.wilaya ?? ""}
                  onChange={(e) => set("wilaya", e.target.value)}
                >
                  <option value="">Choose…</option>
                  {WILAYAS.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Commune">
                <Input
                  value={form.commune ?? ""}
                  onChange={(e) => set("commune", e.target.value)}
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
              <Field label="Address">
                <Input
                  value={form.addressLine ?? ""}
                  onChange={(e) => set("addressLine", e.target.value)}
                />
              </Field>
              <Field label="Postal code">
                <Input
                  inputMode="numeric"
                  value={form.postalCode ?? ""}
                  onChange={(e) => set("postalCode", e.target.value)}
                  placeholder="16000"
                />
              </Field>
            </div>

            <div className="border-t border-line pt-4">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-4">
                Payout
              </p>
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="CCP RIP" hint="optional">
                    <Input
                      inputMode="numeric"
                      value={form.ccpRip ?? ""}
                      onChange={(e) => set("ccpRip", e.target.value)}
                      placeholder="0012 3456 7890 1234 5678"
                      className="font-mono tracking-wide"
                    />
                  </Field>
                  <Field label="Account holder" hint="optional">
                    <Input
                      value={form.ccpHolder ?? ""}
                      onChange={(e) => set("ccpHolder", e.target.value)}
                      placeholder={form.name ?? ""}
                    />
                  </Field>
                </div>
              </div>
            </div>

            <div className="border-t border-line pt-4">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-4">
                Sign-in details
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Email" required>
                  <Input
                    type="email"
                    value={form.email ?? ""}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="them@example.com"
                  />
                </Field>
                <Field label="Password" hint="8 characters or more" required>
                  <Input
                    type="text"
                    value={form.password ?? ""}
                    onChange={(e) => set("password", e.target.value)}
                    placeholder="Something they can change later"
                  />
                </Field>
              </div>
              <p className="mt-2 text-[11.5px] leading-relaxed text-ink-4">
                Pass these on to them. The account works immediately, with no
                approval step, and they can change the password once inside.
              </p>
            </div>

            <Field label="Notes" hint="optional">
              <Textarea
                rows={2}
                value={form.notes ?? ""}
                onChange={(e) => set("notes", e.target.value)}
              />
            </Field>
          </>
        )}

        {kind === "project" && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Status">
                <Select
                  value={form.status ?? "planning"}
                  onChange={(e) => set("status", e.target.value)}
                >
                  <option value="planning">Planning</option>
                  <option value="active">Active</option>
                  <option value="review">In review</option>
                </Select>
              </Field>
              <Field label="Budget" hint="DA">
                <Input
                  type="number"
                  value={form.budget ?? ""}
                  onChange={(e) => set("budget", e.target.value)}
                />
              </Field>
              <Field label="Due">
                <Input type="date" value={form.due ?? ""} onChange={(e) => set("due", e.target.value)} />
              </Field>
            </div>
            <Field label="Client" hint="leave empty for internal work">
              <Combobox
                value={form.client ?? null}
                onChange={(v) => set("client", v ?? "")}
                options={clients}
                placeholder="Internal"
                clearLabel="Internal"
              />
            </Field>
            <Field label="Brief" hint="optional">
              <Textarea rows={3} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
            </Field>
          </>
        )}

        {kind === "task" && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Priority">
                <Select
                  value={form.priority ?? "medium"}
                  onChange={(e) => set("priority", e.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </Select>
              </Field>
              <Field label="Due">
                <Input type="date" value={form.due ?? ""} onChange={(e) => set("due", e.target.value)} />
              </Field>
            </div>
            <Field label="Project" hint="optional">
              <Combobox
                value={form.project ?? null}
                onChange={(v) => set("project", v ?? "")}
                options={projects}
                placeholder="No project"
                clearLabel="No project"
              />
            </Field>
          </>
        )}

        {kind === "event" && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Kind">
                <Select
                  value={form.eventKind ?? "meeting"}
                  onChange={(e) => set("eventKind", e.target.value)}
                >
                  <option value="meeting">Meeting</option>
                  <option value="call">Call</option>
                  <option value="deadline">Deadline</option>
                  <option value="reminder">Reminder</option>
                  <option value="focus">Focus block</option>
                  <option value="personal">Personal</option>
                </Select>
              </Field>
              <Field label="Starts">
                <Input
                  type="datetime-local"
                  value={form.starts ?? todayLocal()}
                  onChange={(e) => set("starts", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Client" hint="optional">
              <Combobox
                value={form.client ?? null}
                onChange={(v) => set("client", v ?? "")}
                options={clients}
                placeholder="None"
              />
            </Field>
          </>
        )}
      </div>
    </Modal>
  );
}
