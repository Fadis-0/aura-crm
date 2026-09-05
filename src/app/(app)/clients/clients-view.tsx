"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Globe, Mail, Phone, Plus, Search, Trash2, Users } from "lucide-react";
import { ConfirmDialog, Drawer } from "@/components/overlays";
import { CreateDialog } from "@/components/create-dialog";
import { useServerState } from "@/lib/use-server-state";
import {
  Avatar,
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
import { InteractionTimeline } from "@/components/interaction-timeline";
import { supabaseBrowser } from "@/lib/supabase/client";
import { accentFor, compactMoney, money, LOCALE } from "@/lib/utils";
import {
  CLIENT_STATUS_ACCENT,
  HEALTH_ACCENT,
  HEALTH_LABEL,
  PROJECT_STATUS_ACCENT,
  PROJECT_STATUS_LABEL,
  type Client,
  type ClientStatus,
  type Invoice,
  type Project,
} from "@/lib/types";

type Filter = "all" | ClientStatus;

export function ClientsView({
  initialClients,
  projects,
  invoices,
}: {
  initialClients: Client[];
  projects: Project[];
  invoices: Invoice[];
}) {
  const sb = supabaseBrowser();
  const params = useSearchParams();

  // Deep link from the command palette: ?focus=<client id>
  const focused =
    initialClients.find((c) => c.id === params.get("focus")) ?? null;

  const [clients, setClients] = useServerState(initialClients);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [selected, setSelected] = useState<Client | null>(focused);
  const [draft, setDraft] = useState<Partial<Client>>(focused ?? {});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const counts = useMemo(
    () => ({
      all: clients.length,
      active: clients.filter((c) => c.status === "active").length,
      paused: clients.filter((c) => c.status === "paused").length,
      churned: clients.filter((c) => c.status === "churned").length,
    }),
    [clients],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients
      .filter((c) => (filter === "all" ? true : c.status === filter))
      .filter((c) =>
        q
          ? [c.name, c.company, c.email, ...(c.tags ?? [])]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(q))
          : true,
      );
  }, [clients, filter, query]);

  const totalLtv = clients.reduce((s, c) => s + c.lifetime_value, 0);
  const mrr = clients
    .filter((c) => c.status === "active")
    .reduce((s, c) => s + (c.retainer_amount ?? 0), 0);

  const openClient = (c: Client) => {
    setSelected(c);
    setDraft(c);
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    const patch = {
      name: draft.name,
      company: draft.company || null,
      email: draft.email || null,
      phone: draft.phone || null,
      website: draft.website || null,
      address: draft.address || null,
      country: draft.country || null,
      status: draft.status,
      health: draft.health,
      tier: draft.tier,
      lifetime_value: Number(draft.lifetime_value ?? 0),
      retainer_amount: draft.retainer_amount ? Number(draft.retainer_amount) : null,
      notes: draft.notes || null,
    };
    const { error } = await sb.from("clients").update(patch).eq("id", selected.id);
    setSaving(false);
    if (error) return toast.error(error.message);

    setClients((rows) =>
      rows.map((c) => (c.id === selected.id ? ({ ...c, ...patch } as Client) : c)),
    );
    toast.success("Client updated");
    setSelected(null);
  };

  const remove = async () => {
    if (!selected) return;
    const { error } = await sb.from("clients").delete().eq("id", selected.id);
    if (error) return toast.error(error.message);
    setClients((rows) => rows.filter((c) => c.id !== selected.id));
    setConfirmDelete(false);
    setSelected(null);
    toast.success("Client deleted");
  };

  const set = <K extends keyof Client>(k: K, v: Client[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const clientProjects = selected
    ? projects.filter((p) => p.client_id === selected.id)
    : [];
  const clientInvoices = selected
    ? invoices.filter((i) => i.client_id === selected.id)
    : [];

  return (
    <>
      <PageHeader
        eyebrow="Revenue"
        title="Clients"
        description={`${counts.active} active · ${money(totalLtv)} lifetime value · ${money(mrr)} recurring per month.`}
        actions={
          <>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: "grid", label: "Cards" },
                { value: "table", label: "Table" },
              ]}
            />
            <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
              <Plus size={14} />
              New
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: counts.all },
            { value: "active", label: "Active", count: counts.active },
            { value: "paused", label: "Paused", count: counts.paused },
            { value: "churned", label: "Churned", count: counts.churned },
          ]}
        />
        <div className="relative ml-auto w-full max-w-xs">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-4"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, company, tag…"
            className="pl-8"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Users size={19} />}
          title={clients.length === 0 ? "No clients yet" : "Nothing matches that"}
          description={
            clients.length === 0
              ? "Convert a won lead from the pipeline, or add one directly."
              : "Try a different search or filter."
          }
          action={
            clients.length === 0 ? (
              <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
                <Plus size={14} />
                New client
              </Button>
            ) : null
          }
        />
      ) : view === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((c) => {
            const active = projects.filter(
              (p) => p.client_id === c.id && p.status !== "done" && p.status !== "cancelled",
            ).length;
            return (
              <button
                key={c.id}
                onClick={() => openClient(c)}
                className="group rounded-lg border border-line bg-surface p-4 text-left shadow-soft transition-all hover:border-line-2 hover:shadow-raised"
              >
                <div className="flex items-start gap-3">
                  <Avatar name={c.name} accent={accentFor(c.id)} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-ink">{c.name}</p>
                    <p className="truncate text-[12px] text-ink-4">
                      {c.company ?? c.email ?? "—"}
                    </p>
                  </div>
                  <Badge accent={CLIENT_STATUS_ACCENT[c.status]} dot>
                    {c.status}
                  </Badge>
                </div>

                <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3">
                  <div>
                    <dt className="text-[10.5px] uppercase tracking-wider text-ink-4">
                      Lifetime
                    </dt>
                    <dd className="mt-0.5 font-display text-[15px] tabular-nums text-ink">
                      {compactMoney(c.lifetime_value)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10.5px] uppercase tracking-wider text-ink-4">
                      Retainer
                    </dt>
                    <dd className="mt-0.5 font-display text-[15px] tabular-nums text-ink">
                      {c.retainer_amount ? compactMoney(c.retainer_amount) : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10.5px] uppercase tracking-wider text-ink-4">
                      Projects
                    </dt>
                    <dd className="mt-0.5 font-display text-[15px] tabular-nums text-ink">
                      {active}
                    </dd>
                  </div>
                </dl>

                <div className="mt-3 flex items-center gap-2">
                  <Badge accent={HEALTH_ACCENT[c.health]}>{HEALTH_LABEL[c.health]}</Badge>
                  {c.tier !== "standard" ? (
                    <Badge accent="plum">{c.tier}</Badge>
                  ) : null}
                  {(c.tags ?? []).slice(0, 2).map((t) => (
                    <span key={t} className="text-[11px] text-ink-4">
                      #{t}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr className="border-b border-line bg-surface-2/60 text-[11px] uppercase tracking-[0.12em] text-ink-4">
                  <th className="px-4 py-2.5 font-semibold">Client</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Health</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Lifetime</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Retainer</th>
                  <th className="px-4 py-2.5 font-semibold">Since</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => openClient(c)}
                    className="cursor-pointer border-b border-line last:border-0 transition-colors hover:bg-surface-2"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={c.name} accent={accentFor(c.id)} size="xs" />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-ink">
                            {c.name}
                          </p>
                          <p className="truncate text-[11.5px] text-ink-4">
                            {c.company ?? "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge accent={CLIENT_STATUS_ACCENT[c.status]} dot>
                        {c.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge accent={HEALTH_ACCENT[c.health]}>{HEALTH_LABEL[c.health]}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right text-[13px] tabular-nums text-ink">
                      {money(c.lifetime_value)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[13px] tabular-nums text-ink-2">
                      {c.retainer_amount ? money(c.retainer_amount) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-[12.5px] text-ink-3">
                      {new Date(c.since).toLocaleDateString(LOCALE, {
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ------------------------------------------------------- drawer */}
      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ""}
        subtitle={
          selected ? (
            <span className="flex flex-wrap items-center gap-2">
              <Badge accent={CLIENT_STATUS_ACCENT[selected.status]} dot>
                {selected.status}
              </Badge>
              <span>
                client since{" "}
                {new Date(selected.since).toLocaleDateString(LOCALE, {
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </span>
          ) : null
        }
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setConfirmDelete(true)}
              className="mr-auto text-[var(--rose)]"
            >
              <Trash2 size={14} />
              Delete
            </Button>
            <Button onClick={() => setSelected(null)}>Cancel</Button>
            <Button variant="primary" onClick={save} loading={saving}>
              Save
            </Button>
          </>
        }
      >
        {selected ? (
          <div className="space-y-5">
            {/* quick contact row */}
            <div className="flex flex-wrap gap-2">
              {selected.email ? (
                <a
                  href={`mailto:${selected.email}`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-[12.5px] transition-colors hover:bg-surface-2"
                >
                  <Mail size={13} /> {selected.email}
                </a>
              ) : null}
              {selected.phone ? (
                <a
                  href={`tel:${selected.phone}`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-[12.5px] transition-colors hover:bg-surface-2"
                >
                  <Phone size={13} /> {selected.phone}
                </a>
              ) : null}
              {selected.website ? (
                <a
                  href={selected.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-[12.5px] transition-colors hover:bg-surface-2"
                >
                  <Globe size={13} /> Website
                </a>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" required>
                <Input value={draft.name ?? ""} onChange={(e) => set("name", e.target.value)} />
              </Field>
              <Field label="Company">
                <Input
                  value={draft.company ?? ""}
                  onChange={(e) => set("company", e.target.value)}
                />
              </Field>
              <Field label="Email">
                <Input value={draft.email ?? ""} onChange={(e) => set("email", e.target.value)} />
              </Field>
              <Field label="Phone">
                <Input value={draft.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Status">
                <Select
                  value={draft.status ?? "active"}
                  onChange={(e) => set("status", e.target.value as ClientStatus)}
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="churned">Churned</option>
                </Select>
              </Field>
              <Field label="Health">
                <Select
                  value={draft.health ?? "good"}
                  onChange={(e) => set("health", e.target.value as Client["health"])}
                >
                  <option value="good">Healthy</option>
                  <option value="watch">Watch</option>
                  <option value="at_risk">At risk</option>
                </Select>
              </Field>
              <Field label="Tier">
                <Select
                  value={draft.tier ?? "standard"}
                  onChange={(e) => set("tier", e.target.value as Client["tier"])}
                >
                  <option value="standard">Standard</option>
                  <option value="key">Key</option>
                  <option value="strategic">Strategic</option>
                </Select>
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Lifetime value" hint="DA">
                <Input
                  type="number"
                  value={draft.lifetime_value ?? 0}
                  onChange={(e) => set("lifetime_value", Number(e.target.value))}
                />
              </Field>
              <Field label="Monthly retainer" hint="DA">
                <Input
                  type="number"
                  value={draft.retainer_amount ?? ""}
                  onChange={(e) => set("retainer_amount", Number(e.target.value))}
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Address">
                <Input
                  value={draft.address ?? ""}
                  onChange={(e) => set("address", e.target.value)}
                />
              </Field>
              <Field label="Country">
                <Input
                  value={draft.country ?? ""}
                  onChange={(e) => set("country", e.target.value)}
                />
              </Field>
            </div>

            <Field label="Notes">
              <Textarea
                rows={4}
                value={draft.notes ?? ""}
                onChange={(e) => set("notes", e.target.value)}
              />
            </Field>

            {/* related work */}
            {clientProjects.length > 0 ? (
              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-4">
                  Projects
                </h3>
                <ul className="space-y-1.5">
                  {clientProjects.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/projects/${p.id}`}
                        className="flex items-center gap-2.5 rounded-md border border-line bg-surface px-3 py-2 transition-colors hover:bg-surface-2"
                      >
                        <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                          {p.name}
                        </span>
                        <Badge accent={PROJECT_STATUS_ACCENT[p.status]}>
                          {PROJECT_STATUS_LABEL[p.status]}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {clientInvoices.length > 0 ? (
              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-4">
                  Invoices
                </h3>
                <ul className="space-y-1.5">
                  {clientInvoices.map((i) => (
                    <li
                      key={i.id}
                      className="flex items-center gap-2.5 rounded-md border border-line bg-surface px-3 py-2"
                    >
                      <span className="flex-1 truncate text-[13px] text-ink">
                        {i.number}
                      </span>
                      <span className="text-[13px] tabular-nums text-ink-2">
                        {money(i.amount)}
                      </span>
                      <Badge
                        accent={
                          i.status === "paid"
                            ? "sage"
                            : i.status === "overdue"
                              ? "rose"
                              : "amber"
                        }
                      >
                        {i.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <InteractionTimeline clientId={selected.id} />
          </div>
        ) : null}
      </Drawer>

      <CreateDialog
        open={creating}
        onClose={() => setCreating(false)}
        only="client"
        onCreated={(row) => setClients((rows) => [row as unknown as Client, ...rows])}
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        title="Delete this client?"
        message={`${selected?.name ?? "This client"} will be removed. Projects and invoices stay but lose the link.`}
      />
    </>
  );
}
