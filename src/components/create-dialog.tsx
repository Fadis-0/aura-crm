"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarDays,
  FolderKanban,
  Handshake,
  ListChecks,
  Target,
  Users,
} from "lucide-react";
import { Modal } from "@/components/overlays";
import { Combobox, type ComboOption } from "@/components/combobox";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type CreateKind =
  | "lead"
  | "client"
  | "project"
  | "task"
  | "event"
  | "affiliate";

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
  { value: "affiliate", label: "Affiliate", icon: Handshake, blurb: "Sends you leads", table: "affiliates" },
];

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
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  only?: CreateKind;
  onCreated?: (row: Row) => void;
}) {
  const router = useRouter();
  const sb = supabaseBrowser();

  const [kind, setKind] = useState<CreateKind>(only ?? "lead");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const [affiliates, setAffiliates] = useState<ComboOption[]>([]);
  const [clients, setClients] = useState<ComboOption[]>([]);
  const [projects, setProjects] = useState<ComboOption[]>([]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Load the pickers' options once the dialog is actually opened.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      const [aff, cli, prj] = await Promise.all([
        sb.from("affiliates").select("id,name,company,commission_rate,accent").order("name"),
        sb.from("clients").select("id,name,company,accent").order("name"),
        sb.from("projects").select("id,name,code,accent").eq("archived", false).order("name"),
      ]);
      if (cancelled) return;

      type A = { id: string; name: string; company: string | null; commission_rate: number; accent: string };
      type C = { id: string; name: string; company: string | null; accent: string };
      type P = { id: string; name: string; code: string | null; accent: string };

      setAffiliates(
        ((aff.data ?? []) as A[]).map((a) => ({
          value: a.id,
          label: a.name,
          hint: [a.company, `${a.commission_rate}% commission`].filter(Boolean).join(" · "),
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

  const close = () => {
    setForm({});
    setKind(only ?? "lead");
    onClose();
  };

  const save = async () => {
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
              starts_at: form.starts || new Date().toISOString(),
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
                }
              : kind === "client"
                ? {
                    name,
                    company: form.company || null,
                    email: form.email || null,
                    phone: form.phone || null,
                    status: "active",
                    retainer_amount: form.retainer ? Number(form.retainer) : null,
                    affiliate_id: form.affiliate || null,
                  }
                : {
                    name,
                    company: form.company || null,
                    email: form.email || null,
                    phone: form.phone || null,
                    commission_rate: form.rate ? Number(form.rate) : 10,
                  };

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

  const nameLabel = kind === "task" || kind === "event" ? "Title" : "Name";
  const source = form.source || "direct";
  const meta = KINDS.find((k) => k.value === kind)!;

  return (
    <Modal
      open={open}
      onClose={close}
      title={only ? `New ${meta.label.toLowerCase()}` : "Create something"}
      description={
        only
          ? meta.blurb
          : "Pick what you're adding, fill the essentials, refine it later."
      }
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={save}>
            Create
          </Button>
        </>
      }
    >
      {!only ? (
        <div className="mb-5 grid grid-cols-3 gap-1.5">
          {KINDS.map((k) => {
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
                  : "Acme Studio"
            }
          />
        </Field>

        {(kind === "lead" || kind === "client" || kind === "affiliate") && (
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
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Monthly retainer" hint="DA">
              <Input
                type="number"
                value={form.retainer ?? ""}
                onChange={(e) => set("retainer", e.target.value)}
                placeholder="300000"
              />
            </Field>
            <Field label="Referred by" hint="optional">
              <Combobox
                value={form.affiliate ?? null}
                onChange={(v) => set("affiliate", v ?? "")}
                options={affiliates}
                placeholder="Nobody"
                clearLabel="Nobody"
              />
            </Field>
          </div>
        )}

        {kind === "affiliate" && (
          <Field label="Commission rate" hint="%">
            <Input
              type="number"
              min={0}
              max={100}
              value={form.rate ?? "10"}
              onChange={(e) => set("rate", e.target.value)}
            />
          </Field>
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
