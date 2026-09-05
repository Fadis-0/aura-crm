"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Ban,
  BadgeCheck,
  Check,
  ExternalLink,
  Handshake,
  Landmark,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";
import { ConfirmDialog, Drawer } from "@/components/overlays";
import { CreateDialog } from "@/components/create-dialog";
import { removePartner } from "./actions";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Progress,
  Segmented,
  Select,
  Textarea,
} from "@/components/ui";
import { InteractionTimeline } from "@/components/interaction-timeline";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useServerState } from "@/lib/use-server-state";
import { accentFor, cn, money, relativeTime } from "@/lib/utils";
import { formatRip, normaliseRip } from "@/lib/algeria";
import { STAGE_ACCENT, STAGE_LABEL } from "@/lib/types";
import type {
  AccountStatus,
  Affiliate,
  Client,
  Commission,
  Lead,
  Profile,
} from "@/lib/types";

type Filter = "all" | "pending" | "active" | "paused";

const ACCOUNT_ACCENT = {
  pending: "amber",
  active: "sage",
  suspended: "rose",
} as const;

const PARTNER_ACCENT = {
  active: "sage",
  paused: "amber",
  ended: "rose",
} as const;

/** One partner row: the affiliate record plus the portal account behind it. */
type Row = {
  affiliate: Affiliate;
  account: Profile | null;
  leads: number;
  won: number;
  earned: number;
  owed: number;
  conversion: number;
};

