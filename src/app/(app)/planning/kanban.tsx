"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { Calendar, Plus, Trash2, X } from "lucide-react";
import { Avatar, Badge, Button, Input, Select } from "@/components/ui";
import { Modal } from "@/components/overlays";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn, LOCALE } from "@/lib/utils";
import {
  PRIORITY_ACCENT,
  PRIORITY_LABEL,
  type Board,
  type BoardColumn,
  type Priority,
  type Profile,
  type Project,
  type Task,
} from "@/lib/types";

const ACCENTS = ["clay", "amber", "sage", "indigo", "plum", "rose"] as const;

/* ------------------------------------------------------------------ card */

function TaskCard({
  task,
  profiles,
  projects,
  onOpen,
  floating,
}: {
  task: Task;
  profiles: Profile[];
  projects: Project[];
  onOpen: () => void;
  floating?: boolean;
}) {
  const assignee = profiles.find((p) => p.id === task.assignee_id);
  const project = projects.find((p) => p.id === task.project_id);
  const overdue =
    task.due_date && new Date(task.due_date) < new Date(new Date().toDateString());

  return (
    <div
      onClick={onOpen}
      className={cn(
        "rounded-lg border border-line bg-surface p-2.5 shadow-soft transition-all",
        "hover:border-line-2 hover:shadow-raised",
        floating && "rotate-2 shadow-float",
      )}
    >
      <p className="text-[13px] leading-snug text-ink">{task.title}</p>

      {project ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-ink-4">
          <span
            className="h-2 w-2 rounded-sm"
            style={{ background: `var(--${project.accent})` }}
          />
          {project.name}
        </p>
      ) : null}

      {(task.labels ?? []).length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.labels.map((l) => (
            <span
              key={l}
              className="rounded bg-surface-sunk px-1.5 py-0.5 text-[10.5px] text-ink-3"
            >
              {l}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-2.5 flex items-center gap-2">
        {task.priority !== "medium" ? (
          <Badge accent={PRIORITY_ACCENT[task.priority]}>
            {PRIORITY_LABEL[task.priority]}
          </Badge>
        ) : null}
        {task.due_date ? (
          <span
            className={cn(
              "flex items-center gap-1 text-[11px]",
              overdue ? "text-[var(--rose)]" : "text-ink-4",
            )}
          >
            <Calendar size={11} />
            {new Date(task.due_date).toLocaleDateString(LOCALE, {
              month: "short",
              day: "numeric",
            })}
          </span>
        ) : null}
        {assignee ? (
          <Avatar
            name={assignee.full_name}
            src={assignee.avatar_url}
            accent={assignee.accent}
            size="xs"
            className="ml-auto"
          />
        ) : null}
      </div>
    </div>
  );
}

function DraggableTask(props: Parameters<typeof TaskCard>[0]) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: props.task.id,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "cursor-grab touch-none select-none active:cursor-grabbing",
        isDragging && "opacity-35",
      )}
    >
      <TaskCard {...props} />
    </div>
  );
}

/* ---------------------------------------------------------------- column */

