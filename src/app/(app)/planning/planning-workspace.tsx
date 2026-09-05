"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarRange,
  Check,
  LayoutList,
  Plus,
  Target,
  Trash2,
} from "lucide-react";
import { Kanban } from "./kanban";
import { Modal } from "@/components/overlays";
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
import { CreateDialog } from "@/components/create-dialog";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useServerState } from "@/lib/use-server-state";
import { cn } from "@/lib/utils";
import {
  PRIORITY_ACCENT,
  PRIORITY_LABEL,
  type Board,
  type BoardColumn,
  type Goal,
  type Profile,
  type Project,
  type Task,
} from "@/lib/types";

type Tab = "board" | "week" | "goals";

const DEFAULT_COLUMNS = [
  { name: "Backlog", accent: "indigo" },
  { name: "This week", accent: "amber" },
  { name: "Doing", accent: "clay" },
  { name: "Done", accent: "sage" },
] as const;

const GOAL_ACCENT = {
  on_track: "sage",
  at_risk: "amber",
  behind: "rose",
  done: "indigo",
} as const;

/* ------------------------------------------------------------ week view */

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function bucketFor(due: string | null) {
  if (!due) return "someday";
  const today = startOfDay(new Date());
  const d = startOfDay(new Date(due));
  const days = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days <= 7) return "week";
  return "later";
}

const BUCKETS = [
  { key: "overdue", label: "Overdue", accent: "rose" },
  { key: "today", label: "Today", accent: "clay" },
  { key: "tomorrow", label: "Tomorrow", accent: "amber" },
  { key: "week", label: "Rest of the week", accent: "indigo" },
  { key: "later", label: "Later", accent: "plum" },
  { key: "someday", label: "No date", accent: "sage" },
] as const;

