"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { Building2, Flame, Plus, Snowflake, Sun, Target, Trash2 } from "lucide-react";
import { ConfirmDialog, Drawer } from "@/components/overlays";
import { CreateLeadDialog } from "@/components/portal/create-lead-dialog";
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
import { useServerState } from "@/lib/use-server-state";
import { cn, compactMoney, money, relativeTime } from "@/lib/utils";
import { planPayout } from "@/lib/commission";
import {
  LEAD_STAGES,
  STAGE_ACCENT,
  STAGE_LABEL,
  type Affiliate,
  type Lead,
  type LeadStage,
  type Project,
  type ProjectPlan,
} from "@/lib/types";

const BOARD_STAGES = LEAD_STAGES.filter((s) => s !== "lost") as LeadStage[];

const TEMP_ICON = { cold: Snowflake, warm: Sun, hot: Flame } as const;
const TEMP_COLOR = {
  cold: "text-[var(--indigo)]",
  warm: "text-[var(--amber)]",
  hot: "text-[var(--clay)]",
} as const;

function LeadCard({
  lead,
  onOpen,
  dragging,
}: {
  lead: Lead;
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

      <p className="mt-2.5 font-display text-[14px] tabular-nums text-ink">
        {compactMoney(lead.estimated_value ?? 0)}
      </p>
    </div>
  );
}

function DraggableCard(props: Parameters<typeof LeadCard>[0]) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: props.lead.id,
  });

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

function Column({
  stage,
  leads,
  onOpen,
}: {
  stage: LeadStage;
  leads: Lead[];
  onOpen: (l: Lead) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const total = leads.reduce((s, l) => s + (l.estimated_value ?? 0), 0);

  return (
    <div className="flex w-[264px] shrink-0 flex-col">
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
          <DraggableCard key={l.id} lead={l} onOpen={() => onOpen(l)} />
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

export function PortalLeads({
  initialLeads,
  affiliateId,
  affiliate,
  projects,
  plans,
}: {
  initialLeads: Lead[];
  affiliateId: string | null;
  affiliate: Affiliate | null;
  projects: Project[];
  plans: ProjectPlan[];
}) {
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
    // On a phone a plain swipe has to scroll the board, so a drag only starts
    // after a short press-and-hold.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
  );

  const open = leads.filter((l) => l.stage !== "won" && l.stage !== "lost");
  const totals = useMemo(() => {
    const wonLeads = leads.filter((l) => l.stage === "won");

    // Commission lives on the plan the client bought, so each won lead pays
    // out on its own terms. A lead with no plan picked yet earns nothing.
    const commission = wonLeads.reduce((s, l) => {
      const plan = plans.find((pl) => pl.id === l.plan_id);
      return s + (plan ? planPayout(plan) : 0);
    }, 0);

    return {
      open: open.reduce((s, l) => s + (l.estimated_value ?? 0), 0),
      won: wonLeads.reduce((s, l) => s + (l.estimated_value ?? 0), 0),
      wonCount: wonLeads.length,
      commission,
    };
  }, [leads, open, plans]);

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
      estimated_value: Number(draft.estimated_value ?? 0),
      project_id: draft.project_id || null,
      plan_id: draft.plan_id || null,
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
        eyebrow="Pipeline"
        title="My leads"
        description="Everyone you have brought in. Drag a card to move it a stage."
        actions={
          <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
            <Plus size={14} />
            New
          </Button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        {[
          { label: "In play", value: money(totals.open), color: "var(--clay)" },
          { label: "Closed", value: money(totals.won), color: "var(--sage)" },
          { label: "Deals won", value: String(totals.wonCount), color: "var(--indigo)" },
          {
            label: "Your cut",
            value: affiliate ? money(totals.commission) : "—",
            color: "var(--amber)",
          },
        ].map((s) => (
          <Card key={s.label} className="p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-4">
              {s.label}
            </p>
            <p
              className="mt-1.5 font-display text-[20px] leading-none tabular-nums"
              style={{ color: s.color }}
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
          description="Add the first person you have brought in and move them along as they warm up."
          action={
            <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
              <Plus size={14} />
              New lead
            </Button>
          }
        />
      ) : (
        <DndContext
          id="portal-leads"
          sensors={sensors}
          onDragStart={(e) => setActiveId(String(e.active.id))}
          onDragEnd={onDragEnd}
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        >
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-4">
            {BOARD_STAGES.map((stage) => (
              <Column
                key={stage}
                stage={stage}
                leads={leads.filter((l) => l.stage === stage)}
                onOpen={(l) => {
                  setSelected(l);
                  setDraft(l);
                }}
              />
            ))}
            <Column
              stage="lost"
              leads={leads.filter((l) => l.stage === "lost")}
              onOpen={(l) => {
                setSelected(l);
                setDraft(l);
              }}
            />
          </div>

          {/* dnd-kit's DragOverlay does not portal itself, so it renders in
              place in the tree and the page's entrance-animation ancestor (a
              CSS transform) hijacks its fixed positioning mid-drag, throwing
              it off the cursor. Portaling it to <body> ourselves fixes it. */}
          {typeof document !== "undefined"
            ? createPortal(
                <DragOverlay dropAnimation={null}>
                  {activeLead ? (
                    <LeadCard lead={activeLead} onOpen={() => {}} dragging />
                  ) : null}
                </DragOverlay>,
                document.body,
              )
            : null}
        </DndContext>
      )}

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
            <Button onClick={() => setSelected(null)}>Cancel</Button>
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
                  onChange={(e) =>
                    set("temperature", e.target.value as Lead["temperature"])
                  }
                >
                  <option value="cold">Cold</option>
                  <option value="warm">Warm</option>
                  <option value="hot">Hot</option>
                </Select>
              </Field>
              <Field label="Value" hint="DA">
                <Input
                  type="number"
                  value={draft.estimated_value ?? 0}
                  onChange={(e) => set("estimated_value", Number(e.target.value))}
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Project" hint="what they'd be buying">
                <Select
                  value={draft.project_id ?? ""}
                  onChange={(e) => {
                    set("project_id", e.target.value || null);
                    set("plan_id", null);
                  }}
                >
                  <option value="">Not decided yet</option>
                  {projects.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Plan" hint="sets what you earn">
                <Select
                  value={draft.plan_id ?? ""}
                  onChange={(e) => set("plan_id", e.target.value || null)}
                  disabled={!draft.project_id}
                >
                  <option value="">
                    {draft.project_id ? "Not decided yet" : "Pick a project first"}
                  </option>
                  {plans
                    .filter((pl) => pl.project_id === draft.project_id)
                    .map((pl) => (
                      <option key={pl.id} value={pl.id}>
                        {pl.name} — {money(planPayout(pl))} to you
                      </option>
                    ))}
                </Select>
              </Field>
            </div>

            <Field label="Notes">
              <Textarea
                rows={5}
                value={draft.notes ?? ""}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="What do they need? When should you follow up?"
              />
            </Field>
          </div>
        ) : null}
      </Drawer>

      <CreateLeadDialog
        open={creating}
        onClose={() => setCreating(false)}
        affiliateId={affiliateId}
        projects={projects}
        plans={plans}
        onCreated={(lead) => setLeads((rows) => [lead, ...rows])}
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        title="Delete this lead?"
        message={`${selected?.name ?? "This lead"} will be removed from your pipeline. This cannot be undone.`}
      />
    </>
  );
}