function KanbanColumn({
  column,
  tasks,
  profiles,
  projects,
  onOpenTask,
  onAdd,
  onRename,
  onDelete,
}: {
  column: BoardColumn;
  tasks: Task[];
  profiles: Profile[];
  projects: Project[];
  onOpenTask: (t: Task) => void;
  onAdd: (columnId: string, title: string) => void;
  onRename: (columnId: string, name: string) => void;
  onDelete: (columnId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(column.name);

  const submit = () => {
    const t = value.trim();
    if (t) onAdd(column.id, t);
    setValue("");
    setAdding(false);
  };

  return (
    <div className="flex w-[280px] shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: `var(--${column.accent})` }}
        />
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              setEditing(false);
              if (name.trim() && name !== column.name) onRename(column.id, name.trim());
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="min-w-0 flex-1 rounded border border-line bg-surface px-1.5 py-0.5 text-[12.5px] font-semibold text-ink outline-none"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-[12.5px] font-semibold text-ink hover:underline"
          >
            {column.name}
          </button>
        )}
        <span className="rounded-full bg-surface-sunk px-1.5 text-[10.5px] font-semibold tabular-nums text-ink-3">
          {tasks.length}
        </span>
        <button
          onClick={() => onDelete(column.id)}
          aria-label="Delete column"
          className="ml-auto text-ink-4 opacity-0 transition-opacity hover:text-[var(--rose)] group-hover/board:opacity-100"
        >
          <X size={13} />
        </button>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 rounded-lg border border-dashed p-2 transition-colors",
          isOver ? "border-[var(--clay)] bg-[var(--clay-soft)]" : "border-line bg-surface-2/40",
        )}
      >
        {tasks.map((t) => (
          <DraggableTask
            key={t.id}
            task={t}
            profiles={profiles}
            projects={projects}
            onOpen={() => onOpenTask(t)}
          />
        ))}

        {adding ? (
          <div className="rounded-lg border border-line bg-surface p-2">
            <textarea
              autoFocus
              rows={2}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
                if (e.key === "Escape") setAdding(false);
              }}
              placeholder="What needs doing?"
              className="w-full resize-none bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-4"
            />
            <div className="mt-1.5 flex gap-1.5">
              <Button size="sm" variant="primary" onClick={submit}>
                Add
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[12.5px] text-ink-4 transition-colors hover:bg-surface hover:text-ink"
          >
            <Plus size={13} />
            Add task
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- board */