function WeekView({
  tasks,
  profiles,
  projects,
  onToggle,
}: {
  tasks: Task[];
  profiles: Profile[];
  projects: Project[];
  onToggle: (t: Task) => void;
}) {
  const open = tasks.filter((t) => t.status !== "done");

  return (
    <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
      {BUCKETS.map((b) => {
        const rows = open.filter((t) => bucketFor(t.due_date) === b.key);
        return (
          <Card key={b.key} className="flex flex-col">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: `var(--${b.accent})` }}
              />
              <h3 className="text-[13px]">{b.label}</h3>
              <span className="ml-auto rounded-full bg-surface-sunk px-1.5 text-[10.5px] font-semibold tabular-nums text-ink-3">
                {rows.length}
              </span>
            </div>

            {rows.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12px] text-ink-4">Clear</p>
            ) : (
              <ul className="divide-y divide-line">
                {rows.map((t) => {
                  const project = projects.find((p) => p.id === t.project_id);
                  const assignee = profiles.find((p) => p.id === t.assignee_id);
                  return (
                    <li
                      key={t.id}
                      className="flex items-start gap-2.5 px-4 py-2.5 transition-colors hover:bg-surface-2"
                    >
                      <button
                        onClick={() => onToggle(t)}
                        aria-label="Mark done"
                        className="mt-0.5 grid h-[17px] w-[17px] shrink-0 place-items-center rounded-[5px] border border-line-strong transition-colors hover:border-[var(--sage)] hover:text-[var(--sage)]"
                      >
                        <Check size={11} strokeWidth={3} className="opacity-0 hover:opacity-100" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] leading-snug text-ink">{t.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {project ? (
                            <span className="flex items-center gap-1 text-[11px] text-ink-4">
                              <span
                                className="h-1.5 w-1.5 rounded-sm"
                                style={{ background: `var(--${project.accent})` }}
                              />
                              {project.name}
                            </span>
                          ) : null}
                          {t.priority !== "medium" ? (
                            <Badge accent={PRIORITY_ACCENT[t.priority]}>
                              {PRIORITY_LABEL[t.priority]}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      {assignee ? (
                        <Avatar
                          name={assignee.full_name}
                          accent={assignee.accent}
                          size="xs"
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- goals */

function GoalsView({
  goals,
  setGoals,
  creating,
  setCreating,
}: {
  goals: Goal[];
  setGoals: React.Dispatch<React.SetStateAction<Goal[]>>;
  creating: boolean;
  setCreating: (v: boolean) => void;
}) {
  const sb = supabaseBrowser();
  const [draft, setDraft] = useState<Partial<Goal>>({
    title: "",
    target_value: 100,
    current_value: 0,
    period: "quarter",
  });

  const create = async () => {
    if (!draft.title?.trim()) return toast.error("Give the goal a name.");
    const { data, error } = await sb
      .from("goals")
      .insert({
        title: draft.title,
        description: draft.description || null,
        metric: draft.metric || "count",
        target_value: Number(draft.target_value ?? 100),
        current_value: Number(draft.current_value ?? 0),
        period: draft.period ?? "quarter",
      })
      .select("*")
      .single();
    if (error) return toast.error(error.message);
    setGoals((g) => [data as Goal, ...g]);
    setCreating(false);
    setDraft({ title: "", target_value: 100, current_value: 0, period: "quarter" });
  };

  const bump = async (goal: Goal, value: number) => {
    const next = Math.max(0, value);
    const status: Goal["status"] =
      next >= goal.target_value
        ? "done"
        : next >= goal.target_value * 0.6
          ? "on_track"
          : next >= goal.target_value * 0.3
            ? "at_risk"
            : "behind";
    setGoals((rows) =>
      rows.map((g) => (g.id === goal.id ? { ...g, current_value: next, status } : g)),
    );
    await sb.from("goals").update({ current_value: next, status }).eq("id", goal.id);
  };

  const remove = async (id: string) => {
    setGoals((rows) => rows.filter((g) => g.id !== id));
    await sb.from("goals").delete().eq("id", id);
  };

  return (
    <>
      {goals.length === 0 ? (
        <EmptyState
          icon={<Target size={19} />}
          title="No goals set"
          description="Set a target for the quarter: revenue, new clients, projects shipped. Anything you can count."
          action={
            <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
              <Plus size={14} />
              Add your first goal
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {goals.map((g) => {
            const pct = g.target_value
              ? Math.min(100, Math.round((g.current_value / g.target_value) * 100))
              : 0;
            return (
              <Card key={g.id} className="group p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium text-ink">{g.title}</p>
                    <p className="mt-0.5 text-[11.5px] uppercase tracking-wider text-ink-4">
                      {g.period}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge accent={GOAL_ACCENT[g.status]} dot>
                      {g.status.replace("_", " ")}
                    </Badge>
                    <button
                      onClick={() => remove(g.id)}
                      aria-label="Delete goal"
                      className="text-ink-4 opacity-0 transition-opacity hover:text-[var(--rose)] group-hover:opacity-100"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {g.description ? (
                  <p className="mt-2 line-clamp-2 text-[12.5px] text-ink-3">
                    {g.description}
                  </p>
                ) : null}

                <div className="mt-4">
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="font-display text-[20px] leading-none tabular-nums text-ink">
                      {g.current_value.toLocaleString()}
                      <span className="text-[13px] text-ink-4">
                        {" "}
                        / {g.target_value.toLocaleString()}
                      </span>
                    </span>
                    <span className="text-[12px] tabular-nums text-ink-3">{pct}%</span>
                  </div>
                  <Progress value={pct} accent={GOAL_ACCENT[g.status]} />
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Input
                    type="number"
                    value={g.current_value}
                    onChange={(e) => bump(g, Number(e.target.value))}
                    className="h-8 flex-1"
                  />
                  <span className="text-[11.5px] text-ink-4">{g.metric}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New goal"
        description="Something countable you want to hit this period."
        footer={
          <>
            <Button onClick={() => setCreating(false)}>Cancel</Button>
            <Button variant="primary" onClick={create}>
              Create goal
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Goal" required>
            <Input
              autoFocus
              value={draft.title ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Close $40k in new business"
            />
          </Field>
          <Field label="Why it matters" hint="optional">
            <Textarea
              rows={2}
              value={draft.description ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Target">
              <Input
                type="number"
                value={draft.target_value ?? 100}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, target_value: Number(e.target.value) }))
                }
              />
            </Field>
            <Field label="Unit">
              <Input
                value={draft.metric ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, metric: e.target.value }))}
                placeholder="dollars"
              />
            </Field>
            <Field label="Period">
              <Select
                value={draft.period ?? "quarter"}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, period: e.target.value as Goal["period"] }))
                }
              >
                <option value="week">Week</option>
                <option value="month">Month</option>
                <option value="quarter">Quarter</option>
                <option value="year">Year</option>
              </Select>
            </Field>
          </div>
        </div>
      </Modal>
    </>
  );
}

/* ----------------------------------------------------------- workspace */

export function PlanningWorkspace({
  initialBoards,
  initialColumns,
  initialTasks,
  initialGoals,
  profiles,
  projects,
}: {
  initialBoards: Board[];
  initialColumns: BoardColumn[];
  initialTasks: Task[];
  initialGoals: Goal[];
  profiles: Profile[];
  projects: Project[];
}) {
  const sb = supabaseBrowser();

  const [tab, setTab] = useState<Tab>("board");
  const [boards, setBoards] = useServerState(initialBoards);
  const [columns, setColumns] = useServerState(initialColumns);
  const [tasks, setTasks] = useServerState(initialTasks);
  const [goals, setGoals] = useServerState(initialGoals);
  const [boardId, setBoardId] = useState<string | null>(initialBoards[0]?.id ?? null);
  const [creatingBoard, setCreatingBoard] = useState(false);
  const [boardName, setBoardName] = useState("");
  const [creatingGoal, setCreatingGoal] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);

  const board = boards.find((b) => b.id === boardId) ?? boards[0] ?? null;

  const openCount = useMemo(
    () => tasks.filter((t) => t.status !== "done").length,
    [tasks],
  );

  const createBoard = async () => {
    const name = boardName.trim() || "Untitled board";
    const { data, error } = await sb
      .from("boards")
      .insert({ name, position: boards.length })
      .select("*")
      .single();
    if (error) return toast.error(error.message);

    const newBoard = data as Board;
    const { data: cols } = await sb
      .from("board_columns")
      .insert(
        DEFAULT_COLUMNS.map((c, i) => ({
          board_id: newBoard.id,
          name: c.name,
          accent: c.accent,
          position: i,
        })),
      )
      .select("*");

    setBoards((b) => [...b, newBoard]);
    setColumns((c) => [...c, ...((cols ?? []) as BoardColumn[])]);
    setBoardId(newBoard.id);
    setBoardName("");
    setCreatingBoard(false);
    toast.success(`Board "${name}" created`);
  };

  const deleteBoard = async (id: string) => {
    setBoards((b) => b.filter((x) => x.id !== id));
    setColumns((c) => c.filter((x) => x.board_id !== id));
    setTasks((t) => t.filter((x) => x.board_id !== id));
    setBoardId((current) => (current === id ? null : current));
    await sb.from("boards").delete().eq("id", id);
  };

  const toggleTask = async (task: Task) => {
    const next = task.status === "done" ? "todo" : "done";
    setTasks((rows) =>
      rows.map((t) => (t.id === task.id ? { ...t, status: next } : t)),
    );
    await sb
      .from("tasks")
      .update({
        status: next,
        completed_at: next === "done" ? new Date().toISOString() : null,
      })
      .eq("id", task.id);
  };

  return (
    <>
      <PageHeader
        eyebrow="Delivery"
        title="Planning"
        description={`${openCount} open ${openCount === 1 ? "task" : "tasks"} across your boards.`}
        actions={
          <>
            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                { value: "board", label: "Boards" },
                { value: "week", label: "My week" },
                { value: "goals", label: "Goals", count: goals.length },
              ]}
            />
            {/* The button creates whatever the open tab is about. */}
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                if (tab === "goals") setCreatingGoal(true);
                else if (tab === "board") setCreatingBoard(true);
                else setCreatingTask(true);
              }}
            >
              <Plus size={14} />
              New
            </Button>
          </>
        }
      />

      {tab === "board" ? (
        boards.length === 0 ? (
          <EmptyState
            icon={<LayoutList size={19} />}
            title="No boards yet"
            description="A board is a kanban for one stream of work: a launch, a client, or your own week."
            action={
              <Button variant="primary" size="sm" onClick={() => setCreatingBoard(true)}>
                <Plus size={14} />
                Create a board
              </Button>
            }
          />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-1.5">
              {boards.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setBoardId(b.id)}
                  onDoubleClick={() => deleteBoard(b.id)}
                  title="Double-click to delete"
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] font-medium transition-all",
                    b.id === boardId
                      ? "border-[var(--clay)] bg-[var(--clay-soft)] text-[var(--clay)]"
                      : "border-line bg-surface text-ink-3 hover:border-line-2 hover:text-ink",
                  )}
                >
                  <span>{b.emoji ?? "🗂️"}</span>
                  {b.name}
                </button>
              ))}
              <button
                onClick={() => setCreatingBoard(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed border-line-2 px-2.5 text-[12.5px] text-ink-4 transition-colors hover:border-[var(--clay)] hover:text-[var(--clay)]"
              >
                <Plus size={13} />
                Board
              </button>
            </div>

            {board ? (
              <Kanban
                board={board}
                columns={columns}
                tasks={tasks}
                profiles={profiles}
                projects={projects}
                setColumns={setColumns}
                setTasks={setTasks}
              />
            ) : null}
          </>
        )
      ) : null}

      {tab === "week" ? (
        tasks.length === 0 ? (
          <EmptyState
            icon={<CalendarRange size={19} />}
            title="Nothing planned"
            description="Tasks from every board and project land here, grouped by when they are due."
          />
        ) : (
          <WeekView
            tasks={tasks}
            profiles={profiles}
            projects={projects}
            onToggle={toggleTask}
          />
        )
      ) : null}

      {tab === "goals" ? (
        <GoalsView
          goals={goals}
          setGoals={setGoals}
          creating={creatingGoal}
          setCreating={setCreatingGoal}
        />
      ) : null}

      <CreateDialog
        open={creatingTask}
        onClose={() => setCreatingTask(false)}
        only="task"
        onCreated={(row) => setTasks((rows) => [row as unknown as Task, ...rows])}
      />

      <Modal
        open={creatingBoard}
        onClose={() => setCreatingBoard(false)}
        title="New board"
        description="It starts with Backlog, This week, Doing and Done. Rename or add columns any time."
        width="sm"
        footer={
          <>
            <Button onClick={() => setCreatingBoard(false)}>Cancel</Button>
            <Button variant="primary" onClick={createBoard}>
              Create board
            </Button>
          </>
        }
      >
        <Field label="Board name" required>
          <Input
            autoFocus
            value={boardName}
            onChange={(e) => setBoardName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createBoard()}
            placeholder="Q1 launch"
          />
        </Field>
      </Modal>
    </>
  );
}
