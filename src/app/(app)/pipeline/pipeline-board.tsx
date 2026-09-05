"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { toast } from "sonner";
import {
  Building2,
  Flame,
  Handshake,
  Plus,
  Mail,
  Phone,
  Snowflake,
  Sun,
  Target,
  Trash2,
  UserPlus,
} from "lucide-react";
import { Drawer, ConfirmDialog } from "@/components/overlays";
import { CreateDialog } from "@/components/create-dialog";
import { Combobox } from "@/components/combobox";
import { useServerState } from "@/lib/use-server-state";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn, compactMoney, money, relativeTime } from "@/lib/utils";
import {
  LEAD_STAGES,
  STAGE_ACCENT,
  STAGE_LABEL,
  type Affiliate,
  type Lead,
  type LeadStage,
} from "@/lib/types";

const BOARD_STAGES = LEAD_STAGES.filter((s) => s !== "lost") as LeadStage[];

const TEMP_ICON = { cold: Snowflake, warm: Sun, hot: Flame } as const;
const TEMP_COLOR = {
  cold: "text-[var(--indigo)]",
  warm: "text-[var(--amber)]",
  hot: "text-[var(--clay)]",
} as const;

/* ------------------------------------------------------------------ card */

function LeadCard({
  lead,
  affiliate,
  onOpen,
  dragging,
}: {
  lead: Lead;
  affiliate?: Affiliate;
  onOpen: () => void;
  dragging?: boolean;
}) {
  const Temp = TEMP_ICON[lead.temperature];

  return (
    <div
      onClick={onOpen}
      className={cn(
        "cursor-grab rounded-lg border border-line bg-surface p-3 shadow-soft transition-all",
        "hover:border-line-2 hover:shadow-raised active:cursor-grabbing",
        dragging && "rotate-1 shadow-float",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
          {lead.name}
        </p>
        <Temp size={13} className={cn("mt-0.5 shrink-0", TEMP_COLOR[lead.temperature])} />
      </div>

      {lead.company ? (
        <p className="mt-0.5 flex items-center gap-1 truncate text-[11.5px] text-ink-4">
          <Building2 size={11} />
          {lead.company}
        </p>
      ) : null}

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="font-display text-[14px] tabular-nums text-ink">
          {compactMoney(lead.estimated_value ?? 0)}
        </span>
        <span className="text-[11px] tabular-nums text-ink-4">
          {lead.probability ?? 0}%
        </span>
      </div>

      {affiliate ? (
        <p className="mt-2 flex items-center gap-1 truncate border-t border-line pt-2 text-[11px] text-ink-4">
          <Handshake size={11} />
          via {affiliate.name}
        </p>
      ) : null}
    </div>
  );
}

function DraggableCard(props: Parameters<typeof LeadCard>[0]) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: props.lead.id,
  });

  // touch-none stops the browser scrolling instead of dragging;
  // select-none stops a drag turning into a text selection.
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn("touch-none select-none", isDragging && "opacity-35")}
    >
      <LeadCard {...props} />
    </div>
  );
}

/* ---------------------------------------------------------------- column */