export function Kanban({
  board,
  columns,
  tasks,
  profiles,
  projects,
  setColumns,
  setTasks,
}: {
  board: Board;
  columns: BoardColumn[];
  tasks: Task[];
  profiles: Profile[];
  projects: Project[];
  setColumns: React.Dispatch<React.SetStateAction<BoardColumn[]>>;
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
}) {
  const sb = supabaseBrowser();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Task | null>(null);
  const [draft, setDraft] = useState<Partial<Task>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const boardColumns = columns.filter((c) => c.board_id === board.id);

  const addColumn = async () => {
    const { data, error } = await sb
      .from("board_columns")
      .insert({
        board_id: board.id,
        name: "New column",
        position: boardColumns.length,
        accent: ACCENTS[boardColumns.length % ACCENTS.length],
      })
      .select("*")
      .single();
    if (error) return toast.error(error.message);
    setColumns((c) => [...c, data as BoardColumn]);
  };

  const renameColumn = async (id: string, name: string) => {
    setColumns((c) => c.map((x) => (x.id === id ? { ...x, name } : x)));
    await sb.from("board_columns").update({ name }).eq("id", id);
  };

  const deleteColumn = async (id: string) => {
    setColumns((c) => c.filter((x) => x.id !== id));
    setTasks((t) => t.filter((x) => x.column_id !== id));
    await sb.from("board_columns").delete().eq("id", id);
  };

  const addTask = async (columnId: string, title: string) => {
    const count = tasks.filter((t) => t.column_id === columnId).length;
    const { data, error } = await sb
      .from("tasks")
      .insert({ title, board_id: board.id, column_id: columnId, position: count })
      .select("*")
      .single();
    if (error) return toast.error(error.message);
    setTasks((t) => [...t, data as Task]);
  };

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const id = String(e.active.id);
    const columnId = e.over?.id ? String(e.over.id) : null;
    if (!columnId) return;

    const task = tasks.find((t) => t.id === id);
    if (!task || task.column_id === columnId) return;

    const previous = tasks;
    setTasks((rows) => rows.map((t) => (t.id === id ? { ...t, column_id: columnId } : t)));

    const { error } = await sb.from("tasks").update({ column_id: columnId }).eq("id", id);
    if (error) {
      setTasks(previous);
      toast.error(error.message);
    }
  };

  const saveTask = async () => {
    if (!selected) return;
    const patch = {
      title: draft.title,
      notes: draft.notes || null,
      priority: draft.priority,
      due_date: draft.due_date || null,
      assignee_id: draft.assignee_id || null,
      project_id: draft.project_id || null,
      status: draft.status,
    };
    const { error } = await sb.from("tasks").update(patch).eq("id", selected.id);
    if (error) return toast.error(error.message);
    setTasks((rows) =>
      rows.map((t) => (t.id === selected.id ? ({ ...t, ...patch } as Task) : t)),
    );
    setSelected(null);
    toast.success("Task saved");
  };

  const deleteTask = async () => {
    if (!selected) return;
    setTasks((rows) => rows.filter((t) => t.id !== selected.id));
    await sb.from("tasks").delete().eq("id", selected.id);
    setSelected(null);
  };

  const activeTask = tasks.find((t) => t.id === activeId);
  const set = <K extends keyof Task>(k: K, v: Task[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  return (
    <>
      {/* A stable id keeps dnd-kit's aria ids identical on server and client. */}
      <DndContext
        id="planning-board"
        sensors={sensors}
        onDragStart={(e) => setActiveId(String(e.active.id))}
        onDragEnd={onDragEnd}
        // The board scrolls sideways, so re-measure the columns while dragging.
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      >
        <div className="group/board -mx-1 flex gap-3 overflow-x-auto px-1 pb-4">
          {boardColumns.map((c) => (
            <KanbanColumn
              key={c.id}
              column={c}
              tasks={tasks.filter((t) => t.column_id === c.id)}
              profiles={profiles}
              projects={projects}
              onOpenTask={(t) => {
                setSelected(t);
                setDraft(t);
              }}
              onAdd={addTask}
              onRename={renameColumn}
              onDelete={deleteColumn}
            />
          ))}

          <button
            onClick={addColumn}
            className="flex h-10 w-[200px] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-dashed border-line-2 text-[12.5px] text-ink-4 transition-colors hover:border-[var(--clay)] hover:text-[var(--clay)]"
          >
            <Plus size={14} />
            Add column
          </button>
        </div>

        {/* dnd-kit sizes the overlay to the dragged card; a fixed width here
            would offset it from the cursor. dnd-kit's DragOverlay does not
            portal itself, so it renders in place in the tree and the page's
            entrance-animation ancestor (a CSS transform) hijacks its fixed
            positioning mid-drag. Portaling it to <body> ourselves fixes it. */}
        {typeof document !== "undefined"
          ? createPortal(
              <DragOverlay dropAnimation={null}>
                {activeTask ? (
                  <TaskCard
                    task={activeTask}
                    profiles={profiles}
                    projects={projects}
                    onOpen={() => {}}
                    floating
                  />
                ) : null}
              </DragOverlay>,
              document.body,
            )
          : null}
      </DndContext>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Task"
        footer={
          <>
            <Button variant="ghost" onClick={deleteTask} className="mr-auto text-[var(--rose)]">
              <Trash2 size={14} />
              Delete
            </Button>
            <Button onClick={() => setSelected(null)}>Cancel</Button>
            <Button variant="primary" onClick={saveTask}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            value={draft.title ?? ""}
            onChange={(e) => set("title", e.target.value)}
            className="h-11 text-[15px]"
          />
          <textarea
            rows={4}
            value={draft.notes ?? ""}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Details, links, acceptance criteria…"
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-[13px] leading-relaxed text-ink outline-none placeholder:text-ink-4 focus:border-[var(--clay)]"
          />

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-ink-2">Priority</span>
              <Select
                value={draft.priority ?? "medium"}
                onChange={(e) => set("priority", e.target.value as Priority)}
              >
                {(["low", "medium", "high", "urgent"] as Priority[]).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-ink-2">Due</span>
              <Input
                type="date"
                value={draft.due_date ?? ""}
                onChange={(e) => set("due_date", e.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-ink-2">Assignee</span>
              <Select
                value={draft.assignee_id ?? ""}
                onChange={(e) => set("assignee_id", e.target.value || null)}
              >
                <option value="">Unassigned</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-ink-2">Project</span>
              <Select
                value={draft.project_id ?? ""}
                onChange={(e) => set("project_id", e.target.value || null)}
              >
                <option value="">None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        </div>
      </Modal>
    </>
  );
}
