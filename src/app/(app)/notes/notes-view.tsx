"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Pin, PinOff, Plus, Search, StickyNote, Trash2 } from "lucide-react";
import { Modal } from "@/components/overlays";
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
import { cn, relativeTime } from "@/lib/utils";
import type { Client, Note, Project } from "@/lib/types";

const NOTE_TINTS = [
  "var(--clay-soft)",
  "var(--amber-soft)",
  "var(--sage-soft)",
  "var(--indigo-soft)",
  "var(--plum-soft)",
];

export function NotesView({
  initialNotes,
  clients,
  projects,
}: {
  initialNotes: Note[];
  clients: Pick<Client, "id" | "name">[];
  projects: Pick<Project, "id" | "name">[];
}) {
  const sb = supabaseBrowser();

  const [notes, setNotes] = useServerState(initialNotes);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Note | null>(null);
  const [draft, setDraft] = useState<Partial<Note>>({});
  const [saving, setSaving] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) =>
      [n.title, n.content, ...(n.tags ?? [])].some((v) =>
        String(v ?? "").toLowerCase().includes(q),
      ),
    );
  }, [notes, query]);

  const openNew = () => {
    setDraft({ title: "", content: "", tags: [] });
    setEditing({ id: "", title: "", content: "" } as Note);
  };

  const openNote = (n: Note) => {
    setDraft(n);
    setEditing(n);
  };

  const save = async () => {
    setSaving(true);
    const payload = {
      title: (draft.title ?? "").trim() || "Untitled",
      content: draft.content ?? "",
      tags:
        typeof draft.tags === "string"
          ? String(draft.tags)
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : (draft.tags ?? []),
      client_id: draft.client_id || null,
      project_id: draft.project_id || null,
      pinned: draft.pinned ?? false,
    };

    if (editing?.id) {
      const { error } = await sb.from("notes").update(payload).eq("id", editing.id);
      setSaving(false);
      if (error) return toast.error(error.message);
      setNotes((rows) =>
        rows.map((n) =>
          n.id === editing.id
            ? ({ ...n, ...payload, updated_at: new Date().toISOString() } as Note)
            : n,
        ),
      );
    } else {
      const { data, error } = await sb.from("notes").insert(payload).select("*").single();
      setSaving(false);
      if (error) return toast.error(error.message);
      setNotes((rows) => [data as Note, ...rows]);
    }

    setEditing(null);
    toast.success("Note saved");
  };

  const togglePin = async (n: Note) => {
    const pinned = !n.pinned;
    setNotes((rows) =>
      [...rows.map((x) => (x.id === n.id ? { ...x, pinned } : x))].sort(
        (a, b) => Number(b.pinned) - Number(a.pinned),
      ),
    );
    await sb.from("notes").update({ pinned }).eq("id", n.id);
  };

  const remove = async () => {
    if (!editing?.id) return setEditing(null);
    setNotes((rows) => rows.filter((n) => n.id !== editing.id));
    await sb.from("notes").delete().eq("id", editing.id);
    setEditing(null);
    toast.success("Note deleted");
  };

  const tagsValue = Array.isArray(draft.tags)
    ? draft.tags.join(", ")
    : String(draft.tags ?? "");

  return (
    <>
      <PageHeader
        eyebrow="Delivery"
        title="Notes"
        description="Meeting notes, briefs, ideas. Pin the ones you keep coming back to."
        actions={
          <Button variant="primary" size="sm" onClick={openNew}>
            <Plus size={14} />
            New
          </Button>
        }
      />

      <div className="mb-4 max-w-xs">
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-4"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes…"
            className="pl-8"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<StickyNote size={19} />}
          title={notes.length === 0 ? "No notes yet" : "Nothing matches"}
          description={
            notes.length === 0
              ? "Write down what came out of that call before you forget it."
              : "Try another search."
          }
          action={
            notes.length === 0 ? (
              <Button variant="primary" size="sm" onClick={openNew}>
                <Plus size={14} />
                Write one
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="columns-1 gap-3 sm:columns-2 xl:columns-3 [&>*]:mb-3">
          {visible.map((n, i) => {
            const client = clients.find((c) => c.id === n.client_id);
            const project = projects.find((p) => p.id === n.project_id);
            return (
              <Card
                key={n.id}
                className="group break-inside-avoid p-0 transition-all hover:shadow-raised"
              >
                <div
                  className="h-1 rounded-t-lg"
                  style={{ background: NOTE_TINTS[i % NOTE_TINTS.length] }}
                />
                <button
                  onClick={() => openNote(n)}
                  className="block w-full p-4 text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="min-w-0 flex-1 text-[14px] leading-snug">
                      {n.title}
                    </h3>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePin(n);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.stopPropagation();
                          togglePin(n);
                        }
                      }}
                      aria-label={n.pinned ? "Unpin" : "Pin"}
                      className={cn(
                        "shrink-0 transition-opacity",
                        n.pinned
                          ? "text-[var(--clay)]"
                          : "text-ink-4 opacity-0 group-hover:opacity-100",
                      )}
                    >
                      {n.pinned ? <Pin size={14} /> : <PinOff size={14} />}
                    </span>
                  </div>

                  {n.content ? (
                    <p className="mt-2 line-clamp-[8] whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-3">
                      {n.content}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {(n.tags ?? []).map((t) => (
                      <Badge key={t}>#{t}</Badge>
                    ))}
                    {client ? <Badge accent="indigo">{client.name}</Badge> : null}
                    {project ? <Badge accent="plum">{project.name}</Badge> : null}
                  </div>

                  <p className="mt-3 text-[11px] text-ink-4">
                    {relativeTime(n.updated_at)}
                  </p>
                </button>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Edit note" : "New note"}
        width="lg"
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
          <Input
            autoFocus
            value={draft.title ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="Title"
            className="h-11 border-0 px-0 text-[18px] font-medium focus:ring-0"
          />
          <Textarea
            rows={12}
            value={draft.content ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
            placeholder="Write it down…"
            className="border-0 px-0 text-[13.5px] focus:ring-0"
          />

          <div className="grid gap-3 border-t border-line pt-4 sm:grid-cols-3">
            <Field label="Tags" hint="comma separated">
              <Input
                value={tagsValue}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    tags: e.target.value
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  }))
                }
                placeholder="brief, pricing"
              />
            </Field>
            <Field label="Client">
              <Select
                value={draft.client_id ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, client_id: e.target.value || null }))
                }
              >
                <option value="">None</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Project">
              <Select
                value={draft.project_id ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, project_id: e.target.value || null }))
                }
              >
                <option value="">None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      </Modal>
    </>
  );
}
