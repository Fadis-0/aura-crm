"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
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
import { cn, LOCALE } from "@/lib/utils";
import {
  EVENT_KINDS,
  EVENT_KIND_ACCENT,
  type CalendarEvent,
  type Client,
  type EventKind,
  type Project,
} from "@/lib/types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const KIND_LABEL: Record<EventKind, string> = {
  meeting: "Meeting",
  call: "Call",
  deadline: "Deadline",
  reminder: "Reminder",
  focus: "Focus block",
  personal: "Personal",
};

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** Monday-first six-week grid covering the given month. */
function monthGrid(anchor: Date) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function CalendarView({
  initialEvents,
  clients,
  projects,
}: {
  initialEvents: CalendarEvent[];
  clients: Pick<Client, "id" | "name">[];
  projects: Pick<Project, "id" | "name">[];
}) {
  const sb = supabaseBrowser();

  const [events, setEvents] = useServerState(initialEvents);
  const [anchor, setAnchor] = useState(new Date());
  const [view, setView] = useState<"month" | "agenda">("month");
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [draft, setDraft] = useState<Partial<CalendarEvent>>({});
  const [saving, setSaving] = useState(false);

  const today = new Date();
  const days = useMemo(() => monthGrid(anchor), [anchor]);

  const eventsOn = (d: Date) =>
    events
      .filter((e) => sameDay(new Date(e.starts_at), d))
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  const upcoming = useMemo(
    () =>
      events
        .filter((e) => new Date(e.starts_at) >= new Date(new Date().toDateString()))
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
        .slice(0, 40),
    [events],
  );

  const openNew = (day?: Date) => {
    const start = day ? new Date(day) : new Date();
    if (day) start.setHours(10, 0, 0, 0);
    setDraft({
      title: "",
      kind: "meeting",
      starts_at: start.toISOString(),
      accent: "clay",
    });
    setEditing({ id: "" } as CalendarEvent);
  };

  const openEvent = (e: CalendarEvent) => {
    setDraft(e);
    setEditing(e);
  };

  const save = async () => {
    if (!draft.title?.trim()) return toast.error("Give the event a title.");
    setSaving(true);

    const kind = (draft.kind ?? "meeting") as EventKind;
    const payload = {
      title: draft.title.trim(),
      description: draft.description || null,
      kind,
      starts_at: draft.starts_at ?? new Date().toISOString(),
      ends_at: draft.ends_at || null,
      all_day: draft.all_day ?? false,
      location: draft.location || null,
      accent: EVENT_KIND_ACCENT[kind],
      client_id: draft.client_id || null,
      project_id: draft.project_id || null,
    };

    if (editing?.id) {
      const { error } = await sb.from("events").update(payload).eq("id", editing.id);
      setSaving(false);
      if (error) return toast.error(error.message);
      setEvents((rows) =>
        rows.map((e) => (e.id === editing.id ? ({ ...e, ...payload } as CalendarEvent) : e)),
      );
    } else {
      const { data, error } = await sb.from("events").insert(payload).select("*").single();
      setSaving(false);
      if (error) return toast.error(error.message);
      setEvents((rows) => [...rows, data as CalendarEvent]);
    }

    setEditing(null);
    toast.success("Event saved");
  };

  const remove = async () => {
    if (!editing?.id) return setEditing(null);
    setEvents((rows) => rows.filter((e) => e.id !== editing.id));
    await sb.from("events").delete().eq("id", editing.id);
    setEditing(null);
    toast.success("Event deleted");
  };

  const shiftMonth = (by: number) =>
    setAnchor((d) => new Date(d.getFullYear(), d.getMonth() + by, 1));

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Calendar"
        description="Meetings, deadlines and focus blocks in one month view."
        actions={
          <>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: "month", label: "Month" },
                { value: "agenda", label: "Agenda" },
              ]}
            />
            <Button variant="primary" size="sm" onClick={() => openNew()}>
              <Plus size={14} />
              New
            </Button>
          </>
        }
      />

      {view === "month" ? (
        <Card className="overflow-hidden">
          <div className="flex items-center gap-3 border-b border-line px-4 py-3">
            <h2 className="text-[16px]">
              {anchor.toLocaleDateString(LOCALE, { month: "long", year: "numeric" })}
            </h2>
            <div className="ml-auto flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                <ChevronLeft size={16} />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAnchor(new Date())}>
                Today
              </Button>
              <Button size="icon" variant="ghost" onClick={() => shiftMonth(1)} aria-label="Next month">
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-line bg-surface-2/60">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="px-2 py-2 text-center text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-4"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px bg-line">
            {days.map((day, i) => {
              const inMonth = day.getMonth() === anchor.getMonth();
              const isToday = sameDay(day, today);
              const dayEvents = eventsOn(day);

              return (
                <div
                  key={i}
                  onDoubleClick={() => openNew(day)}
                  className={cn(
                    "min-h-[104px] bg-surface p-1.5 transition-colors hover:bg-surface-2",
                    !inMonth && "bg-surface-2/40",
                  )}
                >
                  <div className="mb-1 flex items-center justify-between px-0.5">
                    <span
                      className={cn(
                        "grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11.5px] tabular-nums",
                        isToday
                          ? "bg-[var(--clay)] font-semibold text-white"
                          : inMonth
                            ? "text-ink-2"
                            : "text-ink-4",
                      )}
                    >
                      {day.getDate()}
                    </span>
                    {dayEvents.length > 2 ? (
                      <span className="text-[10px] text-ink-4">
                        +{dayEvents.length - 2}
                      </span>
                    ) : null}
                  </div>

                  <div className="space-y-1">
                    {dayEvents.slice(0, 2).map((e) => (
                      <button
                        key={e.id}
                        onClick={() => openEvent(e)}
                        className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left transition-opacity hover:opacity-80"
                        style={{
                          background: `color-mix(in srgb, var(--${e.accent}) 14%, transparent)`,
                        }}
                      >
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: `var(--${e.accent})` }}
                        />
                        <span className="truncate text-[11px] text-ink-2">
                          {e.all_day
                            ? ""
                            : `${new Date(e.starts_at).toLocaleTimeString(LOCALE, {
                                hour: "numeric",
                                minute: "2-digit",
                              })} `}
                          {e.title}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="border-t border-line px-4 py-2 text-[11.5px] text-ink-4">
            Double-click a day to add an event.
          </p>
        </Card>
      ) : upcoming.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={19} />}
          title="Nothing coming up"
          description="Add a meeting, a deadline, or a block of focus time."
          action={
            <Button variant="primary" size="sm" onClick={() => openNew()}>
              <Plus size={14} />
              Add event
            </Button>
          }
        />
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {upcoming.map((e) => {
              const start = new Date(e.starts_at);
              const client = clients.find((c) => c.id === e.client_id);
              return (
                <li key={e.id}>
                  <button
                    onClick={() => openEvent(e)}
                    className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-surface-2"
                  >
                    <div className="w-14 shrink-0 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-4">
                        {start.toLocaleDateString(LOCALE, { weekday: "short" })}
                      </p>
                      <p className="font-display text-[19px] leading-none text-ink">
                        {start.getDate()}
                      </p>
                      <p className="mt-0.5 text-[10px] uppercase text-ink-4">
                        {start.toLocaleDateString(LOCALE, { month: "short" })}
                      </p>
                    </div>
                    <div
                      className="h-9 w-1 shrink-0 rounded-full"
                      style={{ background: `var(--${e.accent})` }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium text-ink">{e.title}</p>
                      <p className="mt-0.5 truncate text-[12px] text-ink-4">
                        {e.all_day
                          ? "All day"
                          : start.toLocaleTimeString(LOCALE, {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                        {e.location ? ` · ${e.location}` : ""}
                        {client ? ` · ${client.name}` : ""}
                      </p>
                    </div>
                    <Badge accent={EVENT_KIND_ACCENT[e.kind]}>{KIND_LABEL[e.kind]}</Badge>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Edit event" : "New event"}
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
          <Field label="Title" required>
            <Input
              autoFocus
              value={draft.title ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Kick-off call with Acme"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Kind">
              <Select
                value={draft.kind ?? "meeting"}
                onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value as EventKind }))}
              >
                {EVENT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Location" hint="or a link">
              <Input
                value={draft.location ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Starts">
              <Input
                type="datetime-local"
                value={draft.starts_at ? toLocalInput(draft.starts_at) : ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    starts_at: new Date(e.target.value).toISOString(),
                  }))
                }
              />
            </Field>
            <Field label="Ends" hint="optional">
              <Input
                type="datetime-local"
                value={draft.ends_at ? toLocalInput(draft.ends_at) : ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    ends_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                  }))
                }
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-[13px] text-ink-2">
            <input
              type="checkbox"
              checked={draft.all_day ?? false}
              onChange={(e) => setDraft((d) => ({ ...d, all_day: e.target.checked }))}
              className="h-4 w-4 rounded border-line accent-[var(--clay)]"
            />
            All day
          </label>

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

          <Field label="Notes">
            <Textarea
              rows={3}
              value={draft.description ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}