export function AffiliatesView({
  initialAffiliates,
  leads,
  clients,
  initialCommissions,
  initialMarketers,
  currentUserId,
}: {
  initialAffiliates: Affiliate[];
  leads: Lead[];
  clients: Client[];
  initialCommissions: Commission[];
  initialMarketers: Profile[];
  currentUserId: string;
}) {
  const sb = supabaseBrowser();

  const [affiliates, setAffiliates] = useServerState(initialAffiliates);
  const [commissions, setCommissions] = useServerState(initialCommissions);
  const [marketers, setMarketers] = useServerState(initialMarketers);

  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Affiliate | null>(null);
  const [draft, setDraft] = useState<Partial<Affiliate>>({});
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const rows: Row[] = useMemo(
    () =>
      affiliates.map((a) => {
        const own = leads.filter((l) => l.affiliate_id === a.id);
        const paid = commissions.filter((c) => c.affiliate_id === a.id);
        const won = own.filter((l) => l.stage === "won").length;
        return {
          affiliate: a,
          account: marketers.find((m) => m.id === a.profile_id) ?? null,
          leads: own.length,
          won,
          earned: paid
            .filter((c) => c.status === "paid")
            .reduce((s, c) => s + c.amount, 0),
          owed: paid
            .filter((c) => c.status !== "paid" && c.status !== "cancelled")
            .reduce((s, c) => s + c.amount, 0),
          conversion: own.length ? Math.round((won / own.length) * 100) : 0,
        };
      }),
    [affiliates, leads, commissions, marketers],
  );

  const isPaused = (r: Row) =>
    r.account?.status === "suspended" || r.affiliate.status !== "active";

  const counts = useMemo(
    () => ({
      all: rows.length,
      pending: rows.filter((r) => r.account?.status === "pending").length,
      active: rows.filter((r) => r.account?.status !== "pending" && !isPaused(r)).length,
      paused: rows.filter((r) => r.account?.status !== "pending" && isPaused(r)).length,
    }),
    [rows],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (filter === "all") return true;
        if (filter === "pending") return r.account?.status === "pending";
        if (filter === "paused") return r.account?.status !== "pending" && isPaused(r);
        return r.account?.status !== "pending" && !isPaused(r);
      })
      .filter((r) =>
        q
          ? [
              r.affiliate.name,
              r.affiliate.company,
              r.affiliate.email,
              r.account?.wilaya,
              r.account?.commune,
            ].some((v) => String(v ?? "").toLowerCase().includes(q))
          : true,
      );
  }, [rows, filter, query]);

  const totals = useMemo(
    () => ({
      partners: rows.filter((r) => r.affiliate.status === "active").length,
      leads: rows.reduce((s, r) => s + r.leads, 0),
      owed: rows.reduce((s, r) => s + r.owed, 0),
      paid: rows.reduce((s, r) => s + r.earned, 0),
    }),
    [rows],
  );

  /* ------------------------------------------------------------ actions */

  const setAccountStatus = async (account: Profile, status: AccountStatus) => {
    setBusy(account.id);
    const patch: Record<string, unknown> = { status };
    if (status === "active" && !account.approved_at) {
      patch.approved_at = new Date().toISOString();
      patch.approved_by = currentUserId;
    }

    const { error } = await sb.from("profiles").update(patch).eq("id", account.id);
    setBusy(null);
    if (error) return toast.error(error.message);

    setMarketers((list) =>
      list.map((m) => (m.id === account.id ? ({ ...m, ...patch } as Profile) : m)),
    );
    toast.success(
      status === "active"
        ? `${account.full_name} can sign in now`
        : `${account.full_name} is paused`,
    );
  };

  const payOut = async (affiliateId: string) => {
    const owed = commissions.filter(
      (c) =>
        c.affiliate_id === affiliateId &&
        c.status !== "paid" &&
        c.status !== "cancelled",
    );
    if (owed.length === 0) return toast("Nothing outstanding.");

    const today = new Date().toISOString().slice(0, 10);
    const { error } = await sb
      .from("commissions")
      .update({ status: "paid", paid_on: today })
      .in(
        "id",
        owed.map((c) => c.id),
      );

    if (error) return toast.error(error.message);
    setCommissions((list) =>
      list.map((c) =>
        owed.some((o) => o.id === c.id) ? { ...c, status: "paid", paid_on: today } : c,
      ),
    );
    toast.success(`Marked ${money(owed.reduce((s, c) => s + c.amount, 0))} as paid`);
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    const patch = {
      name: draft.name,
      company: draft.company || null,
      email: draft.email || null,
      phone: draft.phone || null,
      status: draft.status,
      ccp_rip: draft.ccp_rip ? normaliseRip(draft.ccp_rip) : null,
      ccp_holder: draft.ccp_holder || null,
      notes: draft.notes || null,
    };
    const { error } = await sb.from("affiliates").update(patch).eq("id", selected.id);
    setSaving(false);
    if (error) return toast.error(error.message);

    setAffiliates((list) =>
      list.map((a) => (a.id === selected.id ? ({ ...a, ...patch } as Affiliate) : a)),
    );
    toast.success("Partner updated");
    setSelected(null);
  };

  const remove = async () => {
    if (!selected) return;
    setSaving(true);
    const result = await removePartner(selected.id);
    setSaving(false);
    if (!result.ok) return toast.error(result.error);

    const gone = selected.id;
    setAffiliates((list) => list.filter((a) => a.id !== gone));
    setMarketers((list) => list.filter((m) => m.id !== selected.profile_id));
    setConfirmDelete(false);
    setSelected(null);
    toast.success("Partner removed");
  };

  const set = <K extends keyof Affiliate>(k: K, v: Affiliate[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const selectedRow = selected ? rows.find((r) => r.affiliate.id === selected.id) : null;
  const selectedLeads = selected ? leads.filter((l) => l.affiliate_id === selected.id) : [];
  const selectedCommissions = selected
    ? commissions.filter((c) => c.affiliate_id === selected.id)
    : [];

  return (
    <>
      <PageHeader
        eyebrow="Revenue"
        title="Affiliate partners"
        description="Everyone who sends you leads, what they have brought in, and what you owe them."
        actions={
          <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
            <Plus size={14} />
            New
          </Button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        {[
          { label: "Active partners", value: String(totals.partners), color: "var(--indigo)" },
          { label: "Leads referred", value: String(totals.leads), color: "var(--clay)" },
          { label: "Commission owed", value: money(totals.owed), color: "var(--amber)" },
          { label: "Paid out", value: money(totals.paid), color: "var(--sage)" },
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

      {counts.pending > 0 && filter !== "pending" ? (
        <button
          onClick={() => setFilter("pending")}
          className="mb-4 flex w-full items-center gap-2.5 rounded-lg border border-[var(--amber)]/35 bg-[var(--amber-soft)] px-4 py-2.5 text-left transition-all hover:brightness-[1.02]"
        >
          <BadgeCheck size={15} className="shrink-0 text-[var(--amber)]" />
          <span className="flex-1 text-[13px] text-ink">
            {counts.pending}{" "}
            {counts.pending === 1 ? "application is" : "applications are"} waiting for
            approval.
          </span>
          <span className="text-[12px] font-medium text-[var(--amber)]">Review</span>
        </button>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: counts.all },
            { value: "pending", label: "Pending", count: counts.pending },
            { value: "active", label: "Active", count: counts.active },
            { value: "paused", label: "Paused", count: counts.paused },
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
            placeholder="Search name, company, wilaya…"
            className="pl-8"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Handshake size={19} />}
          title={rows.length === 0 ? "No partners yet" : "Nothing here"}
          description={
            rows.length === 0
              ? "Add someone who refers work to you, or share the signup page so marketers can apply."
              : "Try another filter."
          }
          action={
            rows.length === 0 ? (
              <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
                <Plus size={14} />
                New partner
              </Button>
            ) : null
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {visible.map((row) => {
              const { affiliate: a, account } = row;
              const pending = account?.status === "pending";
              const paused = isPaused(row);

              return (
                <li
                  key={a.id}
                  className={cn(
                    "flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 transition-colors hover:bg-surface-2",
                    pending && "bg-[var(--amber-soft)]/30",
                  )}
                >
                  <button
                    onClick={() => {
                      setSelected(a);
                      setDraft(a);
                    }}
                    className="flex min-w-[240px] flex-1 items-center gap-3 text-left"
                  >
                    <Avatar
                      name={a.name}
                      src={account?.avatar_url}
                      accent={accentFor(a.id)}
                      size="md"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-[13.5px] font-medium text-ink">
                          {a.name}
                        </span>
                        {account ? (
                          <Badge accent={ACCOUNT_ACCENT[account.status]} dot>
                            {account.status}
                          </Badge>
                        ) : (
                          <Badge accent={PARTNER_ACCENT[a.status]}>contact</Badge>
                        )}
                        {row.earned > 0 ? (
                          <Badge accent="clay">{money(row.earned)} earned</Badge>
                        ) : null}
                      </div>

                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11.5px] text-ink-4">
                        {a.email ? (
                          <span className="inline-flex items-center gap-1">
                            <Mail size={10} />
                            {a.email}
                          </span>
                        ) : null}
                        {a.phone ? (
                          <span className="inline-flex items-center gap-1">
                            <Phone size={10} />
                            {a.phone}
                          </span>
                        ) : null}
                        {account?.wilaya ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={10} />
                            {[account.commune, account.wilaya].filter(Boolean).join(", ")}
                          </span>
                        ) : null}
                        {account?.social_url ? (
                          <span
                            role="link"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(
                                account.social_url!,
                                "_blank",
                                "noopener,noreferrer",
                              );
                            }}
                            className="inline-flex items-center gap-1 hover:text-ink-2"
                          >
                            <ExternalLink size={10} />
                            Social
                          </span>
                        ) : null}
                        {pending ? (
                          <span>applied {relativeTime(account.created_at)}</span>
                        ) : null}
                      </div>
                    </div>
                  </button>

                  <dl className="flex shrink-0 items-center gap-5">
                    {[
                      { k: "Leads", v: String(row.leads) },
                      { k: "Won", v: String(row.won) },
                      { k: "Earned", v: money(row.earned) },
                      { k: "Owed", v: money(row.owed) },
                    ].map((x) => (
                      <div key={x.k} className="min-w-[62px]">
                        <dt className="text-[10px] uppercase tracking-wider text-ink-4">
                          {x.k}
                        </dt>
                        <dd className="mt-0.5 text-[13px] font-medium tabular-nums text-ink">
                          {x.v}
                        </dd>
                      </div>
                    ))}
                    <div className="hidden w-24 xl:block">
                      <dt className="text-[10px] uppercase tracking-wider text-ink-4">
                        Conversion
                      </dt>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Progress value={row.conversion} accent="sage" />
                        <span className="text-[11px] tabular-nums text-ink-4">
                          {row.conversion}%
                        </span>
                      </div>
                    </div>
                  </dl>

                  <div className="flex shrink-0 items-center gap-2">
                    {pending ? (
                      <Button
                        size="sm"
                        variant="primary"
                        loading={busy === account.id}
                        onClick={() => setAccountStatus(account, "active")}
                      >
                        {busy === account.id ? null : <Check size={13} />}
                        Approve
                      </Button>
                    ) : row.owed > 0 ? (
                      <Button size="sm" onClick={() => payOut(a.id)}>
                        <Wallet size={13} />
                        Pay {money(row.owed)}
                      </Button>
                    ) : null}

                    {account && !pending ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={busy === account.id}
                        onClick={() =>
                          setAccountStatus(account, paused ? "active" : "suspended")
                        }
                        className={paused ? "" : "text-[var(--rose)]"}
                      >
                        {busy === account.id ? null : paused ? (
                          <Check size={13} />
                        ) : (
                          <Ban size={13} />
                        )}
                        {paused ? "Reinstate" : "Pause"}
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* -------------------------------------------------------- drawer */}
      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ""}
        subtitle={
          selected ? (
            <span className="flex flex-wrap items-center gap-2">
              <Badge accent={PARTNER_ACCENT[selected.status]} dot>
                {selected.status}
              </Badge>
              <span>Paid per project plan</span>
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
              Remove
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

            <Field label="Status" className="max-w-[200px]">
              <Select
                value={draft.status ?? "active"}
                onChange={(e) => set("status", e.target.value as Affiliate["status"])}
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="ended">Ended</option>
              </Select>
            </Field>

            <p className="rounded-lg border border-line bg-surface-2 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink-3">
              Commission is set on each project&apos;s payment plans, not here.
              What this partner earns depends on which plan the client buys.
            </p>

            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-4">
                <Landmark size={12} />
                Payout
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="CCP RIP" hint="20 digits">
                  <Input
                    inputMode="numeric"
                    value={draft.ccp_rip ?? ""}
                    onChange={(e) => set("ccp_rip", e.target.value)}
                    placeholder="0012 3456 7890 1234 5678"
                    className="font-mono tracking-wide"
                  />
                </Field>
                <Field label="Account holder">
                  <Input
                    value={draft.ccp_holder ?? ""}
                    onChange={(e) => set("ccp_holder", e.target.value)}
                    placeholder={draft.name ?? ""}
                  />
                </Field>
              </div>
              {selected.ccp_rip ? (
                <p className="mt-1.5 font-mono text-[11.5px] text-ink-4">
                  On file: {formatRip(selected.ccp_rip)}
                </p>
              ) : null}
            </section>

            {selectedRow?.account ? (
              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-4">
                  Their account
                </h3>
                <dl className="space-y-1.5 rounded-lg border border-line bg-surface-2 p-3 text-[12.5px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-4">Status</dt>
                    <dd>
                      <Badge accent={ACCOUNT_ACCENT[selectedRow.account.status]} dot>
                        {selectedRow.account.status}
                      </Badge>
                    </dd>
                  </div>
                  {selectedRow.account.wilaya ? (
                    <div className="flex justify-between gap-3">
                      <dt className="shrink-0 text-ink-4">Address</dt>
                      <dd className="text-right text-ink">
                        {[
                          selectedRow.account.address_line,
                          selectedRow.account.commune,
                          selectedRow.account.wilaya,
                          selectedRow.account.postal_code,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-4">Joined</dt>
                    <dd className="text-ink">
                      {relativeTime(selectedRow.account.created_at)}
                    </dd>
                  </div>
                </dl>
              </section>
            ) : null}

            <Field label="Notes">
              <Textarea
                rows={3}
                value={draft.notes ?? ""}
                onChange={(e) => set("notes", e.target.value)}
              />
            </Field>

            {selectedLeads.length > 0 ? (
              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-4">
                  Leads referred
                </h3>
                <ul className="space-y-1.5">
                  {selectedLeads.map((l) => (
                    <li
                      key={l.id}
                      className="flex items-center gap-2.5 rounded-md border border-line bg-surface px-3 py-2"
                    >
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                        {l.name}
                      </span>
                      <span className="text-[12.5px] tabular-nums text-ink-3">
                        {money(l.estimated_value ?? 0)}
                      </span>
                      <Badge accent={STAGE_ACCENT[l.stage]}>{STAGE_LABEL[l.stage]}</Badge>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {selectedCommissions.length > 0 ? (
              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-4">
                  Commissions
                </h3>
                <ul className="space-y-1.5">
                  {selectedCommissions.map((c) => {
                    const client = clients.find((x) => x.id === c.client_id);
                    return (
                      <li
                        key={c.id}
                        className="flex items-center gap-2.5 rounded-md border border-line bg-surface px-3 py-2"
                      >
                        <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                          {client?.name ?? c.note ?? "Commission"}
                        </span>
                        <span className="text-[12.5px] tabular-nums text-ink-2">
                          {money(c.amount)}
                        </span>
                        <Badge accent={c.status === "paid" ? "sage" : "amber"} dot>
                          {c.status}
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
                {selectedCommissions.some((c) => c.status !== "paid") ? (
                  <Button size="sm" className="mt-2 w-full" onClick={() => payOut(selected.id)}>
                    <BadgeCheck size={14} />
                    Mark all outstanding as paid
                  </Button>
                ) : null}
              </section>
            ) : null}

            <InteractionTimeline affiliateId={selected.id} />
          </div>
        ) : null}
      </Drawer>

      <CreateDialog
        open={creating}
        onClose={() => setCreating(false)}
        only="affiliate"
        onCreated={(row) => setAffiliates((list) => [row as unknown as Affiliate, ...list])}
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        loading={saving}
        title="Remove this partner?"
        message={
          selectedRow?.account
            ? `${selected?.name ?? "This partner"} loses their sign-in account for good, and everything they submitted loses its attribution. Pausing them instead keeps the history.`
            : `${selected?.name ?? "This partner"} will be removed. Their leads stay but lose the attribution.`
        }
      />
    </>
  );
}