function Column({
  stage,
  leads,
  affiliates,
  onOpen,
}: {
  stage: LeadStage;
  leads: Lead[];
  affiliates: Affiliate[];
  onOpen: (l: Lead) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const total = leads.reduce((s, l) => s + (l.estimated_value ?? 0), 0);

  return (
    <div className="flex w-[268px] shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: `var(--${STAGE_ACCENT[stage]})` }}
        />
        <h3 className="text-[12.5px] font-semibold text-ink">{STAGE_LABEL[stage]}</h3>
        <span className="rounded-full bg-surface-sunk px-1.5 text-[10.5px] font-semibold tabular-nums text-ink-3">
          {leads.length}
        </span>
        <span className="ml-auto text-[11px] tabular-nums text-ink-4">
          {compactMoney(total)}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 rounded-lg border border-dashed p-2 transition-colors",
          isOver
            ? "border-[var(--clay)] bg-[var(--clay-soft)]"
            : "border-line bg-surface-2/40",
        )}
      >
        {leads.map((l) => (
          <DraggableCard
            key={l.id}
            lead={l}
            affiliate={affiliates.find((a) => a.id === l.affiliate_id)}
            onOpen={() => onOpen(l)}
          />
        ))}
        {leads.length === 0 ? (
          <p className="px-2 py-6 text-center text-[11.5px] text-ink-4">
            Drop a lead here
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- board */

export function PipelineBoard({
  initialLeads,
  affiliates,
}: {
  initialLeads: Lead[];
  affiliates: Affiliate[];
}) {
  const router = useRouter();
  const sb = supabaseBrowser();

  const [leads, setLeads] = useServerState(initialLeads);
  const [creating, setCreating] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [draft, setDraft] = useState<Partial<Lead>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const open = leads.filter((l) => l.stage !== "won" && l.stage !== "lost");
  const totals = useMemo(
    () => ({
      value: open.reduce((s, l) => s + (l.estimated_value ?? 0), 0),
      weighted: open.reduce(
        (s, l) => s + (l.estimated_value ?? 0) * ((l.probability ?? 0) / 100),
        0,
      ),
      won: leads
        .filter((l) => l.stage === "won")
        .reduce((s, l) => s + (l.estimated_value ?? 0), 0),
      lost: leads.filter((l) => l.stage === "lost").length,
    }),
    [leads, open],
  );

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const id = String(e.active.id);
    const stage = e.over?.id as LeadStage | undefined;
    if (!stage) return;

    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.stage === stage) return;

    const previous = leads;
    setLeads((rows) => rows.map((l) => (l.id === id ? { ...l, stage } : l)));

    const { error } = await sb.from("leads").update({ stage }).eq("id", id);
    if (error) {
      setLeads(previous);
      toast.error(error.message);
      return;
    }
    toast.success(`${lead.name} moved to ${STAGE_LABEL[stage]}`);
  };

  const openLead = (l: Lead) => {
    setSelected(l);
    setDraft(l);
  };

  const saveLead = async () => {
    if (!selected) return;
    setSaving(true);
    const patch = {
      name: draft.name,
      company: draft.company || null,
      email: draft.email || null,
      phone: draft.phone || null,
      stage: draft.stage,
      temperature: draft.temperature,
      source: draft.source,
      affiliate_id: draft.affiliate_id || null,
      estimated_value: Number(draft.estimated_value ?? 0),
      probability: Number(draft.probability ?? 0),
      expected_close: draft.expected_close || null,
      notes: draft.notes || null,
    };
    const { error } = await sb.from("leads").update(patch).eq("id", selected.id);
    setSaving(false);
    if (error) return toast.error(error.message);

    setLeads((rows) =>
      rows.map((l) => (l.id === selected.id ? ({ ...l, ...patch } as Lead) : l)),
    );
    toast.success("Lead updated");
    setSelected(null);
  };

  const convert = async () => {
    if (!selected) return;
    setSaving(true);

    const { data, error } = await sb
      .from("clients")
      .insert({
        name: selected.name,
        company: selected.company,
        email: selected.email,
        phone: selected.phone,
        website: selected.website,
        source: selected.source,
        affiliate_id: selected.affiliate_id,
        lead_id: selected.id,
        lifetime_value: selected.estimated_value ?? 0,
        tags: selected.tags,
        notes: selected.notes,
      })
      .select("id")
      .single();

    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }

    await sb
      .from("leads")
      .update({ stage: "won", converted_client_id: data.id })
      .eq("id", selected.id);

    // Book the affiliate's commission on the closed value.
    if (selected.affiliate_id) {
      const affiliate = affiliates.find((a) => a.id === selected.affiliate_id);
      if (affiliate) {
        await sb.from("commissions").insert({
          affiliate_id: affiliate.id,
          lead_id: selected.id,
          client_id: data.id,
          rate: affiliate.commission_rate,
          amount:
            ((selected.estimated_value ?? 0) * affiliate.commission_rate) / 100,
          note: `Closed ${selected.name}`,
        });
      }
    }

    setSaving(false);
    setSelected(null);
    toast.success(`${selected.name} is now a client`);
    router.push("/clients");
  };

  const remove = async () => {
    if (!selected) return;
    const { error } = await sb.from("leads").delete().eq("id", selected.id);
    if (error) return toast.error(error.message);
    setLeads((rows) => rows.filter((l) => l.id !== selected.id));
    setConfirmDelete(false);
    setSelected(null);
    toast.success("Lead deleted");
  };

  const activeLead = leads.find((l) => l.id === activeId);
  const set = <K extends keyof Lead>(k: K, v: Lead[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  return (
    <>
      <PageHeader
        eyebrow="Revenue"
        title="Pipeline"
        description="Drag a lead to move it a stage. Converting a won lead creates the client and books the affiliate commission."
        actions={
          <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
            <Plus size={14} />
            New
          </Button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        {[
          { label: "Open value", value: money(totals.value), accent: "clay" },
          { label: "Weighted", value: money(totals.weighted), accent: "amber" },
          { label: "Won", value: money(totals.won), accent: "sage" },
          { label: "Lost leads", value: String(totals.lost), accent: "rose" },
        ].map((s) => (
          <Card key={s.label} className="p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-4">
              {s.label}
            </p>
            <p
              className="mt-1.5 font-display text-[21px] leading-none tabular-nums"
              style={{ color: `var(--${s.accent})` }}
            >
              {s.value}
            </p>
          </Card>
        ))}
      </div>

      {leads.length === 0 ? (
        <EmptyState
          icon={<Target size={19} />}
          title="No leads yet"
          description="Add your first potential client, or press Ctrl J from anywhere."
          action={
            <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
              <Plus size={14} />
              New lead
            </Button>
          }
        />
      ) : (
        // The explicit id keeps dnd-kit's aria ids identical on server and client.
        <DndContext
          id="pipeline-board"
          sensors={sensors}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          // The board scrolls sideways, so re-measure the columns while
          // dragging instead of trusting the rects taken at drag start.
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        >
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-4">
            {BOARD_STAGES.map((stage) => (
              <Column
                key={stage}
                stage={stage}
                leads={leads.filter((l) => l.stage === stage)}
                affiliates={affiliates}
                onOpen={openLead}
              />
            ))}
            <Column
              stage="lost"
              leads={leads.filter((l) => l.stage === "lost")}
              affiliates={affiliates}
              onOpen={openLead}
            />
          </div>

          {/*
            No wrapper with its own width. dnd-kit sizes the overlay to the card
            being dragged, so a fixed width here would make the card sit away
            from the cursor.
          */}
          <DragOverlay dropAnimation={null}>
            {activeLead ? (
              <LeadCard
                lead={activeLead}
                affiliate={affiliates.find((a) => a.id === activeLead.affiliate_id)}
                onOpen={() => {}}
                dragging
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* ------------------------------------------------------- drawer */}
      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ""}
        subtitle={
          selected ? (
            <span className="flex flex-wrap items-center gap-2">
              <Badge accent={STAGE_ACCENT[selected.stage]} dot>
                {STAGE_LABEL[selected.stage]}
              </Badge>
              <span>added {relativeTime(selected.created_at)}</span>
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
            {selected?.stage !== "won" ? (
              <Button onClick={convert} loading={saving}>
                <UserPlus size={14} />
                Convert to client
              </Button>
            ) : null}
            <Button variant="primary" onClick={saveLead} loading={saving}>
              Save
            </Button>
          </>
        }
      >
        {selected ? (
          <div className="space-y-4">
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
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Email">
                <Input
                  type="email"
                  value={draft.email ?? ""}
                  onChange={(e) => set("email", e.target.value)}
                />
              </Field>
              <Field label="Phone">
                <Input
                  value={draft.phone ?? ""}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Stage">
                <Select
                  value={draft.stage ?? "new"}
                  onChange={(e) => set("stage", e.target.value as LeadStage)}
                >
                  {LEAD_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {STAGE_LABEL[s]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Heat">
                <Select
                  value={draft.temperature ?? "warm"}
                  onChange={(e) => set("temperature", e.target.value as Lead["temperature"])}
                >
                  <option value="cold">Cold</option>
                  <option value="warm">Warm</option>
                  <option value="hot">Hot</option>
                </Select>
              </Field>
              <Field label="Source">
                <Select
                  value={draft.source ?? "direct"}
                  onChange={(e) => set("source", e.target.value as Lead["source"])}
                >
                  <option value="direct">Direct</option>
                  <option value="affiliate">Affiliate</option>
                  <option value="referral">Referral</option>
                  <option value="inbound">Inbound</option>
                  <option value="outbound">Outbound</option>
                  <option value="social">Social</option>
                  <option value="other">Other</option>
                </Select>
              </Field>
            </div>

            <Field label="Who brought them in" hint="affiliate">
              <Combobox
                value={draft.affiliate_id ?? null}
                onChange={(v) => set("affiliate_id", v)}
                options={affiliates.map((a) => ({
                  value: a.id,
                  label: a.name,
                  hint: [a.company, `${a.commission_rate}% commission`]
                    .filter(Boolean)
                    .join(" · "),
                  accent: a.accent,
                }))}
                placeholder="Nobody"
                clearLabel="Nobody"
                emptyLabel="No affiliate matches that"
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Value" hint="DA">
                <Input
                  type="number"
                  value={draft.estimated_value ?? 0}
                  onChange={(e) => set("estimated_value", Number(e.target.value))}
                />
              </Field>
              <Field label="Probability" hint="%">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={draft.probability ?? 0}
                  onChange={(e) => set("probability", Number(e.target.value))}
                />
              </Field>
              <Field label="Expected close">
                <Input
                  type="date"
                  value={draft.expected_close ?? ""}
                  onChange={(e) => set("expected_close", e.target.value)}
                />
              </Field>
            </div>

            <Field label="Notes">
              <Textarea
                rows={5}
                value={draft.notes ?? ""}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="What do they need? What did you agree?"
              />
            </Field>

            {selected.email || selected.phone ? (
              <div className="flex gap-2 border-t border-line pt-4">
                {selected.email ? (
                  <a
                    href={`mailto:${selected.email}`}
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-3 text-[13px] font-medium transition-colors hover:bg-surface-2"
                  >
                    <Mail size={14} /> Email
                  </a>
                ) : null}
                {selected.phone ? (
                  <a
                    href={`tel:${selected.phone}`}
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-3 text-[13px] font-medium transition-colors hover:bg-surface-2"
                  >
                    <Phone size={14} /> Call
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </Drawer>

      <CreateDialog
        open={creating}
        onClose={() => setCreating(false)}
        only="lead"
        onCreated={(row) => setLeads((rows) => [row as unknown as Lead, ...rows])}
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        title="Delete this lead?"
        message={`${selected?.name ?? "This lead"} and its history will be removed. This cannot be undone.`}
      />
    </>
  );
}
